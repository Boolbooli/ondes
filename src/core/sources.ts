import type { Quality, Station, StreamSource } from './types';

export interface Capabilities {
  /** Safari/iOS play HLS natively. */
  readonly nativeHls: boolean;
  /** Media Source Extensions, for hls.js elsewhere. */
  readonly mse: boolean;
}

export function detectCapabilities(audio: HTMLMediaElement): Capabilities {
  const nativeHls = audio.canPlayType('application/vnd.apple.mpegurl') !== '';
  const ms = (globalThis as { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource ?? globalThis.MediaSource;
  let mse = false;
  try {
    mse = typeof ms === 'function' && ms.isTypeSupported('audio/mp4; codecs="mp4a.40.2"');
  } catch {
    mse = false;
  }
  return { nativeHls, mse };
}

/** Playable sources, the preferred quality first, keeping the catalogue order within each tier. */
export function orderSources(station: Station, quality: Quality, caps: Capabilities): StreamSource[] {
  const playable = station.streams.filter((s) => s.kind === 'icy' || caps.nativeHls || caps.mse);
  return [...playable.filter((s) => s.quality === quality), ...playable.filter((s) => s.quality !== quality)];
}

export const isHlsUrl = (url: string): boolean => /\.m3u8(?:$|[?#])/i.test(url);
