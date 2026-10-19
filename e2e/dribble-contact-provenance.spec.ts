import { expect, test } from '@playwright/test';

test('live dribble impulses expose a consumed foot plan and leave free-ball simulation active', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('g');
  const probe = page.locator('[data-football-state]');
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await probe.getAttribute('data-planned-contact-count') ?? 0), { timeout: 12000 })
    .toBeGreaterThan(2);
  await page.keyboard.up('w');

  const state = await probe.evaluate((element) => {
    const data = (element as HTMLOutputElement).dataset;
    return {
      controller: data.dribbleController,
      count: Number(data.plannedContactCount ?? 0),
      planId: data.lastContactPlanId ?? '',
      eventTick: Number(data.lastContactEventTick ?? 0),
      foot: data.lastContactFoot ?? '',
      surface: data.contactSurface ?? '',
      freeFrames: Number(data.freeBallFrames ?? 0),
      x: Number(data.ballX ?? 0),
      z: Number(data.ballZ ?? 0),
      action: data.action ?? '',
    };
  });

  expect(state.controller).toBe('planned-contact');
  expect(state.count).toBeGreaterThan(2);
  expect(state.planId).toMatch(/^contact:[0-9a-f]{8}$/);
  expect(state.eventTick).toBeGreaterThan(0);
  expect(state.foot).toMatch(/^(left|right)$/);
  expect(state.surface).toMatch(/^(inside|outside|instep|sole|toe)$/);
  expect(state.freeFrames).toBeGreaterThan(0);
  expect(Number.isFinite(state.x) && Number.isFinite(state.z)).toBe(true);
  expect(state.action).not.toMatch(/FIRST TOUCH FAILED/);
});
