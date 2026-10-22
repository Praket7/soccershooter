import { expect, test } from '@playwright/test';

test('Physical 3v3 runs six bots around one independently simulated ball', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Adaptive Bot Playtest', exact: true }).click();
  await page.locator('[data-physical-bot-scrimmage]').getByRole('button', { name: 'Watch bot match', exact: true }).click();

  const lab = page.locator('[data-physical-bot-scrimmage]');
  const probe = page.locator('[data-physical-state]');
  await expect(lab).toBeVisible();
  await expect(page.locator('canvas[data-physical-scrimmage-canvas="true"]')).toBeVisible();
  await expect(probe).toHaveAttribute('data-physical-invariant', 'true');

  const startTick = Number(await probe.getAttribute('data-tick'));
  await expect.poll(async () => Number(await probe.getAttribute('data-tick')), { timeout: 3000 })
    .toBeGreaterThan(startTick + 20);
  await expect.poll(async () => Number(await probe.getAttribute('data-contact-count')), { timeout: 4000 })
    .toBeGreaterThan(0);
  expect(await probe.getAttribute('data-checksum')).toMatch(/^[0-9a-f]{8}$/);
});

test('Physical 3v3 naturally produces loose-ball windows and contact-driven control changes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Adaptive Bot Playtest', exact: true }).click();
  await page.locator('[data-physical-bot-scrimmage]').getByRole('button', { name: 'Watch bot match', exact: true }).click();
  const probe = page.locator('[data-physical-state]');

  await expect.poll(async () => Number(await probe.getAttribute('data-loose-ball-ticks')), { timeout: 8000 })
    .toBeGreaterThan(0);
  await expect.poll(async () => Number(await probe.getAttribute('data-possession-changes')), { timeout: 8000 })
    .toBeGreaterThan(0);
  await expect(probe).toHaveAttribute('data-physical-invariant', 'true');
});

test('difficulty and personality alter cognition controls while physical constants stay invariant', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Adaptive Bot Playtest', exact: true }).click();
  const probe = page.locator('[data-physical-state]');

  await page.locator('[data-physical-tier]').selectOption('elite');
  await expect(probe).toHaveAttribute('data-tier', 'elite');
  await page.locator('[data-physical-personality]').selectOption('playmaker');
  await expect(probe).toHaveAttribute('data-personality', 'playmaker');
  await expect(probe).toHaveAttribute('data-physical-invariant', 'true');
});
