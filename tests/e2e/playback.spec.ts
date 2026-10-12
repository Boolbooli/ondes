import { dock, linePanel, playerSheet, stop } from './support/app';
import { expect, test } from './support/fixtures';

test('plays France Inter from its stop, pauses and resumes it', async ({ page, network }) => {
  await page.goto('/');
  const franceInter = stop(page, 'fav', 'France Inter');
  const { open, play, led } = dock(page);

  await franceInter.click();
  await expect(franceInter).toHaveAttribute('aria-current', 'location');
  await expect(linePanel(page, 'fav').locator('[aria-current]')).toHaveCount(1);
  await expect(open).toHaveAccessibleName('Ouvrir le lecteur : France Inter');
  await expect(led).toHaveAttribute('data-status', 'playing');
  await expect(led).toHaveText('En direct');
  await expect(play).toHaveAccessibleName('Pause');
  await expect(franceInter.locator('.stop__status')).toHaveText('En direct');
  await expect(page).toHaveTitle('France Inter · Ondes');
  // The Icecast stream, answered with silence: HLS is hidden from the page.
  await expect
    .poll(() => network.streams)
    .toContainEqual(expect.stringMatching(/^https:\/\/icecast\.radiofrance\.fr\/franceinter-/));

  await play.click();
  await expect(play).toHaveAccessibleName('Écouter');
  await expect(led).toHaveAttribute('data-status', 'paused');
  await expect(led).toHaveText('En pause');
  await expect(franceInter).toHaveAttribute('aria-current', 'location');

  // Resume from the player.
  await open.click();
  const player = playerSheet(page);
  await expect(player).toBeVisible();
  await expect(player.locator('.led-board')).toHaveAttribute('data-status', 'paused');
  await player.getByRole('button', { name: 'Écouter', exact: true }).click();
  await expect(player.locator('.led-board')).toHaveAttribute('data-status', 'playing');
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Fermer' }).click();
  await expect(player).toBeHidden();
  await expect(play).toHaveAccessibleName('Pause');
  await expect(led).toHaveAttribute('data-status', 'playing');

  // Tapping the stop of a paused station resumes it rather than opening the player.
  await play.click();
  await expect(led).toHaveAttribute('data-status', 'paused');
  await franceInter.click();
  await expect(led).toHaveAttribute('data-status', 'playing');
  await expect(player).toBeHidden();
});

test('switches station from another stop', async ({ page }) => {
  await page.goto('/');
  await stop(page, 'fav', 'France Inter').click();
  await expect(dock(page).led).toHaveAttribute('data-status', 'playing');

  const fip = stop(page, 'fav', 'FIP');
  await fip.click();
  await expect(fip).toHaveAttribute('aria-current', 'location');
  await expect(stop(page, 'fav', 'France Inter')).not.toHaveAttribute('aria-current');
  await expect(dock(page).open).toHaveAccessibleName('Ouvrir le lecteur : FIP');
  await expect(dock(page).led).toHaveAttribute('data-status', 'playing');
  await expect(page).toHaveTitle('FIP · Ondes');
});
