export type Lang = 'fr' | 'en';
export type Localized = { readonly fr: string; readonly en: string };

export type LineId = 'fav' | 'rf' | 'fip' | 'fm' | 'info' | 'jazz' | 'monde' | 'perso';
export type Quality = 'hifi' | 'eco';
export type StreamKind = 'hls' | 'icy';

/**
 * How advertising reaches the listener.
 * - `none`: no advertising on air.
 * - `onair`: the station airs its own breaks, exactly as on FM.
 * - `stream`: the station also inserts ads into its internet stream (cannot be avoided).
 * - `unknown`: not verified.
 */
export type AdPolicy = 'none' | 'onair' | 'stream' | 'unknown';

export interface StreamSource {
  readonly url: string;
  readonly kind: StreamKind;
  readonly codec: string;
  /** kbit/s, 0 when unknown. */
  readonly bitrate: number;
  readonly quality: Quality;
}

export type MetaSource =
  | { readonly kind: 'radiofrance'; readonly id: number; readonly rules: string }
  | { readonly kind: 'kexp' }
  | { readonly kind: 'somafm'; readonly channel: string }
  | { readonly kind: 'nts'; readonly channel: '1' | '2' };

export interface Station {
  readonly id: string;
  readonly name: string;
  /** Home line; a station may also appear on "Ma ligne". */
  readonly line: LineId;
  /** ISO 3166-1 alpha-2, empty when unknown. */
  readonly country: string;
  readonly tagline: Localized;
  readonly streams: readonly StreamSource[];
  /** Rewindable playlist with the same programme (seconds of history). */
  readonly timeshift?: { readonly url: string; readonly window: number };
  readonly meta?: MetaSource;
  readonly ads: AdPolicy;
  readonly site?: string;
  readonly custom?: boolean;
}

export interface Line {
  readonly id: LineId;
  /** Text inside the roundel. */
  readonly roundel: string;
  readonly name: Localized;
  /** Line ink; `onInk` is the roundel text colour on it. */
  readonly ink: string;
  readonly onInk: string;
  /** Darker ink for the light tile theme when `ink` lacks contrast on white. */
  readonly inkLight?: string;
}

export type NowPlayingKind = 'program' | 'song' | 'about';

export interface NowPlaying {
  readonly kind: NowPlayingKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly cover?: string;
  /** Epoch milliseconds. */
  readonly start?: number;
  readonly end?: number;
  readonly next?: { readonly title: string; readonly subtitle?: string; readonly start?: number };
  /** Suggested delay before the next poll, in milliseconds. */
  readonly refreshIn: number;
}
