import type { NowPlaying } from '../types';

const MIN_REFRESH = 15_000;
const MAX_REFRESH = 10 * 60_000;

export const clampRefresh = (ms: number): number => Math.min(MAX_REFRESH, Math.max(MIN_REFRESH, ms));

/** Next poll: the API hint, but never later than the end of the current item. */
export function refreshDelay(hint: number, end: number | undefined, now: number): number {
  const untilEnd = end !== undefined ? end - now + 3_000 : Number.POSITIVE_INFINITY;
  return clampRefresh(Math.min(hint, untilEnd));
}

/**
 * The answer does not have the shape this normalizer knows: the API has changed. Normalizers
 * return `null` instead when the shape is right but there is nothing to show (an air break).
 */
export class UnknownFormat extends Error {
  override readonly name = 'UnknownFormat';
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** Same title as broadcast, whatever the capitals: "Le Journal" repeats "Le journal". */
const sameTitle = (a: string, b: string): boolean => a.localeCompare(b, 'fr', { sensitivity: 'accent' }) === 0;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const SONG_SEPARATOR = ' • ';

function splitSong(line: string): { artist?: string; title: string } {
  const at = line.indexOf(SONG_SEPARATOR);
  if (at < 0) return { title: line };
  return { artist: line.slice(0, at).trim() || undefined, title: line.slice(at + SONG_SEPARATOR.length).trim() };
}

export const radioFranceCover = (uuid: string): string => `https://www.radiofrance.fr/pikapi/images/${uuid}/400x400`;

interface RfItem {
  title: string;
  subtitle?: string;
  kind: NowPlaying['kind'];
  cover?: string;
  start?: number;
  end?: number;
}

function rfItem(raw: unknown): RfItem | undefined {
  if (!isRecord(raw)) return undefined;
  const first = str(raw.firstLine);
  const second = str(raw.secondLine);
  const startS = num(raw.startTime);
  const endS = num(raw.endTime);
  const cover = str(raw.cover);
  const base = {
    cover: cover ? radioFranceCover(cover) : undefined,
    start: startS !== undefined ? startS * 1000 : undefined,
    end: endS !== undefined ? endS * 1000 : undefined,
  };
  if (second && str(raw.secondLineSongUuid)) {
    const song = splitSong(second);
    return { ...base, kind: 'song', title: song.title, subtitle: song.artist };
  }
  if (first === 'Le direct' && second) return { ...base, kind: 'program', title: second };
  if (startS === undefined && endS === undefined) {
    // Webradios outside a song: the API sends the station description.
    return second ? { ...base, kind: 'about', title: second } : undefined;
  }
  if (!first) return second ? { ...base, kind: 'program', title: second } : undefined;
  // Shows titled with an ellipsis ("La radio de...") name each episode in full ("La radio de Noor").
  const stem = first.replace(/\s*(?:\.\.\.|…)$/, '');
  if (second && stem !== first && second.startsWith(stem)) return { ...base, kind: 'program', title: second };
  const subtitle = second && second !== first && !second.startsWith('Le direct') ? second : undefined;
  return { ...base, kind: 'program', title: first, subtitle };
}

/** `https://api.radiofrance.fr/livemeta/live/{id}/{rules}` */
export function normalizeRadioFrance(json: unknown, now: number): NowPlaying | null {
  if (!isRecord(json) || !isRecord(json.now)) throw new UnknownFormat('no "now" item');
  if (!('firstLine' in json.now) && !('secondLine' in json.now)) throw new UnknownFormat('"now" has no firstLine or secondLine');
  const current = rfItem(json.now);
  if (!current) return null;
  // A show aired in parts lists its next part as what follows; announce the next different programme.
  const continues = (item: RfItem): boolean =>
    current.kind === 'program' && item.kind === 'program' && sameTitle(item.title, current.title);
  const nextRaw = Array.isArray(json.next)
    ? json.next.map(rfItem).find((item) => item && item.kind !== 'about' && !continues(item))
    : undefined;
  // Parts of a show carry the whole show's slot: a start before the programme on air ends is not when they air.
  const nextStart = nextRaw?.start !== undefined && nextRaw.start >= (current.end ?? now) ? nextRaw.start : undefined;
  const hint = num(json.delayToRefresh) ?? 60_000;
  return {
    ...current,
    next: nextRaw ? { title: nextRaw.title, subtitle: nextRaw.subtitle, start: nextStart } : undefined,
    refreshIn: current.kind === 'about' ? 60_000 : refreshDelay(hint, current.end, now),
  };
}

/** `https://api.kexp.org/v2/plays/?format=json&limit=1` */
export function normalizeKexp(json: unknown): NowPlaying | null {
  if (!isRecord(json) || !Array.isArray(json.results)) throw new UnknownFormat('no "results" list');
  const play: unknown = json.results[0];
  // Air breaks: the host is talking.
  if (!isRecord(play) || play.play_type !== 'trackplay') return null;
  if (!('song' in play)) throw new UnknownFormat('a track play without "song"');
  const title = str(play.song);
  if (!title) return null;
  const airdate = str(play.airdate);
  const start = airdate ? Date.parse(airdate) : Number.NaN;
  return {
    kind: 'song',
    title,
    subtitle: str(play.artist),
    cover: str(play.image_uri) ?? str(play.thumbnail_uri),
    start: Number.isFinite(start) ? start : undefined,
    refreshIn: 30_000,
  };
}

/** `https://somafm.com/songs/{channel}.json` */
export function normalizeSomaFm(json: unknown): NowPlaying | null {
  if (!isRecord(json) || !Array.isArray(json.songs)) throw new UnknownFormat('no "songs" list');
  const song: unknown = json.songs[0];
  if (!isRecord(song)) return null;
  if (!('title' in song)) throw new UnknownFormat('a song without "title"');
  const title = str(song.title);
  if (!title) return null;
  const date = Number(song.date);
  return {
    kind: 'song',
    title,
    subtitle: str(song.artist),
    cover: str(song.albumArt),
    start: Number.isFinite(date) && date > 0 ? date * 1000 : undefined,
    refreshIn: 30_000,
  };
}

function ntsBroadcast(raw: unknown): { title: string; place?: string; cover?: string; start?: number; end?: number } | undefined {
  if (!isRecord(raw)) return undefined;
  const title = str(raw.broadcast_title);
  if (!title) return undefined;
  const details = isRecord(raw.embeds) && isRecord(raw.embeds.details) ? raw.embeds.details : undefined;
  const media = details && isRecord(details.media) ? details.media : undefined;
  const start = Date.parse(str(raw.start_timestamp) ?? '');
  const end = Date.parse(str(raw.end_timestamp) ?? '');
  return {
    title: decodeEntities(title),
    place: details ? str(details.location_long) : undefined,
    cover: media ? (str(media.picture_medium_large) ?? str(media.picture_medium)) : undefined,
    start: Number.isFinite(start) ? start : undefined,
    end: Number.isFinite(end) ? end : undefined,
  };
}

/** `https://www.nts.live/api/v2/live` */
export function normalizeNts(json: unknown, channel: '1' | '2', now: number): NowPlaying | null {
  if (!isRecord(json) || !Array.isArray(json.results)) throw new UnknownFormat('no "results" list');
  const entry: unknown = json.results.find((r: unknown) => isRecord(r) && r.channel_name === channel);
  if (!isRecord(entry)) throw new UnknownFormat(`no channel ${channel}`);
  if (!isRecord(entry.now)) throw new UnknownFormat(`no "now" broadcast on channel ${channel}`);
  const current = ntsBroadcast(entry.now);
  if (!current) return null;
  const next = ntsBroadcast(entry.next);
  return {
    kind: 'program',
    title: current.title,
    subtitle: current.place,
    cover: current.cover,
    start: current.start,
    end: current.end,
    next: next ? { title: next.title, start: next.start } : undefined,
    refreshIn: refreshDelay(5 * 60_000, current.end, now),
  };
}
