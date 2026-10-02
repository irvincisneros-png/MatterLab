import { expect, test } from '@playwright/test';

// Remounting a canvas (camera reset, experiment switch) makes React Three Fiber
// force-lose the old context. That must not move a WebGL-capable device to 2D.
const graphics = (page: import('@playwright/test').Page) => page.locator('[data-graphics]').first();

for (const route of ['simulators/4.3.1', 'simulators/4.5.1', 'advanced/plasma']) {
  test(`resetting the camera on ${route} keeps the 3D renderer`, async ({ page }) => {
    await page.goto(`/#/${route}`);
    await expect(graphics(page)).toHaveAttribute('data-graphics', 'ready');
    await page.getByRole('button', { name: 'Reset camera view', exact: true }).click();
    await page.waitForTimeout(1200);
    await expect(graphics(page)).toHaveAttribute('data-graphics', 'ready');
  });
}

test('switching from plasma to the condensate keeps the 3D renderer', async ({ page }) => {
  await page.goto('/#/advanced/plasma');
  await expect(graphics(page)).toHaveAttribute('data-graphics', 'ready');
  await page.getByRole('button', { name: /Bose–Einstein condensate/ }).click();
  await page.waitForTimeout(1200);
  await expect(graphics(page)).toHaveAttribute('data-graphics', 'ready');
});
