import { LIVE_SLACK, isActive, isBusy } from '../core/audio-engine';
import { haptic } from '../core/haptics';
import {
  currentStation,
  delayed,
  lang,
  loadedStationId,
  nowPlaying,
  playbackStatus,
  sheet,
  t,
  togglePlayback,
  wide,
} from '../state/store';
import { ledWord, onAirTitle } from './format';
import { PauseIcon, PlayIcon } from './icons';
import { CoverArt } from './StationArt';

/** The arc that turns around a play button while the stream connects. */
export const Spinner = () => (
  <svg class="spinner" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
    <circle cx="26" cy="26" r="24" pathLength="100" />
  </svg>
);

/** The current station, docked at the bottom like the next-train board on a platform. */
export function Dock() {
  const station = currentStation.value;
  if (!station || wide.value) return null;
  const dict = t.value;
  const status = loadedStationId.value === station.id ? playbackStatus.value : 'idle';
  const np = nowPlaying(station.id);
  const active = isActive(status);
  return (
    <section class="dock enamel" aria-label={dict.player}>
      <button
        type="button"
        class="dock__open"
        aria-label={dict.openPlayer(station.name)}
        aria-describedby="dock-status"
        onClick={() => (sheet.value = 'player')}
      >
        <CoverArt station={station} cover={np?.cover} class="dock__art" />
        <span class="dock__text">
          <span class="dock__name">{station.name}</span>
          <span class="dock__status" id="dock-status">
            <span class="led" data-status={status}>
              {ledWord(status, delayed.value ? LIVE_SLACK : 0, dict)}
            </span>
            {/* The board in the player tells when the programme ends; beside the light there is room for the title. */}
            <span class="dock__onair">{onAirTitle(station, np, lang.value)}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        class="dock__play"
        aria-label={active ? dict.pause : dict.play}
        onClick={() => {
          haptic();
          togglePlayback();
        }}
      >
        {isBusy(status) && <Spinner />}
        {active ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
      </button>
    </section>
  );
}
