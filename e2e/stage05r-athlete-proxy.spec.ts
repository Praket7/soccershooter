import { expect, test } from '@playwright/test';

test('slow-motion contact ghost matches a reachable authoritative dribble contact', async ({ page }) => {
  await page.goto('/?stage05rSlowMotion=1');
  const canvas = page.locator('canvas[data-game-viewport]');
  const practice = page.locator('[data-football-state]');
  const proxy = page.locator('[data-athlete-proxy-state]');

  await expect(canvas).toHaveAttribute('data-procedural-athlete', 'true');
  await page.keyboard.press('g');
  await page.keyboard.down('w');
  await expect.poll(
    async () => Number(await practice.getAttribute('data-planned-contact-count') ?? 0),
    { timeout: 12000 },
  ).toBeGreaterThan(0);
  await page.keyboard.up('w');

  await expect(proxy).toHaveAttribute('data-last-contact-visible', 'true');
  const error = Number(await proxy.getAttribute('data-last-contact-error-m'));
  expect(error).toBeLessThanOrEqual(0.06);
  expect(await proxy.getAttribute('data-last-contact-foot')).toMatch(/left|right/);
  expect(await proxy.getAttribute('data-last-contact-surface')).toMatch(/inside|outside|instep|sole|toe/);
  await page.keyboard.press('F9');
  await expect(page.locator('[data-contact-debug-readout]')).toBeVisible();
  await expect(page.locator('[data-contact-debug-readout]')).toContainText(/LEFT|RIGHT/);
});
