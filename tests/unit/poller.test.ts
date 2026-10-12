import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import kexp from '../fixtures/kexp.json';
import nts from '../fixtures/nts.json';
import rfFip from '../fixtures/rf-fip.json';
import somafm from '../fixtures/somafm.json';
import {
  normalizeKexp,
  normalizeNts,
  normalizeRadioFrance,
  normalizeSomaFm,
  UnknownFormat,
} from '../../src/core/now-playing/normalize';
import { fetchNowPlaying, metaUrl, normalizeNowPlaying, NowPlayingPoller } from '../../src/core/now-playing/poller';
import type { MetaSource, Station } from '../../src/core/types';

const NOW = Date.parse('2026-10-11T16:30:00Z');
/** The FIP fixture's song started at this instant and ends 190 s later. */
const FIP_SONG_START = 1_791_734_726_000;

const station = (id: string, meta?: MetaSource): Station => ({
  id,
  name: id,
  line: 'monde',
  country: '',
  tagline: { fr: id, en: id },
  streams: [],
  ads: 'unknown',
  meta,
});

const KEXP = station('kexp', { kind: 'kexp' });
const SOMA = station('soma-groovesalad', { kind: 'somafm', channel: 'groovesalad' });
const FIP_META: MetaSource = { kind: 'radiofrance', id: 7, rules: 'transistor_musical_player' };
const FIP = station('fip', FIP_META);

/** A fetch answer with only what the poller reads. */
const answer = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

/** A request that never answers, until it is aborted. */
const pending = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Lets resolved fetches and their `.then` chains run, without moving the clock. */
const settle = () => vi.advanceTimersByTimeAsync(0);

let fetchMock: MockInstance<typeof fetch>;
let releases: (() => void)[] = [];

/** Subscriptions made in a test are released after it, so no poller outlives its test. */
const hold = (release: () => void): (() => void) => {
  releases.push(release);
  return release;
};

const signalOf = (call: number): AbortSignal | null | undefined => fetchMock.mock.calls[call]?.[1]?.signal;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fetchMock = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  for (const release of releases) release();
  releases = [];
  vi.useRealTimers();
});

describe('metaUrl', () => {
  it.each<[MetaSource, string]>([
    [
      { kind: 'radiofrance', id: 7, rules: 'transistor_musical_player' },
      'https://api.radiofrance.fr/livemeta/live/7/transistor_musical_player',
    ],
    [{ kind: 'kexp' }, 'https://api.kexp.org/v2/plays/?format=json&limit=1'],
    [{ kind: 'somafm', channel: 'groovesalad' }, 'https://somafm.com/songs/groovesalad.json'],
    [{ kind: 'nts', channel: '1' }, 'https://www.nts.live/api/v2/live'],
    [{ kind: 'nts', channel: '2' }, 'https://www.nts.live/api/v2/live'],
  ])('points %o at %s', (meta, url) => {
    expect(metaUrl(meta)).toBe(url);
  });
});

describe('normalizeNowPlaying', () => {
  it('hands each answer to the normalizer of its source', () => {
    const now = FIP_SONG_START + 60_000;
    expect(normalizeNowPlaying(FIP_META, rfFip, now)).toEqual(normalizeRadioFrance(rfFip, now));
    expect(normalizeNowPlaying({ kind: 'kexp' }, kexp, now)).toEqual(normalizeKexp(kexp));
    expect(normalizeNowPlaying({ kind: 'somafm', channel: 'groovesalad' }, somafm, now)).toEqual(normalizeSomaFm(somafm));
    expect(normalizeNowPlaying({ kind: 'nts', channel: '2' }, nts, now)).toEqual(normalizeNts(nts, '2', now));
  });

  it('passes the time and the NTS channel through', () => {
    expect(normalizeNowPlaying(FIP_META, rfFip, FIP_SONG_START)?.refreshIn).toBe(160_000);
    expect(normalizeNowPlaying(FIP_META, rfFip, FIP_SONG_START + 60_000)?.refreshIn).toBe(133_000);
    expect(normalizeNowPlaying({ kind: 'nts', channel: '1' }, nts, NOW)?.title).toBe('A Month of Sundays w/ Bill Spencer');
    expect(normalizeNowPlaying({ kind: 'nts', channel: '2' }, nts, NOW)?.title).toBe('Hip-Hop & Soul w/ Guests');
  });

  it.each<MetaSource>([
    { kind: 'radiofrance', id: 1, rules: 'transistor_inter_player' },
    { kind: 'kexp' },
    { kind: 'somafm', channel: 'groovesalad' },
    { kind: 'nts', channel: '1' },
  ])('throws UnknownFormat for an empty answer from $kind', (meta) => {
    expect(() => normalizeNowPlaying(meta, {}, NOW)).toThrow(UnknownFormat);
  });
});

describe('fetchNowPlaying', () => {
  it('requests the source without cache or credentials and normalizes its answer', async () => {
    fetchMock.mockResolvedValue(answer(somafm));
    const { signal } = new AbortController();
    await expect(fetchNowPlaying({ kind: 'somafm', channel: 'groovesalad' }, signal)).resolves.toEqual(
      normalizeSomaFm(somafm),
    );
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://somafm.com/songs/groovesalad.json', {
      signal,
      cache: 'no-store',
      credentials: 'omit',
    });
  });

  it('normalizes against the current time', async () => {
    vi.setSystemTime(FIP_SONG_START + 60_000);
    fetchMock.mockResolvedValue(answer(rfFip));
    await expect(fetchNowPlaying(FIP_META, new AbortController().signal)).resolves.toMatchObject({ refreshIn: 133_000 });
  });

  it('rejects on an HTTP error', async () => {
    fetchMock.mockResolvedValue(answer({ results: [] }, 503));
    await expect(fetchNowPlaying({ kind: 'kexp' }, new AbortController().signal)).rejects.toThrow('HTTP 503');
  });

  it('rejects with UnknownFormat when the API has changed', async () => {
    fetchMock.mockResolvedValue(answer({ plays: [] }));
    await expect(fetchNowPlaying({ kind: 'kexp' }, new AbortController().signal)).rejects.toBeInstanceOf(UnknownFormat);
  });
});

describe('NowPlayingPoller', () => {
  it('polls once on subscribe and passes the normalized value on', async () => {
    fetchMock.mockResolvedValue(answer(kexp));
    const update = vi.fn();
    hold(new NowPlayingPoller(update).subscribe(KEXP));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.kexp.org/v2/plays/?format=json&limit=1');
    await settle();
    expect(update).toHaveBeenCalledExactlyOnceWith('kexp', normalizeKexp(kexp));
  });

  it('polls again after the refreshIn of the last value', async () => {
    fetchMock.mockResolvedValue(answer(kexp));
    hold(new NowPlayingPoller(vi.fn()).subscribe(KEXP));
    await settle();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('follows the Radio France hint, capped 3 s after the end of the song', async () => {
    vi.setSystemTime(FIP_SONG_START + 60_000);
    fetchMock.mockResolvedValue(answer(rfFip));
    const update = vi.fn();
    hold(new NowPlayingPoller(update).subscribe(FIP));
    await settle();
    expect(update).toHaveBeenCalledWith('fip', expect.objectContaining({ subtitle: 'Placido Domingo', refreshIn: 133_000 }));
    await vi.advanceTimersByTimeAsync(132_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one poll between subscribers and stops with the last one', async () => {
    fetchMock.mockResolvedValue(answer(kexp));
    const update = vi.fn();
    const poller = new NowPlayingPoller(update);
    const first = hold(poller.subscribe(KEXP));
    const second = hold(poller.subscribe(KEXP));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await settle();
    expect(update).toHaveBeenCalledTimes(1);

    first();
    first(); // releasing twice must not drop the other subscriber's reference
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    second();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts afresh when subscribed again after the last release', () => {
    fetchMock.mockResolvedValue(answer(kexp));
    const poller = new NowPlayingPoller(vi.fn());
    poller.subscribe(KEXP)();
    hold(poller.subscribe(KEXP));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signalOf(0)?.aborted).toBe(true);
    expect(signalOf(1)?.aborted).toBe(false);
  });

  it('aborts the request in flight when the last subscriber leaves', async () => {
    fetchMock.mockImplementation(pending);
    const update = vi.fn();
    const release = new NowPlayingPoller(update).subscribe(KEXP);
    expect(signalOf(0)?.aborted).toBe(false);
    release();
    expect(signalOf(0)?.aborted).toBe(true);
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores an answer that arrives after the last subscriber left', async () => {
    const late = deferred<Response>();
    fetchMock.mockReturnValue(late.promise);
    const update = vi.fn();
    const release = new NowPlayingPoller(update).subscribe(KEXP);
    release();
    late.resolve(answer(kexp));
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the last value on a network error and retries after a minute', async () => {
    fetchMock
      .mockResolvedValueOnce(answer(kexp))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(answer(kexp));
    const update = vi.fn();
    hold(new NowPlayingPoller(update).subscribe(KEXP));
    await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith('kexp', normalizeKexp(kexp));
  });

  it('treats an HTTP error like a network error', async () => {
    fetchMock.mockResolvedValueOnce(answer(kexp)).mockResolvedValue(answer('Bad Gateway', 502));
    const update = vi.fn();
    hold(new NowPlayingPoller(update).subscribe(KEXP));
    await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('clears the value when the API changes shape, then retries after a minute', async () => {
    fetchMock.mockResolvedValueOnce(answer(kexp)).mockResolvedValueOnce(answer({ plays: [] })).mockResolvedValue(answer(kexp));
    const update = vi.fn();
    hold(new NowPlayingPoller(update).subscribe(KEXP));
    await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith('kexp', null);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('passes null on during an air break and looks again after a minute', async () => {
    fetchMock.mockResolvedValue(answer({ results: [{ play_type: 'airbreak' }] }));
    const update = vi.fn();
    hold(new NowPlayingPoller(update).subscribe(KEXP));
    await settle();
    expect(update).toHaveBeenCalledExactlyOnceWith('kexp', null);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a request after 8 s and retries a minute later', async () => {
    fetchMock.mockImplementation(pending);
    const update = vi.fn();
    hold(new NowPlayingPoller(update).subscribe(KEXP));
    await vi.advanceTimersByTimeAsync(7_999);
    expect(signalOf(0)?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signalOf(0)?.aborted).toBe(true);
    expect(update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a station without live metadata', () => {
    const release = new NowPlayingPoller(vi.fn()).subscribe(station('courtoisie'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => release()).not.toThrow();
  });

  it('refreshes on demand, superseding the request in flight and the scheduled poll', async () => {
    const first = deferred<Response>();
    fetchMock.mockReturnValueOnce(first.promise).mockResolvedValue(answer(kexp));
    const update = vi.fn();
    const poller = new NowPlayingPoller(update);
    hold(poller.subscribe(KEXP));

    poller.refresh('kexp');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signalOf(0)?.aborted).toBe(true);
    first.resolve(answer({ results: [{ play_type: 'airbreak' }] }));
    await settle();
    expect(update).toHaveBeenCalledExactlyOnceWith('kexp', normalizeKexp(kexp));

    await vi.advanceTimersByTimeAsync(10_000);
    poller.refresh('kexp');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await settle();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('ignores refresh for a station nobody follows', () => {
    new NowPlayingPoller(vi.fn()).refresh('kexp');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sleeps while the page is hidden, except for background subscribers, and catches up when visible', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fetchMock.mockImplementation(async (input) => answer(String(input).includes('kexp') ? kexp : somafm));
    const polls = (host: string) => fetchMock.mock.calls.filter(([input]) => String(input).includes(host)).length;
    const poller = new NowPlayingPoller(vi.fn());
    hold(poller.subscribe(KEXP));
    hold(poller.subscribe(SOMA, { background: true }));
    await settle();
    expect([polls('kexp'), polls('somafm')]).toEqual([1, 1]);

    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect([polls('kexp'), polls('somafm')]).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect([polls('kexp'), polls('somafm')]).toEqual([1, 4]);

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect([polls('kexp'), polls('somafm')]).toEqual([2, 4]);
    await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    expect([polls('kexp'), polls('somafm')]).toEqual([3, 5]);
  });

  it('keeps polling in the background only while a background subscription is held', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fetchMock.mockResolvedValue(answer(kexp));
    const poller = new NowPlayingPoller(vi.fn());
    hold(poller.subscribe(KEXP));
    const player = hold(poller.subscribe(KEXP, { background: true }));
    await settle();

    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    player();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('starts hidden when the page is hidden at construction', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fetchMock.mockResolvedValue(answer(kexp));
    hold(new NowPlayingPoller(vi.fn()).subscribe(KEXP));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
