import { expect, test } from '@playwright/test';

test('Road to Legend exposes all campaign acts, local baseline profile, and save tools', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Road to Legend' }).click();
  const screen = page.locator('[data-road-to-legend]');
  await expect(screen).toBeVisible();
  await expect(screen).toContainText('OVR 67');
  await expect(screen.locator('li[data-act]')).toHaveCount(7);
  await expect(screen.locator('[data-public-teams] article')).toHaveCount(4);
  await expect.poll(() => screen.locator('[data-public-teams] img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(screen.locator('[data-act="street-beginner"]')).toHaveAttribute('data-active', 'true');
  await expect(screen.locator('[data-current-encounter]')).toContainText('street-01');
  await expect(page.getByRole('button', { name: 'Start current challenge' })).toBeVisible();
  await expect(screen.locator('[data-build-paths] [data-archetype]')).toHaveCount(3);
  await screen.locator('[data-archetype="pace"]').click();
  await expect(screen.locator('[data-archetype="pace"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(screen.locator('[data-build-modifiers]')).toContainText('sprint stamina ×0.82');
  await expect(screen.locator('[data-equipped-slots]')).toContainText('body-feint');
  await expect(page.locator('[data-career-export]')).toBeVisible();
  await expect(page.locator('[data-career-import]')).toBeVisible();
  await page.getByRole('button', { name: 'Open practice' }).click();
  const practice = page.locator('[data-football-practice]');
  await expect(practice).toBeVisible();
  await expect(practice).toHaveAttribute('data-archetype-contact-timing-ticks', '0');
  await expect(practice).toHaveAttribute('data-archetype-sprint-stamina-cost-scale', '0.82');
  await page.getByRole('button', { name: 'Road to Legend' }).click();
  await screen.locator('[data-archetype="power"]').click();
  await page.getByRole('button', { name: 'Open practice' }).click();
  await expect(practice).toHaveAttribute('data-archetype-contact-timing-ticks', '-1');
  await expect(practice).toHaveAttribute('data-archetype-strike-impulse-scale', '1.08');
});

test('Road to Legend starts a physical-goal campaign challenge and saves an abandoned result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Road to Legend' }).click();
  const screen = page.locator('[data-road-to-legend]');
  const challenge = page.locator('[data-campaign-objective]');
  await page.getByRole('button', { name: 'Start current challenge' }).click();
  await expect(page.locator('[data-football-practice]')).toBeVisible();
  await expect(challenge).toBeVisible();
  await expect(challenge).toContainText('basic space');
  await expect(page.locator('[data-football-practice]')).toHaveAttribute('data-campaign-encounter', 'street-01');

  await page.getByRole('button', { name: 'Road to Legend' }).click();
  await expect(page.getByRole('button', { name: 'Abandon current challenge' })).toBeVisible();
  await page.getByRole('button', { name: 'Abandon current challenge' }).click();
  await expect(screen).toContainText('1 losses');
  await expect(page.getByRole('button', { name: 'Start current challenge' })).toBeVisible();
});
