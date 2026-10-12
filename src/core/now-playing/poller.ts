import type { MetaSource, NowPlaying, Station } from '../types';
import { normalizeKexp, normalizeNts, normalizeRadioFrance, normalizeSomaFm, UnknownFormat } from './normalize';

const TIMEOUT = 8_000;
const RETRY_AFTER_ERROR = 60_000;

export function metaUrl(meta: MetaSource): string {
  switch (meta.kind) {
    case 'radiofrance':
      return `https://api.radiofrance.fr/livemeta/live/${meta.id}/${meta.rules}`;
    case 'kexp':
      return 'https://api.kexp.org/v2/plays/?format=json&limit=1';
    case 'somafm':
      return `https://somafm.com/songs/${meta.channel}.json`;
    case 'nts':
      return 'https://www.nts.live/api/v2/live';
  }
}

export async function fetchNowPlaying(meta: MetaSource, signal: AbortSignal): Promise<NowPlaying | null> {
  const response = await fetch(metaUrl(meta), { signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return normalizeNowPlaying(meta, await response.json(), Date.now());
}

/** `null` when there is nothing to show right now; throws `UnknownFormat` when the API has changed. */
export function normalizeNowPlaying(meta: MetaSource, json: unknown, now: number): NowPlaying | null {
  switch (meta.kind) {
    case 'radiofrance':
      return normalizeRadioFrance(json, now);
    case 'kexp':
      return normalizeKexp(json);
    case 'somafm':
      return normalizeSomaFm(json);
    case 'nts':
      return normalizeNts(json, meta.channel, now);
  }
}

type Update = (stationId: string, value: NowPlaying | null) => void;

interface Entry {
  station: Station;
  meta: MetaSource;
  refs: number;
  /** Keeps polling while the page is hidden (the station on the lock screen). */
  background: number;
  timer?: ReturnType<typeof setTimeout>;
  due: number;
  controller?: AbortController;
}

/**
 * Reference-counted live metadata polling. Each subscriber (a visible stop, the player)
 * holds a reference; the poller follows each source's own refresh hint and sleeps while
 * the page is hidden, except for the station that is playing.
 */
export class NowPlayingPoller {
  readonly #entries = new Map<string, Entry>();
  readonly #update: Update;
  #hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

  constructor(update: Update) {
    this.#update = update;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.#hidden = document.visibilityState === 'hidden';
        if (!this.#hidden) for (const entry of this.#entries.values()) if (entry.due <= Date.now()) this.#poll(entry);
      });
    }
  }

  subscribe(station: Station, options: { background?: boolean } = {}): () => void {
    const meta = station.meta;
    if (!meta) return () => {};
    let entry = this.#entries.get(station.id);
    if (!entry) {
      entry = { station, meta, refs: 0, background: 0, due: 0 };
      this.#entries.set(station.id, entry);
      this.#poll(entry);
    }
    entry.refs += 1;
    if (options.background) entry.background += 1;
    const held = entry;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      held.refs -= 1;
      if (options.background) held.background -= 1;
      if (held.refs <= 0) {
        clearTimeout(held.timer);
        held.controller?.abort();
        this.#entries.delete(held.station.id);
      }
    };
  }

  /** Forces a refresh, e.g. when the app returns to the foreground. */
  refresh(stationId: string): void {
    const entry = this.#entries.get(stationId);
    if (entry) this.#poll(entry);
  }

  #schedule(entry: Entry, delay: number): void {
    clearTimeout(entry.timer);
    entry.due = Date.now() + delay;
    entry.timer = setTimeout(() => {
      if (this.#hidden && entry.background <= 0) return; // resumed on visibilitychange
      this.#poll(entry);
    }, delay);
  }

  #poll(entry: Entry): void {
    if (this.#entries.get(entry.station.id) !== entry) return;
    entry.controller?.abort();
    const controller = new AbortController();
    entry.controller = controller;
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);
    // A newer poll or an unsubscribe supersedes this one.
    const current = () => entry.controller === controller && this.#entries.get(entry.station.id) === entry;
    fetchNowPlaying(entry.meta, controller.signal)
      .then((value) => {
        if (!current()) return;
        this.#update(entry.station.id, value);
        this.#schedule(entry, value?.refreshIn ?? RETRY_AFTER_ERROR);
      })
      .catch((error: unknown) => {
        if (!current()) return;
        // A changed API would otherwise leave the last song on screen for good.
        if (error instanceof UnknownFormat) this.#update(entry.station.id, null);
        this.#schedule(entry, RETRY_AFTER_ERROR);
      })
      .finally(() => clearTimeout(timeout));
  }
}
