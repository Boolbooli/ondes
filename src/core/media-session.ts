import type { NowPlaying, Station } from './types';

export interface SessionHandlers {
  play(): void;
  pause(): void;
  previous(): void;
  next(): void;
  /** Present only for stations that can rewind. */
  seekBy?: (seconds: number) => void;
}

const session = (): MediaSession | null =>
  typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;

function setAction(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
  try {
    session()?.setActionHandler(action, handler);
  } catch {
    // The action is not supported by this browser.
  }
}

/**
 * Lock screen, Control Center, CarPlay and headset controls. Previous and next walk the
 * current line; stations that can rewind get ±30 s skips instead, as iOS shows one pair.
 */
export function setSessionHandlers(handlers: SessionHandlers): void {
  setAction('play', () => handlers.play());
  setAction('pause', () => handlers.pause());
  setAction('stop', () => handlers.pause());
  setAction('previoustrack', () => handlers.previous());
  setAction('nexttrack', () => handlers.next());
  const seekBy = handlers.seekBy;
  setAction('seekbackward', seekBy ? (details) => seekBy(-(details.seekOffset ?? 30)) : null);
  setAction('seekforward', seekBy ? (details) => seekBy(details.seekOffset ?? 30) : null);
}

export const stationArtPath = (station: Station): string =>
  station.custom ? 'icons/icon-512.png' : `art/${station.id}.png`;

export interface SessionMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: MediaImage[];
}

/** What the lock screen shows: the song or programme when known, else the station. */
export function sessionMetadata(station: Station, nowPlaying: NowPlaying | null, baseUrl: string): SessionMetadata {
  const art = new URL(stationArtPath(station), baseUrl).href;
  const artwork: MediaImage[] = [];
  if (nowPlaying?.cover) artwork.push({ src: nowPlaying.cover, sizes: '400x400' });
  artwork.push({ src: art, sizes: '512x512', type: 'image/png' });
  if (!nowPlaying || nowPlaying.kind === 'about') {
    return { title: station.name, artist: '', album: '', artwork };
  }
  if (nowPlaying.kind === 'song') {
    return { title: nowPlaying.title, artist: nowPlaying.subtitle ?? station.name, album: station.name, artwork };
  }
  return { title: nowPlaying.title, artist: station.name, album: nowPlaying.subtitle ?? '', artwork };
}

let lastKey = '';

export function applySessionMetadata(metadata: SessionMetadata | null): void {
  const ms = session();
  if (!ms || typeof MediaMetadata === 'undefined') return;
  const key = metadata ? JSON.stringify(metadata) : '';
  if (key === lastKey) return;
  lastKey = key;
  ms.metadata = metadata ? new MediaMetadata(metadata) : null;
}

export function setSessionPlaybackState(state: MediaSessionPlaybackState): void {
  const ms = session();
  if (ms) ms.playbackState = state;
}
