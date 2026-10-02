import { expect, test, type Page } from '@playwright/test';

async function browserSupportsWebGL(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!context) return false;
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
}

test('plasma conserves its charge ledger while reversing opposite live qE force cues', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const supportsWebGL = await browserSupportsWebGL(page);
  await page.goto('/#/advanced/plasma');

  await expect(page.getByRole('heading', { name: 'Hydrogen plasma' })).toBeVisible();
  const ledger = page.locator('.plasma-ledger');
  await expect(ledger).toContainText('net charge 0');
  if (supportsWebGL) {
    await expect(page.locator('.al-scene-wrap canvas')).toHaveCount(1);
    await expect(page.locator('.al-scene-wrap')).toHaveAttribute('data-graphics', 'ready');
  } else {
    await expect(page.getByRole('img', { name: /2D hydrogen plasma view/ })).toBeVisible();
    await expect(page.locator('.al-scene-wrap')).toHaveAttribute('data-graphics', 'fallback');
  }

  await page.getByRole('button', { name: 'Try a challenge' }).click();
  await page.getByRole('button', { name: 'Reverse electric field' }).click();
  await expect(page.locator('.al-force-note')).toContainText('H⁺ force ←');
  await expect(page.locator('.al-force-note')).toContainText('e⁻ force →');
  await expect(ledger).toContainText('net charge 0');
  await page.getByRole('button', { name: 'Reverse electric field' }).click();
  await expect(page.locator('.al-force-note')).toContainText('H⁺ force →');
  await expect(page.locator('.al-force-note')).toContainText('e⁻ force ←');
  await expect(page.locator('.al-challenge')).toContainText('completed');

  const energy = page.getByRole('slider', { name: 'Energy input' });
  await energy.focus();
  await page.keyboard.press('End');
  await expect(ledger).toContainText(/Positive ions H⁺\s*24/);
  await expect(ledger).toContainText(/Free electrons e⁻\s*24/);
  await expect(ledger).toContainText('net charge 0');
  await energy.press('Home');
  await expect(ledger).toContainText(/Neutral H\s*24/);
  await expect(ledger).toContainText(/Free electrons e⁻\s*0/);
  await expect(page.getByText('NEUTRAL GAS', { exact: true })).toBeVisible();
  await expect(page.locator('.al-scene-wrap')).toHaveAttribute('data-charge-forces', 'absent');
  await expect(page.locator('.al-force-note')).toContainText('No H⁺ present');
  await expect(page.locator('.al-force-note')).toContainText('No free e⁻ present');
  await expect(page.locator('.al-force-note')).toContainText('E →');
  await energy.press('End');
  await expect(page.getByText('IONISED GAS', { exact: true })).toBeVisible();
  await expect(page.locator('.al-scene-wrap')).toHaveAttribute('data-charge-forces', 'present');
  expect(pageErrors).toEqual([]);
});

test('cooling rubidium grows a bounded shared-state fraction and warming reverses the challenge', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/#/advanced/bec');
  await expect(page.getByRole('heading', { name: 'Ultracold rubidium' })).toBeVisible();
  const temperature = page.getByRole('slider', { name: 'Temperature' });
  await expect(temperature).toHaveValue('220');
  await expect(page.getByText('180 nK', { exact: false }).first()).toBeVisible();
  const ledger = page.locator('.bec-ledger');
  await expect(ledger).toContainText('48 schematic atom markers');

  await page.getByRole('button', { name: 'Try a challenge' }).click();
  await temperature.focus();
  await page.keyboard.press('Home');
  await expect(ledger).toContainText(/Shared quantum state\s*100%/);
  await temperature.press('End');
  await expect(ledger).toContainText(/Shared quantum state\s*0%/);
  await expect(page.locator('.al-challenge')).toContainText('completed');
  await expect(ledger).toContainText('total stays 48');
  expect(pageErrors).toEqual([]);
});

test('Beyond Three playback advances fixed model time in smooth 60 Hz steps', async ({ page }) => {
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
  await page.goto('/#/advanced/plasma');
  await page.getByRole('button', { name: 'Play model' }).click();
  const progress = await page.evaluate(() => new Promise<{ frames: number; modelSeconds: number }>((resolve) => {
    const root = document.querySelector('.advanced-lab');
    const values = new Set<string>();
    const started = performance.now();
    const sample = (now: number) => {
      const value = root?.getAttribute('data-model-time') ?? '0';
      values.add(value);
      if (now - started >= 450) {
        resolve({ frames: values.size, modelSeconds: Number(value) });
      } else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  await page.getByRole('button', { name: 'Pause model' }).click();
  expect(progress.frames).toBeGreaterThan(12);
  expect(progress.modelSeconds).toBeGreaterThan(0.3);
  expect(progress.modelSeconds).toBeLessThan(0.65);
});

test('the advanced lab retains its live 2D model when WebGL cannot start', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
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
  await page.goto('/#/advanced/plasma');
  await expect(page.locator('.al-scene-wrap')).toHaveAttribute('data-graphics', 'fallback');
  await expect(page.getByRole('img', { name: /2D hydrogen plasma view/ })).toBeVisible();
  const twoDimensionalRig = page.locator('.al-fallback-rig');
  await expect(twoDimensionalRig).not.toHaveClass(/is-reversed/);
  const energy = page.getByRole('slider', { name: 'Energy input' });
  await energy.focus();
  await page.keyboard.press('Home');
  await expect(page.locator('.al-field-line')).toBeVisible();
  await expect(page.locator('.al-force-plus')).toHaveCount(0);
  await expect(page.locator('.al-force-minus')).toHaveCount(0);
  await energy.press('End');
  await expect(page.locator('.al-force-plus')).toHaveCount(1);
  await expect(page.locator('.al-force-minus')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reverse electric field' }).click();
  await expect(twoDimensionalRig).toHaveClass(/is-reversed/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const markers = page.locator('.al-fallback-particle');
  const beforeStep = await markers.evaluateAll((elements) => elements.map((element) => element.getAttribute('style')).join('|'));
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect.poll(() => markers.evaluateAll((elements) => elements.map((element) => element.getAttribute('style')).join('|'))).not.toBe(beforeStep);
  await energy.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.plasma-ledger')).toContainText(/Positive ions H⁺\s*24/);
  await page.getByRole('button', { name: /Bose/ }).click();
  await expect(page.getByRole('img', { name: /2D rubidium-87 trap/ })).toBeVisible();
  await expect(page.locator('.al-scene-wrap')).toHaveAttribute('data-graphics', 'fallback');
  expect(pageErrors).toEqual([]);
});

test('the 375 px view keeps the advanced controls inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/advanced/bec');
  await expect(page.getByRole('slider', { name: 'Temperature' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset experiment' })).toBeVisible();
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(375);
  const bounds = await page.locator('.advanced-lab').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
});
