import { expect, test } from '@playwright/test';

test('Stage 08 techniques expose an eligible windup, counter window, and physical contact', async ({ page }) => {
  await page.goto('/');
  const practice = page.locator('[data-football-state]');
  await page.locator('.practice-technique-panel summary').click();
  await page.locator('[data-technique-select]').selectOption('body-feint');
  await page.keyboard.press('t');

  await expect(practice).toHaveAttribute('data-action', 'TECHNIQUE WINDUP');
  const debug = page.locator('[data-technique-debug]');
  await expect(debug).toBeVisible();
  await expect(debug).toHaveAttribute('data-technique', 'body-feint');
  await expect(debug).toHaveAttribute('data-eligible', 'true');
  await expect(debug).toHaveAttribute('data-counter-until-tick', /\d+/);
  await expect.poll(async () => Number(await practice.getAttribute('data-ball-speed')), { timeout: 1800 })
    .toBeGreaterThan(0.8);
});

test('Stage 08 aerial techniques reject a grounded attempt instead of faking an airborne contact', async ({ page }) => {
  await page.goto('/');
  const practice = page.locator('[data-football-state]');
  await page.locator('.practice-technique-panel summary').click();
  await page.locator('[data-technique-select]').selectOption('volley');
  await page.keyboard.press('t');

  await expect(practice).toHaveAttribute('data-action', 'TECHNIQUE FAILED');
  const debug = page.locator('[data-technique-debug]');
  await expect(debug).toBeVisible();
  await expect(debug).toHaveAttribute('data-technique', 'volley');
  await expect(debug).toHaveAttribute('data-eligible', 'false');
  await expect(debug).toHaveAttribute('data-failure-reason', 'airborne-technique-required');
});
