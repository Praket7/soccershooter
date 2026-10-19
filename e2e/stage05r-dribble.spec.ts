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
