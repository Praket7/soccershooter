import { expect, test } from '@playwright/test';

test('Stage 04 Ball Lab exposes deterministic presets and launches the physical ball', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Ball Lab', { exact: true })).toBeVisible();
  const lab = page.locator('[data-ball-lab]');
  await expect(lab).toHaveAttribute('data-preset', 'straight');
  await expect(lab).toHaveAttribute('data-playing', 'false');

  await page.locator('[data-ball-preset="curl"]').click();
  await expect(lab).toHaveAttribute('data-preset', 'curl');

  const beforeZ = Number(await lab.getAttribute('data-ball-z'));
  await page.locator('[data-ball-launch]').click();
  await expect(lab).toHaveAttribute('data-playing', 'true');
  await page.waitForTimeout(500);

  const flightSeconds = Number(await lab.getAttribute('data-flight-seconds'));
  const afterZ = Number(await lab.getAttribute('data-ball-z'));
  const curvedX = Math.abs(Number(await lab.getAttribute('data-ball-x')));
  expect(flightSeconds).toBeGreaterThan(0.2);
  expect(afterZ).toBeGreaterThan(beforeZ + 2);
  expect(curvedX).toBeGreaterThan(0.05);

  await page.locator('[data-ball-reset]').click();
  await expect(lab).toHaveAttribute('data-playing', 'false');
  await expect(lab).toHaveAttribute('data-flight-seconds', '0.000');
});

test('Stage 04 Ball Lab supports deterministic keyboard presets and trace export', async ({ page }) => {
  await page.goto('/');
  const lab = page.locator('[data-ball-lab]');

  await page.keyboard.press('7');
  await expect(lab).toHaveAttribute('data-preset', 'knuckle');
  await page.keyboard.press('l');
  await page.waitForTimeout(180);
  expect(Number(await lab.getAttribute('data-flight-seconds'))).toBeGreaterThan(0.05);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-ball-export]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('soccershooter-ball-knuckle.csv');
});

test('Ball Lab visual ball is readable, trail advances, and idle render frames cannot rotate it', async ({ page }) => {
  await page.goto('/');
  const lab = page.locator('[data-ball-lab]');

  await expect(lab).toHaveAttribute('data-ball-visual-scale', '1.35');
  const idleQuaternion = await lab.getAttribute('data-ball-visual-quaternion');
  await page.waitForTimeout(250);
  expect(await lab.getAttribute('data-ball-visual-quaternion')).toBe(idleQuaternion);

  await page.locator('[data-ball-preset="curl"]').click();
  await page.locator('[data-ball-launch]').click();
  await page.waitForTimeout(350);
  expect(Number(await lab.getAttribute('data-actual-trail-points'))).toBeGreaterThan(8);
  expect(await lab.getAttribute('data-ball-visual-quaternion')).not.toBe(idleQuaternion);

  await page.locator('[data-ball-reset]').click();
  const resetQuaternion = await lab.getAttribute('data-ball-visual-quaternion');
  await page.waitForTimeout(250);
  expect(await lab.getAttribute('data-ball-visual-quaternion')).toBe(resetQuaternion);
});