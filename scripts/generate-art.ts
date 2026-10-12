/**
 * Renders the authored artwork to PNG with the same SVG the app draws inline:
 *  - one enamel plaque per catalogue station, shown on the lock screen and in CarPlay;
 *  - the home-screen and browser icons;
 *  - one launch image per iPhone screen in `devices.ts`.
 *
 * Run `npm run art` after changing the catalogue, a line or the artwork, then commit `public/`.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { appIconSvg, faviconSvg, fitArtText, splashSvg, stationArtSvg } from '../src/core/station-art';
import { lineById } from '../src/data/lines';
import { catalog } from '../src/data/stations';
import { splashDevices, splashFile } from './devices';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const fontDir = join(root, 'node_modules', '@fontsource-variable', 'archivo');

/** The app's Archivo faces, inlined so the page needs no network or file access. */
async function fontFaces(): Promise<string> {
  const css = await readFile(join(fontDir, 'wdth.css'), 'utf8');
  const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  const kept: string[] = [];
  for (const face of faces) {
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(face)?.[1];
    if (!file || file.includes('vietnamese')) continue;
    const data = (await readFile(join(fontDir, 'files', file))).toString('base64');
    kept.push(face.replace(/url\([^)]+\)/, `url(data:font/woff2;base64,${data})`));
  }
  if (kept.length === 0) throw new Error('No Archivo faces found: run `npm ci` first.');
  return kept.join('\n');
}

async function render(page: Page, svg: string, width: number, height: number, file: string): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.evaluate(
    async ([markup, w, h]) => {
      const stage = document.getElementById('stage');
      if (!stage) throw new Error('No stage');
      stage.innerHTML = markup;
      const element = stage.querySelector('svg');
      if (!element) throw new Error('No SVG');
      element.setAttribute('width', String(w));
      element.setAttribute('height', String(h));
      element.getBoundingClientRect();
      await document.fonts.ready;
    },
    [svg, width, height] as const,
  );
  await page.evaluate(`(${fitArtText.toString()})(document)`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height }, type: 'png' });
  await writeFile(join(publicDir, file), png);
}

/** Removes plaques left behind by stations that left the catalogue. */
async function pruneArt(expected: ReadonlySet<string>): Promise<string[]> {
  const removed: string[] = [];
  for (const name of await readdir(join(publicDir, 'art'))) {
    if (name.endsWith('.png') && !expected.has(name)) {
      await rm(join(publicDir, 'art', name));
      removed.push(name);
    }
  }
  return removed;
}

async function main(): Promise<void> {
  for (const dir of ['art', 'icons', 'splash']) await mkdir(join(publicDir, dir), { recursive: true });

  // Same browser rule as the end-to-end tests: Edge locally, Chrome on CI (PW_CHANNEL=chrome).
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8">' +
        // tsx keeps function names with a helper the page does not have.
        '<script>window.__name = (f) => f;</script>' +
        `<style>${await fontFaces()}\nhtml,body{margin:0;background:#0b1230}svg{display:block}</style>` +
        '</head><body><div id="stage"></div></body></html>',
    );
    const loaded = await page.evaluate(async () => {
      const font = "800 100px 'Archivo Variable'";
      await Promise.all([document.fonts.load(font, 'ABCÉÀ'), document.fonts.load(font, 'ŁŐŠ')]);
      return document.fonts.check(font, 'ONDES');
    });
    if (!loaded) throw new Error('Archivo did not load; the artwork would fall back to another font.');

    const plaques = new Set<string>();
    for (const station of catalog) {
      const file = `${station.id}.png`;
      plaques.add(file);
      await render(page, stationArtSvg(station.name, lineById(station.line)), 512, 512, `art/${file}`);
    }
    const removed = await pruneArt(plaques);

    const icon = appIconSvg();
    await render(page, icon, 512, 512, 'icons/icon-512.png');
    await render(page, icon, 512, 512, 'icons/icon-maskable-512.png');
    await render(page, icon, 192, 192, 'icons/icon-192.png');
    await render(page, icon, 180, 180, 'icons/apple-touch-icon.png');
    await writeFile(join(publicDir, 'icons', 'favicon.svg'), `${faviconSvg()}\n`);

    const splashes = new Set<string>();
    for (const device of splashDevices) {
      const file = splashFile(device);
      if (splashes.has(file)) continue;
      splashes.add(file);
      const width = device.width * device.dpr;
      const height = device.height * device.dpr;
      await render(page, splashSvg(width, height), width, height, file);
    }

    console.log(`Artwork: ${plaques.size} plaques, 5 icons, ${splashes.size} launch images.`);
    if (removed.length > 0) console.log(`Removed stale plaques: ${removed.join(', ')}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
