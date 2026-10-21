import { expect, test } from '@playwright/test';

test('movement check drives forward, sprint, cut, reversal, and a clean stop through the live input path', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/');

  const panel = page.locator('[data-movement-check-panel]');
  await expect(panel).toBeVisible();
  await panel.locator('summary').click();
  await panel.getByRole('button', { name: 'Run movement check' }).click();

  const result = panel.locator('[data-movement-check-result]');
  await expect(result).toHaveAttribute('data-status', 'complete', { timeout: 10_000 });
  const metrics = await result.evaluate((element) => JSON.parse(element.getAttribute('data-results') ?? '{}') as {
    forward: number;
    sprint: number;
    cut: number;
    reversal: number;
    stopDrift: number;
    vectors: {
      forward: { x: number; z: number };
      sprint: { x: number; z: number };
      cut: { x: number; z: number };
      reversal: { x: number; z: number };
    };
    terminalVelocity: { x: number; z: number };
  });
  console.log(`Movement path vectors: ${JSON.stringify(metrics.vectors)}`);

  expect(metrics.forward).toBeGreaterThan(0.45);
  expect(metrics.sprint).toBeGreaterThan(1.2);
  expect(metrics.cut).toBeGreaterThan(0.35);
  expect(metrics.reversal).toBeGreaterThan(0.35);
  expect(metrics.stopDrift).toBeLessThan(0.7);
  expect(metrics.vectors.forward.z).toBeGreaterThan(0.4);
  expect(metrics.vectors.sprint.z).toBeGreaterThan(1.2);
  expect(metrics.vectors.cut.x).toBeGreaterThan(0.4);
  expect(metrics.terminalVelocity.z).toBeLessThan(-0.1);
  expect(runtimeErrors).toEqual([]);
});
