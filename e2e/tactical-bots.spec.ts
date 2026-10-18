import { expect, test } from '@playwright/test';

test('Stage 06 Tactical Bot Lab exposes a live 3v3 simulation without debug overlays by default', async ({ page }) => {
  await page.goto('/');

  const tacticalButton = page.getByRole('button', { name: 'Tactical Bot Lab', exact: true });
  await expect(tacticalButton).toBeVisible();
  await tacticalButton.click();

  const lab = page.locator('[data-bot-tactical-lab]');
  const probe = page.locator('[data-bot-state]');
  await expect(lab).toBeVisible();
  await expect(page.locator('[data-football-practice]')).toBeHidden();
  await expect(page.locator('[data-ball-lab]')).toBeHidden();
  await expect(page.locator('[data-bot-participant]')).toHaveCount(6);
  await expect(lab).toHaveAttribute('data-role-overlay', 'false');

  const startTick = Number(await probe.getAttribute('data-tactical-tick'));
  await expect.poll(async () => Number(await probe.getAttribute('data-tactical-tick')), { timeout: 3000 })
    .toBeGreaterThan(startTick + 5);
  await expect.poll(async () => Number(await probe.getAttribute('data-pass-attempts')), { timeout: 5000 })
    .toBeGreaterThan(0);
  await expect(probe).toHaveAttribute('data-permanent-swarm', 'false');
  expect(Number(await probe.getAttribute('data-max-keeper-depth'))).toBeLessThanOrEqual(3.8);
});

test('Stage 06 Tactical Bot Lab turnover control causes immediate phase/possession response', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tactical Bot Lab', exact: true }).click();

  const lab = page.locator('[data-bot-tactical-lab]');
  const probe = page.locator('[data-bot-state]');
  const before = await probe.getAttribute('data-possession-team');
  expect(before).toMatch(/home|away/);

  await lab.getByRole('button', { name: 'Force Turnover', exact: true }).click();
  await expect.poll(async () => await probe.getAttribute('data-possession-team'), { timeout: 1500 })
    .not.toBe(before);
  await expect(probe).toHaveAttribute('data-last-event', /turnover/);
});

test('Stage 06 role overlay is optional and never required to identify movement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tactical Bot Lab', exact: true }).click();
  const lab = page.locator('[data-bot-tactical-lab]');

  await expect(lab).toHaveAttribute('data-role-overlay', 'false');
  await lab.getByRole('button', { name: 'Show Roles', exact: true }).click();
  await expect(lab).toHaveAttribute('data-role-overlay', 'true');
  await expect(page.locator('[data-bot-role-label]:visible')).toHaveCount(6);
  await lab.getByRole('button', { name: 'Hide Roles', exact: true }).click();
  await expect(lab).toHaveAttribute('data-role-overlay', 'false');
});
