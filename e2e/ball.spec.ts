import { expect, test } from '@playwright/test';

test('Stage 04 Ball Lab launches presets, predicts landing, and exposes deterministic telemetry', async ({ page }) => {
  await page.goto('/');
  const lab = page.locator('[data-ball-lab]');
  await expect(lab).toBeVisible();
  await expect(page.getByRole('button', { name: /straight 20m/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /curl 20m/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /knuckle/i })).toBeVisible();

  const probe = page.locator('[data-ball-state]');
  await expect(probe).toHaveAttribute('data-ball-tick-hz', '120');
  await page.getByRole('button', { name: /curl 20m/i }).click();
  const predictedX = Number(await probe.getAttribute('data-predicted-x'));
  expect(predictedX).toBeGreaterThan(0.25);

  await page.getByRole('button', { name: /^launch$/i }).click();
  await page.waitForTimeout(500);
  const z = Number(await probe.getAttribute('data-z'));
  expect(z).toBeGreaterThan(2);
});

test('Ball Lab custom controls and reset are usable without entering Stage 05 mechanics', async ({ page }) => {
  await page.goto('/');
  const speed = page.getByLabel('Launch speed');
  await speed.fill('28');
  await page.getByLabel('Elevation').fill('18');
  await page.getByLabel('Spin rate').fill('70');
  await page.getByLabel('Spin axis').selectOption('side');
  await page.getByRole('button', { name: /^launch$/i }).click();
  await expect(page.locator('[data-ball-state]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', { name: /reset ball/i }).click();
  await expect(page.locator('[data-ball-state]')).toHaveAttribute('data-active', 'false');
});
