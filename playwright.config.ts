import { defineConfig, devices } from '@playwright/test';

const port = 4173;

/**
 * End-to-end tests run the production build in an iPhone-sized Chromium.
 * Playwright's bundled Chromium has no AAC/H.264 decoders, so we use an installed
 * branded browser: Microsoft Edge locally, Google Chrome on CI (PW_CHANNEL=chrome).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}/`,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // The production build registers a service worker, whose fetches would bypass the
    // tests' network routes (tests/e2e/support/network.ts) and reach the real network.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 15'],
        browserName: 'chromium',
        channel: process.env.PW_CHANNEL ?? 'msedge',
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
