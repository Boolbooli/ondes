import { LIVE_SLACK, type PlaybackStatus } from '../core/audio-engine';
import { formatTime, localize, type Dictionary } from '../core/i18n';
import type { Lang, NowPlaying, Station, StreamSource } from '../core/types';

/** What is on air, in a few words: the song and its artist, or the programme, else the station's tagline. */
export function onAirTitle(station: Station, np: NowPlaying | null, lang: Lang): string {
  if (!np) return localize(station.tagline, lang);
  if (np.kind === 'song') return np.subtitle ? `${np.title} · ${np.subtitle}` : np.title;
  return np.title;
}

/** What a stop shows under its name: what is on air, and when a programme ends. */
export function onAirText(station: Station, np: NowPlaying | null, lang: Lang, t: Dictionary): string {
  const title = onAirTitle(station, np, lang);
  return np?.kind === 'program' && np.end ? `${title} · ${t.until(formatTime(np.end, lang))}` : title;
}

export const behindMinutes = (seconds: number): number => Math.max(1, Math.round(seconds / 60));

/** The status word on the amber board and in the dock. */
export function ledWord(status: PlaybackStatus, behind: number, t: Dictionary): string {
  if (status === 'playing') return behind >= LIVE_SLACK ? t.led.behind : t.led.live;
  return t.led[status];
}

/** The long status shown on the current stop of the map. */
export function stopStatus(status: PlaybackStatus, behind: number, t: Dictionary): string {
  if (status === 'playing' && behind >= LIVE_SLACK) return t.behind(behindMinutes(behind));
  return t.status[status];
}

/** Share of the programme already aired, when its times are known. */
export function showProgress(np: NowPlaying | null, now: number): number | null {
  if (!np?.start || !np.end || np.end <= np.start) return null;
  return Math.min(1, Math.max(0, (now - np.start) / (np.end - np.start)));
}

export function describeStream(source: StreamSource | undefined): string {
  if (!source) return '';
  const parts = [source.kind === 'hls' ? 'HLS' : 'Icecast'];
  const codec = [source.codec, source.bitrate ? `${source.bitrate} kbit/s` : ''].filter(Boolean).join(' ');
  if (codec) parts.push(codec);
  return parts.join(' · ');
}

/** Lower-case, accent-free text for matching what people type. */
export const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
