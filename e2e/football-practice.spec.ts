import { expect, test, type Page } from '@playwright/test';

async function installPointerLockHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let locked: Element | null = null;
    Object.defineProperty(Document.prototype, 'pointerLockElement', {
      configurable: true,
      get: () => locked,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestPointerLock', {
      configurable: true,
      value: function requestPointerLockMock() {
        locked = this;
        document.dispatchEvent(new Event('pointerlockchange'));
        return Promise.resolve();
      },
    });
    Object.defineProperty(Document.prototype, 'exitPointerLock', {
      configurable: true,
      value: function exitPointerLockMock() {
        locked = null;
        document.dispatchEvent(new Event('pointerlockchange'));
      },
    });
  });
}

async function capturePointerWithoutNativePlaywrightLock(page: Page): Promise<void> {
  const canvas = page.locator('[data-game-viewport]');
  // Production button chords use mouse events because each physical button
  // transition must be observable even while another mouse button is held.
  // Dispatch the initial capture mousedown directly so the deterministic
  // pointer-lock harness exercises the same listener contract.
  await canvas.dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: 320,
    clientY: 220,
  });
}

test('visible football controls expose the ergonomic bindings and no legacy Z/X chords', async ({ page }) => {
  await page.goto('/');
  const controls = page.locator('.control-card');
  await expect(controls).toContainText('RMB+E');
  await expect(controls).toContainText('Ctrl+Q');
  await expect(controls).toContainText('RMB+LMB');
  await expect(controls).toContainText('Ctrl+LMB');
  await expect(controls).not.toContainText('Z+E');
  await expect(controls).not.toContainText('Z+Q');
  await expect(controls).not.toContainText('Z finesse');
  await expect(controls).not.toContainText('X chip');
});

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

test('ordinary multi-second dribbling keeps the free ball inside the recoverable control corridor', async ({ page }) => {
  await page.goto('/');
  const ballProbe = page.locator('[data-football-state]');
  const playerProbe = page.locator('[data-player-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.keyboard.down('w');

  let maximumSeparation = 0;
  let maximumLateralError = 0;
  for (let sample = 0; sample < 9; sample += 1) {
    await page.waitForTimeout(160);
    const playerX = Number(await playerProbe.getAttribute('data-x'));
    const playerZ = Number(await playerProbe.getAttribute('data-z'));
    const ballX = Number(await ballProbe.getAttribute('data-ball-x'));
    const ballZ = Number(await ballProbe.getAttribute('data-ball-z'));
    maximumSeparation = Math.max(maximumSeparation, Math.hypot(ballX - playerX, ballZ - playerZ));
    maximumLateralError = Math.max(maximumLateralError, Math.abs(ballX - playerX));
  }
  await page.keyboard.up('w');

  expect(maximumSeparation).toBeLessThan(1.32);
  expect(maximumLateralError).toBeLessThan(0.7);
  expect(Number(await ballProbe.getAttribute('data-ball-speed'))).toBeGreaterThan(2.5);
});

test('first click captures camera only, then locked LMB charges through the permanent reticle', async ({ page }) => {
  await installPointerLockHarness(page);
  await page.goto('/');
  const probe = page.locator('[data-football-state]');
  const playerProbe = page.locator('[data-player-state]');
  const canvas = page.locator('[data-game-viewport]');
  const capture = page.locator('[data-camera-capture]');
  const reticle = page.locator('[data-center-reticle]');

  await expect(capture).toBeVisible();
  await expect(reticle).toBeHidden();
  expect(Number(await probe.getAttribute('data-shot-charge'))).toBe(0);

  await capturePointerWithoutNativePlaywrightLock(page);
  await expect(playerProbe).toHaveAttribute('data-pointer-locked', 'true');
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

test('RMB+E drives the ground pass and Ctrl+Q chips the through ball', async ({ page }) => {
  await installPointerLockHarness(page);
  await page.goto('/');
  const probe = page.locator('[data-football-state]');
  const canvas = page.locator('[data-game-viewport]');

  await capturePointerWithoutNativePlaywrightLock(page);
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-pointer-locked', 'true');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.mouse.down({ button: 'right' });
  await page.keyboard.press('e');
  await page.mouse.up({ button: 'right' });
  await expect(probe).toHaveAttribute('data-reason', /driven:/);

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.keyboard.down('Control');
  await page.keyboard.press('q');
  await page.keyboard.up('Control');
  await expect(probe).toHaveAttribute('data-reason', /chipped-through:/);
});

test('RMB+LMB finesse and Ctrl+LMB chip latch at shot start through modifier release', async ({ page }) => {
  await installPointerLockHarness(page);
  await page.goto('/');
  const probe = page.locator('[data-football-state]');
  const canvas = page.locator('[data-game-viewport]');
  await capturePointerWithoutNativePlaywrightLock(page);
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-pointer-locked', 'true');

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.mouse.down({ button: 'right' });
  await page.mouse.down({ button: 'left' });
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(50);
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await page.mouse.up({ button: 'left' });

  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.keyboard.down('Control');
  await page.mouse.down({ button: 'left' });
  await expect(probe).toHaveAttribute('data-shot-style', 'chip');
  await page.keyboard.up('Control');
  await page.waitForTimeout(50);
  await expect(probe).toHaveAttribute('data-shot-style', 'chip');
  await page.mouse.up({ button: 'left' });
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
