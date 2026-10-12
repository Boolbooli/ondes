import { useEffect, useState } from 'preact/hooks';
import { LIVE_SLACK, isActive, isBusy, type PlaybackStatus } from '../core/audio-engine';
import { haptic } from '../core/haptics';
import { countryName, formatTime, localize } from '../core/i18n';
import { orderSources } from '../core/sources';
import type { LineId, NowPlaying, Station } from '../core/types';
import { inkStyle, lineById } from '../data/lines';
import {
  airplayAvailable,
  clock,
  current,
  currentStation,
  delayed,
  getEngine,
  goLive,
  homeLine,
  isFavorite,
  lang,
  loadedStationId,
  nowPlaying,
  playback,
  playbackAttempt,
  playbackSource,
  playbackStatus,
  playStation,
  retryPlayback,
  seekBehind,
  setSleep,
  settings,
  shareStation,
  showAirPlay,
  skipBy,
  sleep,
  stepStation,
  t,
  toast,
  toggleFavorite,
  togglePlayback,
  watchStation,
} from '../state/store';
import { Spinner } from './Dock';
import { behindMinutes, describeStream, ledWord, showProgress } from './format';
import {
  AirPlayIcon,
  Back30Icon,
  CheckIcon,
  ChevronDownIcon,
  ExternalIcon,
  Forward30Icon,
  InfoIcon,
  MarkIcon,
  MoonIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RetryIcon,
  ShareIcon,
  StarIcon,
} from './icons';
import { Roundel } from './Roundel';
import { CoverArt } from './StationArt';

/** The line being ridden, like the destination sign on the front of a train. */
export function PlayerHeader({ onClose }: { onClose?: () => void }) {
  const dict = t.value;
  const station = currentStation.value;
  if (!station && !onClose) return null;
  const line = station ? lineById(current.value?.lineId ?? homeLine(station)) : null;
  return (
    <div class="player-head">
      {onClose && (
        <button type="button" class="icon-btn" aria-label={dict.close} onClick={onClose}>
          <ChevronDownIcon size={28} />
        </button>
      )}
      {line && (
        <p class="player-head__line">
          <Roundel line={line} size="sm" />
          <span>{localize(line.name, lang.value)}</span>
        </p>
      )}
      {onClose && <span class="player-head__balance" aria-hidden="true" />}
    </div>
  );
}

export function Player() {
  const station = currentStation.value;
  if (!station) {
    return (
      <div class="player player--empty">
        <MarkIcon size={64} />
        <p>{t.value.pickStation}</p>
      </div>
    );
  }
  return <StationPlayer key={station.id} station={station} />;
}

function StationPlayer({ station }: { station: Station }) {
  useEffect(() => watchStation(station), [station]);
  const dict = t.value;
  const status: PlaybackStatus = loadedStationId.value === station.id ? playbackStatus.value : 'idle';
  const np = nowPlaying(station.id);
  const lineId = current.value?.lineId ?? homeLine(station);
  const behind = status === 'playing' || status === 'paused' ? playback.value.behind : 0;
  // Behind live, the board counts the delay instead of showing when the show ends.
  const end = np?.end && behind < LIVE_SLACK ? formatTime(np.end, lang.value) : null;
  // The shape of what the station tells about itself sets how much room the plaque leaves.
  const shape = [
    'player',
    station.meta && 'player--meta',
    station.timeshift && 'player--timeshift',
    station.ads === 'stream' && 'player--note',
  ];
  return (
    <div class={shape.filter(Boolean).join(' ')} style={inkStyle(lineById(homeLine(station)))}>
      <CoverArt station={station} cover={np?.cover} class="player__art" />
      <LedBoard status={status} np={np} behind={behind} end={end} />
      <div class="player__heading">
        <h2 class="player__name">{station.name}</h2>
        <Programme station={station} np={np} boardEnd={end} />
      </div>
      {station.ads === 'stream' ? (
        <p class="note">
          <InfoIcon size={18} />
          <span>{station.id === 'europe1' ? dict.europe1Note : dict.ads.stream}</span>
        </p>
      ) : (
        <p class="adline">
          {station.ads === 'none' ? <CheckIcon size={16} /> : <InfoIcon size={16} />}
          <span>{dict.adsShort[station.ads]}</span>
        </p>
      )}
      {station.timeshift && <Timeline station={station} lineId={lineId} status={status} />}
      <Transport station={station} lineId={lineId} status={status} />
      <StatusMessage status={status} />
      <Actions station={station} np={np} />
      <Facts station={station} />
    </div>
  );
}

/**
 * Amber dot-matrix board, as on the platform: the state of the line, when the show ends,
 * and its bottom row of dots lit for the share of the show already aired.
 */
function LedBoard({
  status,
  np,
  behind,
  end,
}: {
  status: PlaybackStatus;
  np: NowPlaying | null;
  behind: number;
  end: string | null;
}) {
  const dict = t.value;
  const late = behind >= LIVE_SLACK;
  const progress = end ? showProgress(np, clock.value) : null;
  return (
    <div
      class="led-board"
      data-status={late && status === 'playing' ? 'behind' : status}
      data-progress={progress === null ? undefined : ''}
      style={progress === null ? undefined : { '--progress': String(progress) }}
    >
      <span class="led-board__word">{ledWord(status, behind, dict)}</span>
      {late ? (
        <span class="led-board__aside">{dict.minutesBehind(behindMinutes(behind))}</span>
      ) : end ? (
        <span class="led-board__aside">
          <span aria-hidden="true">→ {end}</span>
          <span class="visually-hidden">{dict.until(end)}</span>
        </span>
      ) : null}
    </div>
  );
}

/** The title and the episode or artist share one block, cut at three lines, so the controls keep their place. */
function Programme({ station, np, boardEnd }: { station: Station; np: NowPlaying | null; boardEnd: string | null }) {
  const dict = t.value;
  const language = lang.value;
  if (!np) return <p class="programme programme--quiet">{localize(station.tagline, language)}</p>;
  // The next show usually starts when this one ends, a time the board already shows.
  const nextAt = np.next?.start ? formatTime(np.next.start, language) : null;
  return (
    <>
      <p class="programme">
        <span class="programme__title">{np.title}</span>
        {np.subtitle && (
          <>
            <br />
            <span class="programme__subtitle">{np.subtitle}</span>
          </>
        )}
      </p>
      {np.next && (
        <p class="programme__next">
          <span class="programme__next-label">
            {nextAt && nextAt !== boardEnd ? dict.nextAt(nextAt) : dict.upNext}
          </span>{' '}
          <span>{np.next.title}</span>
        </p>
      )}
    </>
  );
}

/** The last hours of the station, laid out like the line: drag back along it, or return to live. */
function Timeline({ station, lineId, status }: { station: Station; lineId: LineId; status: PlaybackStatus }) {
  const dict = t.value;
  const [preview, setPreview] = useState<number | null>(null);
  const max = Math.max(60, (station.timeshift?.window ?? 0) - 60);
  const loaded = status !== 'idle';
  const behind = loaded ? Math.min(max, playback.value.behind) : 0;
  const value = preview ?? max - behind;
  const shownBehind = max - value;
  const minutes = shownBehind < LIVE_SLACK ? 0 : behindMinutes(shownBehind);
  const hours = Math.floor(max / 3600);
  const fill = String(value / max);

  const commit = (next: number) => {
    setPreview(null);
    haptic();
    const target = max - next;
    if (!loaded) {
      playStation(station, lineId);
      if (target >= LIVE_SLACK) seekBehind(target);
    } else if (target < LIVE_SLACK) {
      goLive();
    } else {
      seekBehind(target);
    }
  };

  return (
    <div class="timeline" data-dragging={preview !== null || undefined}>
      <div class="timeline__rail" style={{ '--fill': fill }}>
        <input
          type="range"
          class="timeline__range"
          min={0}
          max={max}
          step={10}
          value={value}
          aria-label={dict.timeline(Math.round((station.timeshift?.window ?? 0) / 3600))}
          aria-valuetext={dict.timelineValue(minutes)}
          onInput={(event) => setPreview(Number(event.currentTarget.value))}
          onChange={(event) => commit(Number(event.currentTarget.value))}
        />
        <span class="timeline__bubble" aria-hidden="true">
          {minutes > 0 ? dict.minutesBehind(minutes) : dict.live}
        </span>
      </div>
      <div class="timeline__ticks" aria-hidden="true">
        {Array.from({ length: hours }, (_, i) => hours - i).map((h) => (
          <span key={h} class="timeline__tick" style={{ '--at': String((max - h * 3600) / max) }}>
            {dict.hoursAgo(h)}
          </span>
        ))}
        <span class="timeline__tick timeline__tick--live">{dict.live}</span>
      </div>
      {loaded && delayed.value && (
        <button
          type="button"
          class="pill-btn pill-btn--live"
          onClick={() => {
            haptic();
            goLive();
          }}
        >
          {dict.goLive}
        </button>
      )}
    </div>
  );
}

function Transport({ station, lineId, status }: { station: Station; lineId: LineId; status: PlaybackStatus }) {
  const dict = t.value;
  const loaded = status !== 'idle';
  const active = isActive(status);
  const step = (delta: 1 | -1) => {
    haptic();
    stepStation(delta);
  };
  const play = () => {
    haptic();
    if (loaded) togglePlayback();
    else playStation(station, lineId);
  };
  const back = () => {
    haptic();
    if (loaded) {
      skipBy(-30);
    } else {
      playStation(station, lineId);
      seekBehind(30);
    }
  };
  return (
    <div class="transport">
      <button type="button" class="icon-btn transport__step" aria-label={dict.prevStation} onClick={() => step(-1)}>
        <PrevIcon size={30} />
      </button>
      {station.timeshift && (
        <button type="button" class="icon-btn transport__skip" aria-label={dict.back30} onClick={back}>
          <Back30Icon size={32} />
        </button>
      )}
      <button type="button" class="transport__play" aria-label={active ? dict.pause : dict.play} onClick={play}>
        {isBusy(status) && <Spinner />}
        {active ? <PauseIcon size={34} /> : <PlayIcon size={34} />}
      </button>
      {station.timeshift && (
        <button
          type="button"
          class="icon-btn transport__skip"
          aria-label={dict.forward30}
          disabled={!(loaded && delayed.value)}
          onClick={() => {
            haptic();
            skipBy(30);
          }}
        >
          <Forward30Icon size={32} />
        </button>
      )}
      <button type="button" class="icon-btn transport__step" aria-label={dict.nextStation} onClick={() => step(1)}>
        <NextIcon size={30} />
      </button>
    </div>
  );
}

function StatusMessage({ status }: { status: PlaybackStatus }) {
  const dict = t.value;
  const message =
    status === 'retrying'
      ? dict.disrupted(Math.max(1, playbackAttempt.value))
      : status === 'offline'
        ? dict.offlineWait
        : status === 'error'
          ? dict.failed
          : '';
  return (
    <div class="player__status" role="status">
      {message && <p class="player__message">{message}</p>}
      {status === 'error' && (
        <button
          type="button"
          class="pill-btn"
          onClick={() => {
            haptic();
            retryPlayback();
          }}
        >
          <RetryIcon size={20} />
          <span>{dict.retry}</span>
        </button>
      )}
    </div>
  );
}

const SLEEP_CHOICES = [15, 30, 45, 60, 90] as const;

function Actions({ station, np }: { station: Station; np: NowPlaying | null }) {
  const dict = t.value;
  const [choosing, setChoosing] = useState(false);
  const fav = isFavorite(station.id);
  const timer = sleep.value;
  const now = clock.value;
  const remaining = timer ? Math.max(1, Math.ceil((timer.endsAt - now) / 60_000)) : 0;

  const choose = (choice: number | 'show' | null) => {
    haptic();
    setSleep(choice);
    setChoosing(false);
    const set = sleep.peek();
    if (!set) return;
    toast(
      set.endOfShow
        ? dict.sleepAt(formatTime(set.endsAt, lang.peek()))
        : dict.sleepSet(Math.round((set.endsAt - Date.now()) / 60_000)),
    );
  };

  return (
    <div class="player__actions">
      <div class="actions">
        <button
          type="button"
          class="action"
          aria-pressed={fav}
          onClick={() => {
            haptic();
            toggleFavorite(station);
          }}
        >
          <StarIcon size={24} filled={fav} />
          <span class="action__label">{dict.myLine}</span>
        </button>
        <button
          type="button"
          class="action"
          aria-expanded={choosing}
          aria-controls="sleep-options"
          aria-label={timer ? `${dict.sleep}, ${dict.sleepIn(remaining)}` : undefined}
          data-on={timer ? '' : undefined}
          onClick={() => setChoosing(!choosing)}
        >
          <MoonIcon size={24} />
          <span class="action__label">{timer ? dict.sleepMinutes(remaining) : dict.sleep}</span>
        </button>
        {airplayAvailable.value && (
          <button type="button" class="action" onClick={showAirPlay}>
            <AirPlayIcon size={24} />
            <span class="action__label">{dict.airplay}</span>
          </button>
        )}
        <button type="button" class="action" onClick={() => void shareStation(station)}>
          <ShareIcon size={24} />
          <span class="action__label">{dict.share}</span>
        </button>
      </div>
      {choosing && (
        <div class="chips" id="sleep-options" role="group" aria-label={dict.sleep}>
          {SLEEP_CHOICES.map((minutes) => (
            <button key={minutes} type="button" class="chip" onClick={() => choose(minutes)}>
              {dict.sleepMinutes(minutes)}
            </button>
          ))}
          {np?.end !== undefined && np.end > now + 60_000 && (
            <button type="button" class="chip" onClick={() => choose('show')}>
              {dict.sleepEndOfShow}
            </button>
          )}
          {timer && (
            <button type="button" class="chip chip--quiet" onClick={() => choose(null)}>
              {dict.sleepOff}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** What the station is and how it reaches you, for the curious. */
function Facts({ station }: { station: Station }) {
  const dict = t.value;
  const language = lang.value;
  const loadedSource = loadedStationId.value === station.id ? playbackSource.value : null;
  const source = loadedSource ?? orderSources(station, settings.value.quality, getEngine().caps)[0];
  const ads = station.id === 'europe1' ? dict.europe1Note : dict.ads[station.ads];
  return (
    <details class="facts">
      <summary class="facts__summary">
        <span>{dict.aboutStation}</span>
        <ChevronDownIcon size={20} class="facts__chevron" />
      </summary>
      <dl class="facts__list">
        <div class="facts__row">
          <dt>{dict.stream}</dt>
          <dd>{describeStream(source)}</dd>
        </div>
        {station.timeshift && (
          <div class="facts__row">
            <dt>{dict.rewind}</dt>
            <dd>{dict.rewindHours(Math.round(station.timeshift.window / 3600))}</dd>
          </div>
        )}
        {station.country && (
          <div class="facts__row">
            <dt>{dict.country}</dt>
            <dd>{countryName(station.country, language)}</dd>
          </div>
        )}
        <div class="facts__row">
          <dt>{dict.adsLabel}</dt>
          <dd>{ads}</dd>
        </div>
      </dl>
      {station.site && (
        <a class="facts__link" href={station.site} target="_blank" rel="noopener noreferrer">
          <span>{dict.website}</span>
          <ExternalIcon size={18} />
        </a>
      )}
    </details>
  );
}
