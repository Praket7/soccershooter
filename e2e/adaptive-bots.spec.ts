import { expect, test } from '@playwright/test';

const adaptiveButtonName = 'Adaptive Debug';

test('Stage 07 Adaptive Debug exposes cognition scaling with identical physical laws', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: adaptiveButtonName, exact: true }).click();

  const lab = page.locator('[data-adaptive-bot-lab]');
  const probe = page.locator('[data-adaptive-state]');
  await expect(lab).toBeVisible();
  await expect(lab.getByRole('heading', { name: adaptiveButtonName })).toBeVisible();
  await expect(lab).toContainText('Physical 3v3 is now the owner acceptance surface');
  await expect(page.locator('[data-tier-card]')).toHaveCount(3);
  await expect(probe).toHaveAttribute('data-physical-invariant', 'true');
  await expect(probe).toHaveAttribute('data-learned-enabled', 'false');

  const novice = page.locator('[data-tier-card="novice"]');
  const standard = page.locator('[data-tier-card="standard"]');
  const elite = page.locator('[data-tier-card="elite"]');
  await expect(novice).toContainText('220 ms');
  await expect(standard).toContainText('110 ms');
  await expect(elite).toContainText('50 ms');

  const initialTick = Number(await probe.getAttribute('data-sim-tick'));
  await expect.poll(async () => Number(await probe.getAttribute('data-sim-tick')), { timeout: 2500 }).toBeGreaterThan(initialTick + 2);
});

test('Stage 07 adaptation changes only at legal PvE boundaries and is locked in PvP', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: adaptiveButtonName, exact: true }).click();
  const lab = page.locator('[data-adaptive-bot-lab]');
  const probe = page.locator('[data-adaptive-state]');

  await lab.getByRole('button', { name: 'Add elite-like samples', exact: true }).click();
  expect(Number(await probe.getAttribute('data-model-confidence'))).toBeGreaterThan(0.55);

  const beforeLive = await probe.getAttribute('data-current-tier');
  await lab.getByRole('button', { name: 'Try mid-possession change', exact: true }).click();
  await expect(probe).toHaveAttribute('data-current-tier', beforeLive ?? 'standard');

  await lab.getByRole('button', { name: 'Apply restart boundary', exact: true }).click();
  await expect(probe).toHaveAttribute('data-current-tier', 'elite');

  await lab.getByRole('button', { name: 'Mode: PvE', exact: true }).click();
  await expect(probe).toHaveAttribute('data-mode', 'pvp');
  await lab.getByRole('button', { name: 'Add novice-like samples', exact: true }).click();
  await lab.getByRole('button', { name: 'Apply restart boundary', exact: true }).click();
  await expect(probe).toHaveAttribute('data-current-tier', 'elite');
});

test('Stage 07 personality selector changes the real carrier decision surface', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: adaptiveButtonName, exact: true }).click();
  const lab = page.locator('[data-adaptive-bot-lab]');
  const select = lab.locator('select[data-personality]');
  const decision = lab.locator('[data-tier-decision="standard"]');

  await select.selectOption('playmaker');
  const playmaker = await decision.textContent();
  await select.selectOption('poacher');
  const poacher = await decision.textContent();
  expect(poacher).not.toBe(playmaker);
});
