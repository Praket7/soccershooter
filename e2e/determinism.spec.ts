import { expect, test } from '@playwright/test';
import { runReferenceTrace } from '../packages/sim/src/referenceTrace';

test('movement lab replays the exact Node reference trace', async ({ page }) => {
  const expected = runReferenceTrace();
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'SoccerShooter Movement Lab' })).toBeVisible();
  const result = page.locator('[data-determinism-hash]');
  await expect(result).toHaveAttribute('data-determinism-ticks', String(expected.ticks));
  await expect(result).toHaveAttribute('data-determinism-hash', expected.hash);
});
