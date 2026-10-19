import { expect, test } from '@playwright/test';

test('default presentation looks like a game rather than an internal stage harness', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'SoccerShooter', exact: true })).toBeVisible();
  await expect(page.locator('.lab-header .eyebrow')).toContainText('PHYSICAL FOOTBALL');
  await expect(page.getByText('Stage 05–07 · owner control overhaul')).not.toBeVisible();
  await expect(page.getByText('Repair focus')).not.toBeVisible();
  await expect(page.locator('.course-card strong')).toContainText('Football principles');

  const hud = page.locator('[data-movement-hud="true"]');
  await expect(hud).toBeHidden();
  await page.keyboard.press('F1');
  await expect(hud).toBeVisible();
});
