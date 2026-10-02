import { describe, expect, it } from 'vitest';
import {
  addTransitionEnergy,
  advanceTransition,
  allocateMoleculePhases,
  createTransitionState,
  observationAt,
  saturationVapourPressureKPa,
  setTransitionEnvironment,
  setVaporisationMode,
} from '../src/science/transitionEngine';
import { ENERGY_MILESTONES_KJ, SAMPLE_MASS_KG, thermalStateAtEnergy } from '../src/science/matterEngine';
import type { Phase, PhaseFractions } from '../src/science/matterEngine';

const massTotal = (masses: { solid: number; liquid: number; gas: number }) => masses.solid + masses.liquid + masses.gas;
const fractionTotal = (fractions: PhaseFractions) => fractions.solid + fractions.liquid + fractions.gas;

describe('Change Station equilibrium energy paths', () => {
  it('starts melting, freezing and boiling from actual energy-model conditions', () => {
    const melt = createTransitionState('melting');
    const freeze = createTransitionState('freezing');
    const boil = createTransitionState('vaporisation', 'boiling');
    expect(thermalStateAtEnergy(melt.energyKJ).temperatureC).toBeCloseTo(-20, 8);
    expect(thermalStateAtEnergy(freeze.energyKJ).temperatureC).toBeCloseTo(22, 8);
    expect(thermalStateAtEnergy(boil.energyKJ).temperatureC).toBeCloseTo(92, 8);
    expect(observationAt(melt).reservoirsKg.solid).toBeCloseTo(SAMPLE_MASS_KG, 10);
    expect(observationAt(freeze).reservoirsKg.liquid).toBeCloseTo(SAMPLE_MASS_KG, 10);
    expect(observationAt(boil).reservoirsKg.liquid).toBeCloseTo(SAMPLE_MASS_KG, 10);
  });

  it('reuses the water engine latent-heat plateaux for melting, freezing and boiling', () => {
    const fusionMiddle = ENERGY_MILESTONES_KJ.meltingEnd / 2;
    const melt = addTransitionEnergy(createTransitionState('melting'), fusionMiddle + 8.4);
    const meltObservation = observationAt(melt);
    expect(meltObservation.temperatureC).toBe(0);
    expect(meltObservation.fractions.solid).toBeCloseTo(0.5, 8);
    expect(meltObservation.fractions.liquid).toBeCloseTo(0.5, 8);

    const freezeEnergyAtZero = ENERGY_MILESTONES_KJ.meltingEnd;
    const freezeAtZero = addTransitionEnergy(createTransitionState('freezing'), freezeEnergyAtZero - createTransitionState('freezing').energyKJ);
    const halfFrozen = addTransitionEnergy(freezeAtZero, -ENERGY_MILESTONES_KJ.meltingEnd / 2);
    expect(observationAt(halfFrozen).temperatureC).toBe(0);
    expect(observationAt(halfFrozen).fractions.solid).toBeCloseTo(0.5, 8);
    expect(observationAt(halfFrozen).fractions.liquid).toBeCloseTo(0.5, 8);

    const boilStart = addTransitionEnergy(createTransitionState('vaporisation', 'boiling'), 8 * SAMPLE_MASS_KG * 4.18);
    const partialBoil = addTransitionEnergy(boilStart, (ENERGY_MILESTONES_KJ.boilingEnd - ENERGY_MILESTONES_KJ.boilingStart) * 0.2);
    expect(observationAt(partialBoil).temperatureC).toBe(100);
    expect(observationAt(partialBoil).fractions.gas).toBeCloseTo(0.2, 8);
  });

  it('keeps each thermal energy update nonnegative and mass conserving over the model range', () => {
    for (const transition of ['melting', 'freezing', 'vaporisation'] as const) {
      let state = createTransitionState(transition, transition === 'vaporisation' ? 'boiling' : 'evaporation');
      for (let step = 0; step < 130; step += 1) {
        state = addTransitionEnergy(state, step % 2 ? -9 : 14);
        const observation = observationAt(state);
        expect(massTotal(observation.reservoirsKg)).toBeCloseTo(SAMPLE_MASS_KG, 10);
        expect(fractionTotal(observation.fractions)).toBeCloseTo(1, 10);
        for (const value of Object.values(observation.reservoirsKg)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

describe('qualitative surface-transfer model', () => {
  it('uses saturation pressure and relative humidity to make evaporation, condensation, and ice flux causal', () => {
    const evaporation = createTransitionState('vaporisation');
    const humidEvaporation = setTransitionEnvironment(evaporation, { humidityPercent: 95 });
    const drierEvaporation = setTransitionEnvironment(evaporation, { humidityPercent: 25 });
    expect(observationAt(drierEvaporation).transferRateKgPerSecond).toBeGreaterThan(observationAt(humidEvaporation).transferRateKgPerSecond);
    expect(observationAt(drierEvaporation).direction).toEqual(['liquid', 'gas']);
    const evaporationBalance = setTransitionEnvironment(evaporation, { humidityPercent: 100 });
    expect(observationAt(evaporationBalance).transferRateKgPerSecond).toBeCloseTo(0, 9);
    expect(observationAt(evaporationBalance).direction).toBeNull();

    const condensation = createTransitionState('condensation');
    const cooled = setTransitionEnvironment(condensation, { surfaceTempC: 0 });
    const warmed = setTransitionEnvironment(condensation, { surfaceTempC: 22 });
    expect(observationAt(cooled).transferRateKgPerSecond).toBeGreaterThan(observationAt(warmed).transferRateKgPerSecond);
    expect(observationAt(cooled).direction).toEqual(['gas', 'liquid']);
    const condensationBalance = setTransitionEnvironment(condensation, { surfaceTempC: 22, humidityPercent: 100 });
    expect(observationAt(condensationBalance).transferRateKgPerSecond).toBeCloseTo(0, 9);
    expect(observationAt(condensationBalance).direction).toBeNull();

    const sublimation = createTransitionState('sublimation');
    const dry = setTransitionEnvironment(sublimation, { humidityPercent: 15 });
    const moist = setTransitionEnvironment(advanceTransition(sublimation, 8), { humidityPercent: 100 });
    expect(observationAt(dry).direction).toEqual(['solid', 'gas']);
    expect(observationAt(dry).transferRateKgPerSecond).toBeGreaterThan(0);
    expect(observationAt(moist).direction).toEqual(['gas', 'solid']);
    expect(observationAt(moist).transferRateKgPerSecond).toBeGreaterThan(0);
    const iceEquilibriumHumidity = 100 * saturationVapourPressureKPa(-8, true) / saturationVapourPressureKPa(-8);
    const iceAtEquilibrium = setTransitionEnvironment(sublimation, { humidityPercent: iceEquilibriumHumidity });
    expect(observationAt(iceAtEquilibrium).transferRateKgPerSecond).toBeCloseTo(0, 9);
    expect(observationAt(iceAtEquilibrium).direction).toBeNull();

    const deposition = createTransitionState('deposition');
    const humid = setTransitionEnvironment(deposition, { humidityPercent: 90, surfaceTempC: -12 });
    const dryAir = setTransitionEnvironment(deposition, { humidityPercent: 10, surfaceTempC: -12 });
    expect(observationAt(humid).direction).toEqual(['gas', 'solid']);
    expect(observationAt(humid).transferRateKgPerSecond).toBeGreaterThan(observationAt(dryAir).transferRateKgPerSecond);
    expect(observationAt(dryAir).direction).toBeNull();
    const frostEquilibriumHumidity = 100 * saturationVapourPressureKPa(-9, true) / saturationVapourPressureKPa(5);
    const frostAtEquilibrium = setTransitionEnvironment(deposition, { humidityPercent: frostEquilibriumHumidity });
    expect(observationAt(frostAtEquilibrium).transferRateKgPerSecond).toBeCloseTo(0, 9);
    expect(observationAt(frostAtEquilibrium).direction).toBeNull();
    expect(saturationVapourPressureKPa(0, true)).toBeCloseTo(0.61094, 4);
  });

  it('lets surface conditions reverse net flux and reports its current direction', () => {
    let state = createTransitionState('sublimation');
    state = advanceTransition(state, 8);
    const vapourBefore = observationAt(state).reservoirsKg.gas;
    expect(vapourBefore).toBeGreaterThan(0);
    const humidBoundary = setTransitionEnvironment(state, { humidityPercent: 100 });
    expect(observationAt(humidBoundary).direction).toEqual(['gas', 'solid']);
    const reversed = advanceTransition(humidBoundary, 2);
    expect(observationAt(reversed).reservoirsKg.gas).toBeLessThan(vapourBefore);
    expect(observationAt(reversed).reservoirsKg.solid).toBeGreaterThan(observationAt(humidBoundary).reservoirsKg.solid);
    expect(massTotal(observationAt(reversed).reservoirsKg)).toBeCloseTo(SAMPLE_MASS_KG, 12);
  });

  it('enforces phase-safe surface ranges in the engine, including non-finite input', () => {
    expect(setTransitionEnvironment(createTransitionState('sublimation'), { surfaceTempC: 60 }).surfaceTempC).toBe(0);
    expect(setTransitionEnvironment(createTransitionState('deposition'), { surfaceTempC: -90 }).surfaceTempC).toBe(-25);
    expect(setTransitionEnvironment(createTransitionState('condensation'), { surfaceTempC: -10 }).surfaceTempC).toBe(0);
    expect(setTransitionEnvironment(createTransitionState('vaporisation'), { surfaceTempC: 90 }).surfaceTempC).toBe(60);
    expect(setTransitionEnvironment(createTransitionState('vaporisation'), { humidityPercent: Number.NaN }).humidityPercent).toBe(30);
  });

  it('conserves every phase ledger under extended playback, with no liquid on direct ice paths', () => {
    for (const transition of ['vaporisation', 'condensation', 'sublimation', 'deposition'] as const) {
      let state = createTransitionState(transition);
      for (let step = 0; step < 1200; step += 1) {
        state = advanceTransition(state, 0.12);
        const observation = observationAt(state);
        expect(massTotal(observation.reservoirsKg)).toBeCloseTo(SAMPLE_MASS_KG, 11);
        expect(fractionTotal(observation.fractions)).toBeCloseTo(1, 11);
        for (const mass of Object.values(observation.reservoirsKg)) {
          expect(mass).toBeGreaterThanOrEqual(0);
          expect(mass).toBeLessThanOrEqual(SAMPLE_MASS_KG);
        }
        if (transition === 'sublimation' || transition === 'deposition') {
          expect(observation.reservoirsKg.liquid).toBe(0);
        }
      }
    }
  });

  it('keeps an exact set of 18 H₂O phase identities in every ledger mixture', () => {
    const mixes: PhaseFractions[] = [
      { solid: 1, liquid: 0, gas: 0 },
      { solid: 0.5, liquid: 0.5, gas: 0 },
      { solid: 0, liquid: 0.8, gas: 0.2 },
      { solid: 0.2, liquid: 0, gas: 0.8 },
    ];
    for (const fractions of mixes) {
      const phases = allocateMoleculePhases(fractions, 18);
      expect(phases).toHaveLength(18);
      expect(phases.every((phase: Phase) => ['solid', 'liquid', 'gas'].includes(phase))).toBe(true);
      const counts = phases.reduce((sum, phase) => ({ ...sum, [phase]: sum[phase] + 1 }), { solid: 0, liquid: 0, gas: 0 });
      expect(counts.solid + counts.liquid + counts.gas).toBe(18);
      for (const phase of ['solid', 'liquid', 'gas'] as const) {
        expect(Math.abs(counts[phase] / 18 - fractions[phase])).toBeLessThanOrEqual(1 / 18 + 1e-9);
      }
    }
  });
});

describe('transition controls', () => {
  it('switches between below-boiling evaporation and the verified 100 °C boiling plateau', () => {
    const evaporation = createTransitionState('vaporisation');
    expect(observationAt(evaporation).thermal).toBe(false);
    expect(observationAt(evaporation).temperatureC).toBe(24);
    const boiling = setVaporisationMode(evaporation, 'boiling');
    expect(boiling.mode).toBe('boiling');
    expect(observationAt(boiling).thermal).toBe(true);
    expect(observationAt(boiling).temperatureC).toBeCloseTo(92, 8);
    expect(setVaporisationMode(boiling, 'boiling')).toBe(boiling);
  });
});
