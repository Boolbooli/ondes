/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export * from 'hls.js';
  export default Hls;
}

interface Navigator {
  /** iOS home-screen web apps. */
  readonly standalone?: boolean;
  /** WebKit Audio Session API (Safari 16.4+). */
  readonly audioSession?: { type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record' };
}

interface HTMLMediaElement {
  /** AirPlay route picker (Safari). */
  webkitShowPlaybackTargetPicker?: () => void;
  /** Wall-clock date of media time 0 for streams with EXT-X-PROGRAM-DATE-TIME (Safari). */
  getStartDate?: () => Date;
}
