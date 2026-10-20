import { expect, test, type Page } from '@playwright/test';

interface BrowserCarrySample {
  sample: number;
  tick: number;
  playerX: number;
  playerZ: number;
  playerSpeed: number;
  ballX: number;
  ballZ: number;
  ballSpeed: number;
  separation: number;
  action: string;
  reason: string;
  contactCount: number;
  contactPlanId: string;
  contactFoot: string;
  contactSurface: string;
  contactEventTick: number;
  freeBallFrames: number;
  controller: string;
}

interface AtomicCarryState {
  tick: number;
  playerX: number;
  playerZ: number;
  playerSpeed: number;
  ballX: number;
  ballZ: number;
  ballSpeed: number;
  action: string;
  reason: string;
  contactCount: number;
  contactPlanId: string;
  contactFoot: string;
  contactSurface: string;
  contactEventTick: number;
  freeBallFrames: number;
  controller: string;
}

async function atomicCarryState(page: Page): Promise<AtomicCarryState> {
  return page.evaluate(() => {
    const player = document.querySelector<HTMLOutputElement>('[data-player-state]');
    const ball = document.querySelector<HTMLOutputElement>('[data-football-state]');
    if (!player || !ball) throw new Error('missing football carry probes');
    return {
      tick: Number(player.dataset.tick ?? 0),
      playerX: Number(player.dataset.x ?? 0),
      playerZ: Number(player.dataset.z ?? 0),
      playerSpeed: Number(player.dataset.speed ?? 0),
      ballX: Number(ball.dataset.ballX ?? 0),
      ballZ: Number(ball.dataset.ballZ ?? 0),
      ballSpeed: Number(ball.dataset.ballSpeed ?? 0),
      action: ball.dataset.action ?? '',
      reason: ball.dataset.reason ?? '',
      contactCount: Number(ball.dataset.plannedContactCount ?? 0),
      contactPlanId: ball.dataset.lastContactPlanId ?? '',
      contactFoot: ball.dataset.lastContactFoot ?? '',
      contactSurface: ball.dataset.contactSurface ?? '',
      contactEventTick: Number(ball.dataset.lastContactEventTick ?? 0),
      freeBallFrames: Number(ball.dataset.freeBallFrames ?? 0),
      controller: ball.dataset.dribbleController ?? '',
    };
  });
}

async function sampleCarry(page: Page, sample: number): Promise<BrowserCarrySample> {
  const state = await atomicCarryState(page);
  return {
    sample,
    ...state,
    separation: Math.hypot(state.ballX - state.playerX, state.ballZ - state.playerZ),
  };
}

async function runBrowserCarry(page: Page, sprint: boolean, durationTicks = 90): Promise<BrowserCarrySample[]> {
  await page.goto('/');
  await page.keyboard.press('g');
  const initial = await atomicCarryState(page);
  await page.keyboard.down('w');
  if (sprint) await page.keyboard.down('Shift');

  const samples: BrowserCarrySample[] = [];
  for (let index = 0; index < 180; index += 1) {
    const sample = await sampleCarry(page, index);
    samples.push(sample);
    if (sample.tick - initial.tick >= durationTicks) break;
    await page.waitForTimeout(12);
  }

  if (sprint) await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  if ((samples.at(-1)?.tick ?? initial.tick) - initial.tick < durationTicks) {
    throw new Error(`browser carry did not reach ${durationTicks} simulation ticks`);
  }
  return samples;
}

function traceMessage(samples: BrowserCarrySample[]): string {
  const max = Math.max(...samples.map((entry) => entry.separation));
  return JSON.stringify({ maxSeparation: max, samples }, null, 2);
}

test('browser normal carry matches the deterministic compact possession envelope', async ({ page }) => {
  const samples = await runBrowserCarry(page, false);
  const maximum = Math.max(...samples.map((entry) => entry.separation));
  expect(maximum, traceMessage(samples)).toBeLessThan(1.12);
  expect(samples.some((entry) => /FIRST TOUCH FAILED/.test(entry.action)), traceMessage(samples)).toBe(false);
  expect(samples.at(-1)?.controller).toBe('planned-contact');
  expect(Math.max(...samples.map((entry) => entry.contactCount))).toBeGreaterThan(2);
  expect(samples.some((entry) => entry.contactPlanId.startsWith('contact:'))).toBe(true);
  expect(samples.some((entry) => entry.contactEventTick > 0 && entry.contactFoot && entry.contactSurface)).toBe(true);
  expect(samples.at(-1)?.freeBallFrames).toBeGreaterThan(0);
});

test('browser sprint carry stays inside the close physical-control envelope', async ({ page }) => {
  const samples = await runBrowserCarry(page, true);
  const maximum = Math.max(...samples.map((entry) => entry.separation));
  expect(maximum, traceMessage(samples)).toBeLessThan(1.0);
  expect(samples.some((entry) => /FIRST TOUCH FAILED/.test(entry.action)), traceMessage(samples)).toBe(false);
  expect(samples.at(-1)?.controller).toBe('planned-contact');
  expect(Math.max(...samples.map((entry) => entry.contactCount))).toBeGreaterThan(1);
  expect(samples.some((entry) => entry.contactPlanId.startsWith('contact:'))).toBe(true);
  expect(samples.some((entry) => entry.contactEventTick > 0 && entry.contactFoot && entry.contactSurface)).toBe(true);
  expect(samples.at(-1)?.freeBallFrames).toBeGreaterThan(0);
});
