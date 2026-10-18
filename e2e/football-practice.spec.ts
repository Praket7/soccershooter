import { expect, test } from '@playwright/test';

test('Stage 05 practice starts physical, idle, non-magnetic, and visually grounded', async ({ page }) => {
  await page.goto('/');

  const practice = page.locator('[data-football-practice]');
  const probe = page.locator('[data-football-state]');
  const playerProbe = page.locator('[data-player-state]');
  await expect(practice).toBeVisible();
  await expect(page.getByRole('button', { name: 'Football Practice', exact: true })).toHaveAttribute('data-active', 'true');
  await expect(page.locator('[data-ball-lab]')).toBeHidden();

  const before = {
    x: Number(await probe.getAttribute('data-ball-x')),
    z: Number(await probe.getAttribute('data-ball-z')),
    speed: Number(await probe.getAttribute('data-ball-speed')),
  };
  await page.waitForTimeout(350);
  const after = {
    x: Number(await probe.getAttribute('data-ball-x')),
    z: Number(await probe.getAttribute('data-ball-z')),
    speed: Number(await probe.getAttribute('data-ball-speed')),
  };

  expect(after.x).toBeCloseTo(before.x, 5);
  expect(after.z).toBeCloseTo(before.z, 5);
  expect(after.speed).toBeLessThan(0.05);
  const playerY = Number(await playerProbe.getAttribute('data-y'));
  const visualFootY = Number(await playerProbe.getAttribute('data-visual-foot-y'));
  expect(visualFootY).toBeCloseTo(playerY, 5);
});

test('first click captures camera only, then locked LMB charges through the permanent reticle', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');
  const playerProbe = page.locator('[data-player-state]');
  const canvas = page.locator('[data-game-viewport]');
  const capture = page.locator('[data-camera-capture]');
  const reticle = page.locator('[data-center-reticle]');

  await expect(capture).toBeVisible();
  await expect(reticle).toBeHidden();
  expect(Number(await probe.getAttribute('data-shot-charge'))).toBe(0);

  await canvas.click({ position: { x: 320, y: 220 } });
  await expect.poll(async () => await playerProbe.getAttribute('data-pointer-locked'), { timeout: 2000 }).toBe('true');
  await expect(capture).toBeHidden();
  await expect(reticle).toBeVisible();
  expect(Number(await probe.getAttribute('data-shot-charge'))).toBe(0);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down({ button: 'left' });
  await expect.poll(async () => Number(await probe.getAttribute('data-shot-charge')), { timeout: 2000 }).toBeGreaterThan(0.03);
  await expect(probe).toHaveAttribute('data-shot-state', 'POWER');
  await expect(probe).toHaveAttribute('data-aim-guide-visible', 'true');
  await page.mouse.up({ button: 'left' });
});

test('F is an explicit buffered receive and no longer depends on RMB plus zero movement', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.keyboard.press('f');
  await expect.poll(async () => await probe.getAttribute('data-action'), { timeout: 1800 })
    .toMatch(/CUSHION TOUCH|TRAP ARMED/);
  const receiveState = await probe.getAttribute('data-receive-state');
  expect(receiveState).toMatch(/armed|consumed/);
});

test('dedicated E pass contact moves the free ball and exposes lane intent without teleporting it', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(100);
  await expect(probe).toHaveAttribute('data-pass-guide-visible', 'true');
  const beforeZ = Number(await probe.getAttribute('data-ball-z'));
  await page.keyboard.press('e');

  await expect.poll(async () => Math.abs(Number(await probe.getAttribute('data-ball-z')) - beforeZ), { timeout: 2500 })
    .toBeGreaterThan(1.5);
  await expect(probe).toHaveAttribute('data-reason', /ground:/);
  expect(Number(await probe.getAttribute('data-ball-speed'))).toBeGreaterThan(2);
});

test('Z modifies a normal shot into finesse without a six-key shot-mode vocabulary', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');
  const canvas = page.locator('[data-game-viewport]');
  await canvas.click({ position: { x: 320, y: 220 } });
  await expect.poll(async () => await page.locator('[data-player-state]').getAttribute('data-pointer-locked'), { timeout: 2000 }).toBe('true');

  await page.keyboard.down('z');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down({ button: 'left' });
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await page.mouse.up({ button: 'left' });
  await page.keyboard.up('z');
});

test('practice ball visual rotation advances from physics steps, never idle render frames', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(100);
  const idleQuaternion = await probe.getAttribute('data-ball-visual-quaternion');
  expect(idleQuaternion).toMatch(/^-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+$/);
  await page.waitForTimeout(300);
  expect(await probe.getAttribute('data-ball-visual-quaternion')).toBe(idleQuaternion);

  await page.keyboard.press('e');
  await expect.poll(async () => await probe.getAttribute('data-ball-visual-quaternion'), { timeout: 2500 }).not.toBe(idleQuaternion);
});

test('committed challenge still creates an explicit recovery cost', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(60);
  await page.keyboard.down('Shift');
  await page.keyboard.press('c');
  await page.keyboard.up('Shift');

  await expect(probe).toHaveAttribute('data-action', /COMMITTED TACKLE/);
  expect(Number(await probe.getAttribute('data-recovery'))).toBeGreaterThan(0);
});

test('Stage 04 Ball Lab remains a separate instrument', async ({ page }) => {
  await page.goto('/');
  const practice = page.locator('[data-football-practice]');
  const lab = page.locator('[data-ball-lab]');

  await page.getByRole('button', { name: 'Ball Lab', exact: true }).click();
  await expect(practice).toBeHidden();
  await expect(lab).toBeVisible();
  await expect(lab).toHaveAttribute('data-preset', 'straight');

  await page.getByRole('button', { name: 'Football Practice', exact: true }).click();
  await expect(practice).toBeVisible();
  await expect(lab).toBeHidden();
});
