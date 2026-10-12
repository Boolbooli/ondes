/**
 * Checks every catalogue stream the way the iPhone reaches it, and the catalogue's claims:
 *  - HLS: the playlist, its first variant, a live segment list and the newest segment's audio;
 *  - Icecast: the redirect chain, the audio frames at the start of the stream, the bitrate;
 *  - rewind: the length of the timeshift playlist against `timeshift.window`;
 *  - now playing: the endpoint, its CORS header and the app's own normalizer;
 *  - advertising: ads inside the stream (proof), ad-insertion servers on the way (capability)
 *    and ad-break markers.
 *
 *   npm run check:streams                       every station, details for problems only
 *   npm run check:streams -- -v                 every check of every station
 *   npm run check:streams -- rtl europe1        some stations, every check
 *
 * Exits with 1 when a station has no working source; warnings never fail the run.
 */
import { appendFile } from 'node:fs/promises';
import { UnknownFormat } from '../src/core/now-playing/normalize';
import { metaUrl, normalizeNowPlaying } from '../src/core/now-playing/poller';
import { isHlsUrl } from '../src/core/sources';
import type { NowPlaying, Station, StreamSource } from '../src/core/types';
import { lineById } from '../src/data/lines';
import { catalog } from '../src/data/stations';

const TIMEOUT = 15_000;
const CONCURRENCY = 6;
const MAX_REDIRECTS = 5;
/** Enough for several audio frames, little enough to leave a live stream at once. */
const AUDIO_SAMPLE = 16 * 1024;
const PLAYLIST_LIMIT = 4 * 1024 * 1024;
/** Streams are requested as Safari on iPhone does; metadata as the installed app does, cross-origin. */
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ORIGIN = 'https://ondes.example';

/**
 * Ad-insertion servers and their fingerprints in URLs and headers: ad-tech hosts, AdsWizz
 * parameters, and the session cookie of AdsWizz AIS. They show that a server can replace the
 * station's breaks, not that it does: listener-supported stations use the same hosting.
 */
const AD_SERVER =
  /adswizz|aw_0_|AISSessionId|listeningSessionID|adsrvr|adserver|doubleclick|imasdk|fwmrm|freewheel|spotx|targetspot|instreamatic/i;
/** Segment files named as ads: `/ad_0_….aac`, `/ads/…`, `/preroll-…`. Proof of inserted ads. */
const AD_SEGMENT = /(?:^|[/_.-])(?:ads?|preroll|midroll|postroll|adbreak)[/_.-]/i;
/** Playlist tags that mark ad breaks: cue tags, SCTE-35 and interstitials. */
const BREAK_TAG = /^#EXT(?:-X-CUE|-X-SCTE35|-OATCLS-SCTE35|-X-ASSET|-X-PLACEMENT-OPPORTUNITY)/;
const AD_DATERANGE = /SCTE35-(?:OUT|IN|CMD)|com\.apple\.hls\.interstitial|X-AD-/;

type Level = 'ok' | 'warn' | 'fail';

interface Probe {
  readonly playable: boolean;
  readonly level: Level;
  /** Problems first, then facts. */
  readonly notes: readonly string[];
  /** Ads found inside the stream. */
  readonly inserted: readonly string[];
  /** Ad-insertion servers met on the way. */
  readonly servers: readonly string[];
  /** Ad-break markers in the playlist. */
  readonly breaks: readonly string[];
  /** Seconds of audio listed by an HLS playlist. */
  readonly window?: number;
}

/** A condition that makes the source unplayable. */
class Dead extends Error {}

class Findings {
  readonly problems: string[] = [];
  readonly facts: string[] = [];
  readonly inserted = new Set<string>();
  readonly servers = new Set<string>();
  readonly breaks = new Set<string>();
  window?: number;

  result(error?: unknown): Probe {
    const notes = error === undefined ? [...this.problems, ...this.facts] : [reason(error), ...this.problems];
    return {
      playable: error === undefined,
      level: error !== undefined ? 'fail' : this.problems.length > 0 ? 'warn' : 'ok',
      notes,
      inserted: [...this.inserted],
      servers: [...this.servers],
      breaks: [...this.breaks],
      window: this.window,
    };
  }
}

function reason(error: unknown): string {
  if (error instanceof Dead) return error.message;
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return `no answer within ${TIMEOUT / 1000} s`;
    const cause = (error as { cause?: { code?: unknown; message?: unknown } }).cause;
    if (typeof cause?.code === 'string') return cause.code;
    if (typeof cause?.message === 'string') return cause.message;
    return error.message;
  }
  return String(error);
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function duration(seconds: number): string {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)} h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds)} s`;
}

const family = (codec: string): string | undefined => (/aac/i.test(codec) ? 'AAC' : /mp3/i.test(codec) ? 'MP3' : undefined);

// HTTP --------------------------------------------------------------------------------------

interface Hit {
  readonly response: Response;
  /** Every URL requested, redirects included; the answering one last. */
  readonly chain: readonly string[];
}

/** GET, following redirects one hop at a time so that every hop can be inspected. */
async function get(url: string, signal: AbortSignal, headers: Record<string, string> = {}): Promise<Hit> {
  const chain = [url];
  let current = url;
  for (;;) {
    const response = await fetch(current, {
      signal,
      redirect: 'manual',
      headers: { accept: '*/*', 'user-agent': USER_AGENT, ...headers },
    });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return { response, chain };
    await response.body?.cancel();
    if (chain.length > MAX_REDIRECTS) throw new Dead(`more than ${MAX_REDIRECTS} redirects`);
    current = new URL(location, current).href;
    chain.push(current);
  }
}

function expectOk(hit: Hit, what: string): void {
  if (hit.response.ok) return;
  void hit.response.body?.cancel();
  const via = hit.chain.length > 1 ? ` from ${host(hit.chain.at(-1) ?? '')}` : '';
  throw new Dead(`${what}: HTTP ${hit.response.status}${via}`);
}

/** Reads the start of a body, then lets go of it: live streams never end. */
async function readHead(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const allowsOrigin = (response: Response): boolean => {
  const allowed = response.headers.get('access-control-allow-origin');
  return allowed === '*' || allowed === ORIGIN;
};

/** Ad-insertion fingerprints met on the way: in the URLs requested and in the response headers. */
function noteAdServer(hit: Hit, found: Findings, what: string): void {
  for (const url of hit.chain) {
    const match = AD_SERVER.exec(url);
    if (match) found.servers.add(`${match[0]} (${what} URL)`);
  }
  hit.response.headers.forEach((value, name) => {
    const match = AD_SERVER.exec(`${name}: ${value}`);
    if (match) found.servers.add(`${match[0]} (${name})`);
  });
}

// Audio sniffing ----------------------------------------------------------------------------

type Format = 'ADTS' | 'MP3' | 'MPEG-TS' | 'fMP4' | 'Ogg' | 'FLAC';
const FORMAT_FAMILY: Partial<Record<Format, string>> = { ADTS: 'AAC', MP3: 'MP3' };

const byte = (b: Uint8Array, i: number): number => b[i] ?? 0;
const ascii = (b: Uint8Array, from: number, to: number): string => String.fromCharCode(...b.subarray(from, to));

/** Length of the ADTS (AAC) frame starting at `i`, 0 when there is none. */
function adtsFrame(b: Uint8Array, i: number): number {
  if (byte(b, i) !== 0xff || (byte(b, i + 1) & 0xf6) !== 0xf0) return 0;
  if (((byte(b, i + 2) >> 2) & 0x0f) > 12) return 0;
  const length = ((byte(b, i + 3) & 0x03) << 11) | (byte(b, i + 4) << 3) | (byte(b, i + 5) >> 5);
  return length > 7 ? length : 0;
}

const MP3_KBPS = [
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG-2 and 2.5
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG-1
] as const;
const MP3_RATES: Readonly<Record<number, readonly number[]>> = {
  0: [11025, 12000, 8000],
  2: [22050, 24000, 16000],
  3: [44100, 48000, 32000],
};

/** Length of the MPEG Layer III frame starting at `i`, 0 when there is none. */
function mp3Frame(b: Uint8Array, i: number): number {
  const b1 = byte(b, i + 1);
  const b2 = byte(b, i + 2);
  if (byte(b, i) !== 0xff || (b1 & 0xe0) !== 0xe0) return 0;
  const version = (b1 >> 3) & 3;
  if (version === 1 || ((b1 >> 1) & 3) !== 1) return 0;
  const mpeg1 = version === 3;
  const kbps = MP3_KBPS[mpeg1 ? 1 : 0][b2 >> 4];
  const rate = MP3_RATES[version]?.[(b2 >> 2) & 3];
  if (!kbps || !rate) return 0;
  return Math.floor(((mpeg1 ? 144_000 : 72_000) * kbps) / rate) + ((b2 >> 1) & 1);
}

/** True when three consecutive frames follow each other within the first few kilobytes. */
function hasFrames(b: Uint8Array, from: number, frame: (b: Uint8Array, i: number) => number): boolean {
  const last = Math.min(b.length, from + 8192);
  for (let i = from; i < last; i += 1) {
    let at = i;
    let count = 0;
    for (let length = frame(b, at); length > 0 && count < 3; length = frame(b, at)) {
      at += length;
      count += 1;
    }
    if (count >= 3) return true;
  }
  return false;
}

/** HLS packed audio starts with ID3 timestamp tags. */
function afterId3(b: Uint8Array): number {
  let at = 0;
  while (ascii(b, at, at + 3) === 'ID3') {
    const size =
      ((byte(b, at + 6) & 0x7f) << 21) |
      ((byte(b, at + 7) & 0x7f) << 14) |
      ((byte(b, at + 8) & 0x7f) << 7) |
      (byte(b, at + 9) & 0x7f);
    at += 10 + size + (byte(b, at + 5) & 0x10 ? 10 : 0);
  }
  return at;
}

function sniff(b: Uint8Array): Format | undefined {
  if (ascii(b, 0, 4) === 'OggS') return 'Ogg';
  if (ascii(b, 0, 4) === 'fLaC') return 'FLAC';
  if (['ftyp', 'styp', 'moof', 'sidx', 'emsg', 'prft'].includes(ascii(b, 4, 8))) return 'fMP4';
  if (byte(b, 0) === 0x47 && byte(b, 188) === 0x47) return 'MPEG-TS';
  const from = afterId3(b);
  if (hasFrames(b, from, adtsFrame)) return 'ADTS';
  if (hasFrames(b, from, mp3Frame)) return 'MP3';
  return undefined;
}

function noteAudio(bytes: Uint8Array, source: StreamSource, found: Findings, what: string): void {
  if (bytes.length === 0) throw new Dead(`${what}: empty`);
  const format = sniff(bytes);
  if (!format) throw new Dead(`${what}: no audio frames in the first ${Math.ceil(bytes.length / 1024)} KB`);
  found.facts.push(format);
  const declared = family(source.codec);
  const actual = FORMAT_FAMILY[format];
  if (declared && actual && declared !== actual) found.problems.push(`declared ${source.codec}, the stream is ${actual}`);
}

// Probes ------------------------------------------------------------------------------------

interface Variant {
  readonly uri: string;
  readonly bandwidth: number;
  readonly codecs?: string;
}

function attributes(list: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, key, value] of list.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    if (key && value !== undefined) map.set(key, value.replace(/^"|"$/g, ''));
  }
  return map;
}

const tagOf = (line: string): string => /^#[A-Z0-9-]+/.exec(line)?.[0] ?? line;
const afterColon = (line: string): string => line.slice(line.indexOf(':') + 1);

function parseMaster(text: string, base: string): Variant[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const variants: Variant[] = [];
  lines.forEach((line, index) => {
    if (tagOf(line) !== '#EXT-X-STREAM-INF') return;
    const uri = lines.slice(index + 1).find((next) => next && !next.startsWith('#'));
    if (!uri) return;
    const attrs = attributes(afterColon(line));
    variants.push({ uri: new URL(uri, base).href, bandwidth: Number(attrs.get('BANDWIDTH') ?? 0), codecs: attrs.get('CODECS') });
  });
  return variants;
}

interface MediaPlaylist {
  readonly segments: readonly { readonly uri: string; readonly duration: number }[];
  readonly ended: boolean;
  readonly encryption?: string;
  readonly breaks: ReadonlySet<string>;
}

function parseMedia(text: string, base: string): MediaPlaylist {
  const segments: { uri: string; duration: number }[] = [];
  const breaks = new Set<string>();
  let pending = 0;
  let ended = false;
  let encryption: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.startsWith('#')) {
      segments.push({ uri: new URL(line, base).href, duration: pending });
      pending = 0;
      continue;
    }
    const tag = tagOf(line);
    if (tag === '#EXTINF') pending = parseFloat(afterColon(line)) || 0;
    else if (tag === '#EXT-X-ENDLIST') ended = true;
    else if (tag === '#EXT-X-KEY') {
      const method = attributes(afterColon(line)).get('METHOD');
      encryption = method && method !== 'NONE' ? method : undefined;
    } else if (BREAK_TAG.test(line)) breaks.add(tag.slice(1));
    else if (tag === '#EXT-X-DATERANGE' && AD_DATERANGE.test(line)) breaks.add('EXT-X-DATERANGE (ad)');
  }
  return { segments, ended, encryption, breaks };
}

async function readPlaylist(response: Response): Promise<string> {
  const text = new TextDecoder().decode(await readHead(response, PLAYLIST_LIMIT));
  if (!text.trimStart().startsWith('#EXTM3U')) {
    throw new Dead(`not an HLS playlist (${response.headers.get('content-type') ?? 'no content type'})`);
  }
  return text;
}

async function probeHls(source: StreamSource, signal: AbortSignal, found: Findings): Promise<void> {
  const top = await get(source.url, signal);
  expectOk(top, 'playlist');
  noteAdServer(top, found, 'playlist');
  let cors = allowsOrigin(top.response);
  let base = top.chain.at(-1) ?? source.url;
  let text = await readPlaylist(top.response);
  if (text.includes('#EXT-X-STREAM-INF')) {
    const variants = parseMaster(text, base);
    const first = variants[0];
    if (!first) throw new Dead('master playlist without variants');
    const codecs = first.codecs ? ` ${first.codecs}` : '';
    found.facts.push(`${variants.length} variant${variants.length > 1 ? 's' : ''}, first ${Math.round(first.bandwidth / 1000)} kbit/s${codecs}`);
    const hit = await get(first.uri, signal);
    expectOk(hit, 'variant');
    noteAdServer(hit, found, 'variant');
    cors &&= allowsOrigin(hit.response);
    base = hit.chain.at(-1) ?? first.uri;
    text = await readPlaylist(hit.response);
  }

  const media = parseMedia(text, base);
  const newest = media.segments.at(-1);
  if (!newest) throw new Dead('no segments listed');
  if (media.ended) found.problems.push('the playlist is closed (EXT-X-ENDLIST): not live');
  found.window = media.segments.reduce((sum, segment) => sum + segment.duration, 0);
  found.facts.push(`${media.segments.length} segments, ${duration(found.window)}`);
  for (const tag of media.breaks) found.breaks.add(tag);
  const ads = media.segments.filter(({ uri }) => AD_SERVER.test(uri) || AD_SEGMENT.test(new URL(uri).pathname)).length;
  if (ads > 0) found.inserted.add(`${ads} of ${media.segments.length} segments are ads`);

  const segment = await get(newest.uri, signal);
  expectOk(segment, 'segment');
  cors &&= allowsOrigin(segment.response);
  const bytes = await readHead(segment.response, AUDIO_SAMPLE);
  if (media.encryption) found.facts.push(`${media.encryption} encrypted`);
  else noteAudio(bytes, source, found, 'segment');
  if (!cors) found.facts.push('no CORS: native HLS only (iPhone, Safari)');
}

async function probeIcy(source: StreamSource, signal: AbortSignal, found: Findings): Promise<void> {
  const hit = await get(source.url, signal);
  expectOk(hit, 'stream');
  noteAdServer(hit, found, 'stream');
  const type = hit.response.headers.get('content-type') ?? '';
  noteAudio(await readHead(hit.response, AUDIO_SAMPLE), source, found, 'stream');
  if (type) found.facts.push(type);
  if (type && !/^(?:audio\/|application\/ogg)/i.test(type)) found.problems.push(`served as ${type}`);
  const bitrate = parseInt(hit.response.headers.get('icy-br') ?? '', 10);
  if (bitrate > 0) {
    found.facts.push(`${bitrate} kbit/s`);
    if (source.bitrate > 0 && Math.abs(bitrate - source.bitrate) / source.bitrate > 0.25) {
      found.problems.push(`declared ${source.bitrate} kbit/s, the server says ${bitrate}`);
    }
  }
  const hops = hit.chain.slice(1).map(host);
  if (hops.length > 0) found.facts.push(`via ${hops.join(' → ')}`);
}

async function probeSource(source: StreamSource): Promise<Probe> {
  const found = new Findings();
  try {
    const signal = AbortSignal.timeout(TIMEOUT);
    await (source.kind === 'hls' ? probeHls : probeIcy)(source, signal, found);
    return found.result();
  } catch (error) {
    return found.result(error);
  }
}

interface MetaProbe {
  readonly level: Level;
  readonly text: string;
}

const describe = (now: NowPlaying): string => (now.subtitle ? `${now.title} · ${now.subtitle}` : now.title);

async function probeMeta(meta: NonNullable<Station['meta']>): Promise<MetaProbe> {
  try {
    const signal = AbortSignal.timeout(TIMEOUT);
    const hit = await get(metaUrl(meta), signal, { accept: 'application/json', origin: ORIGIN });
    expectOk(hit, 'endpoint');
    const json: unknown = JSON.parse(new TextDecoder().decode(await readHead(hit.response, PLAYLIST_LIMIT)));
    const problems: string[] = [];
    if (!allowsOrigin(hit.response)) problems.push('no CORS header: the app cannot read it');
    let shown = '';
    try {
      const now = normalizeNowPlaying(meta, json, Date.now());
      shown = now ? describe(now) : 'nothing to show right now';
    } catch (error) {
      if (!(error instanceof UnknownFormat)) throw error;
      problems.push(`the API has changed: ${error.message}`);
    }
    return { level: problems.length > 0 ? 'warn' : 'ok', text: [...problems, shown].filter(Boolean).join(' · ') };
  } catch (error) {
    return { level: 'warn', text: reason(error) };
  }
}

// Report ------------------------------------------------------------------------------------

interface Row {
  readonly level: Level;
  readonly what: string;
  readonly where: string;
  readonly text: string;
}

interface Report {
  readonly station: Station;
  readonly rows: readonly Row[];
  readonly working: number;
  readonly level: Level;
  readonly headline: string;
  /** Evidence that the stream replaces the station's breaks, when it does. */
  readonly inserting?: string;
}

function assemble(station: Station, probes: ReadonlyMap<string, Probe>, meta: MetaProbe | undefined): Report {
  const rows: Row[] = [];
  const inserted = new Set<string>();
  const servers = new Set<string>();
  const breaks = new Set<string>();
  const collect = (probe: Probe): void => {
    for (const evidence of probe.inserted) inserted.add(evidence);
    for (const evidence of probe.servers) servers.add(evidence);
    for (const tag of probe.breaks) breaks.add(tag);
  };

  let working = 0;
  for (const source of station.streams) {
    const probe = probes.get(source.url);
    if (!probe) continue;
    if (probe.playable) working += 1;
    collect(probe);
    const what = `${source.kind.toUpperCase()} ${source.codec} ${source.bitrate || ''}`.trim();
    rows.push({ level: probe.level, what, where: host(source.url), text: probe.notes.join(' · ') });
  }

  const timeshift = station.timeshift;
  const rewind = timeshift ? probes.get(timeshift.url) : undefined;
  if (timeshift && rewind) {
    if (!station.streams.some((source) => source.url === timeshift.url)) collect(rewind);
    const listed = rewind.window ?? 0;
    const row = (level: Level, text: string): Row => ({ level, what: 'Rewind', where: host(timeshift.url), text });
    if (!rewind.playable) rows.push(row('warn', `unavailable: ${rewind.notes[0] ?? ''}`));
    else if (listed < timeshift.window * 0.9) {
      rows.push(row('warn', `${duration(listed)} listed, the catalogue says ${duration(timeshift.window)}`));
    } else rows.push(row('ok', `${duration(listed)} listed`));
  }

  if (station.meta && meta) {
    rows.push({ level: meta.level, what: 'Now playing', where: host(metaUrl(station.meta)), text: meta.text });
  }

  const ads = (level: Level, text: string): Row => ({ level, what: 'Ads', where: '', text });
  const proof = [...inserted].join(', ');
  const capable = [...servers].join(', ');
  let inserting: string | undefined;
  if (station.ads === 'stream') {
    const evidence = [proof, capable].filter(Boolean).join(', ');
    inserting = evidence || 'declared';
    rows.push(ads('ok', evidence ? `inserted by the stream, as declared: ${evidence}` : 'declared as inserted by the stream, none seen this time'));
  } else if (proof) {
    inserting = proof;
    rows.push(ads('warn', `the stream inserts ads (${proof}) but the catalogue says "${station.ads}"`));
  } else if (capable) {
    rows.push(
      station.ads === 'unknown'
        ? ads('warn', `served by an ad-insertion server (${capable}): set the catalogue's ad policy`)
        : ads('ok', `served by an ad-insertion server (${capable}), no inserted ad seen`),
    );
  }
  if (breaks.size > 0) {
    const tags = [...breaks].join(', ');
    rows.push(
      station.ads === 'none'
        ? ads('warn', `ad-break markers (${tags}) on a station declared ad-free`)
        : ads('ok', `break markers in the playlist (${tags}): Ondes ignores them`),
    );
  }

  const level: Level = working === 0 ? 'fail' : rows.some((row) => row.level !== 'ok') ? 'warn' : 'ok';
  const problem = rows.find((row) => row.level !== 'ok');
  const headline = problem ? `${problem.what}: ${problem.text}` : (station.meta && meta ? meta.text : (rows[0]?.text ?? ''));
  return { station, rows, working, level, headline, inserting };
}

const tty = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint =
  (code: number) =>
  (text: string): string =>
    tty ? `\x1b[${code}m${text}\x1b[0m` : text;
const green = paint(32);
const yellow = paint(33);
const red = paint(31);
const dim = paint(2);
const bold = paint(1);
const MARK: Readonly<Record<Level, string>> = { ok: green('✓'), warn: yellow('!'), fail: red('✗') };

const fit = (text: string, width: number): string =>
  text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;

function print(reports: readonly Report[], verbose: boolean): void {
  const columns = process.stdout.columns ?? Number.POSITIVE_INFINITY;
  const nameWidth = Math.max(...reports.map((report) => report.station.name.length));
  let line: string | undefined;
  for (const report of reports) {
    const { station } = report;
    if (station.line !== line) {
      line = station.line;
      const info = lineById(station.line);
      console.log(`\n  ${dim(`${info.roundel}  ${info.name.en}`)}`);
    }
    const lead = `  ${MARK[report.level]} ${station.name.padEnd(nameWidth)}  ${`${report.working}/${station.streams.length}`.padStart(3)}  `;
    const headline = fit(report.headline, columns - (nameWidth + 11));
    console.log(lead + (report.level === 'ok' ? dim(headline) : headline));
    if (!verbose && report.level === 'ok') continue;
    for (const row of report.rows) {
      const text = fit(row.text, columns - 52);
      console.log(`      ${MARK[row.level]} ${row.what.padEnd(13)} ${dim(row.where.padEnd(29))} ${text}`);
    }
  }
}

function printTotals(reports: readonly Report[], seconds: number): void {
  const count = (level: Level): number => reports.filter((report) => report.level === level).length;
  const warn = count('warn');
  const fail = count('fail');
  const parts = [
    bold(`${count('ok')} working`),
    warn > 0 ? yellow(`${warn} with warnings`) : '0 with warnings',
    fail > 0 ? red(`${fail} without a working source`) : '0 without a working source',
    dim(`${seconds} s`),
  ];
  console.log(`\n  ${parts.join(' · ')}`);
  const inserting = reports.filter((report) => report.inserting !== undefined);
  if (inserting.length > 0) {
    const list = inserting.map((report) => `${report.station.name} (${report.inserting})`).join('; ');
    console.log(`  Ads inserted by the stream: ${list}`);
  }
  console.log('');
}

async function writeStepSummary(file: string, reports: readonly Report[]): Promise<void> {
  const icon: Readonly<Record<Level, string>> = { ok: '✅', warn: '⚠️', fail: '❌' };
  const cell = (text: string): string => text.replace(/\|/g, '\\|');
  const lines = ['## Ondes stream check', '', '| | Station | Sources | Notes |', '| :-: | --- | :-: | --- |'];
  for (const report of reports) {
    const { station } = report;
    lines.push(`| ${icon[report.level]} | ${cell(station.name)} | ${report.working}/${station.streams.length} | ${cell(report.headline)} |`);
  }
  for (const report of reports.filter((r) => r.level !== 'ok')) {
    lines.push('', `**${report.station.name}**`, '');
    for (const row of report.rows.filter((r) => r.level !== 'ok')) {
      lines.push(`- ${icon[row.level]} ${row.what}${row.where ? ` \`${row.where}\`` : ''}: ${row.text}`);
    }
  }
  await appendFile(file, `${lines.join('\n')}\n`);
}

/** Runs at most `max` tasks at once, in the order they were queued. */
function limiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < max) active += 1;
    else await new Promise<void>((resolve) => queue.push(resolve));
    try {
      return await task();
    } finally {
      // Hand the slot straight to the next task.
      const next = queue.shift();
      if (next) next();
      else active -= 1;
    }
  };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const ids = args.filter((arg) => !arg.startsWith('-'));
  const verbose = ids.length > 0 || args.includes('-v') || args.includes('--verbose');
  const unknown = ids.filter((id) => !catalog.some((station) => station.id === id));
  if (unknown.length > 0) {
    console.error(`Unknown station id: ${unknown.join(', ')}. The ids are in src/data/stations.ts.`);
    return 2;
  }
  const stations = ids.length > 0 ? catalog.filter((station) => ids.includes(station.id)) : catalog;

  const sources = new Map<string, StreamSource>();
  for (const station of stations) {
    for (const source of station.streams) sources.set(source.url, source);
    const timeshift = station.timeshift;
    if (timeshift && !sources.has(timeshift.url)) {
      const kind = isHlsUrl(timeshift.url) ? 'hls' : 'icy';
      sources.set(timeshift.url, { url: timeshift.url, kind, codec: '', bitrate: 0, quality: 'hifi' });
    }
  }

  console.log(bold(`\n  Ondes · stream check · ${stations.length} station${stations.length > 1 ? 's' : ''}`));
  const started = Date.now();
  const run = limiter(CONCURRENCY);
  const probes = new Map<string, Probe>();
  const metas = new Map<string, MetaProbe>();
  const total = sources.size + stations.filter((station) => station.meta).length;
  let done = 0;
  const progress = (): void => {
    done += 1;
    if (process.stderr.isTTY) process.stderr.write(`\r  Checking ${done}/${total}…`);
  };
  await Promise.all([
    ...[...sources.values()].map(async (source) => {
      probes.set(source.url, await run(() => probeSource(source)));
      progress();
    }),
    ...stations.map(async (station) => {
      const meta = station.meta;
      if (!meta) return;
      metas.set(station.id, await run(() => probeMeta(meta)));
      progress();
    }),
  ]);
  if (process.stderr.isTTY) process.stderr.write('\r\x1b[2K');

  const reports = stations.map((station) => assemble(station, probes, metas.get(station.id)));
  print(reports, verbose);
  printTotals(reports, Math.round((Date.now() - started) / 1000));
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) await writeStepSummary(summary, reports);
  return reports.some((report) => report.level === 'fail') ? 1 : 0;
}

process.exitCode = await main();
