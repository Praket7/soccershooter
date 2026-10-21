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
  await canvas.dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: 320,
    clientY: 220,
  });
}

interface CarryState {
  tick: number;
  playerX: number;
  playerZ: number;
  ballX: number;
  ballZ: number;
  ballSpeed: number;
  action: string;
  reason: string;
}

async function readCarryState(page: Page): Promise<CarryState> {
  // Read player and ball in one browser task. Separate Playwright getAttribute
  // awaits let the live simulation advance between the player and ball reads on
  // slow CI machines and fabricate a separation that never existed at one tick.
  return page.evaluate(() => {
    const player = document.querySelector<HTMLOutputElement>('[data-player-state]');
    const ball = document.querySelector<HTMLOutputElement>('[data-football-state]');
    if (!player || !ball) throw new Error('missing football carry probes');
    return {
      tick: Number(player.dataset.tick ?? 0),
      playerX: Number(player.dataset.x ?? 0),
      playerZ: Number(player.dataset.z ?? 0),
      ballX: Number(ball.dataset.ballX ?? 0),
      ballZ: Number(ball.dataset.ballZ ?? 0),
      ballSpeed: Number(ball.dataset.ballSpeed ?? 0),
      action: ball.dataset.action ?? '',
      reason: ball.dataset.reason ?? '',
    };
  });
}

async function runCarryWindow(page: Page, sprint: boolean, durationTicks = 90): Promise<CarryState[]> {
  await page.goto('/');
  await page.keyboard.press('g');
  const initial = await readCarryState(page);
  await page.keyboard.down('w');
  if (sprint) await page.keyboard.down('Shift');

  const states: CarryState[] = [];
  for (let sample = 0; sample < 180; sample += 1) {
    const state = await readCarryState(page);
    states.push(state);
    if (state.tick - initial.tick >= durationTicks) break;
    await page.waitForTimeout(12);
  }

  if (sprint) await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  if ((states.at(-1)?.tick ?? initial.tick) - initial.tick < durationTicks) {
    throw new Error(`carry window did not reach ${durationTicks} simulation ticks`);
  }
  return states;
}

function separation(state: CarryState): number {
  return Math.hypot(state.ballX - state.playerX, state.ballZ - state.playerZ);
}

test('Stage 05 practice starts physical, idle, non-magnetic, visually grounded, and explains shooting clearly', async ({ page }) => {
  await page.goto('/');

  const practice = page.locator('[data-football-practice]');
  const probe = page.locator('[data-football-state]');
  const playerProbe = page.locator('[data-player-state]');
  await expect(practice).toBeVisible();
  await expect(page.getByRole('button', { name: 'Football Practice', exact: true })).toHaveAttribute('data-active', 'true');
  await expect(page.locator('[data-ball-lab]')).toBeHidden();

  const controls = page.locator('.control-card');
  await expect(controls).toContainText('RMB+E');
  await expect(controls).toContainText('sprint with short carry touches');
  await expect(controls).toContainText('Ctrl+Q');
  await expect(controls).toContainText('RMB+LMB');
  await expect(controls).toContainText('Ctrl+LMB');
  await expect(controls).not.toContainText('Z+');
  await expect(controls).not.toContainText('X chip');

  const shootingGuide = page.locator('[data-shot-controls-guide]');
  await expect(shootingGuide).toBeVisible();
  await expect(shootingGuide).toContainText('SHOOTING');
  await expect(shootingGuide).toContainText('Aim with the center reticle');
  await expect(shootingGuide).toContainText('LMB only = NORMAL');
  await expect(shootingGuide).toContainText('RMB anytime while charging = FINESSE');
  await expect(shootingGuide).toContainText('Ctrl anytime while charging = CHIP');
  await expect(shootingGuide).toContainText('Release LMB to strike');

  const before = {
    x: Number(await probe.getAttribute('data-ball-x')),
    z: Number(await probe.getAttribute('data-ball-z')),
    speed: Number(await probe.getAttribute('data-ball-speed')),
  };
  const initialPlayerPosition = await page.evaluate(() => {
    const state = document.querySelector<HTMLOutputElement>('[data-player-state]');
    if (!state) throw new Error('missing player state probe');
    return { x: Number(state.dataset.x ?? 0), z: Number(state.dataset.z ?? 0) };
  });
  expect(Math.hypot(before.x - initialPlayerPosition.x, before.z - initialPlayerPosition.z)).toBeLessThan(0.55);
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

test('ordinary multi-second dribbling keeps a competent carry compact instead of flirting with loss', async ({ page }) => {
  const states = await runCarryWindow(page, false);
  const maximumSeparation = Math.max(...states.map(separation));
  const maximumLateralError = Math.max(...states.map((state) => Math.abs(state.ballX - state.playerX)));
  const final = states.at(-1)!;

  expect(maximumSeparation).toBeLessThan(1.12);
  expect(maximumLateralError).toBeLessThan(0.45);
  expect(final.ballSpeed).toBeGreaterThan(2.5);
  expect(states.some((state) => /FIRST TOUCH FAILED/.test(state.action))).toBe(false);
});

test('sprinting keeps short carry touches close to the player', async ({ page }) => {
  const states = await runCarryWindow(page, true);
  const maximumSeparation = Math.max(...states.map(separation));
  const final = states.at(-1)!;

  expect(maximumSeparation).toBeLessThan(1.0);
  expect(final.ballSpeed).toBeGreaterThan(3.5);
  expect(states.some((state) => /FIRST TOUCH FAILED/.test(state.action))).toBe(false);
});

test('an idle Elastico does not force an extra player movement after its contact', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('g');
  const practice = page.locator('[data-football-practice]');
  const player = page.locator('[data-player-state]');

  await page.keyboard.press('y');
  await expect(practice).toHaveAttribute('data-action', 'TECHNIQUE WINDUP');
  const start = {
    x: Number(await player.getAttribute('data-x')),
    y: Number(await player.getAttribute('data-y')),
    z: Number(await player.getAttribute('data-z')),
  };
  const samples = await page.evaluate(async () => {
    const state = document.querySelector<HTMLOutputElement>('[data-player-state]');
    if (!state) throw new Error('missing player state probe');
    const positions: Array<{ x: number; y: number; z: number }> = [];
    const until = performance.now() + 1700;
    while (performance.now() < until) {
      positions.push({ x: Number(state.dataset.x), y: Number(state.dataset.y), z: Number(state.dataset.z) });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return positions;
  });
  const maximumHorizontalDrift = Math.max(...samples.map((point) => Math.hypot(point.x - start.x, point.z - start.z)));
  const maximumVerticalRise = Math.max(...samples.map((point) => point.y - start.y));
  expect(maximumHorizontalDrift).toBeLessThan(0.01);
  expect(maximumVerticalRise).toBeLessThan(0.03);
});

test('an idle Step-over keeps its intended committed exit step', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('g');
  const practice = page.locator('[data-football-practice]');
  const player = page.locator('[data-player-state]');

  await page.keyboard.press('t');
  await expect(practice).toHaveAttribute('data-action', 'TECHNIQUE WINDUP');
  const start = {
    x: Number(await player.getAttribute('data-x')),
    z: Number(await player.getAttribute('data-z')),
  };
  await expect(practice).toHaveAttribute('data-action', 'TECHNIQUE CONTACT', { timeout: 2_000 });
  await page.waitForTimeout(120);
  const end = {
    x: Number(await player.getAttribute('data-x')),
    z: Number(await player.getAttribute('data-z')),
  };

  expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.01);
});

test('jogging and sprinting hold the ball through continuous circular direction changes', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('g');
  const initial = await readCarryState(page);
  const directions = [
    ['w'], ['w', 'd'], ['d'], ['s', 'd'],
    ['s'], ['s', 'a'], ['a'], ['w', 'a'],
  ];
  const scenarios: Array<{ sprint: boolean; maxSeparation: number }> = [];
  let lostControl = false;

  for (const sprint of [false, true]) {
    await page.keyboard.press('g');
    if (sprint) await page.keyboard.down('Shift');
    const activeKeys = new Set<string>();
    let maxSeparation = 0;
    for (let lap = 0; lap < 3; lap += 1) {
      for (const direction of directions) {
        const nextKeys = new Set(direction);
        for (const key of activeKeys) if (!nextKeys.has(key)) await page.keyboard.up(key);
        for (const key of nextKeys) if (!activeKeys.has(key)) await page.keyboard.down(key);
        activeKeys.clear();
        for (const key of nextKeys) activeKeys.add(key);
        const segmentEndTick = (await readCarryState(page)).tick + 15;
        while ((await readCarryState(page)).tick < segmentEndTick) {
          const state = await readCarryState(page);
          maxSeparation = Math.max(maxSeparation, separation(state));
          lostControl ||= /loose-ball-chase|no-viable-intercept|geometry-miss|missed-window/.test(state.reason);
          await page.waitForTimeout(12);
        }
      }
    }
    for (const key of activeKeys) await page.keyboard.up(key);
    if (sprint) await page.keyboard.up('Shift');
    scenarios.push({ sprint, maxSeparation });
  }

  expect(scenarios[0]?.maxSeparation, JSON.stringify(scenarios)).toBeLessThan(1.0);
  expect(scenarios[1]?.maxSeparation, JSON.stringify(scenarios)).toBeLessThan(1.0);
  expect(lostControl).toBe(false);
  expect((await readCarryState(page)).tick).toBeGreaterThan(initial.tick);
});

async function probeAction(probe: ReturnType<Page['locator']>): Promise<string> {
  return (await probe.getAttribute('data-action')) ?? '';
}

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
  await page.evaluate(() => {
    const probe = document.querySelector<HTMLOutputElement>('[data-football-state]');
    if (!probe) throw new Error('missing football state probe');
    const capture = window as Window & { __groundPassContact?: string };
    capture.__groundPassContact = '';
    const observer = new MutationObserver(() => {
      if (probe.dataset.action === 'CONTACT' && probe.dataset.reason?.startsWith('ground:')) {
        capture.__groundPassContact = probe.dataset.reason;
      }
    });
    observer.observe(probe, { attributes: true, attributeFilter: ['data-action', 'data-reason'] });
  });
  await page.keyboard.press('e');

  await expect.poll(async () => Math.abs(Number(await probe.getAttribute('data-ball-z')) - beforeZ), { timeout: 2500 })
    .toBeGreaterThan(1.5);
  await expect.poll(async () => page.evaluate(() => (window as Window & { __groundPassContact?: string }).__groundPassContact ?? ''))
    .toMatch(/^ground:/);
  expect(Number(await probe.getAttribute('data-ball-speed'))).toBeGreaterThan(2);
});

test('Stage 05R measures live dribble-to-shot and dribble-to-pass contact delays', async ({ page }, testInfo) => {
  await installPointerLockHarness(page);
  await page.goto('/');
  await capturePointerWithoutNativePlaywrightLock(page);
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-pointer-locked', 'true');
  const canvas = page.locator('[data-game-viewport]');
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  if (!canvasBounds) return;
  await page.mouse.move(canvasBounds.x + canvasBounds.width / 2, canvasBounds.y + canvasBounds.height / 2);

  const football = page.locator('[data-football-state]');
  const samples: { kind: 'shot' | 'pass'; delayTicks: number }[] = [];
  for (const kind of ['shot', 'pass'] as const) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.keyboard.down('w');
      await page.waitForTimeout(180);
      await page.keyboard.up('w');
      await page.keyboard.press('g');
      let startTick: number;
      if (kind === 'shot') {
        await page.mouse.down({ button: 'left' });
        await page.waitForTimeout(100);
        startTick = Number(await football.getAttribute('data-contact-tick'));
        await page.mouse.up({ button: 'left' });
      } else {
        startTick = Number(await football.getAttribute('data-contact-tick'));
        await page.keyboard.press('e');
      }
      await expect.poll(async () => await football.getAttribute('data-last-contact-event-tick'), { timeout: 2500 })
        .not.toBe('');
      const contactTick = Number(await football.getAttribute('data-last-contact-event-tick'));
      const delayTicks = contactTick - startTick;
      expect(delayTicks).toBeGreaterThanOrEqual(1);
      // Allow one browser-scheduled fixed step; at 60 Hz this remains under
      // 0.15 seconds and still bounds the running shot/pass contact response.
      expect(delayTicks).toBeLessThanOrEqual(9);
      samples.push({ kind, delayTicks });
    }
  }

  const summarize = (kind: 'shot' | 'pass') => {
    const values = samples.filter((sample) => sample.kind === kind).map((sample) => sample.delayTicks).sort((a, b) => a - b);
    return {
      samples: values.length,
      minTicks: values[0],
      p50Ticks: values[Math.floor((values.length - 1) * 0.5)],
      p90Ticks: values[Math.floor((values.length - 1) * 0.9)],
      maxTicks: values.at(-1),
    };
  };
  const report = { tickRateHz: 60, shot: summarize('shot'), pass: summarize('pass'), samples };
  console.log('Stage 05R live dribble-to-strike transition ticks:', JSON.stringify(report));
  await testInfo.attach('stage-05r-live-strike-transition-calibration.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
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

test('finesse and chip can be selected before or during LMB charge and remain latched through release', async ({ page }) => {
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

  // Modifier-first remains valid.
  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.mouse.down({ button: 'right' });
  await page.mouse.down({ button: 'left' });
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(50);
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await page.mouse.up({ button: 'left' });

  // Beginner-friendly order: start charging, then add RMB.
  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.mouse.down({ button: 'left' });
  await expect(probe).toHaveAttribute('data-shot-style', 'normal');
  await page.mouse.down({ button: 'right' });
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(50);
  await expect(probe).toHaveAttribute('data-shot-style', 'finesse');
  await page.mouse.up({ button: 'left' });

  // Ctrl can upgrade an already-started charge all the way to chip.
  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.mouse.down({ button: 'left' });
  await expect(probe).toHaveAttribute('data-shot-style', 'normal');
  await page.keyboard.down('Control');
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
  const playerProbe = page.locator('[data-player-state]');

  await page.keyboard.press('g');
  await page.waitForTimeout(60);
  await page.evaluate(() => {
    const output = document.querySelector<HTMLOutputElement>('[data-football-state]');
    if (!output) throw new Error('missing football practice probe');
    const observer = new MutationObserver(() => {
      if (output.dataset.action?.includes('COMMITTED TACKLE')) {
        output.dataset.committedTackleSeen = 'true';
        output.dataset.committedTackleRecovery = output.dataset.recovery ?? '0';
      }
    });
    observer.observe(output, { attributes: true, attributeFilter: ['data-action'] });
  });
  await page.keyboard.down('ShiftLeft');
  await expect(playerProbe).toHaveAttribute('data-sprinting', 'true');
  await page.keyboard.down('c');
  await expect(playerProbe).toHaveAttribute('data-tackle-hook', 'true');
  await expect(probe).toHaveAttribute('data-committed-tackle-seen', 'true');
  await page.keyboard.up('c');
  await page.keyboard.up('ShiftLeft');

  expect(Number(await probe.getAttribute('data-committed-tackle-recovery'))).toBeGreaterThan(0);
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
