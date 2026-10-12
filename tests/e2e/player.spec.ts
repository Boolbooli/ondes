import { dictionaries } from '../../src/core/i18n';
import {
  dock,
  linePanel,
  lineTab,
  MA_LIGNE,
  playerLine,
  playerSheet,
  playFromStop,
  stop,
  stopNames,
} from './support/app';
import { expect, test } from './support/fixtures';

test.describe('player sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the live board and the programme on air', async ({ page }) => {
    await playFromStop(page, 'fav', 'France Inter');
    await dock(page).open.click();

    const player = playerSheet(page);
    await expect(player).toBeVisible();
    await expect(playerLine(player)).toHaveText('Ma ligne');
    await expect(player.getByRole('heading', { level: 2 })).toHaveText('France Inter');

    const board = player.locator('.led-board');
    await expect(board).toHaveAttribute('data-status', 'playing');
    // The board's lettering is upper case by style only.
    await expect(board.locator('.led-board__word')).toHaveText('EN DIRECT', { useInnerText: true });
    // tests/fixtures/rf-inter.json: the programme runs from 18:00 to 19:00, Paris time.
    await expect(board.locator('.led-board__aside')).toContainText('→ 19:00');
    await expect(player.locator('.programme__title')).toHaveText('Le journal de 18h du week-end');
    await expect(player.locator('.programme__subtitle')).toHaveText('Le journal de 18h00 du dimanche 11 octobre 2026');
    const next = player.locator('.programme__next');
    // The fixture lists as next a part of the same 18:00–19:00 slot: it follows, with no time already past.
    await expect(next.locator('.programme__next-label')).toHaveText(dictionaries.fr.upNext);
    await expect(next).toContainText('La chronique de Paola Puerari');
    // Where the ads come from, in one line: France Inter airs them as on FM.
    await expect(player.locator('.adline')).toHaveText(dictionaries.fr.adsShort.onair);

    await expect(player.getByRole('button', { name: 'Ma ligne', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(player.getByRole('button', { name: 'Minuterie' })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Partager' })).toBeVisible();

    await player.getByRole('button', { name: 'Fermer' }).click();
    await expect(player).toBeHidden();
    // Closing the player does not stop the sound.
    await expect(dock(page).led).toHaveAttribute('data-status', 'playing');
  });

  test('opens from the current stop and closes with Escape', async ({ page }) => {
    await playFromStop(page, 'fav', 'France Inter');
    const player = playerSheet(page);

    await stop(page, 'fav', 'France Inter').click();
    await expect(player).toBeVisible();
    await expect(player.locator('.player__name')).toHaveText('France Inter');
    await page.keyboard.press('Escape');
    await expect(player).toBeHidden();

    await dock(page).open.click();
    await expect(player).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(player).toBeHidden();
    await expect(dock(page).play).toHaveAccessibleName('Pause');
  });

  test('steps to the next and previous stops of the line', async ({ page }) => {
    await playFromStop(page, 'fav', 'France Inter');
    await dock(page).open.click();
    const player = playerSheet(page);
    const name = player.locator('.player__name');
    const board = player.locator('.led-board');

    await player.getByRole('button', { name: 'Station suivante' }).click();
    await expect(name).toHaveText('franceinfo');
    await expect(board).toHaveAttribute('data-status', 'playing');

    await player.getByRole('button', { name: 'Station précédente' }).click();
    await expect(name).toHaveText('France Inter');
    await expect(board).toHaveAttribute('data-status', 'playing');

    // The line wraps around: before its first stop comes its last.
    await player.getByRole('button', { name: 'Station précédente' }).click();
    await expect(name).toHaveText('Radio Paradise');
    await expect(board).toHaveAttribute('data-status', 'playing');
    await expect(playerLine(player)).toHaveText('Ma ligne');

    await player.getByRole('button', { name: 'Fermer' }).click();
    await expect(player).toBeHidden();
    await expect(stop(page, 'fav', 'Radio Paradise')).toHaveAttribute('aria-current', 'location');
    await expect(linePanel(page, 'fav').locator('[aria-current]')).toHaveCount(1);
    await expect(dock(page).open).toHaveAccessibleName('Ouvrir le lecteur : Radio Paradise');
  });

  test('adds a station to Ma ligne and removes it', async ({ page }) => {
    const home = lineTab(page, 'Ma ligne');
    await lineTab(page, 'Jazz & classique').click();
    await playFromStop(page, 'jazz', 'TSF Jazz');
    await dock(page).open.click();

    const player = playerSheet(page);
    const favorite = player.getByRole('button', { name: 'Ma ligne', exact: true });
    await expect(playerLine(player)).toHaveText('Jazz & classique');
    await expect(favorite).toHaveAttribute('aria-pressed', 'false');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.toasts').getByText('TSF Jazz est sur votre ligne')).toBeVisible();
    await player.getByRole('button', { name: 'Fermer' }).click();
    await expect(player).toBeHidden();

    await expect(home).toHaveAccessibleName('Ma ligne, 9 stations');
    await expect.poll(() => stopNames(page, 'fav')).toEqual([...MA_LIGNE, 'TSF Jazz']);

    // Ma ligne is kept on the device.
    await page.reload();
    await expect(home).toHaveAccessibleName('Ma ligne, 9 stations');
    await expect.poll(() => stopNames(page, 'fav')).toEqual([...MA_LIGNE, 'TSF Jazz']);
    await expect(dock(page).open).toHaveAccessibleName('Ouvrir le lecteur : TSF Jazz');

    await dock(page).open.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.toasts').getByText('TSF Jazz a quitté votre ligne')).toBeVisible();
    await player.getByRole('button', { name: 'Fermer' }).click();
    await expect(player).toBeHidden();
    await expect(home).toHaveAccessibleName('Ma ligne, 8 stations');
    await expect.poll(() => stopNames(page, 'fav')).toEqual(MA_LIGNE);
  });

  test('tells that Europe 1 inserts its own ads', async ({ page }) => {
    await playFromStop(page, 'fav', 'Europe 1');
    await dock(page).open.click();

    const player = playerSheet(page);
    await expect(player.locator('.player__name')).toHaveText('Europe 1');
    await expect(player.locator('.note')).toHaveText(dictionaries.fr.europe1Note);
    // The note takes the place of the one-line ad status.
    await expect(player.locator('.adline')).toHaveCount(0);
  });
});

test('opens a shared station link on the rewind timeline of RTL', async ({ page }) => {
  // RTL streams only in HLS, which these tests hide, so it is opened from a link and not played.
  await page.goto('/#s=rtl');

  const player = playerSheet(page);
  await expect(player).toBeVisible();
  await expect(player.locator('.player__name')).toHaveText('RTL');
  await expect(playerLine(player)).toHaveText('Info & débats');
  await expect(player.locator('.led-board')).toHaveAttribute('data-status', 'idle');
  const timeline = player.getByRole('slider', { name: 'Position dans les 4 dernières heures' });
  await expect(timeline).toHaveAttribute('aria-valuetext', 'En direct');
  await expect(player.locator('.timeline__tick--live')).toHaveText('Direct');
  await expect(player.getByRole('button', { name: 'Reculer de 30 secondes' })).toBeEnabled();
  await expect(player.getByRole('button', { name: 'Avancer de 30 secondes' })).toBeDisabled();

  await player.getByRole('button', { name: 'Fermer' }).click();
  await expect(player).toBeHidden();
  await expect(lineTab(page, 'Info & débats')).toHaveAttribute('aria-selected', 'true');
  await expect(stop(page, 'info', 'RTL')).toHaveAttribute('aria-current', 'location');
  // The link only shows the station: nothing plays until asked.
  await expect(dock(page).led).toHaveAttribute('data-status', 'idle');
});
