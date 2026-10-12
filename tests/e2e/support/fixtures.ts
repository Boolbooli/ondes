import { test as base, expect } from '@playwright/test';
import { routeNetwork, type DirectoryMode, type NetworkLog } from './network';

export { expect };

/**
 * Sunday 11 October 2026, 18:20 in Paris: twenty minutes into the France Inter programme
 * recorded in `tests/fixtures/rf-inter.json` (18:00 to 19:00).
 */
export const NOW = new Date('2026-10-11T16:20:00Z');

interface Options {
  /** How the Radio Browser directory answers. */
  directory: DirectoryMode;
}

interface Fixtures {
  /** What the app asked of the network, and how it was answered. */
  network: NetworkLog;
  /** Uncaught exceptions and console errors, which fail the test. */
  problems: string[];
}

/**
 * Desktop Chromium plays HLS through Media Source Extensions, and its streams cannot be
 * answered with a simple file. Hiding both paths leaves the Icecast streams, which can.
 * Runs in the page: it must not use anything from this module.
 */
function withoutHls(): void {
  const canPlayType = HTMLMediaElement.prototype.canPlayType;
  HTMLMediaElement.prototype.canPlayType = function (this: HTMLMediaElement, type: string) {
    return /mpegurl/i.test(type) ? '' : canPlayType.call(this, type);
  };
  for (const name of ['MediaSource', 'ManagedMediaSource', 'WebKitMediaSource']) {
    Object.defineProperty(window, name, { value: undefined, configurable: true, writable: true });
  }
}

export const test = base.extend<Options & Fixtures>({
  directory: ['down', { option: true }],

  network: async ({ context, baseURL, directory }, use) => {
    await use(await routeNetwork(context, new URL(baseURL ?? 'http://localhost/').origin, directory));
  },

  problems: async ({}, use) => {
    await use([]);
  },

  page: async ({ page, baseURL, network, problems }, use, testInfo) => {
    const appOrigin = new URL(baseURL ?? 'http://localhost/').origin;
    page.on('pageerror', (error) => problems.push(`Uncaught ${error.stack ?? error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const { url } = message.location();
      // Requests the routes abort or refuse on purpose are reported by the browser as failed loads.
      if (message.text().startsWith('Failed to load resource') && url && new URL(url).origin !== appOrigin) return;
      problems.push(`console.error: ${message.text()} (${url || 'no location'})`);
    });
    await page.addInitScript(withoutHls);
    // The clock keeps running from NOW, so timers, animations and polling behave as usual.
    await page.clock.install({ time: NOW });

    await use(page);

    await testInfo.attach('network', { body: JSON.stringify(network, null, 2), contentType: 'application/json' });
    expect(problems, 'uncaught exceptions and console errors').toEqual([]);
  },
});
