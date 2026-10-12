import { computed, signal } from '@preact/signals';
import type { RefObject } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { isActive, isBusy, type PlaybackStatus } from '../core/audio-engine';
import { checkStreamUrl, resolveStreamUrl, stationFromUrl } from '../core/custom-stations';
import { haptic } from '../core/haptics';
import { countryName, localize } from '../core/i18n';
import { looksLikePlaylist } from '../core/playlist';
import { searchDirectory } from '../core/radio-browser';
import type { Lang, Station } from '../core/types';
import { lineById } from '../data/lines';
import { catalog } from '../data/stations';
import {
  addCustomStation,
  customStations,
  homeLine,
  isCustomSaved,
  isFavorite,
  lang,
  loadedStationId,
  playbackStatus,
  playPreview,
  playStation,
  selectedLine,
  sheet,
  t,
  toast,
  togglePlayback,
} from '../state/store';
import { Spinner } from './Dock';
import { fold } from './format';
import { CheckIcon, CloseIcon, PauseIcon, PlayIcon, PlusIcon, RetryIcon, SearchIcon } from './icons';
import { Roundel } from './Roundel';

/** What is typed in the field; shared by the field in the sheet header and the results below it. */
const query = signal('');

const words = (text: string): string[] => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

interface Entry {
  readonly station: Station;
  readonly name: string;
  readonly nameWords: readonly string[];
  /** The name, both taglines and the country in the reader's language. */
  readonly words: readonly string[];
  /** The station's line, in both languages. */
  readonly lineWords: readonly string[];
}

/** A station with the words it can be found by, in either language. */
export function toEntry(station: Station, language: Lang): Entry {
  const line = lineById(homeLine(station));
  const own = [station.name, station.tagline.fr, station.tagline.en, countryName(station.country, language)];
  return {
    station,
    name: fold(station.name),
    nameWords: words(station.name),
    words: [...new Set(words(own.join(' ')))],
    lineWords: [...new Set(words(`${line.name.fr} ${line.name.en}`))],
  };
}

const entries = computed(() => {
  const language = lang.value;
  return [...catalog, ...customStations.value].map((station) => toEntry(station, language));
});

const startsAny = (list: readonly string[], token: string): boolean => list.some((word) => word.startsWith(token));

/** How a station answers the query; lower is better. */
const Rank = {
  nameStart: 0,
  nameWord: 1,
  other: 2,
  /** Needs a word of the line's name: "jazz" finds the classical stations of "Jazz & classique". */
  lineOnly: 3,
} as const;

/**
 * Stations whose words start with every typed word; names that start with the query come first.
 * Stations found only through their line's name are offered when nothing matches directly.
 */
export function matchNetwork(list: readonly Entry[], text: string, limit = 12): Station[] {
  const tokens = words(text);
  const whole = fold(text);
  if (!tokens.length) return [];
  const first = tokens[0] ?? '';
  const found = list.flatMap((entry, order) => {
    if (!tokens.every((token) => startsAny(entry.words, token) || startsAny(entry.lineWords, token))) return [];
    const rank = !tokens.every((token) => startsAny(entry.words, token))
      ? Rank.lineOnly
      : entry.name.startsWith(whole)
        ? Rank.nameStart
        : startsAny(entry.nameWords, first)
          ? Rank.nameWord
          : Rank.other;
    return [{ entry, order, rank }];
  });
  const direct = found.some((match) => match.rank !== Rank.lineOnly);
  return found
    .filter((match) => !direct || match.rank !== Rank.lineOnly)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, limit)
    .map(({ entry }) => entry.station);
}

/** The network, A to Z, as printed beside the map in the station. */
const index = computed<[string, Station[]][]>(() => {
  const language = lang.value;
  const sorted = [...catalog, ...customStations.value].sort((a, b) =>
    a.name.localeCompare(b.name, language, { sensitivity: 'base', numeric: true }),
  );
  const groups = new Map<string, Station[]>();
  for (const station of sorted) {
    const initial = fold(station.name).charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(initial) ? initial : '#';
    groups.set(letter, [...(groups.get(letter) ?? []), station]);
  }
  return [...groups];
});

const catalogNames = new Set(catalog.map((station) => fold(station.name)));

const looksLikeUrl = (text: string): boolean => /^[a-z][a-z\d+.-]*:\/\//i.test(text) || /^www\./i.test(text);

export function SearchField({ inputRef }: { inputRef: RefObject<HTMLInputElement> }) {
  const dict = t.value;
  const value = query.value;
  return (
    <div class="search-field">
      <SearchIcon size={20} class="search-field__icon" />
      <input
        ref={inputRef}
        class="search-field__input"
        type="search"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        placeholder={dict.searchPlaceholder}
        aria-label={dict.searchTitle}
        value={value}
        onInput={(event) => (query.value = event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {value && (
        <button
          type="button"
          class="icon-btn search-field__clear"
          aria-label={dict.clearSearch}
          onClick={() => {
            query.value = '';
            inputRef.current?.focus();
          }}
        >
          <CloseIcon size={18} />
        </button>
      )}
    </div>
  );
}

export function SearchResults({ inputRef }: { inputRef: RefObject<HTMLInputElement> }) {
  const text = query.value.trim();
  // A new search each time the sheet opens.
  useEffect(
    () => () => {
      query.value = '';
    },
    [],
  );
  // As in native lists, scrolling the results puts the keyboard away.
  const onTouchMove = () => {
    if (document.activeElement === inputRef.current) inputRef.current?.blur();
  };
  return (
    <div class="search" onTouchMove={onTouchMove}>
      {!text ? (
        <StationIndex />
      ) : looksLikeUrl(text) ? (
        <AddStream text={text} />
      ) : (
        <>
          <NetworkMatches text={text} />
          <Directory text={text} />
        </>
      )}
    </div>
  );
}

/** Plays a station of the network and shows it on its line. */
function goTo(station: Station): void {
  haptic();
  const line = homeLine(station);
  playStation(station, line);
  selectedLine.value = line;
  sheet.value = null;
}

function NetworkRow({ station, detail = false }: { station: Station; detail?: boolean }) {
  const dict = t.value;
  const language = lang.value;
  const home = lineById(homeLine(station));
  const onFav = home.id !== 'fav' && isFavorite(station.id);
  const status = loadedStationId.value === station.id ? playbackStatus.value : 'idle';
  return (
    <li>
      <button type="button" class="result" onClick={() => goTo(station)}>
        <span class="result__text">
          <span class="result__name">{station.name}</span>
          {detail && (
            <span class="result__meta">
              {status !== 'idle' && <span class="result__status">{dict.status[status]} · </span>}
              {localize(station.tagline, language)}
            </span>
          )}
        </span>
        <span class="result__lines">
          <Roundel line={home} size="xs" />
          {onFav && <Roundel line={lineById('fav')} size="xs" />}
          <span class="visually-hidden">
            , {localize(home.name, language)}
            {onFav ? `, ${dict.onMyLine}` : ''}
          </span>
        </span>
      </button>
    </li>
  );
}

function StationIndex() {
  const dict = t.value;
  return (
    <section class="results" aria-labelledby="results-index">
      <p class="search__intro">{dict.searchIntro}</p>
      <h3 class="results__title" id="results-index">
        {dict.stationIndex}
      </h3>
      {index.value.map(([letter, stations]) => (
        <div key={letter} class="index-group">
          <h4 class="index-group__letter">{letter}</h4>
          <ul class="results__list" role="list">
            {stations.map((station) => (
              <NetworkRow key={station.id} station={station} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function NetworkMatches({ text }: { text: string }) {
  const dict = t.value;
  const matches = matchNetwork(entries.value, text);
  if (!matches.length) return null;
  return (
    <section class="results" aria-labelledby="results-network">
      <h3 class="results__title" id="results-network">
        {dict.onNetwork}
      </h3>
      <ul class="results__list" role="list">
        {matches.map((station) => (
          <NetworkRow key={station.id} station={station} detail />
        ))}
      </ul>
    </section>
  );
}

interface DirectoryState {
  readonly status: 'short' | 'loading' | 'done' | 'error';
  readonly results: readonly Station[];
}

const DEBOUNCE_MS = 350;

/** Radio Browser, searched as you type, without the stations already on the network. */
function Directory({ text }: { text: string }) {
  const dict = t.value;
  const [state, setState] = useState<DirectoryState>({ status: 'short', results: [] });
  const [attempt, setAttempt] = useState(0);
  const short = fold(text).length < 2;

  useEffect(() => {
    if (short) {
      setState({ status: 'short', results: [] });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((previous) => ({ status: 'loading', results: previous.results }));
      // An answer for an older query must not replace the current one.
      searchDirectory(text, controller.signal).then(
        (results) => {
          if (!controller.signal.aborted) setState({ status: 'done', results });
        },
        () => {
          if (!controller.signal.aborted) setState({ status: 'error', results: [] });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, short, attempt]);

  const results = state.results.filter((station) => !catalogNames.has(fold(station.name)));
  const message =
    state.status === 'short'
      ? dict.searchHint
      : state.status === 'error'
        ? dict.directoryError
        : state.status === 'loading' && !results.length
          ? dict.searching
          : state.status === 'done' && !results.length
            ? state.results.length
              ? dict.onlyOnNetwork
              : dict.noResults(text)
            : '';

  return (
    <section class="results" aria-labelledby="results-directory" aria-busy={state.status === 'loading'}>
      <h3 class="results__title" id="results-directory">
        {dict.directory}
      </h3>
      <p class="results__note">{dict.directoryNote}</p>
      <p class="results__message" role="status">
        {message}
      </p>
      {state.status === 'error' && (
        <button
          type="button"
          class="pill-btn pill-btn--quiet results__retry"
          onClick={() => {
            haptic();
            setAttempt((n) => n + 1);
          }}
        >
          <RetryIcon size={20} />
          <span>{dict.retry}</span>
        </button>
      )}
      {results.length > 0 && (
        <ul class="results__list" role="list" data-stale={state.status === 'loading' || undefined}>
          {results.map((station) => (
            <DirectoryRow key={station.id} station={station} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DirectoryRow({ station }: { station: Station }) {
  const dict = t.value;
  const language = lang.value;
  const loaded = loadedStationId.value === station.id;
  const status: PlaybackStatus = loaded ? playbackStatus.value : 'idle';
  const active = isActive(status);
  const saved = isCustomSaved(station.id);
  const meta = [localize(station.tagline, language), countryName(station.country, language)]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(' · ');
  return (
    <li class="result result--directory">
      <span class="result__text">
        <span class="result__name">{station.name}</span>
        <span class="result__meta">
          {status !== 'idle' && <span class="result__status">{dict.status[status]} · </span>}
          {meta}
        </span>
      </span>
      <button
        type="button"
        class="icon-btn result__listen"
        aria-label={dict.listen(station.name)}
        aria-pressed={active}
        onClick={() => {
          haptic();
          if (active) togglePlayback();
          else playPreview(station);
        }}
      >
        {isBusy(status) && <Spinner />}
        {active ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
      </button>
      <button
        type="button"
        class="icon-btn result__add"
        aria-label={saved ? dict.savedStation(station.name) : dict.addToMine(station.name)}
        aria-disabled={saved || undefined}
        onClick={() => {
          if (saved) return;
          haptic();
          addCustomStation(station);
        }}
      >
        {saved ? <CheckIcon size={22} /> : <PlusIcon size={22} />}
      </button>
    </li>
  );
}

type StreamCheck =
  | { readonly status: 'invalid' | 'http' | 'unreachable' }
  | { readonly status: 'checking' }
  | { readonly status: 'ready'; readonly url: string };

/** Playlists are opened before the buttons are offered, so that Listen starts inside the tap. */
function useStreamCheck(text: string): StreamCheck {
  const input = /^www\./i.test(text) ? `https://${text}` : text;
  const checked = checkStreamUrl(input);
  const url = checked.ok ? checked.url : '';
  const playlist = checked.ok && looksLikePlaylist(url);
  const [resolved, setResolved] = useState<{ from: string; result: StreamCheck } | null>(null);

  useEffect(() => {
    if (!playlist) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      resolveStreamUrl(url, controller.signal).then(
        (found) => {
          const again = checkStreamUrl(found);
          setResolved({
            from: url,
            result: again.ok ? { status: 'ready', url: again.url } : { status: again.reason },
          });
        },
        () => {
          if (!controller.signal.aborted) setResolved({ from: url, result: { status: 'unreachable' } });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, playlist]);

  if (!checked.ok) return { status: checked.reason };
  if (!playlist) return { status: 'ready', url };
  return resolved?.from === url ? resolved.result : { status: 'checking' };
}

/** True once `value` has stopped changing for `delay` milliseconds. */
function useSettled(value: string, delay: number): boolean {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled === value;
}

function AddStream({ text }: { text: string }) {
  const dict = t.value;
  const [name, setName] = useState('');
  const check = useStreamCheck(text);
  const settled = useSettled(text, 600);
  const ready = check.status === 'ready';
  const station = ready ? stationFromUrl(check.url, name) : null;
  const host = ready ? new URL(check.url).hostname.replace(/^www\./, '') : '';
  const loaded = station !== null && loadedStationId.value === station.id;
  const status: PlaybackStatus = loaded ? playbackStatus.value : 'idle';
  const active = isActive(status);
  // An address being typed is not wrong yet.
  const error = !settled
    ? ''
    : check.status === 'invalid'
      ? dict.urlInvalid
      : check.status === 'http'
        ? dict.httpBlocked
        : check.status === 'unreachable'
          ? dict.playlistError
          : '';

  const add = (event: Event) => {
    event.preventDefault();
    if (!station) return;
    haptic();
    if (addCustomStation(station)) {
      selectedLine.value = 'perso';
      sheet.value = null;
    } else {
      toast(dict.alreadyAdded(station.name));
    }
  };

  return (
    <section class="results add-stream" aria-labelledby="add-stream-title">
      <h3 class="results__title" id="add-stream-title">
        {dict.addStream}
      </h3>
      <form class="add-stream__card" onSubmit={add}>
        <p class="add-stream__url">{text}</p>
        {check.status === 'checking' && (
          <p class="results__message" role="status">
            {dict.checkingStream}
          </p>
        )}
        <p class="add-stream__error" role="alert">
          {error}
        </p>
        {ready && (
          <>
            <label class="field">
              <span class="field__label">{dict.nameLabel}</span>
              <input
                class="field__input"
                type="text"
                enterkeyhint="done"
                autocomplete="off"
                placeholder={host}
                value={name}
                onInput={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <div class="add-stream__actions">
              <button
                type="button"
                class="pill-btn pill-btn--quiet"
                aria-pressed={active}
                onClick={() => {
                  if (!station) return;
                  haptic();
                  if (active) togglePlayback();
                  else playPreview(station);
                }}
              >
                {isBusy(status) ? <Spinner /> : active ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                <span>{active ? dict.pause : dict.play}</span>
              </button>
              <button type="submit" class="pill-btn">
                <PlusIcon size={18} />
                <span>{dict.add}</span>
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}
