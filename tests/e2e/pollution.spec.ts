import { expect, test, type Page } from '@playwright/test';

async function browserSupportsWebGL(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return false;
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
}

test('pollution inputs occupy distinct locations and filtering improves clarity but leaves dissolved salt', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const supportsWebGL = await browserSupportsWebGL(page);
  await page.goto('/#/simulators/4.5.1');
  await expect(page.getByRole('heading', { name: 'What stays in the water?' })).toBeVisible();
  if (supportsWebGL) {
    await expect(page.locator('.plab-canvas-wrap canvas')).toHaveCount(1);
    await expect(page.locator('.plab-canvas-wrap')).toHaveAttribute('data-graphics', 'ready');
  } else {
    await expect(page.getByRole('img', { name: /2D water body/ })).toBeVisible();
    await expect(page.locator('.plab-canvas-wrap')).toHaveAttribute('data-graphics', 'fallback');
  }

  await page.getByRole('button', { name: 'Add 8 grams Sediment' }).click();
  await page.getByRole('button', { name: 'Add 8 grams Sediment' }).click();
  await page.getByRole('button', { name: 'Add 8 grams Sediment' }).click();
  await page.getByRole('button', { name: 'Add 8 grams Sediment' }).click();
  const clarityBeforeSalt = await page.locator('.plab-readouts > div').first().locator('b').textContent();
  await page.getByRole('button', { name: 'Add 3 grams Dissolved salt' }).click();
  await page.getByRole('button', { name: 'Add 3 grams Dissolved salt' }).click();
  await page.getByRole('button', { name: 'Add 3 grams Dissolved salt' }).click();
  await page.getByRole('button', { name: 'Add 3 grams Dissolved salt' }).click();
  await expect(page.locator('.plab-readouts > div').first().locator('b')).toHaveText(clarityBeforeSalt ?? '');
  await expect(page.locator('.plab-readouts > div').nth(1)).toContainText('12.0 g');

  await page.getByLabel('Planned treatment').selectOption('filter');
  await page.getByRole('button', { name: 'Apply Filter suspended sediment' }).click();
  await expect(page.locator('.plab-readouts > div').first().locator('b')).toContainText('95');
  await expect(page.locator('.plab-readouts > div').nth(1)).toContainText('12.0 g');
  await expect(page.locator('.plab-pollutant-ledger')).toContainText('waste 30.1 g');
  await expect(page.locator('.plab-clarity-note')).toContainText('Appearance is not a safety test');
  expect(errors).toEqual([]);
});

test('matched samples support repeatable trials and the challenge verifies filtering then distillation', async ({ page }) => {
  await page.goto('/#/simulators/4.5.1');
  await page.getByRole('button', { name: 'Load matched sample' }).click();
  await expect(page.locator('.plab-pollutant-ledger')).toContainText('58.0 g remains');
  await page.getByLabel('Trial hypothesis').fill('Filtering traps sediment but leaves the dissolved salt.');
  await page.getByLabel('Planned treatment').selectOption('filter');
  await page.getByRole('button', { name: 'Apply Filter suspended sediment' }).click();
  await page.getByRole('button', { name: 'Record results' }).click();
  const results = page.getByRole('table', { name: 'Controlled treatment trials' });
  await expect(results).toContainText('Filter suspended sediment');
  await expect(results).toContainText('Filtering traps sediment but leaves the dissolved salt.');
  await expect(page.locator('.plab-ledger-row.salt')).toContainText('12.0 g in body');

  await page.getByRole('button', { name: /Try it/ }).click();
  await expect(page.locator('.plab-pollutant-ledger')).toContainText('58.0 g remains');
  await page.getByLabel('Planned treatment').selectOption('filter');
  await page.getByRole('button', { name: 'Apply Filter suspended sediment' }).click();
  await expect(page.locator('.plab-challenge')).toContainText('12.0 g salt still present');
  await page.getByLabel('Planned treatment').selectOption('distill');
  await page.getByRole('button', { name: 'Apply Distil and recover water' }).click();
  await expect(page.locator('.plab-challenge')).toContainText('Salt moved to waste; water recovery is recorded.');
  await expect(page.locator('.plab-water-ledger')).toContainText(/Recovered\s+893 mL/);
  await expect(page.locator('.plab-water-ledger')).toContainText(/Waste water\s+107 mL/);
});

test('a WebGL failure leaves a labelled 2D view and working pollutant ledger', async ({ page }) => {
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
  await page.goto('/#/simulators/4.5.1');
  await expect(page.locator('.plab-canvas-wrap')).toHaveAttribute('data-graphics', 'fallback');
  await expect(page.getByRole('img', { name: /2D water body/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add 2 grams Heavy oil film' }).click();
  await expect(page.locator('.plab-pollutant-ledger')).toContainText('2.0 g');
  expect(errors).toEqual([]);
});

test('the 375 px water investigation fits without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/simulators/4.5.1');
  await expect(page.getByRole('button', { name: 'Load matched sample' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply Skim surface oil' })).toBeVisible();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(375);
  const bounds = await page.locator('.pollution-lab').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
});

test('the 3D water body names where each pollutant is and keeps the four outputs separate', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/simulators/4.5.1');
  test.skip(!(await browserSupportsWebGL(page)), 'needs WebGL');
  const canvas = page.locator('.plab-canvas-wrap canvas');
  await expect(page.locator('.plab-canvas-wrap')).toHaveAttribute('data-graphics', 'ready');
  await expect(canvas).toHaveAttribute('aria-label', /no pollutant added/);
  await expect(canvas).not.toHaveAttribute('aria-label', 'Interactive polluted water body');

  await page.getByRole('button', { name: 'Load matched sample' }).click();
  await expect(canvas).toHaveAttribute('aria-label', /6\.0 g oil film on the surface, 8\.0 g litter floating, 32\.0 g sediment suspended in the water, 12\.0 g dissolved salt, invisible/);
  await page.getByLabel('Planned treatment').selectOption('filter');
  await page.getByRole('button', { name: 'Apply Filter suspended sediment' }).click();
  await expect(canvas).toHaveAttribute('aria-label', /Last treatment: Filter suspended sediment.*Waste 30\.1 g of pollutant/);
  await expect(canvas).toHaveAttribute('aria-label', /Looking clear is not a safety test/);

  // The four places pollution can end up are labelled in the scene.
  for (const tag of ['body', 'water', 'material', 'waste']) await expect(page.locator(`.plab-tag[data-tag="${tag}"]`)).toBeVisible();
  await expect(page.locator('.plab-tag[data-tag="body"]')).toContainText('Water body');
  await expect(page.locator('.plab-tag[data-tag="waste"]')).toContainText('30.1 g');
  await expect(page.locator('.plab-tag[data-tag="water"]')).toContainText('Recovered water');

  // Dissolved salt is invisible unless particle view shows its ions.
  await expect(page.locator('.plab-scene-key')).not.toContainText('Na');
  await page.getByRole('button', { name: /Particle view/ }).click();
  await expect(page.locator('.plab-scene-key')).toContainText('Na⁺');
  await expect(canvas).toHaveAttribute('aria-label', /sodium and chloride ions in particle view/);

  // Clear-looking recovered water is never presented as safe.
  await page.getByLabel('Planned treatment').selectOption('decant');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await page.getByRole('button', { name: 'Apply Decant clear water after settling' }).click();
  await expect(page.locator('.plab-tag[data-tag="water"]')).toContainText(/dissolved salt|not safe to drink/);
  expect(errors).toEqual([]);
});

test('the 2D fallback describes the same state', async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = HTMLCanvasElement.prototype as unknown as { getContext: (this: HTMLCanvasElement, id: string, options?: unknown) => RenderingContext | null };
    const native = prototype.getContext;
    prototype.getContext = function (this: HTMLCanvasElement, id: string, options?: unknown) {
      if (id === 'webgl2' || id === 'webgl' || id === 'experimental-webgl') return null;
      return native.call(this, id, options);
    };
  });
  await page.goto('/#/simulators/4.5.1');
  await page.getByRole('button', { name: 'Load matched sample' }).click();
  const fallback = page.getByRole('img', { name: /2D water body/ });
  await expect(fallback).toHaveAttribute('aria-label', /6\.0 g oil film on the surface/);
  await expect(page.locator('.plab-fallback-outputs')).toContainText('Recovered water');
  await expect(page.locator('.plab-fallback-outputs')).toContainText('Waste');
});
