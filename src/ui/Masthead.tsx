import { useEffect, useRef } from 'preact/hooks';
import { haptic } from '../core/haptics';
import { localize } from '../core/i18n';
import { lines } from '../data/lines';
import { lang, selectedLine, sheet, stationsOn, t } from '../state/store';
import { MarkIcon, SearchIcon, SlidersIcon } from './icons';
import { Roundel } from './Roundel';

export function Masthead() {
  const dict = t.value;
  return (
    <header class="masthead enamel">
      <div class="masthead__bar">
        <h1 class="wordmark">
          <MarkIcon />
          <span>Ondes</span>
        </h1>
        <div class="masthead__actions">
          <button type="button" class="icon-btn" aria-label={dict.search} onClick={() => (sheet.value = 'search')}>
            <SearchIcon />
          </button>
          <button type="button" class="icon-btn" aria-label={dict.settings} onClick={() => (sheet.value = 'settings')}>
            <SlidersIcon />
          </button>
        </div>
      </div>
      <LineTabs />
    </header>
  );
}

function LineTabs() {
  const dict = t.value;
  const language = lang.value;
  const selected = selectedLine.value;
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const index = lines.findIndex((line) => line.id === selected);
    tabs.current[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = lines.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % lines.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + lines.length) % lines.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    const line = lines[target];
    if (!line) return;
    event.preventDefault();
    selectedLine.value = line.id;
    tabs.current[target]?.focus();
  };

  return (
    <div class="tabs" role="tablist" aria-label={dict.lines}>
      {lines.map((line, index) => {
        const isSelected = line.id === selected;
        return (
          <button
            key={line.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${line.id}`}
            class="tab"
            aria-controls={`panel-${line.id}`}
            aria-selected={isSelected}
            aria-label={dict.lineAria(localize(line.name, language), stationsOn(line.id).length)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!isSelected) haptic();
              selectedLine.value = line.id;
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <Roundel line={line} />
          </button>
        );
      })}
    </div>
  );
}
