import { isHlsUrl } from './sources';
import { looksLikePlaylist } from './playlist';
import type { Station } from './types';

/**
 * Radio Browser, the open community directory of internet radio.
 * https://api.radio-browser.info — `all` resolves to every server in service, which changes over time;
 * the named servers are kept as fallbacks for when that round-robin answers with a server that is down.
 */
const MIRRORS = ['all', 'de1', 'de2'].map((host) => `https://${host}.api.radio-browser.info`);
const TIMEOUT = 8_000;
let preferred = 0;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

// —— Names ———————————————————————————————————————————————————————————
// Anyone can type a name into the directory, and many are framed in dashes and capitals to stand out in a list.

/** Dashes, bars and arrows before a name, and a loose `#`; one that starts a word, as in "#1 Hits", stays. */
const LEADING_DECORATION = /^(?:[-–—|~=*_•·<>\s]|#(?![\p{L}\p{N}]))+/u;
const TRAILING_DECORATION = /[-–—|~=*_•·<>\s]+$/u;
/** A loose `#` at the end; one that ends a word, as in "C#", stays. */
const TRAILING_HASH = /(^|\s)#+$/u;
/** Runs of separators, and lone bars or bullets, between the parts of a name. */
const SEPARATORS = /\s*(?:[-–—~=*_•|]{2,}|[|•])\s*/gu;
/** Only repeated: a lone middle dot may belong to a word, as in Catalan "col·lecció". */
const REPEATED_DOTS = /\s*·(?:\s*·)+\s*/gu;
/** Where a name splits into parts that keep or lose their capitals on their own: "SMOOTH JAZZ: Sax, Piano". */
const PARTS = /( · | [-–—] |: )/u;

/** Short words that are words, not initials. Call signs aside: "WILD" is not a station in Wisconsin. */
const WORDS = new Set(
  ('air all art bar big box day dub fun hit hot max mix my new old one our pop rap sea sky sun top you ' +
    'keys kids kind king kiss wave west wild wind wine wise wolf word work').split(' '),
);

/** Articles and prepositions, lowercase inside a name. */
const LINKS = new Set(
  ('a an and at au aux by da das de del der des di die do dos du e el en et for il in ' +
    'la las le les lo los of on sur the to und with y').split(' '),
);

function quietWord(word: string, edge: boolean): string {
  const lower = word.toLowerCase();
  if (LINKS.has(lower)) return edge ? capitalize(lower) : lower;
  if (WORDS.has(lower)) return capitalize(lower);
  const letters = word.normalize('NFD').replace(/\P{L}/gu, '');
  // Initials and call signs stay as written: BBC, FM, RTBF, KEXP.
  if (letters.length <= 3 || (letters.length === 4 && (!/[AEIOU]/.test(letters) || /^[KW]/.test(letters)))) {
    return word;
  }
  // An elided article keeps the capital of the word it leans on: L'Essentiel, O'Reilly.
  return capitalize(lower).replace(/^(\p{L}['’])(\p{L})/u, (_, elided: string, next: string) => elided + next.toUpperCase());
}

/** A part in capitals with at least one long word is shouting; anything in lowercase was cased by its author. */
function quietPart(part: string): string {
  if (/\p{Ll}/u.test(part) || !/\p{L}{5,}/u.test(part)) return part;
  const tokens = part.split(' ');
  return tokens
    .map((token, i) => {
      // Numbers keep the letters they come with (MP3, 24H), but decades read as decades: 80S becomes 80s.
      if (/\p{N}/u.test(token)) return token.replace(/^(\d+)S$/u, '$1s');
      const edge = i === 0 || i === tokens.length - 1;
      return token.replace(/\p{L}+(?:['’]\p{L}+)*/gu, (word) => quietWord(word, edge));
    })
    .join(' ');
}

/** A directory name without the decoration around it or the capitals it shouts in; as typed if nothing would be left. */
export function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  let bare = name.replace(LEADING_DECORATION, '');
  for (let before = ''; before !== bare; ) {
    before = bare;
    bare = bare.replace(TRAILING_DECORATION, '').replace(TRAILING_HASH, '$1');
  }
  bare = bare.replace(SEPARATORS, ' · ').replace(REPEATED_DOTS, ' · ');
  if (!/[\p{L}\p{N}]/u.test(bare)) return name;
  return bare
    .split(PARTS)
    .map((part, i) => (i % 2 ? part : quietPart(part)))
    .join('');
}

export function toDirectoryStation(raw: unknown): Station | undefined {
  if (!isRecord(raw)) return undefined;
  const uuid = str(raw.stationuuid);
  const name = str(raw.name);
  const url = str(raw.url_resolved) ?? str(raw.url);
  if (!uuid || !name || !url || !url.startsWith('https://') || looksLikePlaylist(url)) return undefined;
  // Saved stations are reloaded only with ids of this shape (custom-stations.ts).
  if (!/^[\w-]+$/.test(uuid)) return undefined;
  const codec = (str(raw.codec) ?? '').toUpperCase();
  const tags = (str(raw.tags) ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag && tag.length < 24)
    .slice(0, 3);
  const tagline = tags.length ? capitalize(tags.join(', ')) : (str(raw.country) ?? '');
  const homepage = str(raw.homepage);
  return {
    id: `rb-${uuid}`,
    name: cleanName(name),
    line: 'perso',
    country: (str(raw.countrycode) ?? '').slice(0, 2).toUpperCase(),
    tagline: { fr: tagline, en: tagline },
    streams: [
      {
        url,
        kind: raw.hls === 1 || isHlsUrl(url) ? 'hls' : 'icy',
        codec: codec === 'UNKNOWN' ? '' : codec,
        bitrate: typeof raw.bitrate === 'number' && raw.bitrate > 0 ? raw.bitrate : 0,
        quality: 'hifi',
      },
    ],
    ads: 'unknown',
    site: homepage && /^https?:\/\//.test(homepage) ? homepage : undefined,
    custom: true,
  };
}

/** Merges result lists in order, dropping duplicates of the same station or stream. */
export function mergeDirectory(...lists: unknown[]): Station[] {
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const station = toDirectoryStation(raw);
      if (!station) continue;
      const keys = [station.id, `${station.name.toLowerCase()}|${station.streams[0]?.url}`];
      if (keys.some((key) => seen.has(key))) continue;
      for (const key of keys) seen.add(key);
      out.push(station);
    }
  }
  return out;
}

async function query(path: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  let lastError: unknown = new Error('unreachable');
  // Read once: a concurrent query may move `preferred`, which would skip a mirror and retry another.
  const start = preferred;
  for (let i = 0; i < MIRRORS.length; i += 1) {
    const index = (start + i) % MIRRORS.length;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, TIMEOUT);
    try {
      const response = await fetch(`${MIRRORS[index]}${path}`, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json: unknown = await response.json();
      preferred = index;
      return json;
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
  throw lastError;
}

/** Stations whose name or genre matches, most listened first. Only HTTPS streams that passed the directory's checks. */
export async function searchDirectory(text: string, signal: AbortSignal): Promise<Station[]> {
  const base = { hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true' };
  const byName = new URLSearchParams({ ...base, name: text, limit: '30' });
  const byTag = new URLSearchParams({ ...base, tag: text.toLowerCase(), limit: '15' });
  const [names, tags] = await Promise.allSettled([
    query(`/json/stations/search?${byName}`, signal),
    query(`/json/stations/search?${byTag}`, signal),
  ]);
  if (names.status === 'rejected' && tags.status === 'rejected') throw names.reason;
  return mergeDirectory(
    names.status === 'fulfilled' ? names.value : [],
    tags.status === 'fulfilled' ? tags.value : [],
  ).slice(0, 40);
}
