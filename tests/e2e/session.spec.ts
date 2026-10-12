import { dictionaries } from '../../src/core/i18n';
import { dock, lineTab, openSearch, playFromStop, playerSheet, stop } from './support/app';
import { expect, test } from './support/fixtures';

const fr = dictionaries.fr;

test('a normal session raises no error and stays on this machine', async ({ page, network, problems }) => {
  await page.goto('/');
  const { region, open, led } = dock(page);

  // France Inter, then the next stop along the home line.
  await playFromStop(page, 'fav', 'France Inter');
  await open.click();
  const player = playerSheet(page);
  await expect(player.locator('.programme__title')).toHaveText('Le journal de 18h du week-end');
  await player.getByRole('button', { name: fr.nextStation }).click();
  await expect(player.getByRole('heading', { name: 'franceinfo', exact: true })).toBeVisible();
  await expect(led).toHaveAttribute('data-status', 'playing');
  await player.getByRole('button', { name: fr.close }).click();
  await expect(player).toBeHidden();

  // A station from another line, with its own programme API.
  await lineTab(page, 'Monde').click();
  await expect(lineTab(page, 'Monde')).toHaveAttribute('aria-selected', 'true');
  await playFromStop(page, 'monde', 'NTS 1');
  await expect(region.locator('.dock__onair')).toHaveText('A Month of Sundays w/ Bill Spencer');

  // And one found by searching.
  const { dialog, field } = await openSearch(page);
  await field.fill('salad');
  const first = dialog.getByRole('region', { name: fr.onNetwork }).locator('button.result').first();
  await expect(first.locator('.result__name')).toHaveText('SomaFM Groove Salad');
  await first.click();
  await expect(dialog).toBeHidden();
  await expect(stop(page, 'monde', 'SomaFM Groove Salad')).toHaveAttribute('aria-current', 'location');
  await expect(led).toHaveAttribute('data-status', 'playing');
  await expect(region.locator('.dock__onair')).toHaveText('Into a distant light (Glint Remix) · Thomas Lemmer');

  await page.getByRole('button', { name: fr.settings, exact: true }).click();
  const settings = page.getByRole('dialog', { name: fr.settingsTitle });
  await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: fr.close }).click();
  await expect(settings).toBeHidden();
  await expect(led).toHaveAttribute('data-status', 'playing');

  expect(problems, 'uncaught exceptions and console errors').toEqual([]);

  const metadata = network.metadata.map((url) => new URL(url));
  const asked = (host: string, path: RegExp): boolean =>
    metadata.some((url) => url.hostname === host && path.test(url.pathname));
  expect(asked('api.radiofrance.fr', /^\/livemeta\/live\/1\//), 'France Inter programme').toBe(true);
  expect(asked('www.nts.live', /^\/api\/v2\/live$/), 'NTS programme').toBe(true);
  expect(asked('somafm.com', /^\/songs\/groovesalad\.json$/), 'SomaFM playlist').toBe(true);
  expect(network.streams).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^https:\/\/icecast\.radiofrance\.fr\/franceinter-/),
      expect.stringMatching(/^https:\/\/icecast\.radiofrance\.fr\/franceinfo-/),
      'https://stream-relay-geo.ntslive.net/stream',
      expect.stringMatching(/^https:\/\/ice\d*\.somafm\.com\/groovesalad-/),
    ]),
  );
  // Besides streams, programmes and the directory, the app only asks for the covers of the
  // programmes on air, which the routes leave unanswered.
  const cover = /^https:\/\/(?:www\.radiofrance\.fr\/pikapi\/images\/|media2\.ntslive\.co\.uk\/)/;
  expect(network.blocked.filter(({ url }) => !cover.test(url)), 'requests nothing answers').toEqual([]);
});
