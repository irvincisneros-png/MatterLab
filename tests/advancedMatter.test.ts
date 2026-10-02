import { describe, expect, it } from 'vitest';
import {
  advanceBec,
  advancePlasma,
  becAtomCounts,
  becCondensateFractionAtTemperature,
  becFractionsAt,
  BEC_CRITICAL_TEMPERATURE_NK,
  BEC_MARKERS,
  BEC_TEMPERATURE_BOUNDS_NK,
  createBecState,
  createPlasmaState,
  ionisedNucleiAtEnergy,
  PLASMA_NUCLEI,
  plasmaForceResponse,
  plasmaLedgerAt,
  setBecTemperature,
  setPlasmaElectricField,
  setPlasmaEnergy,
} from '../src/science/advancedMatterEngine';

describe('hydrogen plasma model', () => {
  it('conserves nuclei, the electron population and net charge throughout ionisation and recombination', () => {
    for (let input = -20; input <= 120; input += 1) {
      const state = setPlasmaEnergy(createPlasmaState(), input);
      const ledger = plasmaLedgerAt(state);
      expect(ledger.nuclei).toBe(PLASMA_NUCLEI);
      expect(ledger.neutralAtoms + ledger.positiveIons).toBe(PLASMA_NUCLEI);
      expect(ledger.boundElectrons + ledger.freeElectrons).toBe(PLASMA_NUCLEI);
      expect(ledger.totalElectrons).toBe(PLASMA_NUCLEI);
      expect(ledger.positiveIons).toBe(ledger.freeElectrons);
      expect(ledger.netChargeInElementaryCharges).toBe(0);
      expect(ledger.positiveIons).toBeGreaterThanOrEqual(0);
      expect(ledger.positiveIons).toBeLessThanOrEqual(PLASMA_NUCLEI);
    }
  });

  it('increases ionisation with relative energy and recombines the same one-to-one ion/electron pairs', () => {
    const starting = createPlasmaState();
    const hotter = setPlasmaEnergy(starting, 80);
    const cooler = setPlasmaEnergy(hotter, 0);
    expect(hotter.ionisedNuclei).toBeGreaterThan(starting.ionisedNuclei);
    expect(cooler.ionisedNuclei).toBe(0);
    expect(plasmaLedgerAt(hotter).freeElectrons).toBe(hotter.ionisedNuclei);
    expect(plasmaLedgerAt(cooler).boundElectrons).toBe(PLASMA_NUCLEI);
    expect(ionisedNucleiAtEnergy(10)).toBe(0);
    expect(ionisedNucleiAtEnergy(100)).toBe(PLASMA_NUCLEI);
    expect(setPlasmaEnergy(starting, Number.NaN)).toBe(starting);
  });

  it('gives opposite qE force responses to ions and electrons, zero response to neutral atoms, and reverses them with E', () => {
    const positiveField = setPlasmaElectricField(createPlasmaState(), 65);
    const reversedField = setPlasmaElectricField(positiveField, -65);
    expect(plasmaForceResponse(1, positiveField.electricField)).toBe(65);
    expect(plasmaForceResponse(-1, positiveField.electricField)).toBe(-65);
    expect(plasmaForceResponse(0, positiveField.electricField)).toBe(0);
    expect(plasmaForceResponse(1, reversedField.electricField)).toBe(-65);
    expect(plasmaForceResponse(-1, reversedField.electricField)).toBe(65);
    expect(plasmaForceResponse(1, 1_000)).toBe(100);
    expect(plasmaForceResponse(-1, -1_000)).toBe(100);
    expect(plasmaLedgerAt(positiveField)).toEqual(plasmaLedgerAt(reversedField));
  });

  it('keeps playback separate from the composition and field controls', () => {
    const starting = createPlasmaState();
    const stepped = advancePlasma(starting, 1);
    expect(stepped.modelTimeSeconds).toBe(1);
    expect(plasmaLedgerAt(stepped)).toEqual(plasmaLedgerAt(starting));
    expect(advancePlasma(starting, 0)).toBe(starting);
    expect(advancePlasma(starting, Number.NaN)).toBe(starting);
  });
});

describe('rubidium-87 condensate model', () => {
  it('uses the ideal harmonic-trap relation below Tc and zero condensate fraction at and above Tc', () => {
    expect(BEC_CRITICAL_TEMPERATURE_NK).toBe(180);
    expect(becCondensateFractionAtTemperature(90)).toBeCloseTo(0.875, 12);
    expect(becCondensateFractionAtTemperature(180)).toBe(0);
    expect(becCondensateFractionAtTemperature(260)).toBe(0);
    expect(becCondensateFractionAtTemperature(1, 0)).toBe(0);
  });

  it('keeps temperature positive, fractions bounded and atom markers conserved across the control range', () => {
    const state = createBecState();
    expect(BEC_TEMPERATURE_BOUNDS_NK.minimum).toBeGreaterThan(0);
    for (let temperature = BEC_TEMPERATURE_BOUNDS_NK.minimum; temperature <= BEC_TEMPERATURE_BOUNDS_NK.maximum; temperature += 1) {
      const next = setBecTemperature(state, temperature);
      const fractions = becFractionsAt(next);
      const counts = becAtomCounts(next);
      expect(next.temperatureNK).toBeGreaterThan(0);
      expect(fractions.condensed).toBeGreaterThanOrEqual(0);
      expect(fractions.condensed).toBeLessThanOrEqual(1);
      expect(fractions.thermal).toBeGreaterThanOrEqual(0);
      expect(fractions.thermal).toBeLessThanOrEqual(1);
      expect(fractions.condensed + fractions.thermal).toBeCloseTo(1, 12);
      expect(counts.total).toBe(BEC_MARKERS);
      expect(counts.condensed + counts.thermal).toBe(BEC_MARKERS);
    }
    expect(setBecTemperature(state, 0).temperatureNK).toBe(BEC_TEMPERATURE_BOUNDS_NK.minimum);
    expect(setBecTemperature(state, 1_000).temperatureNK).toBe(BEC_TEMPERATURE_BOUNDS_NK.maximum);
    expect(setBecTemperature(state, Number.NaN)).toBe(state);
  });

  it('has a monotonic shared-state fraction when cooling and none after warming above the threshold', () => {
    let previous = 0;
    for (let temperature = BEC_TEMPERATURE_BOUNDS_NK.maximum; temperature >= BEC_TEMPERATURE_BOUNDS_NK.minimum; temperature -= 1) {
      const fraction = becCondensateFractionAtTemperature(temperature);
      expect(fraction).toBeGreaterThanOrEqual(previous);
      previous = fraction;
    }
    const warm = setBecTemperature(createBecState(), 230);
    const cold = setBecTemperature(warm, 90);
    const rewarmed = setBecTemperature(cold, 220);
    expect(becFractionsAt(cold).condensed).toBeCloseTo(0.875, 12);
    expect(becFractionsAt(rewarmed).condensed).toBe(0);
    expect(becAtomCounts(cold).total).toBe(becAtomCounts(rewarmed).total);
  });

  it('keeps playback time separate from the temperature-controlled fractions', () => {
    const state = createBecState();
    const stepped = advanceBec(state, 1);
    expect(stepped.modelTimeSeconds).toBe(1);
    expect(becFractionsAt(stepped)).toEqual(becFractionsAt(state));
    expect(advanceBec(state, 0)).toBe(state);
    expect(advanceBec(state, Number.NaN)).toBe(state);
  });
});
