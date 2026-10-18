import { expect, test } from '@playwright/test';

async function separation(page: import('@playwright/test').Page): Promise<number> {
  const player = page.locator('[data-player-state]');
  const ball = page.locator('[data-football-state]');
  const px = Number(await player.getAttribute('data-x'));
  const pz = Number(await player.getAttribute('data-z'));
  const bx = Number(await ball.getAttribute('data-ball-x'));
  const bz = Number(await ball.getAttribute('data-ball-z'));
  return Math.hypot(bx - px, bz - pz);
}

test('practice starts and resets the football inside a natural first-touch pocket', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-football-practice]')).toBeVisible();

  expect(await separation(page)).toBeLessThan(0.82);

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  expect(await separation(page)).toBeLessThan(0.82);
});
