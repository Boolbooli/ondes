import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import {
  checkStreamUrl,
  hashString,
  parseCustomStations,
  resolveStreamUrl,
  stationFromUrl,
} from '../../src/core/custom-stations';
import { toDirectoryStation } from '../../src/core/radio-browser';
import type { Station } from '../../src/core/types';

/** A fetch answer with only what the playlist resolver reads. */
const answer = (body: string, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as unknown as Response;

/** Same data after a trip through localStorage. */
const stored = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** A custom station as stored, with fields overridden. */
const saved = (fields: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'url-abc123',
  name: 'Ma radio',
  line: 'perso',
  country: 'FR',
  tagline: { fr: 'radio.example', en: 'radio.example' },
  streams: [{ url: 'https://radio.example/live.mp3', kind: 'icy', codec: 'MP3', bitrate: 128, quality: 'hifi' }],
  ads: 'unknown',
  custom: true,
  ...fields,
});

const parseOne = (value: unknown): Station | undefined => parseCustomStations([value])?.[0];

describe('hashString', () => {
  it('is 32-bit FNV-1a, written in base 36', () => {
    expect(hashString('')).toBe((0x811c9dc5).toString(36));
    expect(hashString('a')).toBe((0xe40c292c).toString(36));
    expect(hashString('foobar')).toBe((0xbf9cf968).toString(36));
  });

  it('is stable, tells close URLs apart and fits in a station id', () => {
    const url = 'https://radio.example/live.mp3';
    expect(hashString(url)).toBe(hashString(url));
    expect(hashString(url)).not.toBe(hashString('https://radio.example/live.aac'));
    expect(hashString('https://radio.example/😀')).toMatch(/^[0-9a-z]+$/);
  });
});

describe('checkStreamUrl', () => {
  it('accepts an HTTPS address, trimmed and normalised', () => {
    expect(checkStreamUrl('  HTTPS://Radio.Example/live stream  ')).toEqual({
      ok: true,
      url: 'https://radio.example/live%20stream',
    });
    expect(checkStreamUrl('https://radio.example')).toEqual({ ok: true, url: 'https://radio.example/' });
  });

  it.each(['http://radio.example/live', 'HTTP://radio.example:8000/;'])('explains that %s is not secure', (input) => {
    expect(checkStreamUrl(input)).toEqual({ ok: false, reason: 'http' });
  });

  it.each([
    '',
    '   ',
    'radio.example/live',
    'not a url',
    'https://',
    'ftp://radio.example/live.mp3',
    'javascript:alert(1)',
    'data:audio/mpeg;base64,AAAA',
    'file:///C:/music/live.mp3',
  ])('rejects %j as invalid', (input) => {
    expect(checkStreamUrl(input)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('resolveStreamUrl', () => {
  let fetchMock: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  it.each(['https://radio.example/live.mp3', 'https://radio.example/live.m3u8', 'https://radio.example/m3u/live'])(
    'returns %s as it is, without a request',
    async (url) => {
      await expect(resolveStreamUrl(url)).resolves.toBe(url);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('follows a PLS playlist to its first entry, without cookies', async () => {
    fetchMock.mockResolvedValue(
      answer('[playlist]\r\nNumberOfEntries=2\r\nFile1=https://radio.example/a.mp3\r\nFile2=https://radio.example/b.mp3\r\n'),
    );
    const signal = new AbortController().signal;
    await expect(resolveStreamUrl('https://radio.example/listen.pls', signal)).resolves.toBe('https://radio.example/a.mp3');
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://radio.example/listen.pls', { signal, credentials: 'omit' });
  });

  it('follows an M3U playlist past its comments', async () => {
    fetchMock.mockResolvedValue(answer('#EXTM3U\n#EXTINF:-1,Ma radio\nhttps://radio.example/live.aac\n'));
    await expect(resolveStreamUrl('https://radio.example/listen.m3u?sid=1')).resolves.toBe('https://radio.example/live.aac');
  });

  it('leaves checking the found address to the caller', async () => {
    fetchMock.mockResolvedValue(answer('http://radio.example:8000/live\n'));
    await expect(resolveStreamUrl('https://radio.example/listen.m3u')).resolves.toBe('http://radio.example:8000/live');
  });

  it('fails on an HTTP error', async () => {
    fetchMock.mockResolvedValue(answer('Not Found', 404));
    await expect(resolveStreamUrl('https://radio.example/listen.pls')).rejects.toThrow('HTTP 404');
  });

  it.each([
    ['an empty file', ''],
    ['comments only', '#EXTM3U\n#EXTINF:-1,Nothing\n'],
    ['an HLS playlist in disguise', '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nsegment1.aac\n'],
    ['a PLS without entries', '[playlist]\nNumberOfEntries=0\n'],
  ])('fails on %s', async (_label, body) => {
    fetchMock.mockResolvedValue(answer(body));
    await expect(resolveStreamUrl('https://radio.example/listen.m3u')).rejects.toThrow('empty-playlist');
  });

  it('passes network errors and cancellation through', async () => {
    const offline = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValueOnce(offline);
    await expect(resolveStreamUrl('https://radio.example/listen.pls')).rejects.toBe(offline);

    const aborted = new DOMException('The operation was aborted.', 'AbortError');
    fetchMock.mockRejectedValueOnce(aborted);
    await expect(resolveStreamUrl('https://radio.example/listen.pls', AbortSignal.abort())).rejects.toBe(aborted);
  });
});

describe('stationFromUrl', () => {
  it('makes a custom station on "My stations" from a pasted address', () => {
    const url = 'https://www.radio.example/live.mp3';
    expect(stationFromUrl(url, '  Ma   radio ')).toEqual({
      id: `url-${hashString(url)}`,
      name: 'Ma radio',
      line: 'perso',
      country: '',
      tagline: { fr: 'radio.example', en: 'radio.example' },
      streams: [{ url, kind: 'icy', codec: '', bitrate: 0, quality: 'hifi' }],
      ads: 'unknown',
      custom: true,
    });
  });

  it('is named after its host when no name is given', () => {
    expect(stationFromUrl('https://www.radio.example/live.mp3', ' ').name).toBe('radio.example');
    expect(stationFromUrl('https://stream.radio.example/live.mp3', '').name).toBe('stream.radio.example');
  });

  it('recognises HLS streams', () => {
    expect(stationFromUrl('https://radio.example/live/master.m3u8', 'HLS').streams[0]?.kind).toBe('hls');
  });

  it('gives the same address the same id, whatever its name', () => {
    const url = 'https://radio.example/live.mp3';
    expect(stationFromUrl(url, 'One').id).toBe(stationFromUrl(url, 'Two').id);
    expect(stationFromUrl(url, 'One').id).not.toBe(stationFromUrl('https://radio.example/live.aac', 'One').id);
  });
});

describe('parseCustomStations', () => {
  it.each([undefined, null, {}, 'stations', 42])('rejects %j', (value) => {
    expect(parseCustomStations(value)).toBeUndefined();
  });

  it('reads back what the app saved', () => {
    const pasted = stationFromUrl('https://radio.example/live.m3u8', 'Ma radio');
    const found = toDirectoryStation({
      stationuuid: '96126f2a-0601-11e8-ae97-52543be04c81',
      name: 'Radio Swiss Jazz',
      url_resolved: 'https://stream.srg-ssr.ch/m/rsj/aacp_96',
      homepage: 'http://www.radioswissjazz.ch/',
      tags: 'jazz,soul',
      countrycode: 'CH',
      codec: 'AAC+',
      bitrate: 96,
    });
    expect(found).toBeDefined();
    expect(parseCustomStations(stored([]))).toEqual([]);
    expect(parseCustomStations(stored([pasted, found]))).toEqual([pasted, found]);
  });

  it('drops broken entries and keeps the others', () => {
    const list = [
      null,
      'url-abc123',
      saved({ id: undefined }),
      saved({ id: 'fip' }),
      saved({ id: 'rb-' }),
      saved({ id: 'url-a b' }),
      saved({ id: 'url-a/b' }),
      saved({ name: '  ' }),
      saved({ streams: [] }),
      saved({ streams: 'https://radio.example/live.mp3' }),
      saved({ streams: [{ url: 'http://radio.example/live.mp3' }, null, { url: 42 }] }),
      saved({ id: 'rb-1234-abcd', name: 'Kept' }),
    ];
    expect(parseCustomStations(stored(list))?.map((s) => s.name)).toEqual(['Kept']);
  });

  it('never lets a stored entry pose as a catalogue station', () => {
    const station = parseOne(saved({ line: 'rf', ads: 'none', custom: false, meta: { kind: 'kexp' } }));
    expect(station).toMatchObject({ line: 'perso', ads: 'unknown', custom: true });
    expect(station).not.toHaveProperty('meta');
  });

  it('trims the id and the name', () => {
    expect(parseOne(saved({ id: ' url-abc123 ', name: '  Ma radio ' }))).toMatchObject({ id: 'url-abc123', name: 'Ma radio' });
  });

  it('keeps only HTTPS streams, with sane defaults', () => {
    const station = parseOne(
      saved({
        streams: [
          { url: 'http://radio.example/insecure.mp3', kind: 'icy' },
          { url: ' https://radio.example/live.m3u8 ', kind: 'hls', codec: 'AAC', bitrate: 192, quality: 'eco' },
          { url: 'https://radio.example/live.mp3', kind: 'dash', codec: '  ', bitrate: -5, quality: 'lossless' },
          { url: 'https://radio.example/live.ogg', bitrate: '128' },
        ],
      }),
    );
    expect(station?.streams).toEqual([
      { url: 'https://radio.example/live.m3u8', kind: 'hls', codec: 'AAC', bitrate: 192, quality: 'eco' },
      { url: 'https://radio.example/live.mp3', kind: 'icy', codec: '', bitrate: 0, quality: 'hifi' },
      { url: 'https://radio.example/live.ogg', kind: 'icy', codec: '', bitrate: 0, quality: 'hifi' },
    ]);
  });

  it('falls back to the French tagline in English, then to nothing', () => {
    expect(parseOne(saved({ tagline: { fr: 'Jazz' } }))?.tagline).toEqual({ fr: 'Jazz', en: 'Jazz' });
    expect(parseOne(saved({ tagline: { en: 'Jazz' } }))?.tagline).toEqual({ fr: '', en: 'Jazz' });
    expect(parseOne(saved({ tagline: 'Jazz' }))?.tagline).toEqual({ fr: '', en: '' });
    expect(parseOne(saved({ tagline: undefined }))?.tagline).toEqual({ fr: '', en: '' });
  });

  it.each<[unknown, string]>([
    ['ch', 'CH'],
    ['FRA', 'FR'],
    [42, ''],
    [undefined, ''],
  ])('normalises the country %j to %j', (country, expected) => {
    expect(parseOne(saved({ country }))?.country).toBe(expected);
  });

  it.each<[unknown, string | undefined]>([
    ['https://radio.example/', 'https://radio.example/'],
    ['http://radio.example/', 'http://radio.example/'],
    ['javascript:alert(1)', undefined],
    ['ftp://radio.example/', undefined],
    [42, undefined],
  ])('keeps only a web site (%j)', (site, expected) => {
    expect(parseOne(saved({ site }))?.site).toBe(expected);
  });
});
