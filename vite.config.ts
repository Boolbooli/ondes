import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { splashDevices, splashFile, splashMedia } from './scripts/devices.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Injects one iOS launch image per supported iPhone screen. */
function launchImages(): Plugin {
  return {
    name: 'ondes:launch-images',
    transformIndexHtml: () =>
      splashDevices.map((device) => ({
        tag: 'link',
        attrs: { rel: 'apple-touch-startup-image', href: splashFile(device), media: splashMedia(device) },
        injectTo: 'head' as const,
      })),
  };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    preact(),
    launchImages(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Ondes, la radio sans coupure',
        short_name: 'Ondes',
        description:
          'Vos radios en direct : Radio France, RTL, Europe 1, Radio Courtoisie et des radios musicales du monde entier. Aucune publicité ajoutée par l’application.',
        lang: 'fr',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b1230',
        theme_color: '#0b1230',
        categories: ['music', 'news', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Launch images are only read by iOS at install time; keep them out of the offline cache,
        // along with the font faces the interface never uses (italics, Vietnamese).
        globIgnores: ['splash/**', 'art/**', '**/*italic*', '**/*vietnamese*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Audio streams and live metadata always go straight to the network.
        // Station artwork and programme covers are kept for the lock screen and offline use.
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.includes('/art/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ondes-art', expiration: { maxEntries: 120 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'www.radiofrance.fr' && url.pathname.startsWith('/pikapi/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ondes-covers',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: ['es2022', 'safari16'],
    sourcemap: true,
  },
  server: {
    host: true,
  },
});
