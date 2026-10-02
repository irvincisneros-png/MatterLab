import { expect, test, type Page } from '@playwright/test';

/**
 * Unstirred coarse crystals dissolve slowly in the accelerated model. To reach equilibrium without
 * dozens of software-rendered Step clicks, use fine crystals with stirring, let playback run, then pause.
 */
async function playUntilSettled(page: Page) {
  await page.getByRole('button', { name: 'Fine' }).click();
  await page.getByRole('button', { name: 'Start stirring' }).click();
  await expect(page.locator('.slab-status')).not.toContainText('Still dissolving', { timeout: 45_000 });
  await page.getByRole('button', { name: 'Pause model' }).click();
  await page.getByRole('button', { name: 'Stop stirring' }).click();
}

async function browserSupportsWebGL(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return false;
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
}

test('dissolving keeps a live beaker and caps dissolved salt while the solid remainder stays visible', async ({ page }) => {
  test.setTimeout(80_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const supportsWebGL = await browserSupportsWebGL(page);
  await page.goto('/#/simulators/4.3.1');
  await expect(page.getByRole('heading', { name: 'Dissolving in water' })).toBeVisible();
  await expect(page.getByLabel('Solute', { exact: true })).toHaveValue('salt');
  if (supportsWebGL) {
    await expect(page.locator('.slab-canvas-wrap canvas')).toHaveCount(1);
    await expect(page.locator('.slab-canvas-wrap')).toHaveAttribute('data-graphics', 'ready');
  } else {
    await expect(page.getByRole('img', { name: /2D beaker: Sodium chloride/ })).toBeVisible();
    await expect(page.locator('.slab-canvas-wrap')).toHaveAttribute('data-graphics', 'fallback');
  }
  const scene = page.locator('.slab-canvas-wrap');
  await expect(scene).toHaveAttribute('data-particles', 'on');
  await expect(page.locator('.slab-stage-sample-tag')).toContainText('Next 5 g of NaCl');
  await page.getByRole('button', { name: 'Add 25 g' }).click();
  await page.getByRole('button', { name: 'Add 25 g' }).click();
  await playUntilSettled(page);
  const ledger = page.locator('.slab-mass-ledger');
  await expect(ledger).toContainText('Added = dissolved + undissolved');
  await expect(ledger).toContainText('36.0 g');
  await expect(page.locator('.slab-status')).toContainText('exact model solubility reading');
  await expect(page.locator('.slab-status')).toContainText('Saturated');
  expect(errors).toEqual([]);
});

test('stirring starts playback, pauses cleanly, advances on Step and stops the rod', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const supportsWebGL = await browserSupportsWebGL(page);
  await page.goto('/#/simulators/4.3.1');
  await expect(page.getByRole('heading', { name: 'Dissolving in water' })).toBeVisible();
  const scene = page.locator('.slab-canvas-wrap');
  if (supportsWebGL) {
    await expect(scene).toHaveAttribute('data-graphics', 'ready');
    await expect(scene.locator('canvas')).toHaveCount(1);
  } else {
    await expect(scene).toHaveAttribute('data-graphics', 'fallback');
  }

  const initialRodAngle = await scene.getAttribute('data-rod-angle');
  const initialModelTime = await scene.getAttribute('data-model-time');
  await page.getByRole('button', { name: 'Start stirring' }).click();
  await expect(scene).toHaveAttribute('data-stirring', 'on');
  if (supportsWebGL) await expect(scene).toHaveAttribute('data-graphics', 'ready');
  await expect(page.getByRole('button', { name: 'Pause model' })).toBeVisible();
  await expect.poll(() => scene.getAttribute('data-rod-angle')).not.toBe(initialRodAngle);
  await expect.poll(() => scene.getAttribute('data-model-time')).not.toBe(initialModelTime);

  await page.getByRole('button', { name: 'Pause model' }).click();
  const pausedRodAngle = await scene.getAttribute('data-rod-angle');
  const pausedModelTime = await scene.getAttribute('data-model-time');
  await page.waitForTimeout(150);
  await expect(scene).toHaveAttribute('data-rod-angle', pausedRodAngle ?? '');
  await expect(scene).toHaveAttribute('data-model-time', pausedModelTime ?? '');

  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect.poll(() => scene.getAttribute('data-rod-angle')).not.toBe(pausedRodAngle);
  await page.getByRole('button', { name: 'Stop stirring' }).click();
  await expect(scene).toHaveAttribute('data-stirring', 'off');
  await expect(scene).toHaveAttribute('data-rod-angle', '0');
  if (supportsWebGL) await expect(scene).toHaveAttribute('data-graphics', 'ready');
  expect(errors).toEqual([]);
});

test('10 g NaCl takes several seconds of playback to dissolve when stirred, and the model stays honest about acceleration', async ({ page }) => {
  test.setTimeout(80_000);
  await page.goto('/#/simulators/4.3.1');
  const scene = page.locator('.slab-canvas-wrap');
  await page.getByRole('button', { name: 'Add 5 g' }).click();
  await page.getByRole('button', { name: 'Add 5 g' }).click();
  await expect(page.locator('.slab-rate-note')).toContainText('accelerated');
  await page.getByRole('button', { name: 'Start stirring' }).click();
  await page.waitForTimeout(1500);
  const midTime = Number(await scene.getAttribute('data-model-time'));
  expect(midTime).toBeGreaterThan(0.5);
  await expect(page.locator('.slab-status')).toContainText('Still dissolving');
  await expect(page.locator('.slab-status')).toContainText('All added solute has dissolved', { timeout: 20_000 });
  expect(Number(await scene.getAttribute('data-model-time'))).toBeGreaterThanOrEqual(5);
});

test('solubility investigation records a lower bound first, then an equilibrium-with-excess measurement', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/simulators/4.3.2');
  await expect(page.getByRole('heading', { name: 'Solubility investigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Add 25 g' }).click();
  await playUntilSettled(page);
  await page.getByRole('button', { name: 'Record trial' }).click();
  const table = page.getByRole('table', { name: 'Recorded solubility trials' });
  await expect(table).toContainText('lower bound unsaturated');
  await expect(table).toContainText('≥ 25.0 g');

  await page.getByRole('button', { name: 'New trial' }).click();
  await page.getByRole('button', { name: 'Add 25 g' }).click();
  await page.getByRole('button', { name: 'Add 25 g' }).click();
  await playUntilSettled(page);
  await page.getByRole('button', { name: 'Record trial' }).click();
  await expect(table).toContainText('36.0 g · exact');
  await expect(page.getByRole('img', { name: /Solubility in grams per 100 grams water versus temperature/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('temperature and particle routes keep the fixed solvent and distinguish ions from whole sucrose molecules', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/simulators/4.3.3');
  await expect(page.getByRole('heading', { name: 'Temperature changes capacity' })).toBeVisible();
  const temperature = page.getByRole('slider', { name: 'Solution temperature' });
  await expect(temperature).toHaveValue('20');
  await page.getByLabel('Solute', { exact: true }).selectOption('sugar');
  await temperature.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.slab-apparatus-note')).toContainText('487.0 g / 100 g water');
  await page.locator('.slab-mode-tabs').getByRole('button', { name: /Particles/ }).click();
  await expect(page.getByRole('heading', { name: 'The particle model' })).toBeVisible();
  await page.getByLabel('Solute', { exact: true }).selectOption('potassium-chloride');
  await expect(page.locator('.slab-particle-panel')).toContainText('K⁺ ion');
  await page.getByLabel('Solute', { exact: true }).selectOption('salt');
  await expect(page.locator('.slab-particle-panel')).toContainText('Ions separate');
  await expect(page.locator('.slab-particle-panel')).toContainText('Na⁺ ion');
  await page.getByLabel('Solute', { exact: true }).selectOption('sugar');
  await expect(page.locator('.slab-particle-panel')).toContainText('Whole molecules spread out');
  await expect(page.locator('.slab-particle-panel')).toContainText('whole sucrose molecules');
  await expect(page.locator('.slab-canvas-wrap')).toHaveAttribute('data-particles', 'on');
  await page.locator('.slab-view-toggle').click();
  await expect(page.locator('.slab-canvas-wrap')).toHaveAttribute('data-particles', 'off');
});

test('matched comparison keeps concentration relative and the supersaturation challenge crystallises only after seeding', async ({ page }) => {
  await page.goto('/#/simulators/4.3.5');
  await expect(page.getByRole('heading', { name: 'Dilute to supersaturated' })).toBeVisible();
  await page.getByRole('button', { name: /Dilute/ }).click();
  await expect(page.locator('.slab-comparison-panel .slab-section-head')).toContainText('Less concentrated than Sample B');
  await expect(page.locator('.slab-status')).toContainText('Below saturation');
  await page.getByRole('button', { name: /Concentrated/ }).click();
  await expect(page.locator('.slab-comparison-panel .slab-section-head')).toContainText('More concentrated than Sample B');
  await expect(page.locator('.slab-status')).toContainText('Below saturation');

  await page.getByRole('button', { name: 'Try challenge' }).click();
  const temperature = page.getByRole('slider', { name: 'Solution temperature' });
  await temperature.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await expect(temperature).toHaveValue('20');
  await expect(page.locator('.slab-status')).toContainText('Supersaturated');
  await expect(page.locator('.slab-status')).toContainText('no crystals are present yet');
  await page.getByRole('button', { name: 'Add 0.2 g seed crystal' }).click();
  await expect(page.locator('.slab-challenge')).toContainText('Crystals grew');
  await expect(page.locator('.slab-status')).toContainText('Saturated');
});

test('unavailable WebGL leaves the labelled 2D model and measurement controls usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const prototype = HTMLCanvasElement.prototype as unknown as {
      getContext: (this: HTMLCanvasElement, contextId: string, options?: unknown) => RenderingContext | null;
    };
    const nativeGetContext = prototype.getContext;
    prototype.getContext = function (this: HTMLCanvasElement, contextId: string, options?: unknown) {
      if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl') return null;
      return nativeGetContext.call(this, contextId, options);
    };
  });
  await page.goto('/#/simulators/4.3.2');
  await expect(page.locator('.slab-canvas-wrap')).toHaveAttribute('data-graphics', 'fallback');
  await expect(page.getByRole('img', { name: /2D beaker/ })).toBeVisible();
  const waterDots = page.locator('.slab-fallback-water-molecule');
  await expect(waterDots).toHaveCount(0);
  await page.locator('.slab-view-toggle').click();
  await expect(waterDots).toHaveCount(12);
  await page.locator('.slab-view-toggle').click();
  await expect(waterDots).toHaveCount(0);
  await page.getByRole('button', { name: 'Add 5 g' }).click();
  await expect(page.locator('.slab-mass-ledger')).toContainText('5.0 g in');
  await expect(page.getByRole('button', { name: 'Record trial' })).toBeEnabled();
  expect(errors).toEqual([]);
});
