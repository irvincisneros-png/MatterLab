import { describe, expect, it } from 'vitest';
import {
  advanceYandying,
  applySeparationTechnique,
  classifyComposition,
  COMPOSITION_SAMPLES,
  compositionSample,
  createIndustrialWaterState,
  createSeparationState,
  createYandyingState,
  industrialPollutantLedger,
  investigationReport,
  separationExpectedMassG,
  particlesForComposition,
  runIndustrialStage,
  setIndustrialCoagulantDose,
  separationFeedMassG,
  separationMassG,
  setYandyingTilt,
  setYandyingProperties,
  YANDYING_PARTICLE_PROPERTIES,
  yandyingSortingEfficiency,
  yandyingMassLedger,
} from '../src/science/mixturesEngine';

describe('mixture classification and particle display', () => {
  it('distinguishes atomic and molecular elements, compounds, and physical mixtures', () => {
    expect(classifyComposition(compositionSample('oxygen'))).toBe('element');
    expect(classifyComposition(compositionSample('argon'))).toBe('element');
    expect(classifyComposition(compositionSample('water'))).toBe('compound');
    expect(classifyComposition(compositionSample('carbon-dioxide'))).toBe('compound');
    expect(classifyComposition(compositionSample('carbon-dioxide'))).toBe('compound');
    expect(classifyComposition(compositionSample('salt-crystal'))).toBe('compound');
    expect(classifyComposition(compositionSample('salt-water'))).toBe('mixture');
    expect(classifyComposition(compositionSample('air'))).toBe('mixture');
  });

  it('does not classify an empty sample as a pure substance', () => {
    const empty = { ...COMPOSITION_SAMPLES[0], constituents: [] };
    expect(classifyComposition(empty)).toBe('empty');
    expect(classifyComposition({ ...empty, constituents: [{ ...COMPOSITION_SAMPLES[0].constituents[0], count: 0 }] })).toBe('empty');
  });

  it('keeps molecule, atom and ion identities separate in a stable 18-marker view', () => {
    const sample = compositionSample('salt-water');
    const particles = particlesForComposition(sample);
    expect(particles).toHaveLength(18);
    expect(new Set(particles.map((particle) => particle.id)).size).toBe(18);
    expect(particles.filter((particle) => particle.entity === 'molecule')).toHaveLength(10);
    expect(particles.filter((particle) => particle.entity === 'ion')).toHaveLength(8);
    expect(particles.every((particle) => particle.position.every(Number.isFinite))).toBe(true);
    expect(particlesForComposition(sample, 2).map((particle) => particle.id)).toEqual(particles.map((particle) => particle.id));
  });

  it('uses red oxygen in O₂ and H₂O, dark carbon in CO₂, and an alternating NaCl crystal lattice', () => {
    const oxygen = compositionSample('oxygen').constituents[0];
    const water = compositionSample('water').constituents[0];
    expect(oxygen.colour).toBe('#e43d39');
    expect(water.colour).toBe('#e43d39');
    expect(compositionSample('carbon-dioxide').constituents[0].colour).toBe('#303844');

    const crystal = particlesForComposition(compositionSample('salt-crystal'));
    expect(crystal).toHaveLength(18);
    expect(crystal.filter((particle) => particle.formula === 'Na⁺')).toHaveLength(9);
    expect(crystal.filter((particle) => particle.formula === 'Cl⁻')).toHaveLength(9);
    expect(new Set(crystal.map((particle) => particle.position.join(','))).size).toBe(18);
    expect(crystal.map((particle) => [...particle.position].map((value) => Math.round(value * 100) / 100))).toContainEqual([-0.34, -0.14, -0.34]);
  });

  it('keeps every marker centre and molecular envelope inside the chamber', () => {
    for (const sample of COMPOSITION_SAMPLES) {
      for (const particle of particlesForComposition(sample, 12)) {
        const radialCentre = Math.hypot(particle.position[0], particle.position[2]);
        expect(radialCentre + particle.radius * 1.3).toBeLessThan(0.77);
        expect(Math.abs(particle.position[1]) + particle.radius * 1.3).toBeLessThan(0.9);
      }
    }
  });
});

describe('physical mixture separation', () => {
  it('uses grain size and magnetism to select only the matching constituents', () => {
    const sieved = applySeparationTechnique(createSeparationState('gravel-sand'), 'sieve');
    expect(sieved.outputs[0]?.massesG.gravel).toBe(42);
    expect(sieved.remainingG.sand).toBe(58);
    expect(sieved.lastAction?.movedG).toBe(42);
    expect(separationMassG(sieved)).toBe(separationFeedMassG('gravel-sand'));

    const magnetised = applySeparationTechnique(createSeparationState('iron-sand'), 'magnet');
    expect(magnetised.outputs[0]?.massesG.iron).toBe(24);
    expect(magnetised.remainingG.sand).toBe(76);
    expect(separationMassG(magnetised)).toBe(separationFeedMassG('iron-sand'));

    const unmatched = applySeparationTechnique(createSeparationState('iron-sand'), 'sieve');
    expect(unmatched.lastAction?.movedG).toBe(0);
    expect(separationMassG(unmatched)).toBe(separationFeedMassG('iron-sand'));

    const decantedOil = applySeparationTechnique(createSeparationState('oil-water'), 'settle-decant');
    expect(decantedOil.outputs[0]?.massesG.oil).toBe(24);
    expect(decantedOil.remainingG.water).toBe(76);
    expect(separationMassG(decantedOil)).toBe(separationFeedMassG('oil-water'));

    const decantedSaltWater = applySeparationTechnique(createSeparationState('sand-salt-water'), 'settle-decant');
    expect(decantedSaltWater.outputs[0]?.massesG.water).toBe(100);
    expect(decantedSaltWater.outputs[0]?.massesG['dissolved-salt']).toBe(12);
    expect(decantedSaltWater.remainingG.sand).toBe(28);
    expect(decantedSaltWater.outputs[0]?.label).toBe('Decanted liquid');
    expect(separationMassG(decantedSaltWater)).toBe(separationFeedMassG('sand-salt-water'));
  });

  it('filters suspended sand but leaves dissolved salt in the water', () => {
    const initial = createSeparationState('sand-salt-water');
    const filtered = applySeparationTechnique(initial, 'filter');
    expect(filtered.outputs[0]?.massesG.sand).toBe(28);
    expect(filtered.outputs[0]?.massesG['dissolved-salt']).toBeUndefined();
    expect(filtered.remainingG['dissolved-salt']).toBe(12);
    expect(filtered.remainingG.water).toBe(100);
    expect(separationMassG(filtered)).toBe(separationFeedMassG('sand-salt-water'));
  });

  it('distinguishes evaporated vapour from distilled condensate and preserves nonvolatile salt', () => {
    const initial = createSeparationState('sand-salt-water');
    const evaporated = applySeparationTechnique(initial, 'evaporate');
    const distilled = applySeparationTechnique(initial, 'distill');
    expect(evaporated.outputs[0]?.label).toBe('Water vapour');
    expect(distilled.outputs[0]?.label).toBe('Condensed water');
    expect(evaporated.outputs[0]?.massesG.water).toBe(100);
    expect(distilled.outputs[0]?.massesG.water).toBe(100);
    expect(evaporated.remainingG['dissolved-salt']).toBe(12);
    expect(distilled.remainingG.sand).toBe(28);
    expect(separationMassG(evaporated)).toBe(separationFeedMassG(initial.mixtureId));
    expect(separationMassG(distilled)).toBe(separationFeedMassG(initial.mixtureId));
  });

  it('records serial separation steps without losing or creating sample mass', () => {
    const sample = createSeparationState('sand-salt-water');
    const filtered = applySeparationTechnique(sample, 'filter');
    const distilled = applySeparationTechnique(filtered, 'distill');
    expect(distilled.steps).toEqual(['filter', 'distill']);
    expect(separationMassG(distilled)).toBe(separationFeedMassG(sample.mixtureId));
  });
});

describe('source-grounded yandying model', () => {
  it('requires shaking and dish tilt for size/density sorting, with a conserved seed/chaff ledger', () => {
    const starting = createYandyingState();
    const still = advanceYandying(setYandyingTilt(starting, 0), 8);
    expect(still.recoveredSeedG).toBe(0);
    const tilted = setYandyingTilt(starting, 30);
    const sorted = advanceYandying(tilted, 5);
    expect(sorted.recoveredSeedG).toBeGreaterThan(0);
    expect(sorted.separatedChaffG).toBeGreaterThan(0);
    const ledger = yandyingMassLedger(sorted);
    expect(ledger.recoveredSeedG + ledger.remainingSeedG).toBeCloseTo(sorted.seedMassG, 12);
    expect(ledger.separatedChaffG + ledger.remainingChaffG).toBeCloseTo(sorted.chaffMassG, 12);
    expect(ledger.totalG).toBe(100);
    expect(setYandyingTilt(starting, 100).tiltDegrees).toBe(35);
    expect(yandyingSortingEfficiency()).toBeGreaterThan(0);
    expect(yandyingSortingEfficiency(YANDYING_PARTICLE_PROPERTIES.seed, YANDYING_PARTICLE_PROPERTIES.seed)).toBe(0);
  });

  it('lets size and density contrasts change sorting while the sample mass stays fixed', () => {
    const start = setYandyingTilt(createYandyingState(), 30);
    const defaultRun = advanceYandying(start, 5);
    const noContrast = setYandyingProperties(start, {
      seedSizeMm: start.chaffSizeMm,
      seedDensityGPerMl: start.chaffDensityGPerMl,
    });
    const unsorted = advanceYandying(noContrast, 5);
    expect(defaultRun.recoveredSeedG).toBeGreaterThan(unsorted.recoveredSeedG);
    expect(defaultRun.separatedChaffG).toBeGreaterThan(unsorted.separatedChaffG);
    expect(yandyingMassLedger(defaultRun).totalG).toBe(yandyingMassLedger(unsorted).totalG);
    expect(setYandyingProperties(start, { seedSizeMm: 99 }).seedSizeMm).toBe(12);
  });
});

describe('industrial screening and water filtration model', () => {
  it('removes some debris and sediment while preserving dissolved salt and all pollutant mass', () => {
    const feed = createIndustrialWaterState();
    const screened = runIndustrialStage(feed, 'screen');
    const flocculated = runIndustrialStage(screened, 'flocculate');
    const filtered = runIndustrialStage(flocculated, 'filter');
    const ledger = industrialPollutantLedger(filtered);
    expect(filtered.flocculated).toBe(true);
    expect(filtered.debrisG).toBeLessThan(feed.debrisG);
    expect(filtered.sedimentG).toBeLessThan(feed.sedimentG);
    expect(filtered.dissolvedSaltG).toBe(feed.dissolvedSaltG);
    expect(ledger.debrisTotalG).toBeCloseTo(feed.debrisG, 12);
    expect(ledger.sedimentTotalG).toBeCloseTo(feed.sedimentG, 12);
    expect(ledger.dissolvedSaltTotalG).toBe(feed.dissolvedSaltG);
    expect(ledger.inputPollutantsG).toBeCloseTo(feed.debrisG + feed.sedimentG + feed.dissolvedSaltG, 12);
  });

  it('makes flocculation change particle clumping, not pollutant mass', () => {
    const feed = createIndustrialWaterState();
    const flocculated = runIndustrialStage(feed, 'flocculate');
    expect(flocculated.flocculated).toBe(true);
    expect(industrialPollutantLedger(flocculated)).toEqual(industrialPollutantLedger(feed));
  });

  it('uses the qualitative coagulant dose to change later particle capture, not pollutant conservation', () => {
    const base = createIndustrialWaterState();
    const low = runIndustrialStage(runIndustrialStage(setIndustrialCoagulantDose(base, 0), 'flocculate'), 'filter');
    const high = runIndustrialStage(runIndustrialStage(setIndustrialCoagulantDose(base, 100), 'flocculate'), 'filter');
    expect(high.wasteSedimentG).toBeGreaterThan(low.wasteSedimentG);
    expect(industrialPollutantLedger(high).sedimentTotalG).toBeCloseTo(base.sedimentG, 12);
    expect(high.dissolvedSaltG).toBe(base.dissolvedSaltG);
  });
});

describe('guided iron + sand + salt investigation', () => {
  const run = (...steps: Parameters<typeof applySeparationTechnique>[1][]) => steps.reduce((state, step) => applySeparationTechnique(state, step), createSeparationState('iron-sand-salt'));

  it('starts as a dry 75 g mixture of iron filings, sand and salt crystals', () => {
    const start = createSeparationState('iron-sand-salt');
    expect(start.remainingG).toEqual({ iron: 15, sand: 40, salt: 20 });
    expect(separationFeedMassG('iron-sand-salt')).toBe(75);
    expect(investigationReport(start).complete).toBe(false);
  });

  it('recovers all three solids pure with magnet, dissolve, filter, evaporate', () => {
    const done = run('magnet', 'dissolve', 'filter', 'evaporate');
    const report = investigationReport(done);
    expect(done.outputs.find((output) => output.technique === 'magnet')?.massesG).toEqual({ iron: 15 });
    expect(done.outputs.find((output) => output.technique === 'filter')?.massesG).toEqual({ sand: 40 });
    expect(report).toMatchObject({ ironG: 15, sandG: 40, saltG: 20, ironPure: true, sandPure: true, saltPure: true, complete: true });
    expect(report.issues).toEqual([]);
    expect(separationMassG(done)).toBe(separationExpectedMassG(done));
    expect(done.addedWaterG).toBe(100);
  });

  it('accepts dissolve before the magnet, because iron does not dissolve and stays magnetic', () => {
    expect(investigationReport(run('dissolve', 'magnet', 'filter', 'evaporate')).complete).toBe(true);
  });

  it('leaves sand in the salt when evaporating before filtering, and says why', () => {
    const wrong = run('magnet', 'dissolve', 'evaporate');
    const report = investigationReport(wrong);
    expect(report.complete).toBe(false);
    expect(report.saltPure).toBe(false);
    expect(wrong.remainingG.sand).toBe(40);
    expect(wrong.lastAction?.note).toMatch(/sand is still mixed/i);
    expect(report.issues.join(' ')).toMatch(/sand or iron is mixed into the salt/i);
    expect(separationMassG(wrong)).toBe(separationExpectedMassG(wrong));
  });

  it('catches iron in the sand residue when the magnet is skipped', () => {
    const skipped = run('dissolve', 'filter', 'evaporate');
    expect(skipped.outputs.find((output) => output.technique === 'filter')?.massesG).toEqual({ iron: 15, sand: 40 });
    const report = investigationReport(skipped);
    expect(report.sandPure).toBe(false);
    expect(report.issues.join(' ')).toMatch(/iron is caught in the sand residue/i);
    expect(report.complete).toBe(false);
  });

  it('cannot filter a dry mixture: nothing moves and the note asks for water', () => {
    const dry = run('filter');
    expect(dry.lastAction?.movedG).toBe(0);
    expect(dry.outputs).toHaveLength(0);
    expect(dry.lastAction?.note).toMatch(/needs a liquid/i);
    expect(dry.remainingG).toEqual({ iron: 15, sand: 40, salt: 20 });
  });

  it('dissolving moves salt into solution without adding or losing mass beyond the water added', () => {
    const wet = run('dissolve');
    expect(wet.remainingG.salt).toBe(0);
    expect(wet.remainingG['dissolved-salt']).toBe(20);
    expect(wet.remainingG.water).toBe(100);
    expect(separationMassG(wet)).toBe(175);
    expect(separationExpectedMassG(wet)).toBe(175);
    const again = applySeparationTechnique(wet, 'dissolve');
    expect(again.addedWaterG).toBe(100);
    expect(again.lastAction?.note).toMatch(/already been added/i);
  });

  it('lets students rescue a wrong order by redissolving the dried salt, filtering and evaporating again', () => {
    const rescued = run('magnet', 'dissolve', 'evaporate', 'dissolve', 'filter', 'evaporate');
    expect(investigationReport(rescued).complete).toBe(true);
    expect(separationMassG(rescued)).toBe(separationExpectedMassG(rescued));
    expect(rescued.addedWaterG).toBe(200);
  });

  it('keeps mass conserved for every ordering of the four steps', () => {
    const steps = ['magnet', 'dissolve', 'filter', 'evaporate'] as const;
    const permutations = (items: readonly (typeof steps)[number][]): (typeof steps)[number][][] => items.length <= 1 ? [[...items]] : items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
    const perms = permutations(steps);
    expect(perms).toHaveLength(24);
    let complete = 0;
    for (const order of perms) {
      const end = run(...order);
      expect(separationMassG(end)).toBeCloseTo(separationExpectedMassG(end), 9);
      if (investigationReport(end).complete) complete += 1;
    }
    // Only magnet-dissolve-filter-evaporate and dissolve-magnet-filter-evaporate succeed.
    expect(complete).toBe(2);
  });
});

describe('filtering other samples now needs liquid and decanting handles the new mixture', () => {
  it('does not "filter" a dry iron and sand mixture', () => {
    const dry = applySeparationTechnique(createSeparationState('iron-sand'), 'filter');
    expect(dry.lastAction?.movedG).toBe(0);
    expect(separationMassG(dry)).toBe(separationFeedMassG('iron-sand'));
  });

  it('records which technique produced each output', () => {
    const sieved = applySeparationTechnique(createSeparationState('gravel-sand'), 'sieve');
    expect(sieved.outputs[0]?.technique).toBe('sieve');
  });
});

describe('industrial stage log', () => {
  it('records what each stage removed so the scene can show where waste was caught', () => {
    const state = runIndustrialStage(runIndustrialStage(createIndustrialWaterState(), 'screen'), 'filter');
    expect(state.stageLog.map((entry) => entry.stage)).toEqual(['screen', 'filter']);
    const logged = state.stageLog.reduce((sum, entry) => sum + entry.debrisG, 0);
    expect(logged).toBeCloseTo(state.wasteDebrisG, 12);
    expect(state.stageLog.reduce((sum, entry) => sum + entry.sedimentG, 0)).toBeCloseTo(state.wasteSedimentG, 12);
  });
});
