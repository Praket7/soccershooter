import { expect, test } from '@playwright/test';

async function resetPracticeBall(page: import('@playwright/test').Page) {
  const probe = page.locator('[data-football-state]');
  await page.keyboard.press('g');
  await expect(probe).toHaveAttribute('data-action', 'READY');
  await expect.poll(async () => Number(await probe.getAttribute('data-ball-speed')), { timeout: 1000 })
    .toBeLessThan(0.05);
}

test('Stage 05 opens in Football Practice with Ball Lab preserved as a separate diagnostics mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-football-practice]')).toBeVisible();
  await expect(page.locator('[data-ball-lab]')).toBeHidden();
  await expect(page.locator('[data-action-debug]')).toBeVisible();
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-mode', 'practice');

  await page.getByRole('button', { name: 'Ball Lab', exact: true }).click();
  await expect(page.locator('[data-ball-lab]')).toBeVisible();
  await expect(page.locator('[data-football-practice]')).toBeHidden();
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-mode', 'ball-lab');

  await page.getByRole('button', { name: 'Football Practice', exact: true }).click();
  await expect(page.locator('[data-football-practice]')).toBeVisible();
  await expect(page.locator('[data-player-state]')).toHaveAttribute('data-mode', 'practice');
});

test('physical dribble touch moves the ball only after player movement', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  const probe = page.locator('[data-football-state]');
  const beforeZ = Number(await probe.getAttribute('data-ball-z'));

  await page.waitForTimeout(220);
  const idleZ = Number(await probe.getAttribute('data-ball-z'));
  expect(Math.abs(idleZ - beforeZ)).toBeLessThan(0.03);

  await page.keyboard.down('w');
  await page.waitForTimeout(520);
  await page.keyboard.up('w');

  await expect.poll(async () => Number(await probe.getAttribute('data-ball-z')), { timeout: 1500 })
    .toBeGreaterThan(beforeZ + 0.35);
  expect(Number(await page.locator('[data-action-debug]').getAttribute('data-control-quality'))).toBeGreaterThan(0);
});

test('E creates a real physical ground pass and Q/R expose dedicated pass families', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('e');
  await expect(probe).toHaveAttribute('data-reason', /ground:/);
  await expect.poll(async () => Number(await probe.getAttribute('data-ball-speed')), { timeout: 1000 })
    .toBeGreaterThan(2);
  await expect(page.locator('[data-action-debug]')).toHaveAttribute('data-success', 'true');

  await resetPracticeBall(page);
  await page.keyboard.press('q');
  await expect(probe).toHaveAttribute('data-reason', /through:/);

  await resetPracticeBall(page);
  await page.keyboard.press('r');
  await expect(probe).toHaveAttribute('data-reason', /lofted:/);
});

test('F explicitly buffers receive independent of RMB precision', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  const probe = page.locator('[data-football-state]');

  await page.keyboard.press('f');
  await expect.poll(async () => await probe.getAttribute('data-action'), { timeout: 1200 })
    .toMatch(/TRAP ARMED|CUSHION TOUCH/);
  expect(await probe.getAttribute('data-receive-state')).toMatch(/armed|consumed/);
});

test('committed challenge creates readable recovery and immediate spam is rejected', async ({ page }) => {
  await page.goto('/');
  await resetPracticeBall(page);
  const probe = page.locator('[data-football-state]');
  const playerProbe = page.locator('[data-player-state]');

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
  await expect(probe).toHaveAttribute('data-committed-tackle-seen', 'true');
  expect(Number(await probe.getAttribute('data-committed-tackle-recovery'))).toBeGreaterThan(0.25);
  await page.keyboard.up('c');
  await page.keyboard.up('ShiftLeft');

  await page.keyboard.press('c');
  await expect.poll(async () => await probe.getAttribute('data-reason'), { timeout: 600 }).toBe('recovering');
});

test('normal play no longer exposes six shot hotkeys; specialist contacts live in Practice-only panel', async ({ page }) => {
  await page.goto('/');
  const probe = page.locator('[data-football-state]');
  const panel = page.locator('.practice-technique-panel');
  await expect(panel).toContainText('Practice-only specialist contacts');
  await panel.locator('summary').click();
  await expect(panel).toHaveAttribute('open', '');

  for (const style of ['normal', 'knuckle', 'outside-foot']) {
    await panel.getByRole('button', { name: style, exact: true }).click();
    await expect(probe).toHaveAttribute('data-shot-style', style);
  }

  await page.keyboard.press('2');
  await expect(probe).toHaveAttribute('data-shot-style', 'outside-foot');
});
