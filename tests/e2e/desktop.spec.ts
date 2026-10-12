import { devices } from '@playwright/test';
import { dock, stop } from './support/app';
import { expect, test } from './support/fixtures';

test.use({
  viewport: { width: 1440, height: 900 },
  isMobile: false,
  hasTouch: false,
  deviceScaleFactor: 1,
  userAgent: devices['Desktop Edge'].userAgent,
});

test('keeps the player beside the map on wide screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.shell')).toHaveClass(/\bshell--wide\b/);

  const side = page.getByRole('complementary', { name: 'Lecteur' });
  // Nothing has played yet: the first stop of Ma ligne waits beside the map, ready.
  await expect(side.getByRole('heading', { name: 'France Inter' })).toBeVisible();
  await expect(side.locator('.led-board')).toHaveAttribute('data-status', 'idle');
  await expect(side.getByRole('button', { name: 'Écouter', exact: true })).toBeVisible();
  await expect(dock(page).region).toHaveCount(0);

  const franceInter = stop(page, 'fav', 'France Inter');
  await franceInter.click();
  await expect(side.getByRole('heading', { name: 'France Inter' })).toBeVisible();
  await expect(side.locator('.led-board')).toHaveAttribute('data-status', 'playing');
  await expect(side.locator('.programme__title')).toHaveText('Le journal de 18h du week-end');
  await expect(side.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Tapping the station on air again has nothing more to open.
  await franceInter.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(side.locator('.led-board')).toHaveAttribute('data-status', 'playing');

  await side.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(side.locator('.led-board')).toHaveAttribute('data-status', 'paused');
  await expect(side.getByRole('button', { name: 'Écouter', exact: true })).toBeVisible();
});
