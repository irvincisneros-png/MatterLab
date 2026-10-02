import { expect, test, type Page } from '@playwright/test';

async function supportsWebGL(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!context) return false;
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
}

test('direct 4.1.4 opens States and the Guide provides all 19 direct lesson routes', async ({ page }) => {
  await page.goto('/#/simulators/4.1.4');
  await expect(page.getByRole('heading', { name: 'States of matter' })).toBeVisible();
  await expect(page.locator('.playground-nav').getByRole('link', { name: /Matter/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.matter-subnav').getByRole('link', { name: 'States' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Particles on' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sample-select')).toHaveCount(3);
  await expect(page.locator('.sample-select').nth(2)).toContainText('Water vapour');
  const supports = await supportsWebGL(page);
  if (supports) {
    await expect(page.locator('.matter-canvas canvas')).toHaveCount(1);
    await page.waitForTimeout(600);
    await expect(page.locator('.matter-canvas canvas')).toHaveCount(1);
  } else {
    await expect(page.locator('.fallback-board')).toBeVisible();
  }
  await page.screenshot({ path: 'output/playwright/playground-states-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Open model notes and learning outcomes' }).click();
  const guide = page.getByRole('dialog', { name: 'Matter' });
  await expect(guide).toContainText('Open a lesson');
  await expect(guide.locator('.outcome-launch-row')).toHaveCount(19);
  await expect(guide).toContainText('Identify the 3 main states of matter');
});

test('outcome 4.1.3 opens Change Station and a selected transition updates the direct route', async ({ page }) => {
  await page.goto('/#/simulators/4.1.3');
  await expect(page.locator('.matter-subnav').getByRole('link', { name: 'Change Station' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Melting' })).toBeVisible();
  await expect(page.locator('.cl-temp-orb')).toContainText('20');
  await page.screenshot({ path: 'output/playwright/playground-change-station.png', fullPage: true });
  await page.locator('.cl-thermal-block .cl-action.heat').click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('0 °C');
  await expect(page.locator('.cl-ledger-foot')).toContainText('total stays 200 g');
  await page.getByRole('button', { name: /Freezing/ }).click();
  await page.waitForURL(/#\/changes\/freezing$/);
  await expect(page.getByRole('heading', { name: 'Freezing' })).toBeVisible();
  await expect(page.locator('.cl-temp-orb')).toHaveText('22 °C');
});

test('Beyond Three exposes plasma and rubidium experiments as optional atom models', async ({ page }) => {
  await page.goto('/#/advanced/plasma');
  await expect(page.getByRole('heading', { name: 'Hydrogen plasma' })).toBeVisible();
  await expect(page.locator('.plasma-ledger')).toContainText('net charge 0');
  await page.screenshot({ path: 'output/playwright/playground-plasma.png', fullPage: true });
  await expect(page.locator('.matter-subnav').getByRole('link', { name: 'Plasma' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: /Bose–Einstein condensate/ }).click();
  await page.waitForURL(/#\/advanced\/bec$/);
  await expect(page.getByRole('heading', { name: 'Ultracold rubidium' })).toBeVisible();
  await expect(page.locator('.bec-ledger')).toContainText('total stays 48');
  await page.screenshot({ path: 'output/playwright/playground-bec.png', fullPage: true });
});

test('the States challenge checks the prediction against particle behaviour', async ({ page }) => {
  await page.goto('/#/simulators/4.1.4');
  await page.getByRole('tab', { name: /Try a challenge/ }).click();
  await page.getByRole('button', { name: 'Solid', exact: true }).click();
  await expect(page.locator('.success-chip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Liquid', exact: true }).click();
  await expect(page.locator('.success-chip')).toContainText('VERIFIED');
});

test('single stepping moves molecule positions while the selected temperature stays fixed', async ({ page }) => {
  await page.goto('/#/simulators/4.1.4');
  await page.getByRole('button', { name: '2D' }).click();
  await page.getByRole('button', { name: 'Pause molecule motion' }).click();
  const dots = page.locator('.fallback-molecule-map .dot');
  const start = await dots.evaluateAll((elements) => elements.map((element) => element.getAttribute('style')).join('|'));
  const readings = await page.locator('.sample-select > strong').allTextContents();
  await page.getByRole('button', { name: 'Advance one model time step' }).click();
  await expect.poll(() => dots.evaluateAll((elements) => elements.map((element) => element.getAttribute('style')).join('|'))).not.toBe(start);
  expect(await page.locator('.sample-select > strong').allTextContents()).toEqual(readings);
});

test('the 375 px States view avoids horizontal scrolling and leaves every sample reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/simulators/4.1.4');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  await expect(page.locator('.sample-select')).toHaveCount(3);
  for (let index = 0; index < 5; index += 1) {
    const link = page.locator('.playground-nav a').nth(index);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  }
  for (let index = 0; index < 4; index += 1) {
    const link = page.locator('.matter-subnav a').nth(index);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  }
  await page.locator('.matter-subnav a').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/playground-mobile.png', fullPage: true });
});

test('the Guide modal closes with Escape and returns focus to its trigger', async ({ page }) => {
  await page.goto('/#/simulators/4.1.4');
  const trigger = page.getByRole('button', { name: 'Open model notes and learning outcomes' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Matter' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
