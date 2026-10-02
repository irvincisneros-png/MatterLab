import { expect, test } from '@playwright/test';

const ledgerValue = (page: import('@playwright/test').Page, phase: 'Ice' | 'Liquid water' | 'Water vapour') =>
  page.locator('.cl-ledger-row').filter({ hasText: phase }).locator('.cl-ledger-label b');

test('melting and freezing follow the verified latent-heat path and conserve the water ledger', async ({ page }) => {
  await page.goto('/#/changes/melting');
  await expect(page.getByRole('heading', { name: 'Melting' })).toBeVisible();
  await expect(page.locator('.cl-temp-orb')).toHaveText('-20 °C');
  const heat = page.getByRole('button', { name: /Heat/ });
  await heat.click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('0 °C');
  await heat.click();
  await expect(page.locator('.cl-ledger')).toContainText('Ice');
  await expect(page.locator('.cl-ledger')).toContainText('Liquid water');
  await expect(page.locator('.cl-ledger-foot')).toContainText('total stays 200 g');

  await page.getByRole('button', { name: /Freezing/ }).click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('22 °C');
  const cool = page.getByRole('button', { name: /Cool/ });
  await cool.click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('10 °C');
  await cool.click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('0 °C');
  expect(await ledgerValue(page, 'Ice').innerText()).not.toBe('0.0 g');
  expect(await ledgerValue(page, 'Liquid water').innerText()).not.toBe('0 g');
});

test('evaporation stays below boiling while the boiling control uses the 100 °C energy plateau', async ({ page }) => {
  await page.goto('/#/changes/vaporisation');
  await expect(page.locator('.cl-temp-orb')).toHaveText('24 °C');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  expect(Number.parseFloat((await ledgerValue(page, 'Water vapour').innerText()).replace(' g', ''))).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Boiling/ }).click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('92 °C');
  await page.getByRole('button', { name: /Heat/ }).click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('100 °C');
  await expect(page.locator('.cl-control-panel')).toContainText('Temperature holds at 100 °C');
});

test('condensation, sublimation and deposition use their correct reservoirs', async ({ page }) => {
  await page.goto('/#/changes/condensation');
  await expect(ledgerValue(page, 'Water vapour')).toHaveText('200 g');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  expect(Number.parseFloat((await ledgerValue(page, 'Liquid water').innerText()).replace(' g', ''))).toBeGreaterThan(0);

  await page.getByRole('button', { name: /Sublimation/ }).click();
  await expect(ledgerValue(page, 'Liquid water')).toHaveText('0.0 g');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  expect(Number.parseFloat((await ledgerValue(page, 'Water vapour').innerText()).replace(' g', ''))).toBeGreaterThan(0);
  await page.getByLabel('Relative humidity of nearby air').fill('100');
  await expect(page.locator('.cl-scene-badge')).toContainText('Water vapour → Ice');
  const vapourBeforeReverse = await ledgerValue(page, 'Water vapour').innerText();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  expect(Number.parseFloat((await ledgerValue(page, 'Water vapour').innerText()).replace(' g', ''))).toBeLessThan(Number.parseFloat(vapourBeforeReverse.replace(' g', '')));

  await page.getByRole('button', { name: /Deposition/ }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  expect(Number.parseFloat((await ledgerValue(page, 'Ice').innerText()).replace(' g', ''))).toBeGreaterThan(0);
  await expect(ledgerValue(page, 'Liquid water')).toHaveText('0.0 g');
});

test('the optional prediction requires a correct choice followed by an actual model change', async ({ page }) => {
  await page.goto('/#/changes/vaporisation');
  await page.getByRole('button', { name: 'Try a prediction' }).click();
  await page.getByRole('button', { name: 'More humid air' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect(page.locator('.cl-challenge-title')).not.toContainText('explored');
  await page.getByRole('button', { name: 'Drier air' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect(page.locator('.cl-challenge-title')).toContainText('explored');

  await page.getByRole('button', { name: /Boiling/ }).click();
  await expect(page.locator('.cl-challenge')).toContainText('What lets boiling continue at 100 °C?');
  await page.getByRole('button', { name: 'Add heat', exact: true }).click();
  await page.getByRole('button', { name: /Heat/ }).click();
  await expect(page.locator('.cl-challenge-title')).toContainText('explored');
});

test('Change Station playback advances fixed model time in smooth 60 Hz steps', async ({ page }) => {
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
  await page.goto('/#/changes/melting');
  await page.getByRole('button', { name: 'Play model' }).click();
  const progress = await page.evaluate(() => new Promise<{ frames: number; modelSeconds: number }>((resolve) => {
    const root = document.querySelector('.change-lab');
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

test('WebGL state is checked independently and its 2D recovery view stays interactive', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/changes/melting');
  const available = await page.evaluate(() => {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!context) return false;
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
  if (available) {
    await expect(page.locator('[data-graphics="ready"] canvas')).toHaveCount(1);
    await expect(page.locator('.cl-2d-equivalent')).toHaveCount(0);
  } else {
    await expect(page.locator('.cl-2d-equivalent')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try 3D again' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect(page.locator('.cl-ledger-foot')).toContainText('total stays 200 g');
  expect(errors).toEqual([]);
});

test('the 3D state-change vessel has an accessible apparatus description', async ({ page }) => {
  await page.goto('/#/changes/melting');
  await expect(page.locator('.cl-scene-wrap')).not.toHaveAttribute('data-graphics', 'starting');
  const canvas = page.locator('.cl-scene-wrap canvas');
  if (await canvas.count()) {
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', /graduated glass beaker and controlled hotplate/i);
  } else {
    await expect(page.locator('.cl-2d-equivalent')).toBeVisible();
  }
});

test('lost WebGL context enters the usable fallback and can recover to 3D', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/changes/condensation');
  // The lab is lazy-loaded: wait for its renderer to settle before deciding whether WebGL started.
  await expect(page.locator('[data-graphics]').first()).not.toHaveAttribute('data-graphics', 'starting', { timeout: 15_000 });
  const canvas = page.locator('[data-graphics="ready"] canvas');
  test.skip(await canvas.count() === 0, 'This browser did not start a WebGL scene.');
  const canLoseContext = await canvas.evaluate((element) => {
    const drawingBuffer = element as HTMLCanvasElement;
    const context = drawingBuffer.getContext('webgl2') ?? drawingBuffer.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  test.skip(!canLoseContext, 'This browser does not expose WEBGL_lose_context.');
  await expect(page.locator('.cl-2d-equivalent')).toBeVisible();
  await expect(page.locator('.cl-fallback-molecule')).toHaveCount(18);
  await page.getByRole('button', { name: 'Try 3D again' }).click();
  await expect(page.locator('[data-graphics="ready"] canvas')).toHaveCount(1);
  await expect(page.locator('.cl-2d-equivalent')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reduced motion and keyboard controls leave the state and controls usable', async ({ browser, page }) => {
  await page.goto('/#/changes/melting');
  const region = page.getByRole('region', { name: 'MatterLab Change Station' });
  await region.focus();
  await page.keyboard.press('h');
  await expect(page.locator('.cl-energy-readout')).toContainText('1.6 kJ');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause model' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset this change' }).click();
  await expect(page.locator('.cl-temp-orb')).toHaveText('-20 °C');

  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto('/#/changes/melting');
  await expect(reducedPage.locator('.change-lab')).toHaveAttribute('data-reduced-motion', 'true');
  const before = await reducedPage.locator('.cl-ledger-row .cl-ledger-label b').allTextContents();
  await reducedPage.waitForTimeout(250);
  expect(await reducedPage.locator('.cl-ledger-row .cl-ledger-label b').allTextContents()).toEqual(before);
  await reducedPage.getByRole('button', { name: /Vaporisation/ }).click();
  await reducedPage.getByRole('button', { name: 'Advance model one second' }).click();
  expect(Number.parseFloat((await ledgerValue(reducedPage, 'Water vapour').innerText()).replace(' g', ''))).toBeGreaterThan(0);
  await reduced.close();
});

test('the 375 px layout fits the viewport and all six transition controls remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/changes/melting');
  await expect(page.getByRole('navigation', { name: 'Choose a change of state' }).getByRole('button')).toHaveCount(6);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: /Deposition/ }).click();
  await expect(page.getByRole('heading', { name: 'Deposition' })).toBeVisible();
});

test('forced WebGL loss selects the complete 2D equivalent without effectful Canvas fallbacks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
      getContext: (this: HTMLCanvasElement, contextId: string, options?: unknown) => RenderingContext | null;
    };
    const nativeGetContext = canvasPrototype.getContext;
    canvasPrototype.getContext = function (this: HTMLCanvasElement, contextId: string, options?: unknown) {
      if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl') return null;
      return nativeGetContext.call(this, contextId, options);
    };
  });
  await page.goto('/#/changes/sublimation');
  await expect(page.locator('.cl-2d-equivalent')).toBeVisible();
  await expect(page.locator('.cl-2d-equivalent')).toContainText('2D science view');
  await expect(page.locator('.cl-fallback-molecule')).toHaveCount(18);
  await expect(ledgerValue(page, 'Liquid water')).toHaveText('0.0 g');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  expect(Number.parseFloat((await ledgerValue(page, 'Water vapour').innerText()).replace(' g', ''))).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the hot plate only glows while energy is being added and shows a cool state when cooling', async ({ page }) => {
  await page.goto('/#/simulators/4.1.3');
  const wrap = page.locator('.cl-scene-wrap');
  await expect(wrap).toHaveAttribute('data-heater', 'idle');
  await expect(page.locator('.cl-heater-chip')).toHaveText('Hot plate off');
  await page.getByRole('button', { name: /Heat/ }).first().click();
  await expect(wrap).toHaveAttribute('data-heater', 'heating');
  await expect(page.locator('.cl-heater-chip')).toContainText('adding energy');
  await expect(wrap).toHaveAttribute('data-heater', 'idle', { timeout: 5000 });
  await page.getByRole('button', { name: /Cool/ }).first().click();
  await expect(wrap).toHaveAttribute('data-heater', 'cooling');
  await expect(wrap).toHaveAttribute('data-heater', 'idle', { timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.locator('.change-lab').focus();
  await page.keyboard.press('h');
  await expect(wrap).toHaveAttribute('data-heater', 'heating');
  await page.getByRole('button', { name: 'Reset this change' }).click();
  await expect(wrap).toHaveAttribute('data-heater', 'idle');
});
