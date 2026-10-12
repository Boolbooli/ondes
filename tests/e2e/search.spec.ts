import { dictionaries } from '../../src/core/i18n';
import { dock, lineTab, openSearch, stop } from './support/app';
import { expect, test } from './support/fixtures';
import { FIXTURE_STREAM_HOST } from './support/network';

const fr = dictionaries.fr;

test('finds France Inter first for "inter" and plays it on its line', async ({ page }) => {
  await page.goto('/');
  const { dialog, field } = await openSearch(page);
  await field.fill('inter');

  const onNetwork = dialog.getByRole('region', { name: fr.onNetwork });
  const first = onNetwork.locator('button.result').first();
  await expect(first.locator('.result__name')).toHaveText('France Inter');
  await first.click();

  await expect(dialog).toBeHidden();
  await expect(lineTab(page, 'Radio France')).toHaveAttribute('aria-selected', 'true');
  await expect(stop(page, 'rf', 'France Inter')).toHaveAttribute('aria-current', 'location');
  await expect(dock(page).open).toHaveAccessibleName('Ouvrir le lecteur : France Inter');
  await expect(dock(page).led).toHaveAttribute('data-status', 'playing');
});

test.describe('world directory', () => {
  test.use({ directory: 'fixture' });

  test('lists the stations only the directory knows, and plays one', async ({ page, network }) => {
    await page.goto('/');
    const { dialog, field } = await openSearch(page);
    await field.fill('ondine');

    const directory = dialog.getByRole('region', { name: fr.directory });
    const rows = directory.locator('li.result--directory');
    await expect(rows.locator('.result__name')).toHaveText(['Ondine Test FM', 'Radio Ondine Nord']);
    await expect(directory.getByRole('status')).toBeEmpty();

    const listen = directory.getByRole('button', { name: 'Écouter Ondine Test FM' });
    await expect(listen).toHaveAttribute('aria-pressed', 'false');
    await listen.click();
    await expect(listen).toHaveAttribute('aria-pressed', 'true');
    await expect(rows.first().locator('.result__status')).toHaveText(/^En direct/);
    expect(network.streams).toContain(`https://${FIXTURE_STREAM_HOST}/ondine-test-fm.mp3`);

    // Listening to a directory station keeps the search open; the dock takes over once it is closed.
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await expect(dialog).toBeHidden();
    await expect(dock(page).open).toHaveAccessibleName('Ouvrir le lecteur : Ondine Test FM');
    await expect(dock(page).led).toHaveAttribute('data-status', 'playing');
  });

  test('leaves out the stations that are already on the network', async ({ page }) => {
    await page.goto('/');
    const { dialog, field } = await openSearch(page);
    await field.fill('fip');

    const directory = dialog.getByRole('region', { name: fr.directory });
    await expect(directory.getByRole('status')).toHaveText(fr.onlyOnNetwork);
    await expect(directory.locator('li.result--directory')).toHaveCount(0);
    await expect(
      dialog.getByRole('region', { name: fr.onNetwork }).locator('.result__name', { hasText: /^FIP$/ }),
    ).toHaveCount(1);
  });
});

test.describe('world directory, unreachable', () => {
  test.use({ directory: 'down' });

  test('keeps the network results and offers to try again', async ({ page, network }) => {
    await page.goto('/');
    const { dialog, field } = await openSearch(page);
    await field.fill('inter');

    const directory = dialog.getByRole('region', { name: fr.directory });
    const status = directory.getByRole('status');
    await expect(status).toHaveText(fr.directoryError);
    expect(network.directory).not.toEqual([]);

    const retry = directory.getByRole('button', { name: fr.retry });
    const asked = network.directory.length;
    await retry.click();
    await expect.poll(() => network.directory.length).toBeGreaterThan(asked);
    await expect(status).toHaveText(fr.directoryError);
    await expect(retry).toBeVisible();

    const first = dialog.getByRole('region', { name: fr.onNetwork }).locator('button.result').first();
    await expect(first.locator('.result__name')).toHaveText('France Inter');
    await first.click();
    await expect(dialog).toBeHidden();
    await expect(dock(page).led).toHaveAttribute('data-status', 'playing');
  });
});
