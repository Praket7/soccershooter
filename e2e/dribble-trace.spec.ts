import { expect, test, type Page } from '@playwright/test';

interface BrowserCarrySample {
  sample: number;
  playerX: number;
  playerZ: number;
  playerSpeed: number;
  ballX: number;
  ballZ: number;
  ballSpeed: number;
  separation: number;
  action: string;
  reason: string;
}

async function sampleCarry(page: Page, sample: number): Promise<BrowserCarrySample> {
  const player = page.locator('[data-player-state]');
  const ball = page.locator('[data-football-state]');
  const playerX = Number(await player.getAttribute('data-x'));
  const playerZ = Number(await player.getAttribute('data-z'));
  const playerSpeed = Number(await player.getAttribute('data-speed'));
  const ballX = Number(await ball.getAttribute('data-ball-x'));
  const ballZ = Number(await ball.getAttribute('data-ball-z'));
  const ballSpeed = Number(await ball.getAttribute('data-ball-speed'));
  return {
    sample,
    playerX,
    playerZ,
    playerSpeed,
    ballX,
    ballZ,
    ballSpeed,
    separation: Math.hypot(ballX - playerX, ballZ - playerZ),
    action: (await ball.getAttribute('data-action')) ?? '',
    reason: (await ball.getAttribute('data-reason')) ?? '',
  };
}

async function runBrowserCarry(page: Page, sprint: boolean): Promise<BrowserCarrySample[]> {
  await page.goto('/');
  await page.keyboard.press('g');
  await page.waitForTimeout(80);
  await page.keyboard.down('w');
  if (sprint) await page.keyboard.down('Shift');

  const samples: BrowserCarrySample[] = [];
  for (let index = 0; index < 34; index += 1) {
    await page.waitForTimeout(50);
    samples.push(await sampleCarry(page, index));
  }

  if (sprint) await page.keyboard.up('Shift');
  await page.keyboard.up('w');
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
});

test('browser sprint carry matches the deterministic recoverable knock-on envelope', async ({ page }) => {
  const samples = await runBrowserCarry(page, true);
  const maximum = Math.max(...samples.map((entry) => entry.separation));
  expect(maximum, traceMessage(samples)).toBeLessThan(1.38);
});
