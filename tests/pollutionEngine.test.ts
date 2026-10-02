import { describe, expect, it } from 'vitest';
import {
  addPollutant,
  advancePollution,
  applyPollutionMethod,
  beginMatchedPollutionTrial,
  beginPollutionChallenge,
  clarityIndexPercent,
  createPollutionState,
  describePollutionScene,
  loadMatchedPollutionSample,
  pollutionChallengeComplete,
  pollutionMassCheck,
  pollutionOutputs,
  pollutionWaterMassCheck,
  recordPollutionTrial,
  remainingPollutantG,
  remainingTotalPollutantG,
  saltRemainingG,
  setPollutionHypothesis,
} from '../src/science/pollutionEngine';

describe('pollutant inputs, locations and conserved ledgers', () => {
  it('models oil, litter, suspended sediment and invisible dissolved salt in distinct compartments', () => {
    let state = createPollutionState();
    state = addPollutant(state, 'oil', 2);
    state = addPollutant(state, 'litter', 4);
    state = addPollutant(state, 'sediment', 10);
    state = addPollutant(state, 'salt', 3);
    expect(state.pollutants.oil.surfaceG).toBe(2);
    expect(state.pollutants.litter.surfaceG).toBe(4);
    expect(state.pollutants.sediment.suspendedG).toBe(10);
    expect(state.pollutants.salt.dissolvedG).toBe(3);
    for (const pollutant of ['oil', 'litter', 'sediment', 'salt'] as const) {
      expect(pollutionMassCheck(state, pollutant).errorG).toBe(0);
    }
    expect(pollutionWaterMassCheck(state).errorMl).toBe(0);
  });

  it('reports signed mass and water ledger errors instead of clamping overdraws to zero', () => {
    const state = addPollutant(createPollutionState(), 'oil', 2);
    const overRecovered = { ...state, pollutants: { ...state.pollutants, oil: { ...state.pollutants.oil, surfaceG: 0, recoveredG: 3 } } };
    const overWater = { ...state, waterBodyMl: state.waterInputMl + 1 };
    expect(pollutionMassCheck(overRecovered, 'oil').errorG).toBe(-1);
    expect(pollutionWaterMassCheck(overWater).errorMl).toBe(-1);
  });

  it('settles sediment from suspension to the bed without deleting pollutant mass', () => {
    let state = addPollutant(createPollutionState(), 'sediment', 18);
    state = advancePollution(state, 3);
    expect(state.pollutants.sediment.suspendedG).toBeCloseTo(10.8, 6);
    expect(state.pollutants.sediment.settledG).toBeCloseTo(7.2, 6);
    expect(pollutionMassCheck(state, 'sediment')).toEqual({ inputG: 18, remainingG: 18, recoveredG: 0, recoveredWaterG: 0, wasteG: 0, errorG: 0 });
    expect(clarityIndexPercent(state)).toBeLessThan(clarityIndexPercent(addPollutant(createPollutionState(), 'salt', 12)));
  });

  it('keeps a matched sample recipe identical for controlled treatment trials', () => {
    const first = recordPollutionTrial(applyPollutionMethod(loadMatchedPollutionSample(createPollutionState()), 'filter'));
    const repeated = beginMatchedPollutionTrial(first);
    expect(first.matchedSample).toBe(true);
    expect(repeated.matchedSample).toBe(true);
    expect((['oil', 'litter', 'sediment', 'salt'] as const).map((id) => first.pollutants[id].inputG))
      .toEqual((['oil', 'litter', 'sediment', 'salt'] as const).map((id) => repeated.pollutants[id].inputG));
    expect(repeated.trials).toHaveLength(1);
  });
});

describe('distinct removal mechanisms', () => {
  it('skimming recovers floating oil but does not remove dissolved salt', () => {
    let state = createPollutionState();
    state = addPollutant(state, 'oil', 5);
    state = addPollutant(state, 'salt', 8);
    const skimmed = applyPollutionMethod(state, 'skim');
    expect(skimmed.pollutants.oil.recoveredG).toBeCloseTo(3.9, 6);
    expect(remainingPollutantG(skimmed.pollutants.oil)).toBeCloseTo(1.1, 6);
    expect(saltRemainingG(skimmed)).toBe(8);
    expect(pollutionMassCheck(skimmed, 'oil').errorG).toBe(0);
    expect(pollutionMassCheck(skimmed, 'salt').errorG).toBe(0);
  });

  it('screening catches litter, filtration catches suspended sediment but leaves dissolved salt', () => {
    let state = createPollutionState();
    state = addPollutant(state, 'litter', 5);
    state = addPollutant(state, 'sediment', 24);
    state = addPollutant(state, 'salt', 10);
    const screened = applyPollutionMethod(state, 'screen');
    expect(screened.pollutants.litter.wasteG).toBeCloseTo(4.8, 6);
    expect(remainingPollutantG(screened.pollutants.sediment)).toBe(24);
    const beforeClarity = clarityIndexPercent(screened);
    const filtered = applyPollutionMethod(screened, 'filter');
    expect(filtered.pollutants.sediment.wasteG).toBeCloseTo(22.56, 6);
    expect(remainingPollutantG(filtered.pollutants.sediment)).toBeCloseTo(1.44, 6);
    expect(saltRemainingG(filtered)).toBe(10);
    expect(clarityIndexPercent(filtered)).toBeGreaterThan(beforeClarity);
    for (const pollutant of ['oil', 'litter', 'sediment', 'salt'] as const) expect(pollutionMassCheck(filtered, pollutant).errorG).toBe(0);
    expect(pollutionWaterMassCheck(filtered).errorMl).toBe(0);
  });

  it('decants upper water after settling, leaves bed sludge, and transfers dissolved salt with the water', () => {
    let state = addPollutant(createPollutionState(), 'sediment', 20);
    state = addPollutant(state, 'salt', 10);
    state = advancePollution(state, 5);
    expect(state.pollutants.sediment.settledG).toBeCloseTo(12, 6);
    const decanted = applyPollutionMethod(state, 'decant');
    expect(decanted.waterBodyMl).toBe(280);
    expect(decanted.recoveredWaterMl).toBe(720);
    expect(decanted.pollutants.sediment.settledG).toBeCloseTo(12, 6);
    expect(decanted.pollutants.sediment.suspendedG).toBeCloseTo(2.24, 6);
    expect(decanted.pollutants.sediment.recoveredWaterG).toBeCloseTo(5.76, 6);
    expect(decanted.pollutants.salt.dissolvedG).toBeCloseTo(2.8, 6);
    expect(decanted.pollutants.salt.recoveredWaterG).toBeCloseTo(7.2, 6);
    expect(pollutionMassCheck(decanted, 'sediment').errorG).toBe(0);
    expect(pollutionMassCheck(decanted, 'salt').errorG).toBe(0);
    expect(pollutionWaterMassCheck(decanted).errorMl).toBe(0);
  });

  it('distills pollution out of a decanted stream instead of treating recovered water as automatically clean', () => {
    let state = createPollutionState();
    state = addPollutant(state, 'sediment', 20);
    state = addPollutant(state, 'salt', 10);
    state = advancePollution(state, 5);
    state = applyPollutionMethod(state, 'decant');
    expect(state.pollutants.salt.recoveredWaterG).toBeCloseTo(7.2, 6);
    state = applyPollutionMethod(state, 'distill');
    expect(state.pollutants.salt.recoveredWaterG).toBe(0);
    expect(state.pollutants.salt.wasteG).toBe(10);
    expect(state.recoveredWaterMl).toBe(900);
    expect(state.wasteWaterMl).toBe(100);
    expect(pollutionWaterMassCheck(state).errorMl).toBe(0);
    expect(pollutionMassCheck(state, 'salt').errorG).toBe(0);
  });

  it('distillation transfers nonvolatile pollutants to waste and tracks recovered and waste water', () => {
    let state = createPollutionState();
    state = addPollutant(state, 'salt', 12);
    state = addPollutant(state, 'oil', 3);
    const distilled = applyPollutionMethod(state, 'distill');
    expect(distilled.waterBodyMl).toBe(0);
    expect(distilled.recoveredWaterMl).toBe(900);
    expect(distilled.wasteWaterMl).toBe(100);
    expect(remainingTotalPollutantG(distilled)).toBe(0);
    expect(distilled.pollutants.salt.wasteG).toBe(12);
    expect(distilled.pollutants.oil.wasteG).toBe(3);
    expect(pollutionWaterMassCheck(distilled).errorMl).toBe(0);
    for (const pollutant of ['oil', 'litter', 'sediment', 'salt'] as const) expect(pollutionMassCheck(distilled, pollutant).errorG).toBe(0);
  });
});

describe('matched trials and challenge state', () => {
  it('records comparable results only after a treatment, including clarity and water outputs', () => {
    let state = loadMatchedPollutionSample(createPollutionState());
    expect(recordPollutionTrial(state)).toBe(state);
    state = setPollutionHypothesis(state, 'Filtering traps sediment, but salt passes through.');
    state = advancePollution(state, 3);
    state = applyPollutionMethod(state, 'filter');
    state = recordPollutionTrial(state);
    expect(state.trials).toHaveLength(1);
    expect(state.trials[0].matchedInitialSample).toBe(true);
    expect(state.trials[0].input).toEqual({ oil: 6, litter: 8, sediment: 32, salt: 12 });
    expect(state.trials[0].hypothesis).toBe('Filtering traps sediment, but salt passes through.');
    expect(state.trials[0].elapsedModelSeconds).toBe(3);
    expect(state.trials[0].saltRemainingG).toBe(12);
    expect(state.trials[0].clarityPercent).toBeGreaterThan(90);
    expect(state.trials[0].remainingG).toBeGreaterThan(12);
    const repeated = beginMatchedPollutionTrial(state);
    expect(repeated.trials).toHaveLength(1);
    expect(remainingTotalPollutantG(repeated)).toBe(58);
  });

  it('shows salt remains after filtering, then passes only after distilling and recovering water', () => {
    let state = beginPollutionChallenge(createPollutionState());
    state = applyPollutionMethod(state, 'filter');
    expect(state.challengeFiltered).toBe(true);
    expect(saltRemainingG(state)).toBe(12);
    expect(pollutionChallengeComplete(state)).toBe(false);
    state = applyPollutionMethod(state, 'distill');
    expect(state.challengeDistilled).toBe(true);
    expect(pollutionChallengeComplete(state)).toBe(true);
    expect(state.recoveredWaterMl).toBeGreaterThan(0);
    expect(saltRemainingG(state)).toBe(0);
  });
});

describe('four separate outputs and the state-aware scene description', () => {
  it('keeps pollution in the body, recovered water, recovered material and waste separate and conserved', () => {
    let state = loadMatchedPollutionSample(createPollutionState());
    const start = pollutionOutputs(state);
    expect(start.body.surfaceOilG).toBe(6);
    expect(start.body.floatingLitterG).toBe(8);
    expect(start.body.suspendedSedimentG).toBe(32);
    expect(start.body.settledSedimentG).toBe(0);
    expect(start.body.dissolvedSaltG).toBe(12);
    expect(start.recoveredWater.ml).toBe(0);
    expect(start.recoveredMaterial.totalG).toBe(0);
    expect(start.waste.pollutantG).toBe(0);

    state = applyPollutionMethod(state, 'skim');
    const skimmed = pollutionOutputs(state);
    expect(skimmed.recoveredMaterial.oilG).toBeCloseTo(6 * 0.78, 5);
    expect(skimmed.recoveredMaterial.totalG).toBeCloseTo(skimmed.recoveredMaterial.oilG, 5);
    expect(skimmed.waste.pollutantG).toBe(0);

    state = applyPollutionMethod(state, 'screen');
    expect(pollutionOutputs(state).waste.litterG).toBeCloseTo(8 * 0.96, 5);

    state = advancePollution(state, 4);
    state = applyPollutionMethod(state, 'decant');
    const decanted = pollutionOutputs(state);
    expect(decanted.recoveredWater.ml).toBeGreaterThan(0);
    expect(decanted.recoveredWater.dissolvedSaltG).toBeGreaterThan(0);
    expect(decanted.body.settledSedimentG).toBeGreaterThan(0);
    const total = decanted.body.totalG + decanted.recoveredWater.pollutantG + decanted.recoveredMaterial.totalG + decanted.waste.pollutantG;
    expect(total).toBeCloseTo(58, 5);
  });

  it('describes where each pollutant is, the clarity, the last treatment and the outputs', () => {
    expect(describePollutionScene(createPollutionState())).toContain('no pollutant added');
    let state = loadMatchedPollutionSample(createPollutionState());
    const before = describePollutionScene(state);
    expect(before).toContain('6.0 g oil film on the surface');
    expect(before).toContain('8.0 g litter floating');
    expect(before).toContain('32.0 g sediment suspended');
    expect(before).toContain('12.0 g dissolved salt, invisible');
    expect(before).not.toContain('sodium and chloride ions');
    expect(describePollutionScene(state, true)).toContain('sodium and chloride ions');
    expect(before).toContain('Last treatment: none yet');
    state = applyPollutionMethod(state, 'filter');
    const after = describePollutionScene(state);
    expect(after).not.toBe(before);
    expect(after).toContain('Last treatment: Filter suspended sediment');
    expect(after).toContain('Water clarity 95 percent');
    expect(after).toContain('12.0 g dissolved salt');
    expect(after).toContain('Looking clear is not a safety test');
    state = applyPollutionMethod(state, 'distill');
    const distilled = describePollutionScene(state);
    expect(distilled).toContain('Recovered water 893 mL');
    expect(distilled).toContain('Waste 58.0 g');
  });
});
