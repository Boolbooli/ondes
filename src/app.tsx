import { useEffect, useRef } from 'preact/hooks';
import { currentStation, sheet, t, wide } from './state/store';
import { Dock } from './ui/Dock';
import { CloseIcon } from './ui/icons';
import { LinePages } from './ui/LinePages';
import { Masthead } from './ui/Masthead';
import { Player, PlayerHeader } from './ui/Player';
import { SearchField, SearchResults } from './ui/SearchPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import { Sheet, SheetHeader } from './ui/Sheet';
import { Toasts } from './ui/Toasts';

/**
 * iOS lays the keyboard over the page instead of resizing it. `--kb` holds the height it
 * covers so that sheets can pad their content and nothing ends up hidden beneath it.
 */
function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty('--kb', `${Math.round(covered)}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
}

export function App() {
  useKeyboardInset();
  const dict = t.value;
  const open = sheet.value;
  const isWide = wide.value;
  const name = currentStation.value?.name;
  const searchInput = useRef<HTMLInputElement>(null);
  const close = () => {
    sheet.value = null;
  };

  useEffect(() => {
    document.title = name ? `${name} · Ondes` : 'Ondes';
  }, [name]);

  return (
    <>
      <div class={`shell${isWide ? ' shell--wide' : ''}`} inert={open !== null}>
        <Masthead />
        <main class="main" id="main">
          <LinePages />
        </main>
        {isWide ? (
          <aside class="side enamel" aria-label={dict.player}>
            <PlayerHeader />
            <Player />
          </aside>
        ) : (
          <Dock />
        )}
      </div>

      <Sheet
        open={open === 'player' && !isWide}
        onClose={close}
        label={dict.player}
        variant="enamel"
        header={<PlayerHeader onClose={close} />}
      >
        <Player />
      </Sheet>

      <Sheet
        open={open === 'search'}
        onClose={close}
        label={dict.searchTitle}
        initialFocus={searchInput}
        header={
          <>
            <SheetHeader title={dict.searchTitle} closeLabel={dict.close} onClose={close} icon={<CloseIcon />} />
            <SearchField inputRef={searchInput} />
          </>
        }
      >
        <SearchResults inputRef={searchInput} />
      </Sheet>

      <Sheet
        open={open === 'settings'}
        onClose={close}
        label={dict.settingsTitle}
        size="auto"
        header={<SheetHeader title={dict.settingsTitle} closeLabel={dict.close} onClose={close} icon={<CloseIcon />} />}
      >
        <SettingsPanel />
      </Sheet>

      <Toasts />
    </>
  );
}
