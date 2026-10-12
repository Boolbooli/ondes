import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectCapabilities, isHlsUrl, orderSources } from '../../src/core/sources';
import type { Capabilities } from '../../src/core/sources';
import type { Station, StreamSource } from '../../src/core/types';

const AAC_LC = 'audio/mp4; codecs="mp4a.40.2"';

const source = (name: string, kind: StreamSource['kind'], quality: StreamSource['quality']): StreamSource => ({
  url: `https://stream.example/${name}${kind === 'hls' ? '.m3u8' : ''}`,
  kind,
  codec: 'AAC',
  bitrate: quality === 'hifi' ? 192 : 64,
  quality,
});

const station = (...streams: StreamSource[]): Station => ({
  id: 'test',
  name: 'Test',
  line: 'monde',
  country: 'FR',
  tagline: { fr: 'Test', en: 'Test' },
  streams,
  ads: 'none',
});

/** A MediaSource-like constructor whose `isTypeSupported` is a spy. */
const mediaSource = (supported: (type: string) => boolean) =>
  Object.assign(function MediaSource() {}, { isTypeSupported: vi.fn(supported) });

const audioThatPlays = (answer: CanPlayTypeResult) => {
  const audio = document.createElement('audio');
  vi.spyOn(audio, 'canPlayType').mockReturnValue(answer);
  return audio;
};

const names = (sources: readonly StreamSource[]) =>
  sources.map((s) => s.url.replace('https://stream.example/', '').replace(/\.m3u8$/, ''));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectCapabilities', () => {
  it.each<[CanPlayTypeResult, boolean]>([
    ['maybe', true],
    ['probably', true],
    ['', false],
  ])('reports native HLS when the element answers %j for the HLS MIME type', (answer, nativeHls) => {
    vi.stubGlobal('MediaSource', undefined);
    const audio = audioThatPlays(answer);
    expect(detectCapabilities(audio)).toEqual({ nativeHls, mse: false });
    expect(audio.canPlayType).toHaveBeenCalledWith('application/vnd.apple.mpegurl');
  });

  it('reports MSE when MediaSource supports AAC-LC in MP4', () => {
    const ms = mediaSource((type) => type === AAC_LC);
    vi.stubGlobal('MediaSource', ms);
    expect(detectCapabilities(audioThatPlays(''))).toEqual({ nativeHls: false, mse: true });
    expect(ms.isTypeSupported).toHaveBeenCalledWith(AAC_LC);
  });

  it('reports no MSE when MediaSource cannot play AAC-LC', () => {
    vi.stubGlobal('MediaSource', mediaSource(() => false));
    expect(detectCapabilities(audioThatPlays('')).mse).toBe(false);
  });

  it('prefers ManagedMediaSource (iOS 17.1+) over MediaSource', () => {
    const managed = mediaSource(() => true);
    const classic = mediaSource(() => false);
    vi.stubGlobal('ManagedMediaSource', managed);
    vi.stubGlobal('MediaSource', classic);
    expect(detectCapabilities(audioThatPlays('')).mse).toBe(true);
    expect(managed.isTypeSupported).toHaveBeenCalledWith(AAC_LC);
    expect(classic.isTypeSupported).not.toHaveBeenCalled();
  });

  it('uses ManagedMediaSource alone, as on iPhone where MediaSource is missing', () => {
    vi.stubGlobal('ManagedMediaSource', mediaSource(() => true));
    vi.stubGlobal('MediaSource', undefined);
    expect(detectCapabilities(audioThatPlays('maybe'))).toEqual({ nativeHls: true, mse: true });
  });

  it('reports no MSE when neither MediaSource nor ManagedMediaSource exists', () => {
    vi.stubGlobal('MediaSource', undefined);
    expect(detectCapabilities(audioThatPlays('')).mse).toBe(false);
  });

  it('reports no MSE when MediaSource is not a constructor', () => {
    vi.stubGlobal('MediaSource', { isTypeSupported: () => true });
    expect(detectCapabilities(audioThatPlays('')).mse).toBe(false);
  });

  it('reports no MSE when isTypeSupported throws', () => {
    vi.stubGlobal(
      'MediaSource',
      mediaSource(() => {
        throw new Error('not allowed');
      }),
    );
    expect(detectCapabilities(audioThatPlays('')).mse).toBe(false);
  });
});

describe('orderSources', () => {
  const hlsHifi = source('hls-hifi', 'hls', 'hifi');
  const icyHifi = source('icy-hifi', 'icy', 'hifi');
  const hlsEco = source('hls-eco', 'hls', 'eco');
  const icyEco = source('icy-eco', 'icy', 'eco');
  const icyEco2 = source('icy-eco-2', 'icy', 'eco');
  const mixed = station(icyEco, hlsHifi, icyEco2, hlsEco, icyHifi);

  const native: Capabilities = { nativeHls: true, mse: false };
  const mse: Capabilities = { nativeHls: false, mse: true };
  const none: Capabilities = { nativeHls: false, mse: false };

  it('puts the preferred quality first, keeping the catalogue order within each tier', () => {
    expect(names(orderSources(mixed, 'hifi', native))).toEqual(['hls-hifi', 'icy-hifi', 'icy-eco', 'icy-eco-2', 'hls-eco']);
    expect(names(orderSources(mixed, 'eco', native))).toEqual(['icy-eco', 'icy-eco-2', 'hls-eco', 'hls-hifi', 'icy-hifi']);
  });

  it('keeps HLS sources when hls.js can play them through MSE', () => {
    expect(orderSources(mixed, 'hifi', mse)).toEqual(orderSources(mixed, 'hifi', native));
  });

  it('drops HLS sources when the browser can play HLS neither natively nor through MSE', () => {
    const ordered = orderSources(mixed, 'hifi', none);
    expect(names(ordered)).toEqual(['icy-hifi', 'icy-eco', 'icy-eco-2']);
    expect(ordered.every((s) => s.kind === 'icy')).toBe(true);
  });

  it('returns nothing for an HLS-only station without HLS support', () => {
    expect(orderSources(station(hlsHifi, hlsEco), 'eco', none)).toEqual([]);
  });

  it('falls back to the other quality when the preferred one is missing', () => {
    expect(names(orderSources(station(icyHifi), 'eco', none))).toEqual(['icy-hifi']);
  });

  it('returns the same source objects without touching the station', () => {
    const before = [...mixed.streams];
    const ordered = orderSources(mixed, 'eco', native);
    expect(mixed.streams).toEqual(before);
    expect(ordered).not.toBe(mixed.streams);
    expect(ordered[0]).toBe(icyEco);
  });
});

describe('isHlsUrl', () => {
  it.each([
    'https://stream.example/live.m3u8',
    'https://stream.example/LIVE.M3U8',
    'https://stream.example/live.m3u8?token=abc',
    'https://stream.example/live.m3u8#t=10',
  ])('recognises %s', (url) => {
    expect(isHlsUrl(url)).toBe(true);
  });

  it.each([
    'https://stream.example/live.m3u',
    'https://stream.example/live.mp3',
    'https://stream.example/live.m3u8x',
    'https://stream.example/m3u8/live.aac',
    'https://stream.example/live.aac?format=m3u8',
    '',
  ])('rejects %j', (url) => {
    expect(isHlsUrl(url)).toBe(false);
  });
});
