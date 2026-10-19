import { expect, test } from '@playwright/test';

test('practice explains technique eligibility before execution', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('.practice-technique-panel');
  await panel.locator('> summary').click();
  await expect(panel).toHaveAttribute('open', '');

  const selector = page.getByLabel('Practice technique');
  await expect(selector).toBeVisible();
  await selector.selectOption('bicycle');

  const guide = page.locator('[data-technique-player-guide]');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Bicycle strike');
  await expect(guide).toContainText('Airborne ball');
  await expect(guide).toContainText('0.75–1.70 m');
  await expect(guide).toContainText('10 stamina');
  await expect(guide).toContainText('24.0 m/s contact');
});
