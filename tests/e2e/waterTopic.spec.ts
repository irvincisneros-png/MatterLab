import { expect, test } from '@playwright/test';

async function setSlider(page: import('@playwright/test').Page, label: string, target: number) {
  const slider = page.getByRole('slider', { name: label });
  const min = Number(await slider.getAttribute('min'));
  const max = Number(await slider.getAttribute('max'));
  const step = Number(await slider.getAttribute('step')) || 1;
  const fromMin = Math.round((target - min) / step);
  const fromMax = Math.round((max - target) / step);
  const fromLowerEnd = fromMin <= fromMax;
  await slider.press(fromLowerEnd ? 'Home' : 'End');
  let current = Number(await slider.inputValue());
  let coarseSteps = 0;
  while (Math.abs(target - current) > step * 2 && coarseSteps < 30) {
    const before = current;
    await slider.press(fromLowerEnd ? 'PageUp' : 'PageDown');
    current = Number(await slider.inputValue());
    coarseSteps += 1;
    if (current === before || (fromLowerEnd ? current > target : current < target)) break;
  }
  let fineSteps = 0;
  while (Math.abs(target - current) > step / 2 && fineSteps < 120) {
    const before = current;
    await slider.press(current < target ? 'ArrowRight' : 'ArrowLeft');
    current = Number(await slider.inputValue());
    fineSteps += 1;
    if (current === before) break;
  }
  expect(current).toBeCloseTo(target, 6);
}

test('direct water-cycle route closes the Earth-movement outcome and keeps one conserved sample', async ({ page }) => {
  await page.goto('/#/simulators/4.1.1');
  await expect(page.locator('.wt-header h1')).toHaveText('Water cycle');
  await expect(page.getByRole('navigation', { name: 'Choose a water investigation' })).toContainText('4.1.1');
  await expect(page.locator('.wt-pool-heading')).toContainText('1.00 kg total');
  await expect(page.getByText('Water vapour (invisible)')).toBeVisible();
  await expect(page.getByText('Cloud droplets')).toBeVisible();

  await setSlider(page, 'Sun heating', 100);
  await page.getByRole('button', { name: 'Start precipitation' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect(page.locator('.wt-pool-heading')).toContainText('1.00 kg total');
  const cloudStart = Number.parseFloat((await page.locator('.wt-pool-row').filter({ hasText: 'Cloud droplets' }).locator('b').innerText()).replace(' g', ''));
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  const cloudAfter = Number.parseFloat((await page.locator('.wt-pool-row').filter({ hasText: 'Cloud droplets' }).locator('b').innerText()).replace(' g', ''));
  expect(cloudAfter).toBeLessThan(cloudStart);
  await expect(page.locator('.wt-pool-heading')).toContainText('1.00 kg total');
});

test('heating investigation records instrument readings against fixed model time and latent-heat plateaux', async ({ page }) => {
  await page.goto('/#/simulators/4.1.2');
  await expect(page.locator('.wt-header h1')).toHaveText('Heating water');
  await expect(page.locator('.wt-scene-hud')).toContainText('-20 °C');
  await page.getByLabel('Thermometer', { exact: true }).selectOption('glass-thermometer');
  await setSlider(page, 'Heater power', 2);
  await page.getByRole('button', { name: 'Record thermometer reading' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect(page.locator('.wt-scene-hud')).toContainText('0 °C');
  await page.getByRole('button', { name: 'Record thermometer reading' }).click();
  await expect(page.locator('.wt-table-card tbody tr').nth(1).locator('td').nth(2)).toHaveText('0');
  await expect(page.locator('.wt-table-card')).toContainText('phase change');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect(page.locator('.wt-scene-hud')).toContainText('0 °C');
  await expect(page.locator('.wt-heating-graph')).toBeVisible();
  await expect(page.locator('.wt-results-note')).toContainText('Actual model time is in seconds');
});

test('properties keep density, buoyancy and surface tension as three distinct investigations', async ({ page }) => {
  await page.goto('/#/simulators/4.2.1');
  await expect(page.locator('.wt-header h1')).toHaveText('Water properties');
  await expect(page.locator('.wt-density-compare')).toContainText('highest');
  await setSlider(page, 'Water temperature for density', 4);
  await page.getByRole('button', { name: 'Buoyancy' }).click();
  await setSlider(page, 'Object mass for buoyancy', 0.75);
  await expect(page.locator('.wt-property-reading')).toContainText('Sinks');

  await setSlider(page, 'Outside displaced volume', 500);
  await setSlider(page, 'Object mass for buoyancy', 0.5);
  await expect(page.locator('.wt-property-reading')).toContainText('Neutral');

  await page.getByRole('button', { name: 'Surface tension' }).click();
  await page.getByRole('button', { name: 'Place gently' }).click();
  await expect(page.locator('.wt-property-reading')).toContainText('stays at the surface');
  await page.getByRole('button', { name: 'Push below' }).click();
  await expect(page.locator('.wt-property-reading')).toContainText('sinks');
  await page.getByRole('button', { name: 'Place gently' }).click();
  await page.getByRole('button', { name: 'Add a detergent drop' }).click();
  await expect(page.locator('.wt-property-reading')).toContainText('sinks');
});

test('liquid density requires tare and a nonzero meniscus reading, then records two SI comparisons', async ({ page }) => {
  await page.goto('/#/simulators/4.2.2');
  await expect(page.locator('.wt-header h1')).toHaveText('Density of liquids');
  await setSlider(page, 'Liquid sample volume', 0);
  await page.getByRole('button', { name: 'Tare empty sample cup' }).click();
  await expect(page.getByRole('button', { name: 'Read cylinder volume' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Read sample mass' })).toBeDisabled();

  await page.getByLabel('Mass measuring equipment').selectOption('ruler');
  await expect(page.locator('.wt-device-warning')).toContainText('cannot measure mass');
  await expect(page.getByRole('button', { name: 'Select a balance to tare' })).toBeDisabled();
  await page.getByLabel('Mass measuring equipment').selectOption('balance');
  await page.getByLabel('Volume measuring equipment').selectOption('beaker');
  await setSlider(page, 'Liquid sample volume', 100);
  for (let index = 0; index < 5; index += 1) await page.getByRole('slider', { name: 'Liquid sample volume' }).press('ArrowLeft');
  await page.getByRole('button', { name: 'Tare empty sample cup' }).click();
  await page.getByRole('button', { name: 'Read beaker volume' }).click();
  await page.getByRole('button', { name: 'Read sample mass' }).click();
  await expect(page.locator('.wt-measurement-result')).toContainText('Calculated density');
  await page.getByRole('button', { name: 'Record this result' }).click();
  await page.getByLabel('Liquid sample', { exact: true }).selectOption('ethanol20C');
  await page.getByRole('button', { name: 'Read beaker volume' }).click();
  await page.getByRole('button', { name: 'Read sample mass' }).click();
  await page.getByRole('button', { name: 'Record this result' }).click();
  await expect(page.locator('.wt-results-panel')).toContainText('Pure water');
  await expect(page.locator('.wt-results-panel')).toContainText('Pure ethanol');
  await expect(page.locator('.wt-results-panel')).toContainText('100 mL beaker · 10 mL');
  await expect(page.locator('.wt-results-panel')).toContainText('998.2');
  await expect(page.locator('.wt-results-panel')).toContainText('789.4');
});

test('a coarse beaker reading changes calculated density without changing the balance mass of the same fill', async ({ page }) => {
  await page.goto('/#/simulators/4.2.2');
  await setSlider(page, 'Liquid sample volume', 47);
  await page.getByRole('button', { name: 'Tare empty sample cup' }).click();
  await page.getByRole('button', { name: 'Read cylinder volume' }).click();
  await page.getByRole('button', { name: 'Read sample mass' }).click();
  await expect(page.getByRole('button', { name: 'Volume recorded · 47 mL' })).toBeVisible();
  await expect(page.locator('.wt-measurement-result')).toContainText('46.9 g');
  await page.getByRole('button', { name: 'Record this result' }).click();

  await page.getByLabel('Volume measuring equipment').selectOption('beaker');
  await page.getByRole('button', { name: 'Read beaker volume' }).click();
  await page.getByRole('button', { name: 'Read sample mass' }).click();
  await expect(page.getByRole('button', { name: 'Volume recorded · 50 mL' })).toBeVisible();
  await expect(page.locator('.wt-measurement-result')).toContainText('46.9 g');
  await expect(page.locator('.wt-measurement-result')).toContainText('938');
  await page.getByRole('button', { name: 'Record this result' }).click();

  const rows = page.locator('.wt-results-panel tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('47 mL');
  await expect(rows.nth(1)).toContainText('50 mL');
  await expect(rows.nth(0)).toContainText('46.9 g');
  await expect(rows.nth(1)).toContainText('46.9 g');
});

test('regular-object dimensions and irregular-object displacement produce recorded density rows', async ({ page }) => {
  await page.goto('/#/simulators/4.2.3');
  await expect(page.locator('.wt-header h1')).toHaveText('Density of objects');
  await page.getByRole('button', { name: 'Tare the balance' }).click();
  await page.getByRole('button', { name: 'Measure three sides with the ruler' }).click();
  await page.getByRole('button', { name: 'Weigh the sample' }).click();
  await page.getByRole('button', { name: 'Calculate density' }).click();
  await expect(page.locator('.wt-measurement-result')).toContainText('2.70 g/cm³');
  await page.getByRole('button', { name: 'Record table row' }).click();

  await page.getByRole('button', { name: 'Irregular object' }).click();
  await page.getByLabel('Object sample type').selectOption('brass');
  await page.getByRole('button', { name: 'Weigh the sample' }).click();
  await page.getByRole('button', { name: 'Read initial meniscus (50 mL)' }).click();
  await page.getByRole('button', { name: 'Lower sample into water' }).click();
  await page.getByRole('button', { name: 'Read final meniscus' }).click();
  await page.getByRole('button', { name: 'Calculate density' }).click();
  await expect(page.locator('.wt-measurement-result')).toContainText('8.39 g/cm³');
  await page.getByRole('button', { name: 'Record table row' }).click();
  await expect(page.locator('.wt-results-panel')).toContainText('Regular block');
  await expect(page.locator('.wt-results-panel')).toContainText('Irregular sample');
  await expect(page.locator('.wt-results-panel')).toContainText('8390.9');
});

test('the live apparatus exposes a concise text description of its measurement geometry', async ({ page }) => {
  await page.goto('/#/simulators/4.2.2');
  await expect(page.locator('.wt-scene-wrap')).not.toHaveAttribute('data-graphics', 'starting', { timeout: 30000 });
  const canvas = page.locator('.wt-scene-wrap canvas');
  if (await canvas.count()) {
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', /graduated cylinder beside a digital balance/i);
  } else {
    await expect(page.locator('.wt-fallback')).toBeVisible();
  }

  await page.getByRole('button', { name: /Heating water/ }).click();
  if (await canvas.count()) await expect(canvas).toHaveAttribute('aria-label', /hot plate.*thermometer probe/i);
});

test('cycle and heating direct links also recover as accessible 2D models when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (this: HTMLCanvasElement, id: string, options?: unknown) => RenderingContext | null };
    const native = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, id: string, options?: unknown) {
      if (id === 'webgl2' || id === 'webgl' || id === 'experimental-webgl') return null;
      return native.call(this, id, options);
    };
  });
  await page.goto('/#/simulators/4.1.1');
  await expect(page.locator('.wt-fallback')).toBeVisible();
  await expect(page.locator('.wt-fallback-dot')).toHaveCount(18);
  await expect(page.getByRole('button', { name: 'Advance model one second' })).toBeVisible();
  await page.getByRole('button', { name: /Heating water/ }).click();
  await expect(page.locator('.wt-fallback')).toBeVisible();
  await expect(page.locator('.wt-scene-hud')).toContainText('°C');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await expect(page.locator('.wt-live-message')).toContainText('Advanced');
});

test('browser WebGL availability is probed independently of the Water scene fallback', async ({ page }) => {
  await page.goto('/#/simulators/4.1.1');
  const supported = await page.evaluate(() => {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
  if (supported) {
    await expect(page.locator('.wt-scene-wrap canvas')).toHaveCount(1);
    await expect(page.locator('.wt-scene-wrap')).toHaveAttribute('data-graphics', 'ready');
    await expect(page.locator('.wt-fallback')).toHaveCount(0);
  } else {
    await expect(page.locator('.wt-fallback')).toBeVisible();
    await expect(page.locator('.wt-retry-graphics')).toBeVisible();
  }
});

test('lost Water scene WebGL context offers an interactive 2D model and a 3D retry', async ({ page }) => {
  await page.goto('/#/simulators/4.1.1');
  // The lab is lazy-loaded: wait for its renderer to settle before deciding whether WebGL started.
  await expect(page.locator('[data-graphics]').first()).not.toHaveAttribute('data-graphics', 'starting', { timeout: 15_000 });
  const canvas = page.locator('.wt-scene-wrap canvas');
  test.skip(await canvas.count() === 0, 'This browser did not start WebGL.');
  const lossSupported = await canvas.evaluate((element) => {
    const drawingBuffer = element as HTMLCanvasElement;
    const context = drawingBuffer.getContext('webgl2') ?? drawingBuffer.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  test.skip(!lossSupported, 'This browser does not expose WEBGL_lose_context.');
  await expect(page.locator('.wt-fallback')).toBeVisible();
  await expect(page.locator('.wt-fallback-dot')).toHaveCount(18);
  await page.getByRole('button', { name: 'Retry 3D view' }).click();
  await expect(page.locator('.wt-scene-wrap')).toHaveAttribute('data-graphics', 'ready');
  await expect(page.locator('.wt-scene-wrap canvas')).toHaveCount(1);
});

test('375 px view keeps all five Water outcomes inside the viewport and direct selections work', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/simulators/4.1.1');
  await expect(page.getByRole('navigation', { name: 'Choose a water investigation' }).getByRole('button')).toHaveCount(5);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: /Density of objects/ }).click();
  await expect(page.locator('.wt-header h1')).toHaveText('Density of objects');
});

test('water cycle legend separates visible clouds from invisible vapour, and the particle view toggles without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/#/simulators/4.1.1');
  await expect(page.locator('.wt-scene-wrap')).not.toHaveAttribute('data-graphics', 'starting', { timeout: 30000 });
  const legend = page.getByRole('list', { name: 'Clouds compared with water vapour' });
  if (await page.locator('.wt-scene-wrap canvas').count()) {
    await expect(legend).toContainText('droplets and ice crystals');
    await expect(legend).toContainText('Invisible');
  }
  const toggle = page.getByRole('button', { name: /Particles (on|off)/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Advance model one second' }).click();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(errors.filter((text) => !/WebGL|GPU stall|swiftshader/i.test(text))).toEqual([]);
});

test('object-density apparatus follows the procedure: weigh on the pan, ruler measurement, displacement in the cylinder', async ({ page }) => {
  await page.goto('/#/simulators/4.2.3');
  await page.getByRole('button', { name: 'Tare the balance' }).click();
  await page.getByRole('button', { name: 'Weigh the sample' }).click();
  await page.getByRole('button', { name: 'Measure three sides with the ruler' }).click();
  await expect(page.getByRole('button', { name: 'Dimensions measured' })).toBeVisible();
  await page.getByRole('button', { name: 'Irregular object' }).click();
  await page.getByRole('button', { name: 'Read initial meniscus (50 mL)' }).click();
  await page.getByRole('button', { name: 'Lower sample into water' }).click();
  await page.getByRole('button', { name: 'Read final meniscus' }).click();
  await expect(page.getByRole('button', { name: 'Final level · 64.0 mL' })).toBeVisible();
  const toggle = page.getByRole('button', { name: /Particles (on|off)/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
