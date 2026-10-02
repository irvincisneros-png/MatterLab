import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ANION_RADIUS, buildDynamicModel, buildSolidModel, CATION_RADIUS, FLOOR_Y, planSolid } from '../src/components/scene/SolutionsParticles';
import {
  addSolute,
  advanceSolutions,
  beginNewSolubilityTrial,
  beginSupersaturationChallenge,
  constituentLedgerAt,
  createSolutionsState,
  hasExcessSolute,
  isAtEquilibrium,
  isExactSolubilityMeasurement,
  loadComparisonPreset,
  massLedgerAt,
  recordSolubilityTrial,
  relativeConcentrationLabel,
  seedSupersaturatedSolution,
  setParticleSize,
  setSolutionTemperature,
  setStirring,
  solubilityCapacityG,
  SOLUTES,
  SOLUTE_MASS_LIMIT_G,
  supersaturationChallengeComplete,
  type SoluteId,
} from '../src/science/solutionsEngine';

describe('published classroom solubility curves', () => {
  it('keeps source-based capacities separate by substance and temperature', () => {
    expect(solubilityCapacityG('salt', 20)).toBe(36);
    expect(solubilityCapacityG('sugar', 20)).toBe(204);
    expect(solubilityCapacityG('sugar', 100)).toBe(487);
    expect(solubilityCapacityG('potassium-chloride', 20)).toBe(33);
    expect(solubilityCapacityG('sand', 100)).toBe(0);
    expect(solubilityCapacityG('salt', 120)).toBe(39);
    expect(solubilityCapacityG('salt', -5)).toBe(35.5);
    expect(solubilityCapacityG('sugar', 60)).toBeGreaterThan(solubilityCapacityG('salt', 60));
    expect(solubilityCapacityG('salt', 80)).toBeGreaterThan(solubilityCapacityG('salt', 0));
    expect(solubilityCapacityG('sugar', 80)).toBeGreaterThan(solubilityCapacityG('sugar', 0) * 1.8);
    expect(SOLUTES.salt.curve).toHaveLength(6);
  });
});

describe('rate, capacity and conserved solute mass', () => {
  it('lets stirring and fine grains change dissolving speed without changing capacity', () => {
    const start = addSolute(createSolutionsState('dissolving', 'salt'), 25);
    const coarse = advanceSolutions(start, 1);
    const fine = advanceSolutions(setParticleSize(start, 'fine'), 1);
    const stirred = advanceSolutions(setStirring(start, true), 1);
    expect(fine.dissolvedG).toBeGreaterThan(coarse.dissolvedG);
    expect(stirred.dissolvedG).toBeGreaterThan(coarse.dissolvedG);
    expect(solubilityCapacityG('salt', 20)).toBe(36);
    expect(coarse.dissolvedG).toBeLessThan(solubilityCapacityG('salt', 20));
  });

  it('caps dissolved mass at capacity and conserves added = dissolved + undissolved across solutes', () => {
    const materials: readonly SoluteId[] = ['salt', 'sugar', 'potassium-chloride', 'sand'];
    for (const soluteId of materials) {
      let state = createSolutionsState('dissolving', soluteId);
      state = setStirring(state, true);
      state = addSolute(state, 90);
      for (let index = 0; index < 200; index += 1) state = advanceSolutions(state, 0.25);
      const ledger = massLedgerAt(state);
      expect(ledger.massErrorG).toBe(0);
      expect(ledger.dissolvedG).toBeLessThanOrEqual(solubilityCapacityG(soluteId, state.temperatureC) + 0.000001);
      expect(ledger.undissolvedG).toBeGreaterThanOrEqual(0);
      expect(ledger.dissolvedG + ledger.undissolvedG).toBeCloseTo(90, 6);
    }
    expect(addSolute(createSolutionsState(), SOLUTE_MASS_LIMIT_G + 100).addedG).toBe(SOLUTE_MASS_LIMIT_G);
  });

  it('does not report an unsaturated observation as an exact solubility measurement', () => {
    let state = createSolutionsState('investigation', 'salt');
    state = addSolute(state, 10);
    state = advanceSolutions(state, 60);
    expect(isAtEquilibrium(state)).toBe(true);
    expect(hasExcessSolute(state)).toBe(false);
    expect(isExactSolubilityMeasurement(state)).toBe(false);
    state = recordSolubilityTrial(state);
    expect(state.trials[0].status).toBe('lower-bound-unsaturated');
    expect(state.trials[0].measurementG).toBeNull();
    expect(state.trials[0].lowerBoundG).toBeCloseTo(10, 6);

    state = addSolute(state, 40);
    for (let index = 0; index < 120; index += 1) state = advanceSolutions(state, 1);
    expect(isExactSolubilityMeasurement(state)).toBe(true);
    state = recordSolubilityTrial(state);
    expect(state.trials[1].status).toBe('equilibrium-with-excess');
    expect(state.trials[1].measurementG).toBe(36);
    expect(state.trials[1].undissolvedG).toBeCloseTo(14, 6);
    const nextTrial = beginNewSolubilityTrial(state);
    expect(nextTrial.addedG).toBe(0);
    expect(nextTrial.trials).toHaveLength(2);
  });

  it('preserves ion constituents for NaCl and KCl while sucrose remains whole molecules', () => {
    for (const soluteId of ['salt', 'potassium-chloride'] as const) {
      let ionic = addSolute(createSolutionsState('particles', soluteId), 40);
      ionic = advanceSolutions(ionic, 120);
      const constituents = constituentLedgerAt(ionic);
      expect(constituents.kind).toBe('ionic');
      expect(constituents.totalCationMol).toBeCloseTo(constituents.totalAnionMol, 12);
      expect(constituents.dissolvedCationMol).toBeCloseTo(constituents.dissolvedAnionMol, 12);
      expect(constituents.dissolvedCationMol + constituents.undissolvedCationMol).toBeCloseTo(constituents.totalCationMol, 12);
      expect(constituents.dissolvedAnionMol + constituents.undissolvedAnionMol).toBeCloseTo(constituents.totalAnionMol, 12);
      expect(constituents.sodiumMassG + constituents.chlorideMassG + constituents.potassiumMassG).toBeCloseTo(40, 10);
      expect(constituents.totalSucroseMoleculesMol).toBe(0);
    }

    const sucrose = advanceSolutions(addSolute(createSolutionsState('particles', 'sugar'), 100), 400);
    const moleculeLedger = constituentLedgerAt(sucrose);
    expect(moleculeLedger.kind).toBe('molecular');
    expect(moleculeLedger.totalSucroseMoleculesMol).toBeCloseTo(100 / 342.2965, 12);
    expect(moleculeLedger.dissolvedSucroseMoleculesMol).toBeCloseTo(moleculeLedger.totalSucroseMoleculesMol, 12);
    expect(moleculeLedger.totalCationMol).toBe(0);
    expect(moleculeLedger.sucroseMassG).toBe(100);
  });
});

describe('playback pacing of the accelerated model', () => {
  const secondsToEquilibrium = (soluteId: SoluteId, massG: number, stirring: boolean, size: 'coarse' | 'fine') => {
    let state = setParticleSize(setStirring(addSolute(createSolutionsState('dissolving', soluteId), massG), stirring), size);
    let seconds = 0;
    while (!isAtEquilibrium(state) && seconds < 1000) { state = advanceSolutions(state, 1 / 60); seconds += 1 / 60; }
    return seconds;
  };

  it('takes several seconds of playback for 10 g NaCl when stirred and noticeably longer when unstirred', () => {
    const stirred = secondsToEquilibrium('salt', 10, true, 'coarse');
    const unstirred = secondsToEquilibrium('salt', 10, false, 'coarse');
    expect(stirred).toBeGreaterThanOrEqual(5);
    expect(stirred).toBeLessThanOrEqual(10);
    expect(unstirred).toBeGreaterThan(stirred * 2);
    expect(secondsToEquilibrium('salt', 10, true, 'fine')).toBeLessThan(stirred);
  });

  it('gives the same result for one 1 s Step as sixty frames', () => {
    const start = setStirring(addSolute(createSolutionsState('dissolving', 'salt'), 25), true);
    let frames = start;
    for (let index = 0; index < 60; index += 1) frames = advanceSolutions(frames, 1 / 60);
    expect(advanceSolutions(start, 1).dissolvedG).toBeCloseTo(frames.dissolvedG, 1);
  });
});

describe('relative concentration and supersaturation', () => {
  it('compares concentration only against a matched sample, independently from capacity', () => {
    const dilute = loadComparisonPreset(createSolutionsState('comparison', 'sugar'), 'dilute');
    const concentrated = loadComparisonPreset(createSolutionsState('comparison', 'sugar'), 'concentrated');
    const saturated = loadComparisonPreset(createSolutionsState('comparison', 'sugar'), 'saturated');
    expect(relativeConcentrationLabel(dilute)).toBe('less-than-reference');
    expect(relativeConcentrationLabel(concentrated)).toBe('more-than-reference');
    expect(relativeConcentrationLabel(saturated)).toBe('more-than-reference');
    expect(isAtEquilibrium(saturated)).toBe(true);
    expect(hasExcessSolute(saturated)).toBe(true);
    expect(relativeConcentrationLabel(createSolutionsState('comparison', 'sugar'))).toBe('uncompared');
  });

  it('allows a clear solution warmed above room temperature to become metastable on seed-free cooling', () => {
    let state = createSolutionsState('comparison', 'sugar');
    state = setSolutionTemperature(state, 40);
    state = addSolute(state, 230);
    state = advanceSolutions(state, 400);
    expect(massLedgerAt(state).undissolvedG).toBe(0);
    expect(state.hotClearHistory).toBe(true);
    state = setSolutionTemperature(state, 20);
    expect(state.metastable).toBe(true);
    expect(massLedgerAt(state).undissolvedG).toBe(0);
    expect(isAtEquilibrium(state)).toBe(false);
  });

  it('requires a genuinely hot and seed-free clear preparation and conserves mass when a seed starts crystallisation', () => {
    const challenge = beginSupersaturationChallenge(createSolutionsState('comparison', 'sugar'));
    expect(challenge.temperatureC).toBe(80);
    expect(challenge.addedG).toBe(challenge.dissolvedG);
    expect(massLedgerAt(challenge).undissolvedG).toBe(0);
    const cooled = setSolutionTemperature(challenge, 40);
    expect(cooled.metastable).toBe(true);
    expect(massLedgerAt(cooled).undissolvedG).toBe(0);
    expect(supersaturationChallengeComplete(cooled)).toBe(false);
    const crystallised = seedSupersaturatedSolution(cooled);
    expect(crystallised.metastable).toBe(false);
    expect(crystallised.seedAddedG).toBeCloseTo(0.2, 8);
    expect(massLedgerAt(crystallised).massErrorG).toBe(0);
    expect(massLedgerAt(crystallised).dissolvedG).toBeCloseTo(solubilityCapacityG('sugar', 40), 6);
    expect(supersaturationChallengeComplete(crystallised)).toBe(true);

    const roomTemperature = advanceSolutions(addSolute(createSolutionsState('comparison', 'sugar'), 200), 600);
    const cooledWithoutHotPrep = setSolutionTemperature(roomTemperature, 0);
    expect(cooledWithoutHotPrep.metastable).toBe(false);
    expect(massLedgerAt(cooledWithoutHotPrep).undissolvedG).toBeGreaterThan(0);
  });
});

describe('particle scene model', () => {
  const dissolvingSalt = (size: 'coarse' | 'fine') => {
    let state = setParticleSize(setStirring(addSolute(createSolutionsState('dissolving', 'salt'), 50), true), size);
    state = advanceSolutions(state, 2);
    return state;
  };

  it('draws undissolved NaCl as alternating rock-salt lattice sites and shrinks the crystal with the undissolved mass', () => {
    const early = dissolvingSalt('coarse');
    const plan = planSolid(early, true);
    const model = buildSolidModel(plan);
    expect(plan.kind).toBe('ionic');
    const total = model.cations.length + model.anions.length;
    expect(total).toBeGreaterThan(40);
    // Rock salt: every site has exactly the opposite species as its nearest axis neighbour.
    expect(Math.abs(model.cations.length - model.anions.length)).toBeLessThanOrEqual(Math.ceil(total * 0.15));
    expect(model.cations.every((ion) => Math.abs(ion.p[1] - FLOOR_Y) < 0.6)).toBe(true);
    const later = advanceSolutions(early, 12);
    const laterModel = buildSolidModel(planSolid(later, true));
    expect(laterModel.cations.length + laterModel.anions.length).toBeLessThan(total);
    // Equilibrium with excess: crystals remain; no loose pairs, so there are lattice bonds.
    expect(laterModel.bonds.length).toBeGreaterThan(0);
  });

  it('makes fine crystals more numerous and smaller than coarse crystals', () => {
    const coarse = planSolid(dissolvingSalt('coarse'), true);
    const fine = planSolid(dissolvingSalt('fine'), true);
    expect(fine.crystals.length).toBeGreaterThan(coarse.crystals.length * 2);
    expect(Math.max(...fine.crystals.map((c) => c.edge))).toBeLessThan(Math.max(...coarse.crystals.map((c) => c.edge)));
  });

  it('orients hydration waters with O towards a cation and H towards an anion', () => {
    for (let seconds = 0.4; seconds < 2.6; seconds += 0.4) {
      const state = { ...dissolvingSalt('coarse'), modelTimeSeconds: seconds };
      const plan = planSolid(state, true);
      expect(plan.detachers.length).toBeGreaterThan(0);
      const model = buildDynamicModel(state, plan, true);
      const bulk = 40;
      const shell = model.waters.slice(bulk);
      expect(shell.length).toBeGreaterThan(0);
      const ions = [...model.cations.map((ion) => ({ ion, cation: true })), ...model.anions.map((ion) => ({ ion, cation: false }))];
      for (const water of shell) {
        const [x, y, z, w] = water.q!;
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(x, y, z, w));
        const hydrogen = new THREE.Vector3(...water.p).addScaledVector(axis, 0.09 * water.s);
        // The hydrated ion is the one sitting exactly one shell distance from this water's oxygen.
        const host = ions.find((entry) => Math.abs(Math.hypot(water.p[0] - entry.ion.p[0], water.p[1] - entry.ion.p[1], water.p[2] - entry.ion.p[2]) - (entry.cation ? CATION_RADIUS.sodium + 0.085 : ANION_RADIUS + 0.1)) < 1e-6);
        expect(host).toBeDefined();
        const oxygenDistance = new THREE.Vector3(...water.p).distanceTo(new THREE.Vector3(...host!.ion.p));
        const hydrogenDistance = hydrogen.distanceTo(new THREE.Vector3(...host!.ion.p));
        if (host!.cation) expect(oxygenDistance).toBeLessThan(hydrogenDistance);
        else expect(hydrogenDistance).toBeLessThan(oxygenDistance);
      }
    }
  });

  it('keeps dissolved marker counts tied to dissolved mass and never splits sucrose', () => {
    let state = setStirring(addSolute(createSolutionsState('dissolving', 'salt'), 25), true);
    state = advanceSolutions(state, 30);
    const ledger = massLedgerAt(state);
    const dynamic = buildDynamicModel(state, planSolid(state, true), true);
    expect(ledger.undissolvedG).toBe(0);
    expect(dynamic.cations.length).toBe(Math.min(24, Math.ceil(ledger.dissolvedG / 2.5)));
    expect(dynamic.anions.length).toBe(dynamic.cations.length);
    const sugar = advanceSolutions(setStirring(addSolute(createSolutionsState('dissolving', 'sugar'), 40), true), 60);
    const sugarModel = buildDynamicModel(sugar, planSolid(sugar, true), true);
    expect(sugarModel.cations.length + sugarModel.anions.length).toBe(0);
    expect(sugarModel.sucrose.length).toBe(Math.min(24, Math.ceil(massLedgerAt(sugar).dissolvedG / 2.5)));
    const sand = addSolute(createSolutionsState('dissolving', 'sand'), 30);
    const sandPlan = planSolid(sand, true);
    expect(sandPlan.kind).toBe('sand');
    expect(buildDynamicModel(sand, sandPlan, true).sand).toHaveLength(0);
    expect(buildSolidModel(sandPlan).sand.length).toBeGreaterThan(10);
  });
});

describe('particle-model starting solution', () => {
  it('opens the particle lesson on a fully dissolved, below-saturation solution', async () => {
    const { createSolutionsState, prepareParticleModelSolution, massLedgerAt, solubilityCapacityG } = await import('../src/science/solutionsEngine');
    const salt = prepareParticleModelSolution(createSolutionsState('particles', 'salt'));
    expect(massLedgerAt(salt)).toMatchObject({ addedG: 20, dissolvedG: 20, undissolvedG: 0 });
    expect(salt.addedG).toBeLessThan(solubilityCapacityG('salt', salt.temperatureC));
    expect(prepareParticleModelSolution(createSolutionsState('particles', 'sand')).addedG).toBe(0);
    expect(prepareParticleModelSolution(createSolutionsState('dissolving', 'salt')).addedG).toBe(0);
  });
});
