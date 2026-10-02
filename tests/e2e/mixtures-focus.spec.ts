import { expect, test } from '@playwright/test';

const stage = (lab: import('@playwright/test').Locator, name: RegExp) => lab.getByRole('group', { name: 'Choose an industrial water treatment stage' }).getByRole('button', { name });
const technique = (lab: import('@playwright/test').Locator, name: RegExp) => lab.getByRole('group', { name: 'Choose a separation technique' }).getByRole('button', { name });

test('4.4.1 opens an atoms · molecules · ions comparison with a particle-theory property for each', async ({ page }) => {
  await page.goto('/#/simulators/4.4.1');
  const lab = page.locator('.mixtures-lab');
  await expect(lab).toHaveAttribute('data-variant', 'entities');
  await expect(lab.getByRole('heading', { level: 1 })).toHaveText('Atoms, molecules and ions');
  const strip = lab.getByRole('group', { name: 'Compare atoms, molecules, ions and a mixture' });
  await expect(strip.getByRole('button')).toHaveCount(5);
  const cases: [RegExp, RegExp, string][] = [
    [/Argon/, /fill its whole container/, 'Ar · atom'],
    [/Oxygen, O₂/, /two bonded oxygen atoms/, 'O₂ · molecule'],
    [/Water, H₂O/, /slide past each other/, 'H₂O · molecule'],
    [/Sodium chloride/, /regular lattice[\s\S]*high melting point/, 'Na⁺ · ion'],
    [/Salt water/, /keeps its own properties/, 'H₂O · molecule'],
  ].map(([a, b, c]) => [a as RegExp, b instanceof RegExp ? b : new RegExp(b as string), c as string]);
  for (const [button, text, legend] of cases) {
    await strip.getByRole('button', { name: button }).click();
    await expect(lab.locator('.ml-entity-detail')).toContainText(text);
    await expect(lab.locator('.ml-particle-legend')).toContainText(legend);
  }
  // the simulation is usable immediately: no quiz needs completing first
  await expect(lab.getByRole('button', { name: 'Play model motion' })).toBeEnabled();
});

test('4.4.2 sorts every sample into element, compound or mixture with immediate feedback and a tally', async ({ page }) => {
  await page.goto('/#/simulators/4.4.2');
  const lab = page.locator('.mixtures-lab');
  await expect(lab).toHaveAttribute('data-variant', 'purity');
  await expect(lab.getByRole('heading', { level: 1 })).toHaveText('Sort it: element, compound or mixture');
  await expect(lab.getByRole('listitem')).toHaveCount(8);
  const tally = lab.locator('.ml-score-tally');
  await expect(tally).toContainText('0 of 8 sorted');
  await lab.getByRole('button', { name: 'Sort Pure water as mixture' }).click();
  await expect(lab.locator('.ml-sort-row').filter({ hasText: 'Pure water' })).toContainText('Not quite');
  await expect(tally).toContainText('0 of 8 sorted');
  await lab.getByRole('button', { name: 'Sort Pure water as compound' }).click();
  await expect(lab.locator('.ml-sort-row').filter({ hasText: 'Pure water' })).toContainText('Compound.');
  await expect(tally).toContainText('1 of 8 sorted');
  await expect(tally).toContainText('0 right first time');
  await lab.getByRole('button', { name: 'Sort Oxygen gas as element' }).click();
  await expect(tally).toContainText('1 right first time');
  const answers: Record<string, string> = { 'Argon gas': 'element', 'Carbon dioxide gas': 'compound', 'Sodium chloride crystal': 'compound', 'Salt water': 'mixture', 'Sand and salt': 'mixture', 'Air sample': 'mixture' };
  for (const [name, kind] of Object.entries(answers)) await lab.getByRole('button', { name: `Sort ${name} as ${kind}` }).click();
  await expect(tally).toContainText('8 of 8 sorted');
  await expect(tally).toContainText('7 right first time');
  await expect(tally).toContainText('9 attempts');
});

test('4.4.4 guided challenge: wrong order gets feedback, right order recovers all three solids with a record per step', async ({ page }) => {
  await page.goto('/#/simulators/4.4.4');
  const lab = page.locator('.mixtures-lab');
  await expect(lab).toHaveAttribute('data-variant', 'investigation');
  await expect(lab.getByRole('heading', { level: 1 })).toHaveText('Separate iron, sand and salt');
  await technique(lab, /^Filter/).click();
  await lab.getByRole('button', { name: 'Run filter' }).click();
  await expect(lab.locator('.ml-step-note')).toContainText('needs a liquid');
  await technique(lab, /^Add water/).click();
  await lab.getByRole('button', { name: 'Run add water & stir' }).click();
  await technique(lab, /^Evaporate/).click();
  await lab.getByRole('button', { name: 'Run evaporate' }).click();
  await expect(lab.locator('.ml-step-note')).toContainText('sand is still mixed in with the salt');
  await expect(lab.locator('.ml-challenge-card')).toContainText('mixed into the salt');
  await lab.getByRole('button', { name: 'Reset this mixtures investigation' }).click();
  await expect(lab.locator('.ml-trial-log')).toHaveCount(0);
  for (const [name, run] of [[/^Magnet/, 'Run magnet'], [/^Add water/, 'Run add water & stir'], [/^Filter/, 'Run filter'], [/^Evaporate/, 'Run evaporate']] as const) {
    await technique(lab, name).click();
    await lab.getByRole('button', { name: run }).click();
  }
  await expect(lab.locator('.ml-challenge-card')).toContainText('Challenge complete');
  await expect(lab.locator('.ml-trial-table tbody tr')).toHaveCount(4);
  await expect(lab.locator('.ml-trial-table')).toContainText('Iron filings 15 g');
  await expect(lab.locator('.ml-trial-table')).toContainText('Sand 40 g');
  await expect(lab.locator('.ml-mass-ledger')).toContainText('Total represented mass remains 175 g (including 100 g of added water)');
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Remaining · Salt crystals' })).toContainText('20.0 g');
});

test('4.4.3 keeps a free choice of separation property with apparatus for each technique', async ({ page }) => {
  await page.goto('/#/simulators/4.4.3');
  const lab = page.locator('.mixtures-lab');
  await expect(lab).toHaveAttribute('data-variant', 'properties');
  await expect(lab.getByRole('heading', { level: 1 })).toHaveText('Choose a separation property');
  const apparatus: [RegExp, string, RegExp][] = [
    [/^Filter/, 'filter', /Retort stand and ring clamp holding a glass funnel/],
    [/^Sieve/, 'sieve', /mesh sieve resting on the rim of a glass bowl/],
    [/^Magnet/, 'magnet', /bar magnet/],
    [/^Settle/, 'settle-decant', /tilted on a wedge/],
    [/^Evaporate/, 'evaporate', /evaporating basin on a gauze and tripod/],
    [/^Distil/, 'distill', /Liebig condenser/],
  ];
  for (const [name, id, note] of apparatus) {
    await technique(lab, name).click();
    await expect(lab).toHaveAttribute('data-technique', id);
    await expect(lab.locator('.ml-apparatus-note')).toContainText(note);
    await expect(lab.locator('.ml-scene-panel')).toHaveAttribute('aria-label', note);
  }
});

test('the scene region describes the current sample, apparatus and outputs, and updates after a run', async ({ page }) => {
  await page.goto('/#/simulators/4.4.3');
  const lab = page.locator('.mixtures-lab');
  const panel = lab.locator('.ml-scene-panel');
  await technique(lab, /^Filter/).click();
  await expect(panel).toHaveAttribute('aria-label', /Apparatus: Retort stand.*Sample: Sand, salt and water\. Remaining in the sample: Water 100 g, Sand 28 g, Dissolved salt 12 g\. Recovered outputs: none yet/);
  await lab.getByRole('button', { name: 'Run filter' }).click();
  await expect(panel).toHaveAttribute('aria-label', /Recovered outputs: Filter residue: Sand 28 g/);
  await page.goto('/#/simulators/4.4.1');
  await expect(page.locator('.mixtures-lab .ml-scene-panel')).toHaveAttribute('aria-label', /3D beaker particle view of Oxygen gas: 18 O₂ molecules/);
});

test('keyboard controls still work: Space toggles play and R resets', async ({ page }) => {
  await page.goto('/#/simulators/4.4.5');
  const lab = page.locator('.mixtures-lab');
  await lab.getByRole('button', { name: 'Shake dish' }).click();
  await expect(lab.locator('.ml-mass-ledger .ml-readout b')).not.toHaveText('0.0 g');
  await lab.focus();
  await page.keyboard.press('r');
  await expect(lab.locator('.ml-mass-ledger .ml-readout b')).toHaveText('0.0 g');
  await page.keyboard.press('Space');
  await expect(lab.getByRole('button', { name: 'Pause model motion' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(lab.getByRole('button', { name: 'Play model motion' })).toBeVisible();
});

test('4.4.5 shows ACARA-sourced yandying context in view, with the double-yandying steps and respectful note', async ({ page }) => {
  await page.goto('/#/simulators/4.4.5');
  const lab = page.locator('.mixtures-lab');
  const context = lab.locator('.ml-context-card');
  await expect(context).toBeVisible();
  await expect(context).toContainText('Yindjibarni people of the Pilbara region in Western Australia (also spelled Yindjibarndi)');
  const steps = context.locator('ol li');
  await expect(steps).toHaveCount(5);
  await expect(steps.nth(0)).toContainText('separated from their pods');
  await expect(steps.nth(1)).toContainText('pod fragments');
  await expect(steps.nth(2)).toContainText('Baked');
  await expect(steps.nth(3)).toContainText('remove the sand and ashes');
  await expect(steps.nth(4)).toContainText('Ground');
  await expect(context).toContainText('living knowledge that belongs to the communities');
  await expect(context).toContainText('consult local Aboriginal community members or education officers');
  await expect(context.getByRole('link', { name: /ACARA teacher background/ })).toHaveAttribute('href', /science_teacher_background_information_AC9S7U06_E6/);
  await expect(context).not.toContainText('<details');
});

test('4.4.6 shows the connected treatment train and keeps conservation while stages run in order', async ({ page }) => {
  await page.goto('/#/simulators/4.4.6');
  const lab = page.locator('.mixtures-lab');
  await expect(lab.locator('.ml-scene-panel')).toHaveAttribute('aria-label', /inflow channel with bar screen, flocculation tank with paddle mixer and overflow weir, layered filter bed, clear water outlet/);
  for (const [name, run] of [[/Screen$/, 'Run screen'], [/Flocculate$/, 'Run flocculation'], [/Filter media$/, 'Run filter media']] as const) {
    await stage(lab, name).click();
    await lab.getByRole('button', { name: run }).click();
  }
  await expect(lab.locator('.ml-scene-panel')).toHaveAttribute('aria-label', /Stages run: screen, then flocculate, then filter/);
  await expect(lab.locator('.ml-ledger-row').filter({ hasText: 'Dissolved salt · remains' })).toContainText('6.0 g');
  await expect(lab.locator('.ml-mass-ledger')).toContainText('safety is not inferred');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`all Mixtures routes render without page overflow or console errors at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    for (const outcome of ['4.4.1', '4.4.2', '4.4.3', '4.4.4', '4.4.5', '4.4.6']) {
      await page.goto(`/#/simulators/${outcome}`);
      await expect(page.locator('.mixtures-lab')).toBeVisible();
      const canvas = page.locator('.ml-scene-wrap canvas');
      if (await canvas.count()) {
        const box = await canvas.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThan(250);
        expect(box?.height ?? 0).toBeGreaterThan(250);
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
    expect(errors.filter((text) => !/Clock|WebGL|GPU stall|swiftshader/i.test(text))).toEqual([]);
  });
}
