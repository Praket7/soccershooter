import { expect, test } from '@playwright/test';

const adaptiveButtonName = 'Adaptive Debug';

test('Stage 07 Adaptive Debug exposes cognition scaling with identical physical laws', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: adaptiveButtonName, exact: true }).click();

  const lab = page.locator('[data-adaptive-bot-lab]');
  const probe = page.locator('[data-adaptive-state]');
  await expect(lab).toBeVisible();
  await expect(lab.getByRole('heading', { name: adaptiveButtonName })).toBeVisible();
  await expect(lab).toContainText('Adaptive Bot Playtest to play a keyboard-controlled player');
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

test('Stage 07 physical playtest lets the player steer a participant against tiered bots', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Adaptive Bot Playtest', exact: true }).click();
  const lab = page.locator('[data-physical-bot-scrimmage]');
  const probe = lab.locator('[data-physical-state]');
  await expect(lab).toBeVisible();
  await expect(lab.getByText('W upfield · S downfield · A left · D right · Shift sprint · E pass · Space shoot · C challenge', { exact: true })).toBeVisible();
  await expect(probe).toHaveAttribute('data-user-player', 'h-1');
  await expect(page.locator('.lab-footer')).toContainText('Adaptive Bot Playtest: WASD move · Shift sprint · E pass · Space shoot · C challenge');
  await lab.getByRole('button', { name: 'Reset seeded scrimmage', exact: true }).click();

  const playerX = Number(await probe.getAttribute('data-user-x'));
  await lab.locator('[data-physical-stage]').click();
  await page.keyboard.down('d');
  await expect.poll(async () => Number(await probe.getAttribute('data-user-x')), { timeout: 2500 })
    .toBeLessThan(playerX - 0.1);
  await page.keyboard.up('d');
  const playerZ = Number(await probe.getAttribute('data-user-z'));
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await probe.getAttribute('data-user-z')), { timeout: 2500 })
    .toBeGreaterThan(playerZ + 0.1);
  await page.keyboard.up('w');
  const upfieldZ = Number(await probe.getAttribute('data-user-z'));
  const rightX = Number(await probe.getAttribute('data-user-x'));
  await page.keyboard.down('a');
  await expect.poll(async () => Number(await probe.getAttribute('data-user-x')), { timeout: 2500 })
    .toBeGreaterThan(rightX + 0.1);
  await page.keyboard.up('a');
  await page.keyboard.down('s');
  await expect.poll(async () => Number(await probe.getAttribute('data-user-z')), { timeout: 2500 })
    .toBeLessThan(upfieldZ - 0.1);
  await page.keyboard.up('s');
  await lab.getByRole('button', { name: 'Reset seeded scrimmage', exact: true }).click();
  await lab.locator('[data-physical-stage]').click();
  const actionInputCount = Number(await probe.getAttribute('data-human-input-count'));
  await page.keyboard.press('Space');
  await expect.poll(async () => Number(await probe.getAttribute('data-human-input-count')), { timeout: 2500 })
    .toBeGreaterThan(actionInputCount);
  await expect(probe).toHaveAttribute('data-user-player', 'h-1');
  await expect(probe).toHaveAttribute('data-last-human-action', 'shoot');
  await expect.poll(() => probe.getAttribute('data-last-human-contact'), { timeout: 2500 }).toBe('shot');
  await lab.getByRole('button', { name: 'Reset seeded scrimmage', exact: true }).click();
  await lab.locator('[data-physical-stage]').click();
  await page.keyboard.press('e');
  await expect.poll(() => probe.getAttribute('data-last-human-contact'), { timeout: 2500 }).toBe('pass');
  await expect(probe).toHaveAttribute('data-tier', 'standard');
  await expect(lab.locator('[data-physical-proof]')).toContainText('Physical invariant PASS');
});

test('Stage 07 spectator mode runs two autonomous teams with independently selected tiers and styles', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Adaptive Bot Playtest', exact: true }).click();
  const lab = page.locator('[data-physical-bot-scrimmage]');
  const probe = lab.locator('[data-physical-state]');
  await lab.getByRole('button', { name: 'Watch bot match', exact: true }).click();
  await lab.locator('select[data-home-tier]').selectOption('elite');
  await lab.locator('select[data-away-tier]').selectOption('novice');
  await lab.locator('select[data-home-playstyle]').selectOption('possession');
  await lab.locator('select[data-away-playstyle]').selectOption('direct');

  const initialTick = Number(await probe.getAttribute('data-tick'));
  await expect(probe).toHaveAttribute('data-spectator-mode', 'true');
  await expect(probe).toHaveAttribute('data-user-player', '');
  await expect(probe).toHaveAttribute('data-human-input-count', '0');
  await expect(probe).toHaveAttribute('data-home-tier', 'elite');
  await expect(probe).toHaveAttribute('data-away-tier', 'novice');
  await expect.poll(async () => Number(await probe.getAttribute('data-tick')), { timeout: 2500 }).toBeGreaterThan(initialTick + 5);
  await expect(lab.getByRole('button', { name: 'Take control', exact: true })).toBeVisible();
});
