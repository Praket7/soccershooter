import { expect, test } from '@playwright/test';

async function resetPracticeBall(page: import('@playwright/test').Page) {
  await page.keyboard.press('g');
  await expect(page.locator('[data-football-state]')).toHaveAttribute('data-action', 'reset');
}

test('Stage 05 opens in Football Practice with Ball Lab preserved as a separate diagnostics mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-football-practice]')).toBeVisible();
  await expect(page.locator('[data-ball-lab]')).toBeHidden();
  await expect(page.locator('[data-action-debug]')).toBeVisible();
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-mode', 'practice');

  await page.getByRole('button', { name: 'Ball Lab', exact: true }).click();
  await expect(page.locator('[data-ball-lab]')).toBeVisible();
  await expect(page.locator('[data-football-practice]')).toBeHidden();
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-mode', 'ball-lab');

  await page.getByRole('button', { name: 'Football Practice', exact: true }).click();
  await expect(page.locator('[data-football-practice]')).toBeVisible();
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-mode', 'practice');
});

test('physical dribble touch moves the ball only after player movement', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  const probe = page.locator('[data-football-state]');
  const beforeZ = Number(await probe.getAttribute('data-ball-z'));

  await page.waitForTimeout(220);
  const idleZ = Number(await probe.getAttribute('data-ball-z'));
  expect(Math.abs(idleZ - beforeZ)).toBeLessThan(0.03);

  await page.keyboard.down('w');
  await page.waitForTimeout(520);
  await page.keyboard.up('w');

  await expect.poll(async () => Number(await probe.getAttribute('data-ball-z')), { timeout: 1_500 })
    .toBeGreaterThan(beforeZ + 0.45);
  expect(Number(await page.locator('[data-action-debug]').getAttribute('data-control-quality'))).toBeGreaterThan(0);
});

test('E creates a real physical pass toward the moving practice receiver', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('e');
  await expect.poll(async () => await probe.getAttribute('data-action'), { timeout: 1_000 }).toContain('pass');
  await expect.poll(async () => Number(await probe.getAttribute('data-ball-speed')), { timeout: 1_000 })
    .toBeGreaterThan(7);
  await expect(page.locator('[data-action-debug]')).toHaveAttribute('data-success', 'true');
});

test('held primary pointer input charges then releases a bounded shot', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  await page.keyboard.press('3');
  await expect(page.locator('[data-football-state]')).toHaveAttribute('data-shot-style', 'finesse');

  const canvas = page.locator('canvas[data-game-viewport]');
  await canvas.click();
  await expect.poll(async () => page.evaluate(() => document.pointerLockElement?.getAttribute('data-game-viewport') ?? 'false'))
    .toBe('true');

  const box = await canvas.boundingBox();
  if (!box) throw new Error('game canvas has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(430);
  const charged = Number(await page.locator('[data-football-state]').getAttribute('data-shot-charge'));
  expect(charged).toBeGreaterThan(0.35);
  await page.mouse.up({ button: 'left' });

  const probe = page.locator('[data-football-state]');
  await expect.poll(async () => await probe.getAttribute('data-action'), { timeout: 1_000 }).toContain('shot');
  await expect.poll(async () => Number(await probe.getAttribute('data-ball-speed')), { timeout: 1_000 })
    .toBeGreaterThan(8);
  await expect(page.locator('[data-action-debug]')).toHaveAttribute('data-success', 'true');
});

test('committed challenge creates readable recovery and immediate spam is rejected', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  const probe = page.locator('[data-football-state]');

  await page.keyboard.down('Shift');
  await page.keyboard.press('c');
  await page.keyboard.up('Shift');
  await expect.poll(async () => Number(await probe.getAttribute('data-recovery')), { timeout: 800 })
    .toBeGreaterThan(0.25);

  await page.keyboard.press('c');
  await expect.poll(async () => await probe.getAttribute('data-reason'), { timeout: 600 }).toBe('recovering');
});

test('shot style selection exposes all six Stage 05 contact families', async ({ page }) => {
  await page.goto('/');
  const styles = ['normal', 'driven', 'finesse', 'chip', 'knuckle', 'outside-foot'];
  for (let index = 0; index < styles.length; index += 1) {
    await page.keyboard.press(String(index + 1));
    await expect(page.locator('[data-football-state]')).toHaveAttribute('data-shot-style', styles[index]!);
  }
});
