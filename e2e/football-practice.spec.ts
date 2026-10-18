import { expect, test } from '@playwright/test';

test('Stage 05 practice starts physical, idle, and non-magnetic', async ({ page }) => {
  await page.goto('/');

  const practice = page.locator('[data-football-practice]');
  const probe = page.locator('[data-football-state]');
  await expect(practice).toBeVisible();
  await expect(page.getByRole('button', { name: 'Football Practice', exact: true })).toHaveAttribute('data-active', 'true');
  await expect(page.locator('[data-ball-lab]')).toBeHidden();

  const before = {
    x: Number(await probe.getAttribute('data-ball-x')),
    z: Number(await probe.getAttribute('data-ball-z')),
    speed: Number(await probe.getAttribute('data-ball-speed')),
  };
  await page.waitForTimeout(350);
  const after = {
    x: Number(await probe.getAttribute('data-ball-x')),
    z: Number(await probe.getAttribute('data-ball-z')),
    speed: Number(await probe.getAttribute('data-ball-speed')),
  };

  expect(after.x).toBeCloseTo(before.x, 5);
  expect(after.z).toBeCloseTo(before.z, 5);
  expect(after.speed).toBeLessThan(0.05);
});

test('Stage 05 pass contact moves the free ball without teleporting it', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  const beforeZ = Number(await probe.getAttribute('data-ball-z'));
  await page.keyboard.press('e');

  await expect.poll(async () => Number(await probe.getAttribute('data-ball-z')), { timeout: 2500 })
    .toBeGreaterThan(beforeZ + 1.5);
  await expect(probe).toHaveAttribute('data-action', /pass/);
  expect(Number(await probe.getAttribute('data-ball-speed'))).toBeGreaterThan(2);
});

test('Stage 05 practice ball visual rotation advances from physics steps, never idle render frames', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(100);
  const idleQuaternion = await probe.getAttribute('data-ball-visual-quaternion');
  expect(idleQuaternion).toMatch(/^-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+$/);
  await page.waitForTimeout(300);
  expect(await probe.getAttribute('data-ball-visual-quaternion')).toBe(idleQuaternion);

  await page.keyboard.press('e');
  await expect.poll(async () => await probe.getAttribute('data-ball-visual-quaternion'), { timeout: 2500 })
    .not.toBe(idleQuaternion);
});

test('Stage 05 exposes shot-style mastery and tackle commitment recovery', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('3');
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await expect(page.locator('[data-shot-style="finesse"]')).toHaveAttribute('data-active', 'true');

  await page.keyboard.press('g');
  await page.waitForTimeout(60);
  await page.keyboard.down('Shift');
  await page.keyboard.press('c');
  await page.keyboard.up('Shift');

  await expect(probe).toHaveAttribute('data-action', /committed tackle/);
  expect(Number(await probe.getAttribute('data-recovery'))).toBeGreaterThan(0.4);
});

test('Stage 05 mode switch preserves the Stage 04 Ball Lab as a separate instrument', async ({ page }) => {
  await page.goto('/');
  const practice = page.locator('[data-football-practice]');
  const lab = page.locator('[data-ball-lab]');

  await page.getByRole('button', { name: 'Ball Lab', exact: true }).click();
  await expect(practice).toBeHidden();
  await expect(lab).toBeVisible();
  await expect(lab).toHaveAttribute('data-preset', 'straight');

  await page.getByRole('button', { name: 'Football Practice', exact: true }).click();
  await expect(practice).toBeVisible();
  await expect(lab).toBeHidden();
});
