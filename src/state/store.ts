import { batch, computed, effect, signal, type Signal } from '@preact/signals';
import { AudioEngine, LIVE_SLACK, isActive, type PlaybackState } from '../core/audio-engine';
import { parseCustomStations } from '../core/custom-stations';
import { dictionaries, type Dictionary } from '../core/i18n';
import {
  applySessionMetadata,
  sessionMetadata,
  setSessionHandlers,
  setSessionPlaybackState,
} from '../core/media-session';
import { NowPlayingPoller } from '../core/now-playing/poller';
import { isStringArray, load, save } from '../core/storage';
import type { Lang, LineId, NowPlaying, Quality, Station } from '../core/types';
import { isLineId } from '../data/lines';
import { catalog, defaultFavorites } from '../data/stations';

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  readonly theme: Theme;
  readonly lang: Lang;
  readonly quality: Quality;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function deviceLang(): Lang {
  const first = typeof navigator === 'undefined' ? 'fr' : (navigator.languages?.[0] ?? navigator.language ?? 'fr');
  return first.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function parseSettings(value: unknown): Settings | undefined {
  if (!isRecord(value)) return undefined;
  return {
    theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'auto',
    lang: value.lang === 'en' || value.lang === 'fr' ? value.lang : deviceLang(),
    quality: value.quality === 'eco' ? 'eco' : 'hifi',
  };
}

const catalogById = new Map(catalog.map((station) => [station.id, station]));

export const isCatalogId = (id: string): boolean => catalogById.has(id);

// —— Persistent state ——————————————————————————————————————————————

export const settings = signal<Settings>(
  load('settings', parseSettings, { theme: 'auto', lang: deviceLang(), quality: 'hifi' }),
);
export const lang = computed<Lang>(() => settings.value.lang);
export const t = computed<Dictionary>(() => dictionaries[settings.value.lang]);

export const customStations = signal<readonly Station[]>(load('custom', parseCustomStations, []));

/** Directory stations being tried out before they are added; not saved. */
const previews = signal<ReadonlyMap<string, Station>>(new Map());

const stationIndex = computed(() => {
  const map = new Map(previews.value);
  for (const station of catalog) map.set(station.id, station);
  for (const station of customStations.value) map.set(station.id, station);
  return map;
});

const isSaved = (id: string): boolean => catalogById.has(id) || customStations.peek().some((s) => s.id === id);

export const stationById = (id: string | null | undefined): Station | undefined =>
  id ? stationIndex.value.get(id) : undefined;

export const favorites = signal<readonly string[]>(
  load('favorites', (v) => (isStringArray(v) ? [...new Set(v)] : undefined), [...defaultFavorites]),
);

export const selectedLine = signal<LineId>(load('line', (v) => (isLineId(v) ? v : undefined), 'fav'));

export interface Current {
  readonly stationId: string;
  /** The line the station was started from; previous and next walk it. */
  readonly lineId: LineId;
}

function parseCurrent(value: unknown): Current | undefined {
  if (!isRecord(value) || typeof value.stationId !== 'string' || !isLineId(value.lineId)) return undefined;
  return { stationId: value.stationId, lineId: value.lineId };
}

/** On a first visit the first stop of Ma ligne is on the board, ready to play: one tap from silence to sound. */
function firstStop(): Current | null {
  const stationId = favorites.peek().find((id) => stationById(id) !== undefined);
  return stationId ? { stationId, lineId: 'fav' } : null;
}

export const current = signal<Current | null>(load('last', parseCurrent, null) ?? firstStop());
export const currentStation = computed<Station | null>(() => stationById(current.value?.stationId) ?? null);

// —— Lines ————————————————————————————————————————————————————————————

/** The stops on a line, in order. Reactive when read inside a component or computed. */
export function stationsOn(line: LineId): Station[] {
  switch (line) {
    case 'fav':
      return favorites.value.map((id) => stationById(id)).filter((s) => s !== undefined);
    case 'perso':
      return [...customStations.value];
    default:
      return catalog.filter((station) => station.line === line);
  }
}

export const homeLine = (station: Station): LineId => (station.custom ? 'perso' : station.line);

// —— Session state ——————————————————————————————————————————————————————

export const playback = signal<PlaybackState>({
  status: 'idle',
  stationId: null,
  source: null,
  attempt: 0,
  behind: 0,
  window: 0,
  airplay: false,
});

/** Narrow views of `playback` that only change when their value does (`behind` ticks every second). */
export const playbackStatus = computed(() => playback.value.status);
export const loadedStationId = computed(() => playback.value.stationId);
export const playbackAttempt = computed(() => playback.value.attempt);
export const playbackSource = computed(() => playback.value.source);
export const airplayAvailable = computed(() => playback.value.airplay);
/** Playing a rewindable station behind its live point. */
export const delayed = computed(() => playback.value.status === 'playing' && playback.value.behind >= LIVE_SLACK);

export type SheetId = 'player' | 'search' | 'settings';
export const sheet = signal<SheetId | null>(null);
export const editing = signal(false);
export const online = signal(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
export const wide = signal(false);
export const standalone = signal(false);
export const clock = signal(Date.now());
export const updateReady = signal(false);
export const pendingImport = signal<readonly string[]>([]);

export interface Sleep {
  readonly endsAt: number;
  readonly endOfShow: boolean;
}
export const sleep = signal<Sleep | null>(null);

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly action?: { readonly label: string; readonly run: () => void };
}
export const toasts = signal<readonly Toast[]>([]);

// —— Now playing ———————————————————————————————————————————————————————

const nowPlayingSignals = new Map<string, Signal<NowPlaying | null>>();

export function nowPlayingOf(stationId: string): Signal<NowPlaying | null> {
  let value = nowPlayingSignals.get(stationId);
  if (!value) {
    value = signal<NowPlaying | null>(null);
    nowPlayingSignals.set(stationId, value);
  }
  return value;
}

/** Drops information that has run out: a show long over, or a song with no end that started long ago. */
export function freshNowPlaying(value: NowPlaying | null, now: number): NowPlaying | null {
  if (!value) return null;
  if (value.end !== undefined && now > value.end + 60_000) return null;
  if (value.end === undefined && value.kind === 'song' && value.start !== undefined && now - value.start > 20 * 60_000) {
    return null;
  }
  return value;
}

/** Fresh now-playing for a station; reactive. */
export const nowPlaying = (stationId: string): NowPlaying | null =>
  freshNowPlaying(nowPlayingOf(stationId).value, clock.value);

const poller = new NowPlayingPoller((stationId, value) => {
  nowPlayingOf(stationId).value = value;
});

/** Polls a station's programme while the caller holds the returned release function. */
export const watchStation = (station: Station, background = false): (() => void) =>
  poller.subscribe(station, { background });

// —— Toasts —————————————————————————————————————————————————————————————

let toastId = 0;
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function dismissToast(id: number): void {
  clearTimeout(toastTimers.get(id));
  toastTimers.delete(id);
  toasts.value = toasts.value.filter((item) => item.id !== id);
}

export function toast(message: string, action?: Toast['action'], duration = action ? 8_000 : 3_500): number {
  const id = ++toastId;
  toasts.value = [...toasts.value.slice(-2), { id, message, action }];
  if (duration > 0) toastTimers.set(id, setTimeout(() => dismissToast(id), duration));
  return id;
}

// —— Playback ———————————————————————————————————————————————————————————

let engineInstance: AudioEngine | null = null;

function engine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine(() => settings.peek().quality);
    engineInstance.subscribe((state) => {
      playback.value = state;
    });
  }
  return engineInstance;
}

export const getEngine = engine;

/** Starts a station, or resumes it if it is the one already loaded. Synchronous: call from the tap. */
export function playStation(station: Station, lineId: LineId = homeLine(station)): void {
  const audio = engine();
  current.value = { stationId: station.id, lineId };
  if (audio.station?.id === station.id) {
    const status = playback.peek().status;
    if (status === 'paused') return audio.resume();
    if (status === 'error') return audio.retry();
    if (isActive(status)) return;
  }
  audio.play(station);
}

/** Play or pause the station on screen. A shared link can show a station other than the one loaded. */
export function togglePlayback(): void {
  const audio = engine();
  const shown = currentStation.peek();
  if (audio.station && (!shown || audio.station.id === shown.id)) {
    audio.toggle();
    return;
  }
  const station = shown ?? stationsOn('fav')[0] ?? catalog[0];
  if (station) playStation(station, current.peek()?.lineId ?? homeLine(station));
}

export function pausePlayback(): void {
  engineInstance?.pause();
}

export function resumePlayback(): void {
  const audio = engine();
  if (audio.station) audio.resume();
  else togglePlayback();
}

export const retryPlayback = (): void => engine().retry();
export const skipBy = (seconds: number): void => engine().skip(seconds);
export const seekBehind = (seconds: number): void => engine().seekBehind(seconds);
export const goLive = (): void => engine().goLive();
export const showAirPlay = (): void => engine().showAirPlayPicker();

/** Next or previous stop on the line the current station was started from, wrapping at the ends. */
export function stepStation(delta: 1 | -1): void {
  const cur = current.peek();
  const station = currentStation.peek();
  if (!cur || !station) return;
  let lineId = cur.lineId;
  let list = stationsOn(lineId);
  if (!list.some((s) => s.id === station.id)) {
    lineId = homeLine(station);
    list = stationsOn(lineId);
  }
  const index = list.findIndex((s) => s.id === station.id);
  const next = list[(index + delta + list.length) % list.length];
  if (next && next.id !== station.id) playStation(next, lineId);
}

export function stopPlayback(): void {
  engineInstance?.stop();
}

// —— Favourites and custom stations —————————————————————————————————————————

export const isFavorite = (id: string): boolean => favorites.value.includes(id);

export function toggleFavorite(station: Station): void {
  const dict = t.peek();
  if (favorites.peek().includes(station.id)) {
    favorites.value = favorites.peek().filter((id) => id !== station.id);
    toast(dict.removedFav(station.name));
  } else {
    favorites.value = [...favorites.peek(), station.id];
    toast(dict.addedFav(station.name));
  }
}

function moveIn<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return [...list];
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  if (item !== undefined) copy.splice(target, 0, item);
  return copy;
}

export function moveStation(line: LineId, id: string, delta: number): void {
  if (line === 'fav') {
    favorites.value = moveIn(favorites.peek(), favorites.peek().indexOf(id), delta);
  } else if (line === 'perso') {
    const list = customStations.peek();
    customStations.value = moveIn(
      list,
      list.findIndex((s) => s.id === id),
      delta,
    );
  }
}

export function removeFromLine(line: LineId, id: string): void {
  if (line === 'fav') {
    favorites.value = favorites.peek().filter((fav) => fav !== id);
    return;
  }
  if (line !== 'perso') return;
  batch(() => {
    customStations.value = customStations.peek().filter((s) => s.id !== id);
    favorites.value = favorites.peek().filter((fav) => fav !== id);
    if (current.peek()?.stationId === id) {
      engineInstance?.stop();
      current.value = null;
    }
  });
}

/** Adds a directory or pasted station to "Mes stations". Returns false if it was already there. */
export function addCustomStation(station: Station): boolean {
  if (isSaved(station.id)) return false;
  customStations.value = [...customStations.peek(), station];
  toast(t.peek().added(station.name));
  return true;
}

export const isCustomSaved = (id: string): boolean => customStations.value.some((s) => s.id === id);

/** Plays a directory result without adding it to "Mes stations". */
export function playPreview(station: Station): void {
  if (!stationById(station.id)) previews.value = new Map(previews.peek()).set(station.id, station);
  playStation(station, 'perso');
}

// —— Sleep timer ————————————————————————————————————————————————————————

let sleepTimer: ReturnType<typeof setTimeout> | undefined;

function armSleep(): void {
  clearTimeout(sleepTimer);
  const value = sleep.peek();
  if (!value) return;
  const remaining = value.endsAt - Date.now();
  if (remaining <= 0) {
    sleep.value = null;
    if (engineInstance && isActive(playback.peek().status)) {
      void engineInstance.fadeOutAndPause();
      toast(t.peek().sleepStopped);
    }
    return;
  }
  // Short steps keep the timer honest when the system throttles a backgrounded page.
  sleepTimer = setTimeout(armSleep, Math.min(remaining, 15_000));
}

/** Minutes from now, the end of the current show, or `null` to cancel. */
export function setSleep(choice: number | 'show' | null): void {
  clearTimeout(sleepTimer);
  if (choice === null) {
    sleep.value = null;
    return;
  }
  const station = currentStation.peek();
  let endsAt: number;
  if (choice === 'show') {
    const show = station ? freshNowPlaying(nowPlayingOf(station.id).peek(), Date.now()) : null;
    if (!show?.end || show.end <= Date.now()) return;
    endsAt = show.end;
  } else {
    endsAt = Date.now() + choice * 60_000;
  }
  sleep.value = { endsAt, endOfShow: choice === 'show' };
  armSleep();
}

// —— Sharing and deep links ———————————————————————————————————————————————

const appUrl = (): string => `${location.origin}${location.pathname}`;

export const stationLink = (station: Station): string =>
  station.custom ? (station.site ?? appUrl()) : `${appUrl()}#s=${encodeURIComponent(station.id)}`;

export function lineLink(): string {
  const ids = favorites.peek().filter(isCatalogId);
  return `${appUrl()}#import=${ids.map(encodeURIComponent).join(',')}`;
}

async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    toast(t.peek().linkCopied);
  } catch {
    toast(data.url);
  }
}

export const shareStation = (station: Station): Promise<void> =>
  shareOrCopy({ title: station.name, text: t.peek().shareText(station.name), url: stationLink(station) });

export const shareLine = (): Promise<void> =>
  shareOrCopy({ title: 'Ondes', text: t.peek().shareLineText, url: lineLink() });

/** Reads `#s=<station>` (open a station) and `#import=<ids>` (offer shared favourites). */
export function readDeepLink(hash: string): { station?: Station; imports: string[] } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const station = catalogById.get(params.get('s') ?? '');
  const imports = (params.get('import') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id, i, all) => isCatalogId(id) && all.indexOf(id) === i);
  return { station, imports };
}

export function handleDeepLink(): void {
  if (!location.hash) return;
  const { station, imports } = readDeepLink(location.hash);
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  batch(() => {
    if (station) {
      current.value = { stationId: station.id, lineId: station.line };
      selectedLine.value = station.line;
      if (!wide.peek()) sheet.value = 'player';
    }
    const fresh = imports.filter((id) => !favorites.peek().includes(id));
    if (fresh.length) pendingImport.value = fresh;
  });
}

export function acceptImport(): void {
  const ids = pendingImport.peek().filter((id) => !favorites.peek().includes(id));
  batch(() => {
    favorites.value = [...favorites.peek(), ...ids];
    pendingImport.value = [];
    selectedLine.value = 'fav';
  });
  if (ids.length) toast(t.peek().imported(ids.length));
}

export const dismissImport = (): void => {
  pendingImport.value = [];
};

// —— Updates ————————————————————————————————————————————————————————————

interface UpdateControls {
  check(): Promise<boolean>;
  apply(): void;
}
let updates: UpdateControls | null = null;

export function setUpdateControls(controls: UpdateControls): void {
  updates = controls;
}

export async function checkForUpdate(): Promise<void> {
  const found = updates ? await updates.check().catch(() => false) : false;
  if (!found && !updateReady.peek()) toast(t.peek().upToDate);
}

export function applyUpdate(): void {
  updates?.apply();
}

// —— Wiring ——————————————————————————————————————————————————————————————

export function setSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.peek(), ...patch };
}

function watchMedia(query: string, apply: (matches: boolean) => void): void {
  const list = window.matchMedia(query);
  apply(list.matches);
  list.addEventListener('change', (event) => apply(event.matches));
}

let started = false;

/** Connects state to the page, the audio engine and the system controls. Call once at startup. */
export function initStore(): void {
  if (started) return;
  started = true;
  engine();

  const systemLight = signal(false);
  watchMedia('(prefers-color-scheme: light)', (matches) => {
    systemLight.value = matches;
  });
  watchMedia('(min-width: 1024px)', (matches) => {
    wide.value = matches;
  });
  watchMedia('(display-mode: standalone)', (matches) => {
    standalone.value = matches || navigator.standalone === true;
  });

  effect(() => {
    const { theme, lang: language } = settings.value;
    const root = document.documentElement;
    root.dataset.theme = theme === 'auto' ? (systemLight.value ? 'light' : 'dark') : theme;
    root.lang = language;
    save('settings', settings.value);
  });
  effect(() => save('favorites', favorites.value));
  effect(() => save('custom', customStations.value));
  effect(() => save('line', selectedLine.value));
  effect(() => {
    if (current.value) save('last', current.value);
  });
  effect(() => {
    // The inline player replaces the sheet on wide screens.
    if (wide.value && sheet.peek() === 'player') sheet.value = null;
  });
  effect(() => {
    // Organising is per line: leaving the line ends it.
    void selectedLine.value;
    editing.value = false;
  });

  setInterval(() => {
    clock.value = Date.now();
  }, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    clock.value = Date.now();
    armSleep();
    const station = currentStation.peek();
    if (station) poller.refresh(station.id);
  });
  window.addEventListener('online', () => {
    online.value = true;
  });
  window.addEventListener('offline', () => {
    online.value = false;
  });

  // The lock screen shows what is actually playing, which a shared link can make differ from the station on screen.
  const loadedStation = computed(() => stationById(loadedStationId.value) ?? null);

  // The station on the lock screen keeps its programme up to date in the background.
  effect(() => {
    const station = loadedStation.value;
    return station ? watchStation(station, true) : undefined;
  });

  effect(() => {
    const station = loadedStation.value;
    const status = playbackStatus.value;
    if (!station) {
      applySessionMetadata(null);
      return;
    }
    applySessionMetadata(sessionMetadata(station, nowPlaying(station.id), document.baseURI));
    setSessionPlaybackState(status === 'paused' || status === 'error' ? 'paused' : 'playing');
  });

  effect(() => {
    const canRewind = Boolean(loadedStation.value?.timeshift);
    setSessionHandlers({
      play: () => resumePlayback(),
      pause: () => pausePlayback(),
      previous: () => stepStation(-1),
      next: () => stepStation(1),
      seekBy: canRewind ? (seconds) => skipBy(seconds) : undefined,
    });
  });

  handleDeepLink();
  window.addEventListener('hashchange', handleDeepLink);
}
