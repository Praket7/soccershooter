import { expect, test } from '@playwright/test';

test('Stage 03 movement remains controllable inside the physical football lab', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SoccerShooter Physical Football Lab' })).toBeVisible();
  await expect(page.locator('canvas[data-game-viewport]')).toBeVisible();

  const probe = page.locator('[data-player-state]');
  await expect(probe).toHaveAttribute('data-movement-tick-hz', '60');

  const before = Number(await probe.getAttribute('data-z'));
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await page.waitForTimeout(80);
  const after = Number(await probe.getAttribute('data-z'));
  expect(after).toBeGreaterThan(before + 0.2);

  const inputToSimulationMs = Number(await probe.getAttribute('data-input-to-simulation-ms'));
  const inputToRenderMs = Number(await probe.getAttribute('data-input-to-render-ms'));
  expect(Number.isFinite(inputToSimulationMs)).toBe(true);
  expect(Number.isFinite(inputToRenderMs)).toBe(true);
  expect(inputToSimulationMs).toBeGreaterThanOrEqual(0);
  expect(inputToRenderMs).toBeGreaterThanOrEqual(0);
});

test('Stage 03 action hooks visibly acknowledge keyboard requests', async ({ page }) => {
  await page.goto('/');
  const feedback = page.locator('[data-action-feedback]');
  await expect(feedback).toHaveAttribute('data-action', 'idle');

  await page.keyboard.press('c');
  await expect(feedback).toHaveAttribute('data-action', 'tackle');
  await expect(feedback).toContainText(/challenge|defensive/i);

  await page.keyboard.press('Space');
  await expect(feedback).toHaveAttribute('data-action', 'jump');
  await expect(feedback).toContainText(/aerial|header|jump/i);
});

test('trackpad or wheel zoom changes third-person field of view distance smoothly', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas[data-game-viewport]');
  const probe = page.locator('[data-player-state]');
  await canvas.hover();

  const initial = Number(await probe.getAttribute('data-camera-distance'));
  expect(initial).toBeGreaterThan(5);

  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(350);
  const zoomedOut = Number(await probe.getAttribute('data-camera-distance'));
  expect(zoomedOut).toBeGreaterThan(initial + 0.35);

  await page.mouse.wheel(0, -420);
  await page.waitForTimeout(350);
  const zoomedIn = Number(await probe.getAttribute('data-camera-distance'));
  expect(zoomedIn).toBeLessThan(zoomedOut - 0.35);
});

test('Stage 02 deterministic browser parity evidence remains exposed', async ({ page }) => {
  await page.goto('/');
  const result = page.locator('[data-determinism-hash]');
  await expect(result).toHaveAttribute('data-determinism-ticks', '10000');
  await expect(result).toHaveAttribute('data-determinism-hash', /[0-9a-f]{16}/);
});