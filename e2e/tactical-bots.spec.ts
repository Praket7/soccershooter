import { expect, test } from '@playwright/test';

const tacticalButtonName = 'Tactical Debug';

test('Stage 06 Tactical Debug remains a live tactical blackboard, not physical-possession evidence', async ({ page }) => {
  await page.goto('/');

  const tacticalButton = page.getByRole('button', { name: tacticalButtonName, exact: true });
  await expect(tacticalButton).toBeVisible();
  await tacticalButton.click();

  const lab = page.locator('[data-bot-tactical-lab]');
  const probe = page.locator('[data-bot-state]');
  await expect(lab).toBeVisible();
  await expect(lab.getByRole('heading', { name: tacticalButtonName })).toBeVisible();
  await expect(lab).toContainText('Possession on this page is scripted');
  await expect(page.locator('[data-football-practice]')).toBeHidden();
  await expect(page.locator('[data-ball-lab]')).toBeHidden();
  await expect(page.locator('[data-bot-participant]')).toHaveCount(6);
  await expect(lab).toHaveAttribute('data-role-overlay', 'false');

  const startTick = Number(await probe.getAttribute('data-tactical-tick'));
  await expect.poll(async () => Number(await probe.getAttribute('data-tactical-tick')), { timeout: 3000 })
    .toBeGreaterThan(startTick + 5);
  await expect.poll(async () => Number(await probe.getAttribute('data-pass-attempts')), { timeout: 5000 })
    .toBeGreaterThan(0);
  await expect(probe).toHaveAttribute('data-permanent-swarm', 'false');
  expect(Number(await probe.getAttribute('data-max-keeper-depth'))).toBeLessThanOrEqual(3.8);
});

test('Stage 06 Tactical Debug turnover control causes immediate phase/possession response', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: tacticalButtonName, exact: true }).click();

  const probe = page.locator('[data-bot-state]');
  const before = await probe.getAttribute('data-possession-team');
  expect(before).toMatch(/home|away/);

  const observedTurnover = await page.evaluate(async () => {
    const eventView = document.querySelector<HTMLElement>('[data-bot-event]');
    const button = document.querySelector<HTMLButtonElement>('[data-bot-turnover]');
    if (!eventView || !button) throw new Error('Tactical Debug turnover controls are missing');

    return await new Promise<string>((resolve, reject) => {
      const read = (): string => eventView.textContent?.trim() ?? '';
      const finishIfTurnover = (): boolean => {
        const value = read();
        if (!value.startsWith('turnover:')) return false;
        window.clearTimeout(timeout);
        observer.disconnect();
        resolve(value);
        return true;
      };
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error(`turnover event was not observed; last visible event=${read()}`));
      }, 1200);
      const observer = new MutationObserver(() => { finishIfTurnover(); });
      observer.observe(eventView, { childList: true, subtree: true, characterData: true });
      button.click();
      finishIfTurnover();
    });
  });

  expect(observedTurnover).toMatch(/^turnover:(home|away|loose)->(home|away)$/);
  await expect.poll(async () => await probe.getAttribute('data-possession-team'), { timeout: 1500 })
    .not.toBe(before);
});

test('Stage 06 role overlay is optional and never required to identify movement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: tacticalButtonName, exact: true }).click();
  const lab = page.locator('[data-bot-tactical-lab]');

  await expect(lab).toHaveAttribute('data-role-overlay', 'false');
  await lab.getByRole('button', { name: 'Show Roles', exact: true }).click();
  await expect(lab).toHaveAttribute('data-role-overlay', 'true');
  await expect(page.locator('[data-bot-role-label]:visible')).toHaveCount(6);
  await lab.getByRole('button', { name: 'Hide Roles', exact: true }).click();
  await expect(lab).toHaveAttribute('data-role-overlay', 'false');
});
