import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/doto/index.css';
import './styles/index.css';
import { render } from 'preact';
import { App } from './app';
import { applyUpdate, initStore, setUpdateControls, t, toast, updateReady } from './state/store';

const HOUR = 3_600_000;

initStore();

// iOS Safari only applies `:active` press styles once a touch listener exists on the page.
document.addEventListener('touchstart', () => undefined, { passive: true });

const root = document.getElementById('app');
if (root) render(<App />, root);

/**
 * New versions install in the background and wait. Ondes never reloads by itself, since that
 * would cut the radio: it offers the update and applies it when asked.
 */
async function registerServiceWorker(): Promise<void> {
  const { registerSW } = await import('virtual:pwa-register');
  let registration: ServiceWorkerRegistration | undefined;
  const offer = () => {
    if (updateReady.peek()) return;
    updateReady.value = true;
    const dict = t.peek();
    toast(dict.updateReady, { label: dict.updateNow, run: applyUpdate }, 0);
  };
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: offer,
    onRegisteredSW: (_url, found) => {
      registration = found;
    },
  });
  setUpdateControls({
    async check() {
      if (!registration) return false;
      await registration.update();
      return Boolean(registration.waiting ?? registration.installing) || updateReady.peek();
    },
    apply: () => void updateSW(true),
  });
  let checkedAt = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - checkedAt < HOUR) return;
    checkedAt = Date.now();
    registration?.update().catch(() => undefined);
  });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) void registerServiceWorker();
