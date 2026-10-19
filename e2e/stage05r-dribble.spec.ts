import { expect, test } from '@playwright/test';

test('live normal dribble uses gait-timed planned foot contacts with free-ball frames', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await expect(probe).toHaveAttribute('data-dribble-controller', 'planned-contact');
  const startingContacts = Number(await probe.getAttribute('data-planned-contact-count') ?? 0);

  await page.keyboard.down('w');
  await expect.poll(
    async () => Number(await probe.getAttribute('data-planned-contact-count') ?? 0),
    { timeout: 3000 },
  ).toBeGreaterThan(startingContacts + 1);
  await page.keyboard.up('w');

  await expect(probe).toHaveAttribute('data-last-contact-foot', /left|right/);
  await expect(probe).toHaveAttribute('data-free-ball-frames', /[1-9][0-9]*/);
  await expect(probe).toHaveAttribute('data-dribble-loose-ball', 'false');
});

test('a late 90 degree jog cut in the live game retains contact without attaching the ball', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');
  const player = page.locator('[data-player-state]');

  await page.keyboard.press('g');
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await player.getAttribute('data-speed') ?? 0), { timeout: 3000 })
    .toBeGreaterThan(4);
  await expect.poll(async () => Number(await probe.getAttribute('data-planned-contact-count') ?? 0), { timeout: 3000 })
    .toBeGreaterThanOrEqual(2);
  let contactCountdown = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 600 && contactCountdown !== 2; attempt += 1) {
    contactCountdown = await page.evaluate(() => {
      const playerState = document.querySelector<HTMLOutputElement>('[data-player-state]');
      const footballState = document.querySelector<HTMLOutputElement>('[data-football-state]');
      if (!playerState || !footballState) throw new Error('missing live cut probes');
      const currentTick = Number(playerState.dataset.tick ?? 0);
      const contactTick = Number(footballState.dataset.activeContactTick ?? 0);
      return contactTick > currentTick ? contactTick - currentTick : Number.POSITIVE_INFINITY;
    });
    if (contactCountdown !== 2) await page.waitForTimeout(4);
  }
  expect(contactCountdown, 'live dribble planner did not expose a contact two ticks ahead').toBe(2);
  const contactsBeforeCut = Number(await probe.getAttribute('data-planned-contact-count') ?? 0);
  const startX = Number(await player.getAttribute('data-x') ?? 0);
  const startZ = Number(await player.getAttribute('data-z') ?? 0);
  const startTick = Number(await player.getAttribute('data-tick') ?? 0);
  const startingFreeBallFrames = Number(await probe.getAttribute('data-free-ball-frames') ?? 0);
  let maximumSeparation = 0;
  let maximumSeparationState: Record<string, unknown> = {};
  const tickSamples: Array<Record<string, number | boolean>> = [];

  await page.keyboard.down('d');
  await page.keyboard.up('w');
  let lastSampledTick = startTick;
  for (let attempt = 0; attempt < 240 && lastSampledTick < startTick + 36; attempt += 1) {
    const state = await page.evaluate(() => {
      const playerState = document.querySelector<HTMLOutputElement>('[data-player-state]');
      const footballState = document.querySelector<HTMLOutputElement>('[data-football-state]');
      if (!playerState || !footballState) throw new Error('missing live cut probes');
      const playerX = Number(playerState.dataset.x ?? 0);
      const playerZ = Number(playerState.dataset.z ?? 0);
      const ballX = Number(footballState.dataset.ballX ?? 0);
      const ballZ = Number(footballState.dataset.ballZ ?? 0);
      return {
        playerX,
        playerZ,
        tick: Number(playerState.dataset.tick ?? 0),
        ballX,
        ballZ,
        separation: Math.hypot(playerX - ballX, playerZ - ballZ),
        loose: footballState.dataset.dribbleLooseBall === 'true',
        contactTick: Number(footballState.dataset.activeContactTick ?? 0),
      };
    });
    if (state.tick > lastSampledTick) {
      tickSamples.push(state);
      lastSampledTick = state.tick;
      if (state.separation > maximumSeparation) {
        maximumSeparation = state.separation;
        maximumSeparationState = state;
      }
    }
    if (lastSampledTick < startTick + 36) await page.waitForTimeout(5);
  }
  await page.keyboard.up('d');

  const endX = Number(await player.getAttribute('data-x') ?? 0);
  const endZ = Number(await player.getAttribute('data-z') ?? 0);
  const contactsAfterCut = Number(await probe.getAttribute('data-planned-contact-count') ?? 0);
  const endingFreeBallFrames = Number(await probe.getAttribute('data-free-ball-frames') ?? 0);
  const loose = await probe.getAttribute('data-dribble-loose-ball');
  const finalDiagnostics = await page.evaluate(() => {
    const footballState = document.querySelector<HTMLOutputElement>('[data-football-state]');
    const playerState = document.querySelector<HTMLOutputElement>('[data-player-state]');
    return {
      reason: footballState?.dataset.reason,
      action: footballState?.dataset.action,
      contactTick: footballState?.dataset.contactTick,
      activeContactTick: footballState?.dataset.activeContactTick,
      currentTick: playerState?.dataset.tick,
      freeBallFrames: footballState?.dataset.freeBallFrames,
    };
  });
  expect(endX).toBeLessThan(startX - 1.5);
  expect(Math.abs(endZ - startZ)).toBeLessThan(2.0);
  expect(lastSampledTick, 'cut telemetry should cover 36 simulation ticks around the next contact').toBeGreaterThanOrEqual(startTick + 36);
  expect(contactsAfterCut, JSON.stringify({ contactCountdown, contactsBeforeCut, contactsAfterCut, loose, finalDiagnostics })).toBeGreaterThan(contactsBeforeCut);
  expect(endingFreeBallFrames, 'free-ball simulation should advance between legal contacts').toBeGreaterThan(startingFreeBallFrames);
  expect(maximumSeparation, JSON.stringify({ startTick, startX, startZ, endX, endZ, contactsBeforeCut, contactsAfterCut, loose, maximumSeparation, maximumSeparationState })).toBeLessThan(2.0);
  const looseTicks = tickSamples.filter((state) => state.loose).length;
  expect(tickSamples.length, 'cut telemetry should include at least 30 unique simulation-tick observations').toBeGreaterThanOrEqual(30);
  expect(looseTicks / tickSamples.length, JSON.stringify({ startX, startZ, endX, endZ, contactsBeforeCut, contactsAfterCut, loose, looseTicks, sampleTicks: tickSamples.length, maximumSeparation, finalDiagnostics })).toBeLessThanOrEqual(0.2);
});

test('RMB close control stays on planned contacts instead of falling back to the cooldown corridor', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  await page.keyboard.down('w');
  await page.mouse.down({ button: 'right' });
  await expect.poll(
    async () => Number(await probe.getAttribute('data-planned-contact-count') ?? 0),
    { timeout: 3000 },
  ).toBeGreaterThan(1);
  await page.mouse.up({ button: 'right' });
  await page.keyboard.up('w');

  await expect(probe).toHaveAttribute('data-dribble-controller', 'planned-contact');
  await expect(probe).toHaveAttribute('data-contact-surface', /inside|outside|instep|sole|toe/);
});

test('live sprint knock-ons use the same planned-contact controller and leave free-ball travel between beats', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('g');
  const startingContacts = Number(await probe.getAttribute('data-planned-contact-count') ?? 0);
  const startingFreeFrames = Number(await probe.getAttribute('data-free-ball-frames') ?? 0);

  await page.keyboard.down('w');
  await page.keyboard.down('Shift');
  await expect.poll(
    async () => Number(await probe.getAttribute('data-planned-contact-count') ?? 0),
    { timeout: 4000 },
  ).toBeGreaterThan(startingContacts + 1);
  await expect.poll(
    async () => Number(await probe.getAttribute('data-free-ball-frames') ?? 0),
    { timeout: 4000 },
  ).toBeGreaterThan(startingFreeFrames);
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');

  await expect(probe).toHaveAttribute('data-dribble-controller', 'planned-contact');
  await expect(probe).toHaveAttribute('data-last-contact-foot', /left|right/);
  await expect(probe).toHaveAttribute('data-contact-surface', /inside|outside|instep/);
});
