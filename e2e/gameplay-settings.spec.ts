import { expect, test } from '@playwright/test';

test('gameplay settings persist and apply without reloading authoritative simulation', async ({ page }) => {
  await page.goto('/');

  const settingsButton = page.getByRole('button', { name: 'Settings' });
  await expect(settingsButton).toBeVisible();
  await settingsButton.click();

  const dialog = page.getByRole('dialog', { name: 'Gameplay settings' });
  await expect(dialog).toBeVisible();

  const fov = page.getByLabel('Camera field of view');
  const invertY = page.getByLabel('Invert vertical camera');
  const reducedMotion = page.getByLabel('Reduce camera motion');
  const showHints = page.getByLabel('Show control hints');

  await fov.fill('68');
  await invertY.check();
  await reducedMotion.check();
  await showHints.uncheck();

  await expect(page.locator('body')).toHaveAttribute('data-camera-fov', '68');
  await expect(page.locator('body')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('.control-card')).toBeHidden();

  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.reload();

  await expect(page.locator('.control-card')).toBeHidden();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Camera field of view')).toHaveValue('68');
  await expect(page.getByLabel('Invert vertical camera')).toBeChecked();
  await expect(page.getByLabel('Reduce camera motion')).toBeChecked();
  await expect(page.getByLabel('Show control hints')).not.toBeChecked();
});

test('reset defaults restores the shipped professional control feel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Mouse sensitivity').fill('200');
  await page.getByLabel('Camera distance').fill('8.8');
  await page.getByRole('button', { name: 'Reset defaults' }).click();

  await expect(page.getByLabel('Mouse sensitivity')).toHaveValue('100');
  await expect(page.getByLabel('Camera distance')).toHaveValue('5.6');
  await expect(page.locator('body')).toHaveAttribute('data-camera-fov', '55');
});
