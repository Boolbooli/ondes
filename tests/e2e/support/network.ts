import { readFileSync } from 'node:fs';
import type { BrowserContext, Route } from '@playwright/test';
import { catalog } from '../../../src/data/stations';
import { silentWav } from './wav';

/** How the Radio Browser directory answers: unreachable (503), or with the stations below. */
export type DirectoryMode = 'down' | 'fixture';

/** Every request that left the app's origin, by what the routes did with it. */
export interface NetworkLog {
  /** Streams, answered with silence. */
  readonly streams: string[];
  /** Programme APIs, answered from recorded responses. */
  readonly metadata: string[];
  /** Radio Browser. */
  readonly directory: string[];
  /** Anything else, aborted so that nothing reaches the network. */
  readonly blocked: BlockedRequest[];
}

export interface BlockedRequest {
  readonly url: string;
  /** As Playwright names it: `image`, `fetch`, `media`… */
  readonly resourceType: string;
}

/** A reserved name that never resolves: only the route answers for it. */
export const FIXTURE_STREAM_HOST = 'stream.ondes-e2e.test';

/** A station as Radio Browser returns it, cut down to the fields the app reads. */
export interface DirectoryStation {
  readonly stationuuid: string;
  readonly name: string;
  readonly url: string;
  readonly url_resolved: string;
  readonly homepage: string;
  readonly tags: string;
  readonly country: string;
  readonly countrycode: string;
  readonly codec: string;
  readonly bitrate: number;
  readonly hls: 0 | 1;
}

const directoryStation = (uuid: string, name: string, url: string, tags: string, codec: string, bitrate: number) => ({
  stationuuid: uuid,
  name,
  url,
  url_resolved: url,
  homepage: 'https://example.org/',
  tags,
  country: 'France',
  countrycode: 'FR',
  codec,
  bitrate,
  hls: 0 as const,
});

/** Two stations only the directory knows, and one that is already on the network. */
export const directoryStations: readonly DirectoryStation[] = [
  directoryStation(
    'e2e00000-0000-4000-8000-000000000001',
    'Ondine Test FM',
    `https://${FIXTURE_STREAM_HOST}/ondine-test-fm.mp3`,
    'ambient,test',
    'MP3',
    128,
  ),
  directoryStation(
    'e2e00000-0000-4000-8000-000000000002',
    'Radio Ondine Nord',
    `https://${FIXTURE_STREAM_HOST}/radio-ondine-nord.aac`,
    'jazz,lille',
    'AAC',
    96,
  ),
  directoryStation(
    'e2e00000-0000-4000-8000-000000000003',
    'FIP',
    'https://icecast.radiofrance.fr/fip-hifi.aac',
    'eclectic,france',
    'AAC',
    192,
  ),
];

/** Long enough for any test: the engine retries when a stream ends. */
const SILENCE = silentWav(120);
const CORS = { 'access-control-allow-origin': '*' };
const DIRECTORY_HOST = /(^|\.)api\.radio-browser\.info$/;

const ICECAST_STREAMS = new Set(
  catalog.flatMap((station) =>
    station.streams.filter((source) => source.kind === 'icy').map((source) => new URL(source.url).href),
  ),
);

const fixture = (name: string): string =>
  readFileSync(new URL(`../../fixtures/${name}.json`, import.meta.url), 'utf8');

/** Recorded `livemeta` responses, by Radio France station id. */
const RADIO_FRANCE: Readonly<Record<string, string>> = {
  1: fixture('rf-inter'),
  4: fixture('rf-musique'),
  7: fixture('rf-fip'),
  64: fixture('rf-fiprock'),
  405: fixture('rf-lajazz'),
};

/** A station without a recording gets a programme with no lines, which the app shows as its tagline. */
const RADIO_FRANCE_QUIET = JSON.stringify({ now: { firstLine: null, secondLine: null }, delayToRefresh: 60_000 });
const KEXP = fixture('kexp');
const SOMAFM = fixture('somafm');
const NTS = fixture('nts');

/** The recorded answer of a programme API, if the URL is one the poller calls. */
function metadataFor(url: URL): string | undefined {
  if (url.hostname === 'api.radiofrance.fr') {
    const id = /^\/livemeta\/live\/(\d+)\/[\w-]+$/.exec(url.pathname)?.[1];
    return id === undefined ? undefined : (RADIO_FRANCE[id] ?? RADIO_FRANCE_QUIET);
  }
  if (url.hostname === 'api.kexp.org' && url.pathname === '/v2/plays/') return KEXP;
  if (url.hostname === 'somafm.com' && /^\/songs\/[\w-]+\.json$/.test(url.pathname)) return SOMAFM;
  if (url.hostname === 'www.nts.live' && url.pathname === '/api/v2/live') return NTS;
  return undefined;
}

/** `/json/stations/search` over the fixture: a name or tag substring, as Radio Browser matches them. */
function searchDirectory(url: URL): readonly DirectoryStation[] | undefined {
  if (url.pathname !== '/json/stations/search') return undefined;
  const name = url.searchParams.get('name')?.toLowerCase();
  const tag = url.searchParams.get('tag')?.toLowerCase();
  const limit = Number(url.searchParams.get('limit') ?? directoryStations.length);
  return directoryStations
    .filter(
      (station) =>
        (name !== undefined && station.name.toLowerCase().includes(name)) ||
        (tag !== undefined && station.tags.split(',').some((item) => item.includes(tag))),
    )
    .slice(0, limit);
}

const json = (route: Route, body: string): Promise<void> =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body });

/**
 * Answers every request that leaves the app's origin, so that tests never touch the network:
 * streams with silence, programme APIs and the directory with fixtures, the rest aborted.
 * Service workers must be blocked, since their fetches bypass these routes.
 */
export async function routeNetwork(
  context: BrowserContext,
  appOrigin: string,
  directory: DirectoryMode,
): Promise<NetworkLog> {
  const log: NetworkLog = { streams: [], metadata: [], directory: [], blocked: [] };
  await context.route(
    (url) => url.origin !== appOrigin,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        request.resourceType() === 'media' ||
        ICECAST_STREAMS.has(url.href) ||
        url.hostname === FIXTURE_STREAM_HOST
      ) {
        log.streams.push(url.href);
        return route.fulfill({ status: 200, contentType: 'audio/wav', headers: CORS, body: SILENCE });
      }
      const metadata = metadataFor(url);
      if (metadata !== undefined) {
        log.metadata.push(url.href);
        return json(route, metadata);
      }
      if (DIRECTORY_HOST.test(url.hostname)) {
        log.directory.push(url.href);
        if (directory === 'down') {
          return route.fulfill({ status: 503, contentType: 'text/plain', headers: CORS, body: 'Service Unavailable' });
        }
        const results = searchDirectory(url);
        if (results) return json(route, JSON.stringify(results));
      }
      log.blocked.push({ url: url.href, resourceType: request.resourceType() });
      return route.abort('blockedbyclient');
    },
  );
  return log;
}
