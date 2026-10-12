import type Hls from 'hls.js/light';
import { detectCapabilities, orderSources, type Capabilities } from './sources';
import type { Quality, Station, StreamSource } from './types';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'retrying' | 'offline' | 'error';

/** Playback holds the stream open, or is trying to: a tap on play means pause. */
export const isActive = (status: PlaybackStatus): boolean =>
  status === 'playing' || status === 'loading' || status === 'retrying' || status === 'offline';

/** Waiting for sound to start. */
export const isBusy = (status: PlaybackStatus): boolean => status === 'loading' || status === 'retrying';

export interface PlaybackState {
  readonly status: PlaybackStatus;
  readonly stationId: string | null;
  readonly source: StreamSource | null;
  /** Reconnection attempt shown while retrying (1-based), 0 otherwise. */
  readonly attempt: number;
  /** Seconds behind the live point, for stations that can rewind. */
  readonly behind: number;
  /** Seconds of history that can be rewound, 0 when the station cannot rewind. */
  readonly window: number;
  /** An AirPlay receiver is reachable (Safari). */
  readonly airplay: boolean;
}

const BACKOFF_S = [1, 2, 4, 8, 15];
const MAX_ATTEMPTS = 10;
const LOAD_TIMEOUT = 15_000;
const STALL_TIMEOUT = 12_000;
/** A live stream paused for longer than this restarts at the live point. */
const RELOAD_AFTER_PAUSE = 5_000;
/** Playback this long counts as stable and resets the backoff. */
const STABLE_PLAY = 20_000;
/** Closer than this to the live point counts as live (seconds). */
export const LIVE_SLACK = 8;
/** Distance between the end of a live playlist and the live point (seconds), until measured. */
const DEFAULT_LIVE_OFFSET = 18;

interface Plan {
  readonly station: Station;
  readonly sources: readonly StreamSource[];
  index: number;
  /** `shift` plays the station's rewindable playlist. */
  readonly mode: 'live' | 'shift';
  /** Where to seek once the rewindable playlist is ready: seconds behind live at a wall-clock instant. */
  anchor?: { behind: number; at: number };
}

const shiftSource = (station: Station): StreamSource => {
  const base = station.streams.find((s) => s.kind === 'hls') ?? station.streams[0];
  return {
    url: station.timeshift?.url ?? '',
    kind: 'hls',
    codec: base?.codec ?? 'AAC',
    bitrate: base?.bitrate ?? 0,
    quality: base?.quality ?? 'hifi',
  };
};

function probeVolume(el: HTMLMediaElement): boolean {
  // iOS ignores programmatic volume: the hardware buttons own it.
  try {
    el.volume = 0.5;
    const settable = Math.abs(el.volume - 0.5) < 0.01;
    el.volume = 1;
    return settable;
  } catch {
    return false;
  }
}

/**
 * Plays one station at a time through a single persistent `<audio>` element. iOS unlocks
 * an element once, inside a user gesture; reusing it lets later source changes, retries and
 * lock-screen commands play without a fresh tap. Public methods that start playback do so
 * synchronously so they can be called straight from a tap handler.
 */
export class AudioEngine {
  readonly el: HTMLAudioElement;
  readonly caps: Capabilities;
  readonly volumeSettable: boolean;

  readonly #listeners = new Set<(state: PlaybackState) => void>();
  readonly #getQuality: () => Quality;
  #state: PlaybackState = {
    status: 'idle',
    stationId: null,
    source: null,
    attempt: 0,
    behind: 0,
    window: 0,
    airplay: false,
  };
  #plan: Plan | null = null;
  #token = 0;
  #attempt = 0;
  #hls: Hls | null = null;
  #hlsModule: Promise<typeof Hls> | null = null;
  #retryTimer?: ReturnType<typeof setTimeout>;
  #loadTimer?: ReturnType<typeof setTimeout>;
  #stallTimer?: ReturnType<typeof setInterval>;
  #progress = { time: 0, at: 0 };
  #playingSince = 0;
  #pausedAt = 0;
  #behindAtPause = 0;
  #liveOffset = DEFAULT_LIVE_OFFSET;
  #liveOffsetMeasured = false;
  #lastBehindEmit = 0;
  #sessionReady = false;

  constructor(getQuality: () => Quality) {
    this.#getQuality = getQuality;
    const el = document.createElement('audio');
    el.preload = 'none';
    el.setAttribute('x-webkit-airplay', 'allow');
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    this.el = el;
    this.caps = detectCapabilities(el);
    this.volumeSettable = probeVolume(el);

    el.addEventListener('playing', () => this.#onPlaying());
    el.addEventListener('waiting', () => {
      if (this.#state.status === 'playing') this.#setState({ status: 'loading' });
    });
    el.addEventListener('pause', () => this.#onElementPause());
    el.addEventListener('error', () => {
      if (this.#hls || this.el.getAttribute('src')) this.#fail('media-error');
    });
    el.addEventListener('ended', () => this.#fail('ended'));
    el.addEventListener('timeupdate', () => this.#onTimeUpdate());
    for (const type of ['loadedmetadata', 'canplay', 'durationchange']) {
      el.addEventListener(type, () => this.#applyPendingSeek());
    }
    el.addEventListener('webkitplaybacktargetavailabilitychanged', (event) => {
      const availability = (event as Event & { availability?: string }).availability;
      this.#setState({ airplay: availability === 'available' });
    });

    window.addEventListener('online', () => {
      if (this.#state.status === 'offline' && this.#plan) {
        this.#attempt = 0;
        this.#load();
      }
    });
    window.addEventListener('offline', () => {
      if (this.#state.status === 'retrying') {
        this.#clearTimers();
        this.#setState({ status: 'offline', attempt: 0 });
      }
    });
  }

  get state(): PlaybackState {
    return this.#state;
  }

  get station(): Station | null {
    return this.#plan?.station ?? null;
  }

  subscribe(listener: (state: PlaybackState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  /** Starts a station at its live point. Call from a user gesture the first time. */
  play(station: Station): void {
    this.#prepareSession();
    const sources = orderSources(station, this.#getQuality(), this.caps);
    this.#plan = { station, sources, index: 0, mode: 'live' };
    this.#attempt = 0;
    this.#pausedAt = 0;
    this.#liveOffset = DEFAULT_LIVE_OFFSET;
    this.#liveOffsetMeasured = false;
    this.#setState({
      status: 'loading',
      stationId: station.id,
      source: sources[0] ?? null,
      attempt: 0,
      behind: 0,
      window: station.timeshift?.window ?? 0,
    });
    if (!sources.length) {
      this.#unload();
      this.#setState({ status: 'error' });
      return;
    }
    this.#load();
  }

  pause(): void {
    const status = this.#state.status;
    if (!this.#plan || status === 'paused' || status === 'idle') return;
    this.#behindAtPause = this.#behindNow();
    this.#pausedAt = Date.now();
    this.#clearTimers();
    this.#setState({ status: 'paused', attempt: 0 });
    this.el.pause();
  }

  /** Resumes after a pause: where it stopped if the station can rewind, else at the live point. */
  resume(): void {
    const plan = this.#plan;
    if (!plan) return;
    this.#prepareSession();
    const status = this.#state.status;
    if (status === 'playing' || status === 'loading') return;
    if (status !== 'paused') {
      this.retry();
      return;
    }
    const away = Date.now() - this.#pausedAt;
    const loaded = this.el.readyState > 0 && (this.#hls !== null || this.el.getAttribute('src') !== null);
    if (plan.station.timeshift) {
      if (plan.mode === 'shift' && loaded) {
        this.#quickResume();
        return;
      }
      const behind = this.#behindAtPause + away / 1000;
      if (behind >= LIVE_SLACK) {
        this.seekBehind(behind);
        return;
      }
    }
    if (loaded && away < RELOAD_AFTER_PAUSE) {
      this.#quickResume();
      return;
    }
    this.#attempt = 0;
    this.#setState({ status: 'loading' });
    this.#load();
  }

  toggle(): void {
    if (isActive(this.#state.status)) this.pause();
    else this.resume();
  }

  /** Starts over from the preferred source, e.g. after an error. */
  retry(): void {
    const plan = this.#plan;
    if (!plan) return;
    this.#prepareSession();
    this.#attempt = 0;
    plan.index = 0;
    this.#setState({ status: 'loading', attempt: 0 });
    this.#load();
  }

  stop(): void {
    this.#token += 1;
    this.#clearTimers();
    this.#unload();
    this.#plan = null;
    this.#setState({ status: 'idle', stationId: null, source: null, attempt: 0, behind: 0, window: 0 });
  }

  /** Moves through a rewindable station by `delta` seconds (negative goes back in time). */
  skip(delta: number): void {
    // While paused the programme point stays put, so the live point drifts away from it.
    const current =
      this.#state.status === 'paused'
        ? this.#behindAtPause + (Date.now() - this.#pausedAt) / 1000
        : this.#behindNow();
    this.seekBehind(current - delta);
  }

  /** Plays a rewindable station `target` seconds behind the live point. */
  seekBehind(target: number): void {
    const plan = this.#plan;
    const timeshift = plan?.station.timeshift;
    if (!plan || !timeshift) return;
    this.#prepareSession();
    const behind = Math.min(Math.max(0, target), timeshift.window - 60);
    if (behind < LIVE_SLACK) {
      this.goLive();
      return;
    }
    const seekable = this.el.seekable;
    if (plan.mode === 'shift' && !plan.anchor && seekable.length > 0) {
      const start = seekable.start(0);
      const end = seekable.end(seekable.length - 1);
      this.el.currentTime = Math.max(start + 2, end - this.#liveOffset - behind);
      this.#setState({ behind: Math.round(behind) });
      if (this.el.paused) this.#quickResume();
      return;
    }
    this.#plan = {
      station: plan.station,
      sources: [shiftSource(plan.station)],
      index: 0,
      mode: 'shift',
      anchor: { behind, at: Date.now() },
    };
    this.#attempt = 0;
    this.#setState({ status: 'loading', behind: Math.round(behind) });
    this.#load();
  }

  /** Back to the live point of the current station. */
  goLive(): void {
    const plan = this.#plan;
    if (!plan) return;
    this.#prepareSession();
    const sources = orderSources(plan.station, this.#getQuality(), this.caps);
    this.#plan = { station: plan.station, sources, index: 0, mode: 'live' };
    this.#attempt = 0;
    this.#setState({ status: 'loading', behind: 0, source: sources[0] ?? null });
    this.#load();
  }

  /** Fades out where the platform allows it (not on iOS), then pauses. */
  async fadeOutAndPause(duration = 8_000): Promise<void> {
    if (this.volumeSettable && this.#state.status === 'playing') {
      const steps = 40;
      for (let i = 1; i <= steps; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, duration / steps));
        if (this.#state.status !== 'playing') break;
        this.el.volume = Math.max(0, 1 - i / steps);
      }
    }
    this.pause();
    this.el.volume = 1;
  }

  showAirPlayPicker(): void {
    this.el.webkitShowPlaybackTargetPicker?.();
  }

  #prepareSession(): void {
    if (this.#sessionReady) return;
    this.#sessionReady = true;
    try {
      // Plays with the silent switch on and keeps playing when the screen locks.
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      // Not supported: the default session already suits <audio>.
    }
  }

  #setState(patch: Partial<PlaybackState>): void {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener(this.#state);
  }

  #load(): void {
    const plan = this.#plan;
    if (!plan) return;
    const source = plan.sources[plan.index];
    const token = ++this.#token;
    this.#clearTimers();
    this.#destroyHls();
    this.#playingSince = 0;
    if (!source) {
      this.#fail('no-source');
      return;
    }
    this.#setState({ source });
    this.#loadTimer = setTimeout(() => {
      if (token === this.#token) this.#fail('timeout');
    }, LOAD_TIMEOUT);
    if (source.kind === 'hls' && !this.caps.nativeHls) {
      void this.#loadWithHlsJs(source, token);
      return;
    }
    this.el.src = source.url;
    this.#playElement(token);
  }

  async #loadWithHlsJs(source: StreamSource, token: number): Promise<void> {
    // Silence the previous stream while hls.js loads.
    this.el.removeAttribute('src');
    this.el.load();
    let HlsClass: typeof Hls;
    try {
      this.#hlsModule ??= import('hls.js/light').then((module) => module.default);
      HlsClass = await this.#hlsModule;
    } catch {
      this.#hlsModule = null;
      if (token === this.#token) this.#fail('hls-unavailable');
      return;
    }
    if (token !== this.#token) return;
    if (!HlsClass.isSupported()) {
      this.#fail('hls-unsupported');
      return;
    }
    const hls = new HlsClass({
      enableWorker: true,
      lowLatencyMode: false,
      liveDurationInfinity: true,
      backBufferLength: 60,
    });
    this.#hls = hls;
    hls.on(HlsClass.Events.ERROR, (_event, data) => {
      if (token === this.#token && data.fatal) this.#fail(`hls:${data.details}`);
    });
    hls.on(HlsClass.Events.LEVEL_UPDATED, () => {
      if (token === this.#token) this.#applyPendingSeek();
    });
    hls.attachMedia(this.el);
    hls.loadSource(source.url);
    this.#playElement(token);
  }

  #playElement(token: number): void {
    let promise: Promise<void> | undefined;
    try {
      promise = this.el.play();
    } catch (error) {
      this.#onPlayRejected(error, token);
      return;
    }
    promise?.catch((error: unknown) => this.#onPlayRejected(error, token));
  }

  #quickResume(): void {
    const token = this.#token;
    this.#clearTimers();
    this.#setState({ status: 'loading' });
    this.#loadTimer = setTimeout(() => {
      if (token === this.#token) this.#fail('timeout');
    }, LOAD_TIMEOUT);
    this.#playElement(token);
  }

  #onPlayRejected(error: unknown, token: number): void {
    if (token !== this.#token) return;
    const name = error instanceof DOMException || error instanceof Error ? error.name : '';
    if (name === 'AbortError') return;
    if (name === 'NotAllowedError') {
      // The browser wants a tap first: show the play button.
      this.#clearTimers();
      this.#pausedAt = Date.now();
      this.#behindAtPause = this.#state.behind;
      this.#setState({ status: 'paused', attempt: 0 });
      return;
    }
    this.#fail(name || 'play-rejected');
  }

  #onPlaying(): void {
    const plan = this.#plan;
    if (!plan) return;
    if (this.#state.status === 'paused') {
      // Playback resumed from outside the app (e.g. a headset button): follow it.
      this.#pausedAt = 0;
    }
    // The element may recover on its own while a retry is pending.
    clearTimeout(this.#loadTimer);
    clearTimeout(this.#retryTimer);
    if (!this.#playingSince) this.#playingSince = Date.now();
    if (plan.mode === 'live' && plan.station.timeshift && !this.#liveOffsetMeasured) {
      const seekable = this.el.seekable;
      if (seekable.length > 0) {
        const offset = seekable.end(seekable.length - 1) - this.el.currentTime;
        if (offset > 0 && offset < 90) {
          this.#liveOffset = offset;
          this.#liveOffsetMeasured = true;
        }
      }
    }
    this.#applyPendingSeek();
    this.#setState({ status: 'playing', attempt: 0 });
    this.#watch(this.#token);
  }

  #onElementPause(): void {
    // Pauses the app asked for already set the state; this catches calls, Siri and other apps.
    const status = this.#state.status;
    if (!this.#plan || this.el.ended || (status !== 'playing' && status !== 'loading')) return;
    this.#behindAtPause = this.#behindNow();
    this.#pausedAt = Date.now();
    this.#clearTimers();
    this.#setState({ status: 'paused', attempt: 0 });
  }

  #onTimeUpdate(): void {
    const plan = this.#plan;
    if (!plan?.station.timeshift || this.#state.status !== 'playing') return;
    const now = Date.now();
    if (now - this.#lastBehindEmit < 1_000) return;
    this.#lastBehindEmit = now;
    const behind = Math.round(this.#behindNow());
    if (behind !== this.#state.behind) this.#setState({ behind });
  }

  #behindNow(): number {
    const plan = this.#plan;
    if (!plan?.station.timeshift || plan.mode === 'live') return 0;
    if (plan.anchor) return plan.anchor.behind + (Date.now() - plan.anchor.at) / 1000;
    const seekable = this.el.seekable;
    if (!seekable.length) return this.#state.behind;
    return Math.max(0, seekable.end(seekable.length - 1) - this.#liveOffset - this.el.currentTime);
  }

  #applyPendingSeek(): void {
    const plan = this.#plan;
    if (!plan || plan.mode !== 'shift' || !plan.anchor) return;
    const seekable = this.el.seekable;
    if (!seekable.length) return;
    const start = seekable.start(0);
    const end = seekable.end(seekable.length - 1);
    // Wait for the long playlist; a few segments are not enough to seek in.
    if (end - start < Math.min(600, plan.anchor.behind + this.#liveOffset)) return;
    const behind = plan.anchor.behind + (Date.now() - plan.anchor.at) / 1000;
    plan.anchor = undefined;
    this.el.currentTime = Math.max(start + 2, end - this.#liveOffset - behind);
    this.#setState({ behind: Math.round(behind) });
  }

  #watch(token: number): void {
    clearInterval(this.#stallTimer);
    this.#progress = { time: this.el.currentTime, at: Date.now() };
    this.#stallTimer = setInterval(() => {
      if (token !== this.#token) return;
      const time = this.el.currentTime;
      if (time !== this.#progress.time) {
        this.#progress = { time, at: Date.now() };
        if (this.#state.status === 'loading' && !this.el.paused) this.#setState({ status: 'playing' });
        return;
      }
      if (!this.el.paused && Date.now() - this.#progress.at > STALL_TIMEOUT) this.#fail('stalled');
    }, 2_000);
  }

  #fail(_reason: string): void {
    const plan = this.#plan;
    const status = this.#state.status;
    if (!plan || status === 'paused' || status === 'idle' || status === 'error') return;
    const token = ++this.#token;
    if (plan.mode === 'shift' && !plan.anchor) plan.anchor = { behind: this.#behindNow(), at: Date.now() };
    this.#clearTimers();
    this.#destroyHls();
    const played = this.#playingSince > 0;
    if (played && Date.now() - this.#playingSince > STABLE_PLAY) this.#attempt = 0;
    this.#playingSince = 0;

    if (navigator.onLine === false) {
      this.#setState({ status: 'offline', attempt: 0 });
      return;
    }
    if (!played && plan.index + 1 < plan.sources.length) {
      plan.index += 1;
      this.#load();
      return;
    }
    this.#attempt += 1;
    if (this.#attempt > MAX_ATTEMPTS) {
      this.#unload();
      this.#setState({ status: 'error', attempt: 0 });
      return;
    }
    if (!played) plan.index = 0;
    const delay = (BACKOFF_S[this.#attempt - 1] ?? 15) * 1_000;
    this.#setState({ status: 'retrying', attempt: this.#attempt });
    this.#retryTimer = setTimeout(() => {
      if (token === this.#token) this.#load();
    }, delay);
  }

  #clearTimers(): void {
    clearTimeout(this.#retryTimer);
    clearTimeout(this.#loadTimer);
    clearInterval(this.#stallTimer);
  }

  #destroyHls(): void {
    if (!this.#hls) return;
    this.#hls.destroy();
    this.#hls = null;
  }

  #unload(): void {
    this.#destroyHls();
    this.el.removeAttribute('src');
    this.el.load();
  }
}
