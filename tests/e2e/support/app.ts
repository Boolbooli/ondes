import { expect, type Locator, type Page } from '@playwright/test';
import type { LineId } from '../../../src/core/types';

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The home line of a first visit: the default favourites, in order. */
export const MA_LIGNE: readonly string[] = [
  'France Inter',
  'franceinfo',
  'France Culture',
  'FIP',
  'RTL',
  'Europe 1',
  'Radio Courtoisie',
  'Radio Paradise',
];

/** A line's roundel tab, named after the line and its number of stations. */
export const lineTab = (page: Page, name: string): Locator =>
  page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(name)}, \\d+ stations?$`) });

/**
 * A line's page. The pages of the other lines stay in the document but are inert, so their
 * content is reached with CSS rather than roles.
 */
export const linePanel = (page: Page, line: LineId): Locator => page.locator(`#panel-${line}`);

/**
 * The button of a stop, by station name. A station is marked as current on every line that has it,
 * so stops are always looked up on a given line.
 */
export const stop = (page: Page, line: LineId, name: string): Locator =>
  linePanel(page, line)
    .locator('button.stop__btn')
    .filter({ has: page.locator(`.stop__name:text-is(${JSON.stringify(name)})`) });

/** The station names along a line, top to bottom, without the connection roundels that follow them. */
export const stopNames = (page: Page, line: LineId): Promise<string[]> =>
  linePanel(page, line)
    .locator('.stop__name')
    .evaluateAll((names) => names.map((name) => name.firstChild?.textContent?.trim() ?? ''));

/** The mini-player docked at the bottom of narrow screens. Unreachable while a sheet is open. */
export function dock(page: Page) {
  const region = page.getByRole('region', { name: 'Lecteur', exact: true });
  return {
    region,
    /** Opens the player; named after the current station. */
    open: region.getByRole('button', { name: /^Ouvrir le lecteur : / }),
    /** Named "Écouter" or "Pause". */
    play: region.locator('button.dock__play'),
    /** The status light, with the playback status in `data-status`. */
    led: region.locator('.led'),
  };
}

/** The player, as a sheet on narrow screens. */
export const playerSheet = (page: Page): Locator => page.getByRole('dialog', { name: 'Lecteur', exact: true });

/** The name of the line ridden, at the head of the player, without its decorative roundel. */
export const playerLine = (player: Locator): Locator => player.locator('.player-head__line > span:not(.roundel)');

/** Plays a station from its stop and waits until sound would come out. */
export async function playFromStop(page: Page, line: LineId, name: string): Promise<void> {
  await stop(page, line, name).click();
  await expect(dock(page).led).toHaveAttribute('data-status', 'playing');
}

/** Opens the search sheet from the masthead. */
export async function openSearch(page: Page) {
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rechercher une station' });
  await expect(dialog).toBeVisible();
  return { dialog, field: dialog.getByRole('searchbox', { name: 'Rechercher une station' }) };
}
