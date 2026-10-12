import { isHlsUrl } from './sources';
import { looksLikePlaylist, parsePlaylist } from './playlist';
import type { Station, StreamSource } from './types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** FNV-1a, enough to give a pasted URL a stable id. */
export function hashString(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: 'invalid' | 'http' };

/** Only HTTPS can play inside a secure web app on iPhone. */
export function checkStreamUrl(input: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.protocol === 'http:') return { ok: false, reason: 'http' };
  if (url.protocol !== 'https:' || !url.hostname) return { ok: false, reason: 'invalid' };
  return { ok: true, url: url.href };
}

/** Follows an M3U or PLS playlist to its first stream; other URLs are returned as they are. */
export async function resolveStreamUrl(url: string, signal?: AbortSignal): Promise<string> {
  if (!looksLikePlaylist(url)) return url;
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const found = parsePlaylist(await response.text());
  if (!found) throw new Error('empty-playlist');
  return found;
}

export function stationFromUrl(url: string, name: string): Station {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const label = name.trim().replace(/\s+/g, ' ') || host;
  return {
    id: `url-${hashString(url)}`,
    name: label,
    line: 'perso',
    country: '',
    tagline: { fr: host, en: host },
    streams: [{ url, kind: isHlsUrl(url) ? 'hls' : 'icy', codec: '', bitrate: 0, quality: 'hifi' }],
    ads: 'unknown',
    custom: true,
  };
}

function parseStream(value: unknown): StreamSource | undefined {
  if (!isRecord(value)) return undefined;
  const url = str(value.url);
  if (!url || !url.startsWith('https://')) return undefined;
  return {
    url,
    kind: value.kind === 'hls' ? 'hls' : 'icy',
    codec: str(value.codec) ?? '',
    bitrate: typeof value.bitrate === 'number' && value.bitrate > 0 ? value.bitrate : 0,
    quality: value.quality === 'eco' ? 'eco' : 'hifi',
  };
}

function parseCustomStation(value: unknown): Station | undefined {
  if (!isRecord(value)) return undefined;
  const id = str(value.id);
  const name = str(value.name);
  if (!id || !name || !/^(rb|url)-[\w-]+$/.test(id)) return undefined;
  const streams = Array.isArray(value.streams) ? value.streams.map(parseStream).filter((s) => s !== undefined) : [];
  if (!streams.length) return undefined;
  const tagline = isRecord(value.tagline) ? value.tagline : {};
  const site = str(value.site);
  return {
    id,
    name,
    line: 'perso',
    country: (str(value.country) ?? '').slice(0, 2).toUpperCase(),
    tagline: { fr: str(tagline.fr) ?? '', en: str(tagline.en) ?? str(tagline.fr) ?? '' },
    streams,
    ads: 'unknown',
    site: site?.startsWith('https://') || site?.startsWith('http://') ? site : undefined,
    custom: true,
  };
}

/** Validates stations read back from storage. */
export function parseCustomStations(value: unknown): Station[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(parseCustomStation).filter((s) => s !== undefined);
}
