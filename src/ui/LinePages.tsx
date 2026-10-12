import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { isActive } from '../core/audio-engine';
import { haptic } from '../core/haptics';
import { localize } from '../core/i18n';
import type { Line, LineId, Station } from '../core/types';
import { inkStyle, lineById, lines } from '../data/lines';
import {
  current,
  editing,
  homeLine,
  lang,
  loadedStationId,
  moveStation,
  nowPlaying,
  playback,
  playbackStatus,
  playStation,
  removeFromLine,
  selectedLine,
  sheet,
  stationsOn,
  t,
  watchStation,
  wide,
} from '../state/store';
import { onAirText, stopStatus } from './format';
import { useVisible } from './hooks';
import { ArrowDownIcon, ArrowUpIcon, RemoveIcon, SearchIcon } from './icons';
import { EASE_OUT, TRAVEL_MS, easeOutTimeAt, reducedMotion } from './motion';
import { Roundel } from './Roundel';

/** One page per line, side by side; swiping changes line, as do the roundel tabs. */
export function LinePages() {
  const scroller = useRef<HTMLDivElement>(null);
  const pages = useRef(new Map<LineId, HTMLElement>());
  const inView = useRef<LineId>(selectedLine.peek());
  const target = useRef<LineId | null>(null);
  const selected = selectedLine.value;

  useLayoutEffect(() => {
    const page = pages.current.get(selectedLine.peek());
    if (page && scroller.current) scroller.current.scrollLeft = page.offsetLeft;
  }, []);

  // Tabs, deep links and imports change the line: bring its page in.
  useEffect(() => {
    if (selected === inView.current) return;
    const page = pages.current.get(selected);
    const root = scroller.current;
    if (!page || !root) return;
    target.current = selected;
    root.scrollTo({ left: page.offsetLeft, behavior: reducedMotion.peek() ? 'instant' : 'smooth' });
    const timer = setTimeout(() => {
      target.current = null;
      inView.current = selected;
    }, 900);
    return () => clearTimeout(timer);
  }, [selected]);

  // A swipe settles on a page: that line becomes the selected one.
  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const id = (entry.target as HTMLElement).dataset.line as LineId;
          if (target.current && id !== target.current) continue;
          target.current = null;
          inView.current = id;
          if (selectedLine.peek() !== id) selectedLine.value = id;
        }
      },
      { root, threshold: [0.6] },
    );
    for (const page of pages.current.values()) observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <div class="pages" ref={scroller}>
      {lines.map((line) => (
        <section
          key={line.id}
          ref={(el) => {
            if (el) pages.current.set(line.id, el);
            else pages.current.delete(line.id);
          }}
          class="page"
          id={`panel-${line.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${line.id}`}
          data-line={line.id}
          inert={line.id !== selected}
        >
          <LinePage line={line} />
        </section>
      ))}
    </div>
  );
}

function LinePage({ line }: { line: Line }) {
  const dict = t.value;
  const stations = stationsOn(line.id);
  const editable = line.id === 'fav' || line.id === 'perso';
  const isEditing = editable && editing.value && selectedLine.value === line.id;
  return (
    <div class="page__inner" style={inkStyle(line)}>
      <header class="line-head">
        <Roundel line={line} size="lg" />
        <div class="line-head__text">
          <h2 class="line-head__name">{localize(line.name, lang.value)}</h2>
          <p class="line-head__count">{dict.stationCount(stations.length)}</p>
        </div>
        {editable && stations.length > 0 && (
          <button
            type="button"
            id={`organize-${line.id}`}
            class="text-btn"
            aria-pressed={isEditing}
            onClick={() => (editing.value = !editing.peek())}
          >
            {isEditing ? dict.done : dict.organize}
          </button>
        )}
      </header>
      {stations.length > 0 ? (
        <LineMap line={line} stations={stations} editing={isEditing} />
      ) : (
        <EmptyLine line={line} />
      )}
    </div>
  );
}

const centerOf = (list: HTMLElement, index: number): number | null => {
  const stop = list.children[index] as HTMLElement | undefined;
  const dot = stop?.querySelector<HTMLElement>('.stop__dot');
  return stop && dot ? stop.offsetTop + dot.offsetTop + dot.offsetHeight / 2 : null;
};

/** Scrolls a stop into its page vertically without ever moving the pages sideways. */
function reveal(stop: HTMLElement, smooth: boolean): void {
  const page = stop.closest<HTMLElement>('.page');
  if (!page) return;
  const bounds = page.getBoundingClientRect();
  const box = stop.getBoundingClientRect();
  const margin = 24;
  let delta = 0;
  if (box.top < bounds.top + margin) delta = box.top - bounds.top - margin;
  else if (box.bottom > bounds.bottom - margin) delta = box.bottom - bounds.bottom + margin;
  if (delta) page.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'instant' });
}

/** The strip map: the line drawn top to bottom, one stop per station, and "you are here". */
function LineMap({ line, stations, editing: isEditing }: { line: Line; stations: Station[]; editing: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const placed = useRef<{ index: number; y: number } | null>(null);
  const currentId = current.value?.stationId ?? null;
  const index = stations.findIndex((station) => station.id === currentId);
  const status = index >= 0 && loadedStationId.value === currentId ? playbackStatus.value : 'idle';

  useLayoutEffect(() => {
    const root = list.current;
    const ring = marker.current;
    if (!root || !ring) return;
    if (index < 0) {
      ring.hidden = true;
      placed.current = null;
      return;
    }
    const y = centerOf(root, index);
    if (y === null) return;
    const previous = placed.current;
    const travels = previous !== null && previous.index !== index && !reducedMotion.peek();
    ring.hidden = false;
    ring.style.transition = travels ? `transform ${TRAVEL_MS}ms ${EASE_OUT}` : 'none';
    ring.style.transform = `translateY(${y}px)`;
    if (!previous) {
      ring.classList.remove('is-arriving');
      void ring.offsetWidth;
      ring.classList.add('is-arriving');
    }
    if (travels && previous) {
      // The stops the marker passes light up as it goes by.
      const step = index > previous.index ? 1 : -1;
      const distance = y - previous.y;
      for (let i = previous.index + step; i !== index; i += step) {
        const at = centerOf(root, i);
        const dot = root.children[i]?.querySelector<HTMLElement>('.stop__dot');
        if (at === null || !dot || distance === 0) continue;
        dot.style.setProperty('--wake-delay', `${Math.round(easeOutTimeAt((at - previous.y) / distance) * TRAVEL_MS)}ms`);
        dot.classList.remove('is-waking');
        void dot.offsetWidth;
        dot.classList.add('is-waking');
      }
    }
    if (previous?.index !== index && selectedLine.peek() === line.id) {
      const stop = root.children[index] as HTMLElement | undefined;
      if (stop) reveal(stop, previous !== null && !reducedMotion.peek());
    }
    placed.current = { index, y };
  }, [index, stations.length, line.id]);

  // Text size, rotation or a programme that wraps: keep the marker on its stop.
  useEffect(() => {
    const root = list.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const at = placed.current;
      const ring = marker.current;
      if (!at || !ring) return;
      const y = centerOf(root, at.index);
      if (y === null || Math.abs(y - at.y) < 0.5) return;
      ring.style.transform = `translateY(${y}px)`;
      placed.current = { index: at.index, y };
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div class="map">
      <ol class="map__stops" role="list" ref={list}>
        {stations.map((station, i) => (
          <Stop
            key={station.id}
            station={station}
            line={line}
            index={i}
            count={stations.length}
            isCurrent={i === index}
            editing={isEditing}
          />
        ))}
      </ol>
      <div class="map__marker" ref={marker} data-status={status} hidden aria-hidden="true" />
    </div>
  );
}

interface StopProps {
  station: Station;
  line: Line;
  index: number;
  count: number;
  isCurrent: boolean;
  editing: boolean;
}

function Stop({ station, line, index, count, isCurrent, editing: isEditing }: StopProps) {
  const ref = useRef<HTMLLIElement>(null);
  const visible = useVisible(ref);
  useEffect(() => (visible && station.meta ? watchStation(station) : undefined), [visible, station]);

  const dict = t.value;
  const language = lang.value;
  const loaded = isCurrent && loadedStationId.value === station.id;
  const status = loaded ? playbackStatus.value : null;
  const behind = status === 'playing' ? playback.value.behind : 0;
  const text = onAirText(station, nowPlaying(station.id), language, dict);
  const home = lineById(homeLine(station));
  const showChange = line.id === 'fav' && home.id !== 'fav';

  const onClick = () => {
    haptic();
    if (status && isActive(status)) {
      if (!wide.peek()) sheet.value = 'player';
      return;
    }
    playStation(station, line.id);
  };

  const remove = () => {
    removeFromLine(line.id, station.id);
    requestAnimationFrame(() => document.getElementById(`organize-${line.id}`)?.focus());
  };

  return (
    <li ref={ref} class="stop" data-current={isCurrent || undefined}>
      <span class="stop__dot" aria-hidden="true" onAnimationEnd={(event) => event.currentTarget.classList.remove('is-waking')} />
      <button type="button" class="stop__btn" aria-current={isCurrent ? 'location' : undefined} onClick={onClick}>
        <span class="stop__name">
          {station.name}
          {showChange && (
            <>
              <Roundel line={home} size="xs" />
              <span class="visually-hidden">{dict.change(localize(home.name, language))}</span>
            </>
          )}
        </span>
        <span class="stop__meta">
          {isCurrent && <span class="visually-hidden">{dict.youAreHere}. </span>}
          {status && status !== 'idle' && <span class="stop__status">{stopStatus(status, behind, dict)}</span>}
          {status && status !== 'idle' ? ' · ' : ''}
          {text}
        </span>
      </button>
      {isEditing && (
        <div class="stop__tools">
          <button
            type="button"
            class="icon-btn icon-btn--tool"
            disabled={index === 0}
            aria-label={dict.moveUp(station.name)}
            onClick={() => moveStation(line.id, station.id, -1)}
          >
            <ArrowUpIcon size={20} />
          </button>
          <button
            type="button"
            class="icon-btn icon-btn--tool"
            disabled={index === count - 1}
            aria-label={dict.moveDown(station.name)}
            onClick={() => moveStation(line.id, station.id, 1)}
          >
            <ArrowDownIcon size={20} />
          </button>
          <button
            type="button"
            class="icon-btn icon-btn--tool icon-btn--remove"
            aria-label={line.id === 'perso' ? dict.deleteStation(station.name) : dict.removeFrom(station.name)}
            onClick={remove}
          >
            <RemoveIcon size={20} />
          </button>
        </div>
      )}
    </li>
  );
}

/** An empty line is drawn dashed, like a line still under construction on the map. */
function EmptyLine({ line }: { line: Line }) {
  const dict = t.value;
  const fav = line.id === 'fav';
  return (
    <div class="empty">
      <svg class="empty__track" viewBox="0 0 56 168" aria-hidden="true" focusable="false">
        <path d="M28 6V162" stroke-width="8" stroke-dasharray="16 12" />
        <circle cx="28" cy="20" r="9" />
      </svg>
      <div class="empty__text">
        <h3 class="empty__title">{fav ? dict.emptyFavTitle : dict.emptyPersoTitle}</h3>
        <p class="empty__body">{fav ? dict.emptyFavBody : dict.emptyPersoBody}</p>
        <button type="button" class="pill-btn" onClick={() => (sheet.value = 'search')}>
          <SearchIcon size={20} />
          <span>{dict.findRadio}</span>
        </button>
      </div>
    </div>
  );
}
