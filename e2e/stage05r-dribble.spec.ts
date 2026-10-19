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
  await page.waitForFunction(() => {
    const windowWithCapture = window as Window & {
      __stage05rCutCapture?: {
        baseline: { startX: number; startZ: number; startTick: number; contactCountdown: number; contactsBeforeCut: number; startingFreeBallFrames: number; inputAckSimTick: number };
        samples: Array<{ tick: number; playerX: number; playerZ: number; ballX: number; ballZ: number; separation: number; contactTick: number; inputAckSimTick: number }>;
        done: boolean;
        onTick: (sample: { tick: number; playerX: number; playerZ: number; ballX: number; ballZ: number; separation: number; contactTick: number; inputAckSimTick: number }) => void;
      };
    };
    if (windowWithCapture.__stage05rCutCapture) return true;
    const playerState = document.querySelector<HTMLOutputElement>('[data-player-state]');
    const footballState = document.querySelector<HTMLOutputElement>('[data-football-state]');
    if (!playerState || !footballState) throw new Error('missing live cut probes');
    const startTick = Number(playerState.dataset.tick ?? 0);
    const contactTick = Number(footballState.dataset.activeContactTick ?? 0);
    const contactCountdown = contactTick > startTick ? contactTick - startTick : Number.POSITIVE_INFINITY;
    if (contactCountdown !== 2) return false;

    const capture = {
      baseline: {
        startX: Number(playerState.dataset.x ?? 0),
        startZ: Number(playerState.dataset.z ?? 0),
        startTick,
        contactCountdown,
        contactsBeforeCut: Number(footballState.dataset.plannedContactCount ?? 0),
        startingFreeBallFrames: Number(footballState.dataset.freeBallFrames ?? 0),
        inputAckSimTick: Number(playerState.dataset.inputAckSimTick ?? 0),
      },
      samples: [] as Array<{ tick: number; playerX: number; playerZ: number; ballX: number; ballZ: number; separation: number; contactTick: number; inputAckSimTick: number }>,
      done: false,
      onTick(sample: { tick: number; playerX: number; playerZ: number; ballX: number; ballZ: number; separation: number; contactTick: number; inputAckSimTick: number }) {
        if (capture.done || sample.tick <= startTick) return;
        capture.samples.push(sample);
        if (sample.tick >= startTick + 36) capture.done = true;
      },
    };
    windowWithCapture.__stage05rCutCapture = capture;
    return true;
  }, undefined, { polling: 'raf', timeout: 8000 });

  await page.keyboard.down('d');
  await page.keyboard.up('w');
  await page.waitForFunction(
    () => (window as Window & { __stage05rCutCapture?: { done: boolean } }).__stage05rCutCapture?.done === true,
    undefined,
    { timeout: 8000 },
  );
  const captureResult = await page.evaluate(() => (window as Window & {
    __stage05rCutCapture?: {
      baseline: { startX: number; startZ: number; startTick: number; contactCountdown: number; contactsBeforeCut: number; startingFreeBallFrames: number; inputAckSimTick: number };
      samples: Array<{ tick: number; playerX: number; playerZ: number; ballX: number; ballZ: number; separation: number; contactTick: number; inputAckSimTick: number }>;
    };
  }).__stage05rCutCapture);
  if (!captureResult) throw new Error('live cut telemetry was not captured');
  const { startX, startZ, startTick, contactCountdown, contactsBeforeCut, startingFreeBallFrames, inputAckSimTick: baselineInputAckSimTick } = captureResult.baseline;
  const tickSamples = captureResult.samples;
  await page.keyboard.up('d');

  const maximumSeparationState = tickSamples.reduce<Record<string, unknown> | undefined>((maximum, state) =>
    !maximum || Number(state.separation) > Number(maximum.separation) ? state : maximum, undefined);
  const maximumSeparation = Number(maximumSeparationState?.separation ?? 0);
  const lastSampledTick = Number(tickSamples.at(-1)?.tick ?? startTick);

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
  expect(Math.abs(endZ - startZ)).toBeLessThan(2.2);
  expect(lastSampledTick, 'cut telemetry should cover 36 simulation ticks around the next contact').toBeGreaterThanOrEqual(startTick + 36);
  expect(contactsAfterCut, JSON.stringify({ contactCountdown, contactsBeforeCut, contactsAfterCut, loose, finalDiagnostics })).toBeGreaterThan(contactsBeforeCut);
  expect(endingFreeBallFrames, 'free-ball simulation should advance between legal contacts').toBeGreaterThan(startingFreeBallFrames);
  expect(maximumSeparation, JSON.stringify({ contactCountdown, startTick, startX, startZ, endX, endZ, contactsBeforeCut, contactsAfterCut, loose, finalDiagnostics, maximumSeparation, maximumSeparationState })).toBeLessThan(2.0);
  const firstObservedTick = Number(tickSamples[0]?.tick ?? startTick);
  const cutInputAckTick = tickSamples.find((state) => state.inputAckSimTick > baselineInputAckSimTick)?.inputAckSimTick;
  const maximumObservedTickGap = Math.max(
    0,
    firstObservedTick - startTick,
    ...tickSamples.slice(1).map((state, index) => Number(state.tick) - Number(tickSamples[index]?.tick ?? 0)),
  );
  expect(tickSamples.length, 'cut telemetry should include the full 36 simulation ticks').toBeGreaterThanOrEqual(36);
  expect(firstObservedTick).toBe(startTick + 1);
  expect(maximumObservedTickGap, JSON.stringify({ sampleTicks: tickSamples.map((state) => state.tick) })).toBeLessThanOrEqual(1);
  // The fixed-step loop applies tickIntent to movement and FootballPractice
  // before it stamps inputAcknowledgedSimTick. Equality therefore means the
  // cut was consumed in the contact step, before that step's contact update.
  expect(cutInputAckTick, JSON.stringify({ baselineInputAckSimTick, contactCountdown, samples: tickSamples.map((state) => ({ tick: state.tick, inputAckSimTick: state.inputAckSimTick })) }))
    .toBeLessThanOrEqual(startTick + contactCountdown);
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
