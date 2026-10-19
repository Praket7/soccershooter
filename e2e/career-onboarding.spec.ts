import { expect, test } from '@playwright/test';

test('a new player can understand Road to Legend without developer explanation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Road to Legend' }).click();

  const screen = page.locator('[data-road-to-legend]');
  const quickstart = screen.locator('[data-career-quickstart]');
  await expect(quickstart).toBeVisible();
  await expect(quickstart).toContainText('Choose your play style');
  await expect(quickstart).toContainText('Start the current challenge');
  await expect(quickstart).toContainText('Score one physical goal');

  const technical = screen.locator('[data-archetype="technical"]');
  const pace = screen.locator('[data-archetype="pace"]');
  const power = screen.locator('[data-archetype="power"]');
  await expect(technical).toContainText('Technical');
  await expect(technical).toContainText('forgiving touch timing');
  await expect(pace).toContainText('Pace');
  await expect(pace).toContainText('efficient sprinting');
  await expect(power).toContainText('Power');
  await expect(power).toContainText('stronger strikes');

  const brief = screen.locator('[data-challenge-brief]');
  await expect(brief).toContainText('Find space');
  await expect(brief).toContainText('move the defender before you release the ball');
  await expect(screen.locator('[data-current-encounter]')).toContainText('What to try');
});

test('later tactical problems explain the football idea rather than only exposing an internal label', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('soccershooter.profile.v2') ?? '{}');
    profile.campaignActId = 'academy';
    profile.campaignEncounterIndex = 0;
    profile.campaignComplete = false;
    localStorage.setItem('soccershooter.profile.v2', JSON.stringify(profile));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Road to Legend' }).click();

  const brief = page.locator('[data-challenge-brief]');
  await expect(brief).toContainText('Beat the press');
  await expect(brief).toContainText('play before pressure arrives');
});
