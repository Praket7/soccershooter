import { expect, test } from '@playwright/test';

async function installPointerLockHarness(page: import('@playwright/test').Page): Promise<void> {
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

async function capturePointer(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-game-viewport]').dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: 320,
    clientY: 220,
  });
}

test('player can keep running while charging and completing a shot', async ({ page }) => {
  await installPointerLockHarness(page);
  await page.goto('/');
  await capturePointer(page);
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-pointer-locked', 'true');

  const football = page.locator('[data-football-state]');
  const player = page.locator('[data-player-state]');
  const viewport = page.locator('[data-game-viewport]');
  await page.keyboard.press('g');
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await player.getAttribute('data-speed')), { timeout: 2200 }).toBeGreaterThan(3.2);

  await page.evaluate(() => {
    const output = document.querySelector<HTMLOutputElement>('[data-football-state]');
    const playerOutput = document.querySelector<HTMLOutputElement>('[data-player-state]');
    if (!output || !playerOutput) throw new Error('missing football practice probe');
    const trace: string[] = [];
    const capture = () => {
      const entry = JSON.stringify({
        tick: output.dataset.contactTick ?? '',
        action: output.dataset.action ?? '',
        reason: output.dataset.reason ?? '',
        shotState: output.dataset.shotState ?? '',
        charge: output.dataset.shotCharge ?? '',
        ballX: output.dataset.ballX ?? '',
        ballZ: output.dataset.ballZ ?? '',
        playerX: playerOutput.dataset.x ?? '',
        playerZ: playerOutput.dataset.z ?? '',
        speed: playerOutput.dataset.speed ?? '',
      });
      if (trace[trace.length - 1] !== entry) trace.push(entry);
      if (output.dataset.reason?.startsWith('shot:')) output.dataset.runningShotContactSeen = 'true';
    };
    capture();
    const observer = new MutationObserver(capture);
    observer.observe(output, { attributes: true });
    (window as Window & { __runningShotTrace?: string[] }).__runningShotTrace = trace;
  });

  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);

  const beforeContact = Number(await football.getAttribute('data-last-contact-event-tick'));
  await page.mouse.down({ button: 'left' });
  await expect.poll(async () => Number(await football.getAttribute('data-shot-charge')), { timeout: 1000 }).toBeGreaterThan(0.03);
  await page.waitForTimeout(150);
  await page.mouse.up({ button: 'left' });

  await page.waitForTimeout(500);
  const trace = await page.evaluate(() => (window as Window & { __runningShotTrace?: string[] }).__runningShotTrace ?? []);
  expect(await football.getAttribute('data-running-shot-contact-seen'), trace.join('\n')).toBe('true');
  await expect.poll(async () => Number(await football.getAttribute('data-last-contact-event-tick')), { timeout: 1800 })
    .toBeGreaterThan(beforeContact);
  expect(Number(await player.getAttribute('data-speed'))).toBeGreaterThan(2.5);
  await page.keyboard.up('w');
});

test('sustained lateral carry keeps the free ball compact while the athlete turns into travel', async ({ page }) => {
  await page.goto('/');
  const football = page.locator('[data-football-state]');
  const player = page.locator('[data-player-state]');
  await page.keyboard.press('g');
  await page.keyboard.down('a');
  await page.waitForTimeout(650);
  await page.keyboard.up('a');

  const state = await page.evaluate(() => {
    const p = document.querySelector<HTMLOutputElement>('[data-player-state]')!;
    const b = document.querySelector<HTMLOutputElement>('[data-football-state]')!;
    return {
      px: Number(p.dataset.x),
      pz: Number(p.dataset.z),
      yaw: Number(p.dataset.facingYaw),
      bx: Number(b.dataset.ballX),
      bz: Number(b.dataset.ballZ),
      action: b.dataset.action ?? '',
    };
  });

  expect(Math.abs(state.px)).toBeGreaterThan(0.9);
  expect(Math.hypot(state.bx - state.px, state.bz - state.pz)).toBeLessThan(1.0);
  expect(Math.abs(state.yaw)).toBeGreaterThan(1.0);
  expect(state.action).not.toMatch(/FAILED|MISSED/);
  await expect(football).toHaveAttribute('data-dribble-controller', 'planned-contact');
  await expect(player).toHaveAttribute('data-sprinting', 'false');
});
