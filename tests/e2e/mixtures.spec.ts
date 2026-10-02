import { expect, test, type Page } from '@playwright/test';

async function setSlider(page: Page, label: string, target: number) {
  const slider = page.getByRole('slider', { name: label });
  const min = Number(await slider.getAttribute('min'));
  const max = Number(await slider.getAttribute('max'));
  const step = Number(await slider.getAttribute('step')) || 1;
  const fromMin = Math.round((target - min) / step);
  const fromMax = Math.round((max - target) / step);
  if (fromMin <= fromMax) {
    await slider.press('Home');
    for (let index = 0; index < fromMin; index += 1) await slider.press('ArrowRight');
  } else {
    await slider.press('End');
    for (let index = 0; index < fromMax; index += 1) await slider.press('ArrowLeft');
  }
}

const directRoutes = [
  ['4.1.1', '.water-topic-lab', 'Water cycle', 'Water'],
  ['4.1.2', '.water-topic-lab', 'Heating water', 'Water'],
  ['4.1.3', '.change-lab', 'Melting', 'Matter'],
  ['4.1.4', '.playground-hero', 'States of matter', 'Matter'],
  ['4.2.1', '.water-topic-lab', 'Water properties', 'Water'],
  ['4.2.2', '.water-topic-lab', 'Density of liquids', 'Water'],
  ['4.2.3', '.water-topic-lab', 'Density of objects', 'Water'],
  ['4.3.1', '.solutions-lab', 'Dissolving in water', 'Solutions'],
  ['4.3.2', '.solutions-lab', 'Solubility investigation', 'Solutions'],
  ['4.3.3', '.solutions-lab', 'Temperature changes capacity', 'Solutions'],
  ['4.3.4', '.solutions-lab', 'The particle model', 'Solutions'],
  ['4.3.5', '.solutions-lab', 'Dilute to supersaturated', 'Solutions'],
  ['4.4.1', '.mixtures-lab', 'Atoms, molecules and ions', 'Mixtures'],
  ['4.4.2', '.mixtures-lab', 'Sort it: element, compound or mixture', 'Mixtures'],
  ['4.4.3', '.mixtures-lab', 'Choose a separation property', 'Mixtures'],
  ['4.4.4', '.mixtures-lab', 'Separate iron, sand and salt', 'Mixtures'],
  ['4.4.5', '.mixtures-lab', 'Tilt, shake and sort', 'Mixtures'],
  ['4.4.6', '.mixtures-lab', 'Screen, flocculate, filter', 'Mixtures'],
  ['4.5.1', '.pollution-lab', 'What stays in the water?', 'Water pollution'],
] as const;
const topicIndex: Record<string, number> = { Water: 0, Matter: 1, Solutions: 2, Mixtures: 3, 'Water pollution': 4 };

test('all 19 canonical curriculum routes launch the intended working lesson', async ({ page }) => {
  for (const [outcome, selector, heading, topic] of directRoutes) {
    await page.goto(`/#/simulators/${outcome}`);
    const lab = page.locator(selector);
    await expect(lab).toBeVisible();
    await expect(lab.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expect(page.locator('.playground-nav a').nth(topicIndex[topic])).toHaveAttribute('aria-current', 'page');
    if (outcome.startsWith('4.4.')) {
      const expectedMode = outcome === '4.4.5' ? 'ml-culture' : outcome === '4.4.6' ? 'ml-industrial' : outcome === '4.4.3' || outcome === '4.4.4' ? 'ml-separate' : 'ml-classify';
      await expect(lab).toHaveClass(new RegExp(expectedMode));
    }
  }
});

test('classifier distinguishes molecular element O₂ from H₂O compound and checks the submitted answer', async ({ page }) => {
  await page.goto('/#/simulators/4.4.1');
  const lab = page.locator('.mixtures-lab');
  await expect(lab.locator('.ml-particle-legend')).toContainText('O₂ · molecule');
  await lab.getByLabel('Choose a matter sample').selectOption('water');
  await expect(lab.locator('.ml-particle-legend')).toContainText('H₂O · molecule');
  await lab.getByRole('button', { name: 'Compound', exact: true }).click();
  await lab.getByRole('button', { name: 'Check classification' }).click();
  await expect(lab.locator('.ml-feedback')).toContainText('Correct · Compound');
  await lab.getByLabel('Choose a matter sample').selectOption('carbon-dioxide');
  await expect(lab.locator('.ml-particle-legend')).toContainText('CO₂ · molecule');
  await expect(lab.locator('.ml-particle-legend .ml-legend-mark.ml-legend-co2 .carbon')).toHaveCSS('background-color', 'rgb(48, 56, 68)');
});

test('filtering retains dissolved salt, while a genuine decant transfers the salt-water liquid layer', async ({ page }) => {
  await page.goto('/#/simulators/4.4.3');
  const lab = page.locator('.mixtures-lab');
  await lab.getByLabel('Choose a mixture to separate').selectOption('sand-salt-water');
  await lab.getByRole('button', { name: /^Filter/ }).click();
  await lab.getByRole('button', { name: 'Run filter' }).click();
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Remaining · Dissolved salt' })).toContainText('12.0 g');
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Filter residue · Sand' })).toContainText('28.0 g');
  await expect(lab.locator('.ml-science-note')).toContainText('Dissolved salt passes through');
  await lab.getByRole('button', { name: 'Settle & decant' }).click();
  await expect(lab.locator('.ml-science-note').filter({ hasText: 'gently pour the liquid from above' })).toContainText('dissolved salt travels with the water');
  await lab.getByRole('button', { name: 'Run settle & decant' }).click();
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Decanted liquid · Water' })).toContainText('100.0 g');
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Decanted liquid · Dissolved salt' })).toContainText('12.0 g');
  await lab.getByRole('button', { name: 'Record this trial' }).click();
  await expect(lab.locator('.ml-trial-log')).toContainText('Investigation records');
});

test('yandying tilt, shake and property controls change sorting without changing represented mass', async ({ page }) => {
  await page.goto('/#/simulators/4.4.5');
  const lab = page.locator('.mixtures-lab');
  await lab.locator('.ml-source-note summary').first().click();
  await setSlider(page, 'Dish tilt', 30);
  await setSlider(page, 'Seed size', 8);
  await setSlider(page, 'Seed density', 0.3);
  await lab.getByRole('button', { name: 'Shake dish' }).click();
  const lowRecovery = Number.parseFloat(await lab.locator('.ml-mass-ledger .ml-readout b').innerText());
  await setSlider(page, 'Seed size', 3);
  await setSlider(page, 'Seed density', 1.15);
  await lab.getByRole('button', { name: 'Shake dish' }).click();
  const recovered = await lab.locator('.ml-mass-ledger .ml-readout b').innerText();
  expect(Number.parseFloat(recovered)).toBeGreaterThan(lowRecovery);
  await expect(lab.locator('.ml-mass-ledger')).toContainText('All 100 g is accounted for');
  await expect(lab.locator('.ml-question-card').filter({ hasText: 'A sieve mainly selects a size cutoff' })).toBeVisible();
});

test('coagulant dose changes later filter capture while pollutant totals remain conserved', async ({ page }) => {
  await page.goto('/#/simulators/4.4.6');
  const lab = page.locator('.mixtures-lab');
  await lab.getByRole('button', { name: 'Flocculate' }).click();
  await setSlider(page, 'Relative coagulant dose', 0);
  await lab.getByRole('button', { name: 'Run flocculation' }).click();
  await lab.getByRole('button', { name: 'Filter media' }).click();
  await lab.getByRole('button', { name: 'Run filter media' }).click();
  const lowDoseWaste = Number.parseFloat((await lab.locator('.ml-mass-ledger').innerText()).match(/Suspended sediment · waste\s+(\d+\.\d+)/)?.[1] ?? '0');
  await lab.getByRole('button', { name: 'Reset this mixtures investigation' }).click();
  await lab.getByRole('button', { name: 'Flocculate' }).click();
  await setSlider(page, 'Relative coagulant dose', 100);
  await lab.getByRole('button', { name: 'Run flocculation' }).click();
  await lab.getByRole('button', { name: 'Filter media' }).click();
  await lab.getByRole('button', { name: 'Run filter media' }).click();
  const highLedger = await lab.locator('.ml-mass-ledger').innerText();
  const highDoseWaste = Number.parseFloat(highLedger.match(/Suspended sediment · waste\s+(\d+\.\d+)/)?.[1] ?? '0');
  expect(highDoseWaste).toBeGreaterThan(lowDoseWaste);
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Dissolved salt · remains' })).toContainText('6.0 g');
  await expect(lab.locator('.ml-science-note')).toContainText('does not remove dissolved salt');
});

test('the five topic groups stay within 375 px and all outcomes remain directly reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [outcome, selector] of directRoutes) {
    await page.goto(`/#/simulators/${outcome}`);
    await expect(page.locator(selector)).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  }
  await page.screenshot({ path: 'output/playwright/full-topic-mobile-375.png', fullPage: true });
});

test('Mixtures keeps a supported 3D renderer mounted instead of misreading its inert fallback child', async ({ page }) => {
  const supports = await page.evaluate(() => {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!context) return false;
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
  await page.goto('/#/simulators/4.4.1');
  const scene = page.locator('.ml-scene-wrap');
  const lab = page.locator('.mixtures-lab');
  if (supports) {
    await expect(lab).toHaveAttribute('data-graphics', 'ready');
    await expect(scene.locator('canvas')).toHaveCount(1);
    await page.waitForTimeout(650);
    await expect(lab).toHaveAttribute('data-graphics', 'ready');
    await expect(scene.locator('canvas')).toHaveCount(1);
  } else {
    await expect(scene).toHaveAttribute('data-graphics', 'fallback');
    await expect(scene.getByRole('img', { name: /Two dimensional classify model/ })).toBeVisible();
  }
});

test('unavailable WebGL keeps the Mixtures 2D view and filter controls usable', async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = HTMLCanvasElement.prototype as unknown as { getContext: (this: HTMLCanvasElement, id: string, options?: unknown) => RenderingContext | null };
    const native = prototype.getContext;
    prototype.getContext = function (this: HTMLCanvasElement, id: string, options?: unknown) {
      if (id === 'webgl2' || id === 'webgl' || id === 'experimental-webgl') return null;
      return native.call(this, id, options);
    };
  });
  await page.goto('/#/simulators/4.4.3');
  const lab = page.locator('.mixtures-lab');
  await expect(lab).toHaveAttribute('data-graphics', 'fallback');
  await expect(lab.locator('.ml-fallback')).toBeVisible();
  await lab.getByLabel('Choose a mixture to separate').selectOption('sand-salt-water');
  await lab.getByRole('button', { name: /^Filter/ }).click();
  await lab.getByRole('button', { name: 'Run filter' }).click();
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Remaining · Dissolved salt' })).toContainText('12.0 g');
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Filter residue · Sand' })).toContainText('28.0 g');
});

test('pure water shows red oxygen in its legend and in the 2D fallback markers', async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = HTMLCanvasElement.prototype as unknown as { getContext: (this: HTMLCanvasElement, id: string, options?: unknown) => RenderingContext | null };
    const native = prototype.getContext;
    prototype.getContext = function (this: HTMLCanvasElement, id: string, options?: unknown) {
      if (id === 'webgl2' || id === 'webgl' || id === 'experimental-webgl') return null;
      return native.call(this, id, options);
    };
  });
  await page.goto('/#/simulators/4.4.1');
  const lab = page.locator('.mixtures-lab');
  await lab.getByLabel('Choose a matter sample').selectOption('water');
  await expect(lab.locator('.ml-particle-legend')).toContainText('H₂O · molecule');
  await expect(lab.locator('.ml-particle-legend .ml-legend-water .oxygen')).toHaveCSS('background-color', 'rgb(228, 61, 57)');
  const fallbackOxygen = await lab.locator('.ml-fallback .ml-dot').first().evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fallbackOxygen).toBe('rgb(228, 61, 57)');
  await expect(lab.locator('.ml-fallback .ml-dot')).toHaveCount(18);
});
