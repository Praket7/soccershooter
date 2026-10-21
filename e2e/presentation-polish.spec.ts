import { expect, test } from '@playwright/test';

test('default presentation looks like a game rather than an internal stage harness', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'SoccerShooter', exact: true })).toBeVisible();
  await expect(page.locator('.lab-header .eyebrow')).toContainText('PHYSICAL FOOTBALL');
  await expect(page.getByText('Stage 05–07 · owner control overhaul')).not.toBeVisible();
  await expect(page.getByText('Stage 05R sprint + turn slice')).not.toBeVisible();
  await expect(page.getByText('Repair focus')).not.toBeVisible();
  await expect(page.locator('.course-card')).toHaveCount(0);
  const sessionStatus = page.locator('[data-action-debug]');
  await expect(sessionStatus).toContainText('Session status');
  await expect(sessionStatus).not.toContainText('LEGAL');
  await expect(page.locator('[data-football-practice]')).toContainText('Carry at pace with WASD');
  await expect(page.locator('[data-football-practice]')).not.toContainText('independent physical ball');

  const hud = page.locator('[data-movement-hud="true"]');
  await expect(hud).toBeHidden();
  const controls = page.locator('.control-card');
  await expect(controls.locator('summary')).toContainText('Controls');
  await expect(controls).not.toHaveAttribute('open', '');
  await expect(controls.getByText('WASD / left stick · move and carry direction')).not.toBeVisible();
  await controls.locator('summary').click();
  await expect(controls.getByText('WASD / left stick · move and carry direction')).toBeVisible();
  await page.keyboard.press('F1');
  await expect(hud).toBeVisible();
});
