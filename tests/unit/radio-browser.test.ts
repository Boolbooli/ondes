import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { cleanName, mergeDirectory, toDirectoryStation } from '../../src/core/radio-browser';

type RadioBrowser = typeof import('../../src/core/radio-browser');

/** A Radio Browser station record, as the API returns it. */
const raw = (n: number, fields: Record<string, unknown> = {}): Record<string, unknown> => ({
  stationuuid: `uuid-${n}`,
  name: `Station ${n}`,
  url: `https://stream.example/${n}`,
  url_resolved: `https://stream.example/${n}.mp3`,
  homepage: `https://station${n}.example/`,
  tags: 'jazz,blues',
  country: 'France',
  countrycode: 'FR',
  codec: 'MP3',
  bitrate: 128,
  hls: 0,
  ...fields,
});

/** A fetch answer with only what the client reads. */
const answer = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

/** A request that never answers, until it is aborted. */
const pending = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });

const ids = (stations: readonly { id: string }[]) => stations.map((s) => s.id);

describe('toDirectoryStation', () => {
  it('turns a directory record into a custom station on "My stations"', () => {
    expect(toDirectoryStation(raw(1))).toEqual({
      id: 'rb-uuid-1',
      name: 'Station 1',
      line: 'perso',
      country: 'FR',
      tagline: { fr: 'Jazz, blues', en: 'Jazz, blues' },
      streams: [{ url: 'https://stream.example/1.mp3', kind: 'icy', codec: 'MP3', bitrate: 128, quality: 'hifi' }],
      ads: 'unknown',
      site: 'https://station1.example/',
      custom: true,
    });
  });

  it('tidies the name', () => {
    expect(toDirectoryStation(raw(1, { name: '  Radio \n  Nova\t ' }))?.name).toBe('Radio Nova');
    expect(toDirectoryStation(raw(1, { name: '-- # TOP 100 CHARTS ---' }))?.name).toBe('Top 100 Charts');
  });

  it('prefers the resolved URL and falls back to the declared one', () => {
    expect(toDirectoryStation(raw(1, { url_resolved: '' }))?.streams[0]?.url).toBe('https://stream.example/1');
    expect(toDirectoryStation(raw(1, { url_resolved: undefined }))?.streams[0]?.url).toBe('https://stream.example/1');
  });

  it.each<[string, Record<string, unknown>]>([
    ['no uuid', { stationuuid: undefined }],
    ['a blank uuid', { stationuuid: '  ' }],
    ['no name', { name: undefined }],
    ['a blank name', { name: ' \t ' }],
    ['no URL', { url: undefined, url_resolved: undefined }],
    ['a plain http stream', { url_resolved: 'http://stream.example/1.mp3' }],
    ['a PLS playlist', { url_resolved: 'https://stream.example/listen.pls' }],
    ['an M3U playlist', { url_resolved: 'https://stream.example/listen.m3u?x=1' }],
    ['a non-string URL', { url: 42, url_resolved: null }],
    ['a uuid that cannot name a saved station', { stationuuid: 'a/b' }],
  ])('rejects a record with %s', (_label, fields) => {
    expect(toDirectoryStation(raw(1, fields))).toBeUndefined();
  });

  it.each([null, undefined, 'station', 42, []])('rejects %j', (value) => {
    expect(toDirectoryStation(value)).toBeUndefined();
  });

  it('marks HLS streams, by flag or by URL', () => {
    expect(toDirectoryStation(raw(1, { hls: 1 }))?.streams[0]?.kind).toBe('hls');
    expect(toDirectoryStation(raw(1, { url_resolved: 'https://stream.example/live.m3u8' }))?.streams[0]?.kind).toBe('hls');
    expect(toDirectoryStation(raw(1, { hls: '1' }))?.streams[0]?.kind).toBe('icy');
  });

  it.each<[unknown, string]>([
    ['aac+', 'AAC+'],
    ['UNKNOWN', ''],
    ['unknown', ''],
    ['', ''],
    [undefined, ''],
  ])('normalises the codec %j to %j', (codec, expected) => {
    expect(toDirectoryStation(raw(1, { codec }))?.streams[0]?.codec).toBe(expected);
  });

  it.each<[unknown, number]>([
    [320, 320],
    [0, 0],
    [-1, 0],
    ['128', 0],
    [undefined, 0],
  ])('keeps only a positive numeric bitrate (%j → %d)', (bitrate, expected) => {
    expect(toDirectoryStation(raw(1, { bitrate }))?.streams[0]?.bitrate).toBe(expected);
  });

  it('describes the station by its first three short tags', () => {
    const tags = 'smooth jazz, , a tag far too long to be useful,blues , soul,funk';
    expect(toDirectoryStation(raw(1, { tags }))?.tagline).toEqual({ fr: 'Smooth jazz, blues, soul', en: 'Smooth jazz, blues, soul' });
  });

  it('falls back to the country, then to nothing, when there are no usable tags', () => {
    expect(toDirectoryStation(raw(1, { tags: '' }))?.tagline.fr).toBe('France');
    expect(toDirectoryStation(raw(1, { tags: ' , ' }))?.tagline.en).toBe('France');
    expect(toDirectoryStation(raw(1, { tags: undefined, country: undefined }))?.tagline).toEqual({ fr: '', en: '' });
  });

  it.each<[unknown, string]>([
    ['fr', 'FR'],
    ['GBR', 'GB'],
    ['', ''],
    [undefined, ''],
  ])('normalises the country code %j to %j', (countrycode, expected) => {
    expect(toDirectoryStation(raw(1, { countrycode }))?.country).toBe(expected);
  });

  it.each<[unknown, string | undefined]>([
    ['https://nova.example/', 'https://nova.example/'],
    ['http://nova.example/', 'http://nova.example/'],
    ['nova.example', undefined],
    ['javascript:alert(1)', undefined],
    ['', undefined],
  ])('keeps only a web homepage (%j)', (homepage, expected) => {
    expect(toDirectoryStation(raw(1, { homepage }))?.site).toBe(expected);
  });
});

describe('cleanName', () => {
  it.each([
    ['-- # TOP 100 CHARTS --- DJ MIXES -- Pop, Dance, Hits', 'Top 100 Charts · DJ Mixes · Pop, Dance, Hits'],
    ['0R - PIANO JAZZ LOUNGE || Jazz, Piano', '0R - Piano Jazz Lounge · Jazz, Piano'],
    ['SMOOTH JAZZ: Sax, Piano', 'Smooth Jazz: Sax, Piano'],
    ['# 100 GREATEST JAZZ LOUNGE BAR', '100 Greatest Jazz Lounge Bar'],
  ])('quietens %j, as found in the directory', (name, expected) => {
    expect(cleanName(name)).toBe(expected);
  });

  it.each([
    ['=== Radio Meuh ===', 'Radio Meuh'],
    ['>> Jazz Radio <<', 'Jazz Radio'],
    ['# Radio Nova #', 'Radio Nova'],
    ['~*~ Chillout ~*~  ', 'Chillout'],
    ['•· Lounge ·•', 'Lounge'],
  ])('drops the decoration around %j', (name, expected) => {
    expect(cleanName(name)).toBe(expected);
  });

  it.each(['#1 Hits', '.977 The Hits Channel', 'Radio C#', 'Rádio+ Jazz', 'Ràdio Col·legi', 'Radio 1 - Rock'])(
    'keeps %j, whose signs belong to the name',
    (name) => {
      expect(cleanName(name)).toBe(name);
    },
  );

  it.each([
    ['Jazz || Blues', 'Jazz · Blues'],
    ['Jazz | Blues', 'Jazz · Blues'],
    ['Jazz|Blues', 'Jazz · Blues'],
    ['Jazz • Blues', 'Jazz · Blues'],
    ['Jazz -- Blues', 'Jazz · Blues'],
    ['Jazz ===== Blues', 'Jazz · Blues'],
    ['Jazz | | Blues', 'Jazz · Blues'],
  ])('joins the parts of %j with one separator', (name, expected) => {
    expect(cleanName(name)).toBe(expected);
  });

  it.each([
    ['RADIO NOVA', 'Radio Nova'],
    ['BBC WORLD SERVICE', 'BBC World Service'],
    ['KEXP SEATTLE', 'KEXP Seattle'],
    ['RTBF CLASSIC 21', 'RTBF Classic 21'],
    ['WILD COUNTRY', 'Wild Country'],
    ['LA RADIO DU JAZZ', 'La Radio du Jazz'],
    ['MUSIC FOR THE PEOPLE', 'Music for the People'],
    ['GREATEST HITS OF THE 80S', 'Greatest Hits of the 80s'],
    ["L'ESSENTIEL DU JAZZ", "L'Essentiel du Jazz"],
    ['BR-KLASSIK', 'BR-Klassik'],
    ['RADIO ÉNERGIE', 'Radio Énergie'],
  ])('stops %j shouting, keeping initials and call signs', (name, expected) => {
    expect(cleanName(name)).toBe(expected);
  });

  it.each(['NRJ', 'JAZZ FM', 'HOT 108 JAMZ', 'Radio NOVA', 'FIP'])('leaves %j as its author cased it', (name) => {
    expect(cleanName(name)).toBe(name);
  });

  it('keeps a name made only of signs as it was typed', () => {
    expect(cleanName(' ---- ')).toBe('----');
    expect(cleanName('#')).toBe('#');
  });
});

describe('mergeDirectory', () => {
  it('keeps the lists in order', () => {
    expect(ids(mergeDirectory([raw(1), raw(2)], [raw(3)]))).toEqual(['rb-uuid-1', 'rb-uuid-2', 'rb-uuid-3']);
  });

  it('drops a station seen earlier', () => {
    expect(ids(mergeDirectory([raw(1), raw(2)], [raw(2, { name: 'Renamed' }), raw(3)]))).toEqual([
      'rb-uuid-1',
      'rb-uuid-2',
      'rb-uuid-3',
    ]);
  });

  it('drops a duplicate entry of the same stream under the same name', () => {
    const twin = raw(9, { name: 'STATION 1', url_resolved: 'https://stream.example/1.mp3' });
    expect(ids(mergeDirectory([raw(1)], [twin]))).toEqual(['rb-uuid-1']);
  });

  it('compares names once their decoration is gone', () => {
    const twin = raw(9, { name: '== Station 1 ==', url_resolved: 'https://stream.example/1.mp3' });
    expect(ids(mergeDirectory([raw(1)], [twin]))).toEqual(['rb-uuid-1']);
  });

  it('keeps homonyms that stream something else', () => {
    const homonym = raw(9, { name: 'Station 1' });
    expect(ids(mergeDirectory([raw(1), homonym]))).toEqual(['rb-uuid-1', 'rb-uuid-9']);
  });

  it('skips unusable records and anything that is not a list', () => {
    expect(ids(mergeDirectory(undefined, { stations: [raw(1)] }, 'oops', [null, raw(2, { url_resolved: 'http://x.example/' }), raw(3)]))).toEqual([
      'rb-uuid-3',
    ]);
    expect(mergeDirectory()).toEqual([]);
  });
});

describe('searchDirectory', () => {
  let fetchMock: MockInstance<typeof fetch>;
  let searchDirectory: RadioBrowser['searchDirectory'];

  const urlOf = (call: number): URL => new URL(String(fetchMock.mock.calls[call]?.[0]));
  const mirrorOf = (url: URL): string => url.hostname.split('.')[0] ?? '';
  const requests = () => fetchMock.mock.calls.map(([input]) => new URL(String(input)));
  const isNameQuery = (url: URL) => url.searchParams.has('name');

  beforeEach(async () => {
    // A fresh module per test: the client remembers which mirror answered last.
    vi.resetModules();
    ({ searchDirectory } = await import('../../src/core/radio-browser'));
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches names and genres, HTTPS only, most listened first, without broken stations', async () => {
    fetchMock.mockResolvedValue(answer([]));
    await expect(searchDirectory('Jazz Café', new AbortController().signal)).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const byName = requests().find(isNameQuery);
    const byTag = requests().find((url) => url.searchParams.has('tag'));
    const common = { hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true' };
    expect(byName?.origin).toBe('https://all.api.radio-browser.info');
    expect(byName?.pathname).toBe('/json/stations/search');
    expect(Object.fromEntries(byName?.searchParams ?? [])).toEqual({ ...common, name: 'Jazz Café', limit: '30' });
    expect(byTag?.origin).toBe('https://all.api.radio-browser.info');
    expect(byTag?.pathname).toBe('/json/stations/search');
    expect(Object.fromEntries(byTag?.searchParams ?? [])).toEqual({ ...common, tag: 'jazz café', limit: '15' });
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe('omit');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('lists name matches before genre matches, whichever answers first, without duplicates', async () => {
    let answerNames: (response: Response) => void = () => {};
    fetchMock.mockImplementation((input) =>
      isNameQuery(new URL(String(input)))
        ? new Promise((resolve) => {
            answerNames = resolve;
          })
        : Promise.resolve(answer([raw(2), raw(3)])),
    );
    const search = searchDirectory('jazz', new AbortController().signal);
    await Promise.resolve();
    answerNames(answer([raw(1), raw(2)]));
    expect(ids(await search)).toEqual(['rb-uuid-1', 'rb-uuid-2', 'rb-uuid-3']);
  });

  it('returns at most 40 stations', async () => {
    const names = Array.from({ length: 30 }, (_, i) => raw(i + 1));
    const tags = Array.from({ length: 15 }, (_, i) => raw(i + 31));
    fetchMock.mockImplementation(async (input) => answer(isNameQuery(new URL(String(input))) ? names : tags));
    const found = await searchDirectory('jazz', new AbortController().signal);
    expect(found).toHaveLength(40);
    expect(found.at(-1)?.id).toBe('rb-uuid-40');
  });

  it('leaves out what cannot play in the app', async () => {
    fetchMock.mockResolvedValue(answer([raw(1, { url_resolved: 'http://stream.example/1.mp3' }), raw(2), { junk: true }]));
    expect(ids(await searchDirectory('jazz', new AbortController().signal))).toEqual(['rb-uuid-2']);
  });

  it('falls over to the next mirror, then sticks to the one that answered', async () => {
    fetchMock.mockImplementation(async (input) => {
      const mirror = mirrorOf(new URL(String(input)));
      if (mirror === 'all') throw new TypeError('Failed to fetch');
      if (mirror === 'de1') return answer('Service Unavailable', 503);
      return answer([raw(1)]);
    });
    expect(ids(await searchDirectory('jazz', new AbortController().signal))).toEqual(['rb-uuid-1']);
    const tried = requests().filter(isNameQuery).map(mirrorOf);
    expect(tried).toEqual(['all', 'de1', 'de2']);

    fetchMock.mockClear();
    await searchDirectory('rock', new AbortController().signal);
    expect(requests().map(mirrorOf)).toEqual(['de2', 'de2']);
  });

  it('treats an unreadable answer as a failure of that mirror', async () => {
    fetchMock.mockImplementation(async (input) =>
      mirrorOf(new URL(String(input))) === 'all'
        ? ({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('Unexpected token <')) } as unknown as Response)
        : answer([raw(1)]),
    );
    expect(ids(await searchDirectory('jazz', new AbortController().signal))).toEqual(['rb-uuid-1']);
  });

  it('gives up on a silent mirror after 8 seconds', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((input, init) =>
      mirrorOf(new URL(String(input))) === 'all' ? pending(input, init) : Promise.resolve(answer([raw(1)])),
    );
    const search = searchDirectory('jazz', new AbortController().signal);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(requests().map(mirrorOf)).toEqual(['all', 'all']);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(ids(await search)).toEqual(['rb-uuid-1']);
    expect(requests().map(mirrorOf)).toEqual(['all', 'all', 'de1', 'de1']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns what one query found when the other fails on every mirror', async () => {
    fetchMock.mockImplementation(async (input) =>
      isNameQuery(new URL(String(input))) ? answer([raw(1)]) : answer('Internal Server Error', 500),
    );
    expect(ids(await searchDirectory('jazz', new AbortController().signal))).toEqual(['rb-uuid-1']);
    expect(requests().filter((url) => !isNameQuery(url)).map(mirrorOf)).toEqual(['all', 'de1', 'de2']);
  });

  it('tries every mirror once per query, even when the other query settles on another mirror meanwhile', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (mirrorOf(url) === 'all') throw new TypeError('Failed to fetch');
      return isNameQuery(url) ? answer([raw(1)]) : answer('Internal Server Error', 500);
    });
    expect(ids(await searchDirectory('jazz', new AbortController().signal))).toEqual(['rb-uuid-1']);
    expect(requests().filter(isNameQuery).map(mirrorOf)).toEqual(['all', 'de1']);
    expect(requests().filter((url) => !isNameQuery(url)).map(mirrorOf)).toEqual(['all', 'de1', 'de2']);
  });

  it('fails with the last error once both queries have failed on every mirror', async () => {
    fetchMock.mockImplementation(async (input) => {
      throw new TypeError(`${mirrorOf(new URL(String(input)))} is down`);
    });
    await expect(searchDirectory('jazz', new AbortController().signal)).rejects.toThrow('de2 is down');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('reports HTTP errors', async () => {
    fetchMock.mockResolvedValue(answer('Bad Gateway', 502));
    await expect(searchDirectory('jazz', new AbortController().signal)).rejects.toThrow('HTTP 502');
  });

  it('stops at once when the search is cancelled, without trying other mirrors', async () => {
    fetchMock.mockImplementation(pending);
    const controller = new AbortController();
    const search = searchDirectory('jazz', controller.signal);
    controller.abort();
    await expect(search).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  });

  it('does not search at all with a signal that is already aborted', async () => {
    fetchMock.mockResolvedValue(answer([raw(1)]));
    const controller = new AbortController();
    controller.abort();
    await expect(searchDirectory('jazz', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not cut a slow answer short once the outer search is over', async () => {
    fetchMock.mockResolvedValue(answer([raw(1)]));
    const controller = new AbortController();
    await searchDirectory('jazz', controller.signal);
    controller.abort();
    expect(fetchMock.mock.calls.some(([, init]) => init?.signal?.aborted)).toBe(false);
    expect(urlOf(0).hostname).toBe('all.api.radio-browser.info');
  });
});
