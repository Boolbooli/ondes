import { dock, linePanel, lineTab, MA_LIGNE, stop, stopNames } from './support/app';
import { expect, test } from './support/fixtures';

test.describe('home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens on Ma ligne with its eight stops in order', async ({ page }) => {
    await expect(page.getByRole('tab')).toHaveCount(8);
    const home = lineTab(page, 'Ma ligne');
    await expect(home).toHaveAccessibleName('Ma ligne, 8 stations');
    await expect(home).toHaveAttribute('aria-selected', 'true');

    const panel = linePanel(page, 'fav');
    await expect(panel).not.toHaveAttribute('inert');
    await expect(panel.locator('.line-head__name')).toHaveText('Ma ligne');
    await expect(panel.locator('.line-head__count')).toHaveText('8 stations');
    await expect.poll(() => stopNames(page, 'fav')).toEqual(MA_LIGNE);
  });

  test('puts the first stop on the board, one tap from sound', async ({ page }) => {
    // Nothing has played yet: France Inter, first on Ma ligne, waits on the dock.
    await expect(linePanel(page, 'fav').locator('[aria-current]')).toHaveCount(1);
    await expect(stop(page, 'fav', 'France Inter')).toHaveAttribute('aria-current', 'location');
    const player = dock(page);
    await expect(player.open).toHaveAccessibleName('Ouvrir le lecteur : France Inter');
    await expect(player.led).toHaveAttribute('data-status', 'idle');
    await expect(player.play).toHaveAccessibleName('Écouter');

    await player.play.click();
    await expect(player.led).toHaveAttribute('data-status', 'playing');
    await expect(player.play).toHaveAccessibleName('Pause');
  });

  test('switches lines with the roundel tabs', async ({ page }) => {
    const home = lineTab(page, 'Ma ligne');
    const radioFrance = lineTab(page, 'Radio France');
    const jazz = lineTab(page, 'Jazz & classique');

    await radioFrance.click();
    await expect(radioFrance).toHaveAttribute('aria-selected', 'true');
    await expect(home).toHaveAttribute('aria-selected', 'false');
    await expect(linePanel(page, 'rf')).not.toHaveAttribute('inert');
    await expect(linePanel(page, 'fav')).toHaveAttribute('inert');
    await expect(linePanel(page, 'rf').locator('.line-head__name')).toBeInViewport({ ratio: 1 });
    await expect(linePanel(page, 'fav').locator('.line-head__name')).not.toBeInViewport();
    await expect.poll(() => stopNames(page, 'rf')).toEqual(expect.arrayContaining(['France Inter', 'France Culture']));

    await jazz.click();
    await expect(jazz).toHaveAttribute('aria-selected', 'true');
    await expect(radioFrance).toHaveAttribute('aria-selected', 'false');
    await expect(linePanel(page, 'jazz')).not.toHaveAttribute('inert');
    await expect(linePanel(page, 'rf')).toHaveAttribute('inert');
    await expect(linePanel(page, 'jazz').locator('.line-head__name')).toHaveText('Jazz & classique');
    await expect(linePanel(page, 'jazz').locator('.line-head__name')).toBeInViewport({ ratio: 1 });
    await expect.poll(async () => (await stopNames(page, 'jazz'))[0]).toBe('TSF Jazz');

    await home.click();
    await expect(home).toHaveAttribute('aria-selected', 'true');
    await expect(jazz).toHaveAttribute('aria-selected', 'false');
    await expect(linePanel(page, 'fav').locator('.line-head__name')).toBeInViewport({ ratio: 1 });
  });
});
