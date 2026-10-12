import { lineTab } from './support/app';
import { expect, test } from './support/fixtures';

// The system appearance is dark, so that choosing the light theme is a visible change.
test.use({ colorScheme: 'dark' });

test('switches to the light theme and keeps it', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('html');
  // Auto follows the system.
  await expect(root).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages' });
  await expect(settings.getByRole('radio', { name: 'Auto' })).toBeChecked();
  await settings.getByText('Carrelage', { exact: true }).click();
  await expect(settings.getByRole('radio', { name: 'Carrelage' })).toBeChecked();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await settings.getByRole('button', { name: 'Fermer' }).click();
  await expect(settings).toBeHidden();

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(settings.getByRole('radio', { name: 'Carrelage' })).toBeChecked();

  // And back to enamel, whatever the system says.
  await settings.getByText('Émail', { exact: true }).click();
  await expect(settings.getByRole('radio', { name: 'Émail' })).toBeChecked();
  await expect(root).toHaveAttribute('data-theme', 'dark');
});

test('switches the interface to English and keeps it', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('lang', 'fr');

  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByRole('dialog', { name: 'Réglages' }).getByText('English', { exact: true }).click();

  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('radio', { name: 'English' })).toBeChecked();
  await expect(root).toHaveAttribute('lang', 'en');
  await settings.getByRole('button', { name: 'Close' }).click();
  await expect(settings).toBeHidden();

  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'My line, 8 stations' })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(root).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'My line, 8 stations' })).toBeVisible();
  await expect(lineTab(page, 'Radio France')).toBeVisible();
});
