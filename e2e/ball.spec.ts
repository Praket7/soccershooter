import { expect, test } from '@playwright/test';

async function openBallLab(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ball Lab', exact: true }).click();
}

test('Stage 04 Ball Lab launches presets, predicts landing, and exposes deterministic telemetry', async ({ page }) => {
  await openBallLab(page);
  const lab = page.locator('[data-ball-lab]');
  await expect(lab).toBeVisible();
  await expect(page.getByRole('button', { name: /straight 20m/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /curl 20m/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /knuckle/i })).toBeVisible();

  const probe = page.locator('[data-ball-state]');
  await expect(probe).toHaveAttribute('data-ball-tick-hz', '120');
  await page.getByRole('button', { name: /curl 20m/i }).click();
  const predictedX = Number(await probe.getAttribute('data-predicted-x'));
  expect(predictedX).toBeGreaterThan(0.25);

  const startZ = Number(await probe.getAttribute('data-z'));
  await page.getByRole('button', { name: /^launch$/i }).click();
  await expect.poll(
    async () => Number(await probe.getAttribute('data-z')),
    { timeout: 2_000 },
  ).toBeGreaterThan(startZ + 6);
});

test('Ball Lab custom controls and reset remain usable in diagnostics mode', async ({ page }) => {
  await openBallLab(page);
  const speed = page.getByLabel('Launch speed');
  await speed.fill('28');
  await page.getByLabel('Elevation').fill('18');
  await page.getByLabel('Spin rate').fill('70');
  await page.getByLabel('Spin axis').selectOption('side');
  await page.getByRole('button', { name: /^launch$/i }).click();
  await expect(page.locator('[data-ball-state]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', { name: /reset ball/i }).click();
  await expect(page.locator('[data-ball-state]')).toHaveAttribute('data-active', 'false');
});

test('CSV export is complete even when exported before launching the selected preset', async ({ page }) => {
  await openBallLab(page);
  await page.getByRole('button', { name: /post rebound/i }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /export csv/i }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();

  const lines = csv.trim().split('\n');
  expect(lines.length).toBeGreaterThan(100);
  expect(csv).toContain('goal-frame,right-post');
});
