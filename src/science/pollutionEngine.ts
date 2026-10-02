export type PollutantId = 'oil' | 'litter' | 'sediment' | 'salt';
export type PollutionMethodId = 'skim' | 'screen' | 'decant' | 'filter' | 'distill';
export type PollutantInventory = Readonly<{
  inputG: number;
  surfaceG: number;
  suspendedG: number;
  dissolvedG: number;
  settledG: number;
  recoveredG: number;
  recoveredWaterG: number;
  wasteG: number;
}>;
export type PollutantLedger = Readonly<Record<PollutantId, PollutantInventory>>;
export type PollutionVector = Readonly<Record<PollutantId, number>>;

export const STARTING_WATER_ML = 1000;
export const MATCHED_POLLUTION_RECIPE: PollutionVector = { oil: 6, litter: 8, sediment: 32, salt: 12 };
export const POLLUTANTS: readonly Readonly<{ id: PollutantId; label: string; addG: number; color: string; location: string }>[] = [
  { id: 'oil', label: 'Heavy oil film', addG: 2, color: '#efb33b', location: 'floats at the water surface in this model' },
  { id: 'litter', label: 'Litter', addG: 2, color: '#ef695d', location: 'floats as solid debris' },
  { id: 'sediment', label: 'Sediment', addG: 8, color: '#a67f58', location: 'suspends, then settles' },
  { id: 'salt', label: 'Dissolved salt', addG: 3, color: '#3476df', location: 'dissolves and remains invisible' },
];

export const POLLUTION_METHODS: Readonly<Record<PollutionMethodId, Readonly<{ label: string; description: string }>>> = {
  skim: { label: 'Skim surface oil', description: 'A skimmer collects some floating heavy oil into a recovery tank.' },
  screen: { label: 'Screen litter', description: 'A coarse screen catches floating solid litter.' },
  decant: { label: 'Decant clear water after settling', description: 'After particles settle, pour off the upper water; the bed sludge stays behind and dissolved salt travels with the pour.' },
  filter: { label: 'Filter suspended sediment', description: 'Filter paper traps suspended solids; dissolved salt passes through.' },
  distill: { label: 'Distil and recover water', description: 'Evaporate water and condense it; modeled heavy oil and other nonvolatile pollutants stay in waste.' },
};

export type PollutionTrial = Readonly<{
  id: number;
  matchedInitialSample: boolean;
  input: PollutionVector;
  treatments: readonly PollutionMethodId[];
  hypothesis: string;
  elapsedModelSeconds: number;
  remainingG: number;
  clarityPercent: number;
  recoveredWaterMl: number;
  wasteWaterMl: number;
  recoveredPollutantG: number;
  pollutantInRecoveredWaterG: number;
  wastePollutantG: number;
  saltRemainingG: number;
}>;

export type PollutionState = Readonly<{
  waterInputMl: number;
  waterBodyMl: number;
  recoveredWaterMl: number;
  wasteWaterMl: number;
  pollutants: PollutantLedger;
  modelTimeSeconds: number;
  matchedSample: boolean;
  treatments: readonly PollutionMethodId[];
  selectedMethod: PollutionMethodId;
  hypothesis: string;
  challengeActive: boolean;
  challengeFiltered: boolean;
  challengeDistilled: boolean;
  trials: readonly PollutionTrial[];
  nextTrialId: number;
}>;

export type PollutionMassCheck = Readonly<{
  inputG: number;
  remainingG: number;
  recoveredG: number;
  recoveredWaterG: number;
  wasteG: number;
  errorG: number;
}>;

const round = (value: number) => Math.round(Math.max(0, value) * 1_000_000) / 1_000_000;
const signedRound = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const emptyInventory = (): PollutantInventory => ({ inputG: 0, surfaceG: 0, suspendedG: 0, dissolvedG: 0, settledG: 0, recoveredG: 0, recoveredWaterG: 0, wasteG: 0 });
const emptyLedger = (): PollutantLedger => ({ oil: emptyInventory(), litter: emptyInventory(), sediment: emptyInventory(), salt: emptyInventory() });
const compartmentFor: Readonly<Record<PollutantId, 'surfaceG' | 'suspendedG' | 'dissolvedG'>> = {
  oil: 'surfaceG', litter: 'surfaceG', sediment: 'suspendedG', salt: 'dissolvedG',
};

function inventoryWithInput(current: PollutantInventory, grams: number, target: 'surfaceG' | 'suspendedG' | 'dissolvedG'): PollutantInventory {
  return { ...current, inputG: round(current.inputG + grams), [target]: round(current[target] + grams) };
}

export function createPollutionState(): PollutionState {
  return {
    waterInputMl: STARTING_WATER_ML, waterBodyMl: STARTING_WATER_ML,
    recoveredWaterMl: 0, wasteWaterMl: 0, pollutants: emptyLedger(),
    modelTimeSeconds: 0, matchedSample: false, treatments: [], selectedMethod: 'skim',
    hypothesis: '',
    challengeActive: false, challengeFiltered: false, challengeDistilled: false,
    trials: [], nextTrialId: 1,
  };
}

export function remainingPollutantG(inventory: PollutantInventory): number {
  return round(inventory.surfaceG + inventory.suspendedG + inventory.dissolvedG + inventory.settledG);
}

export function remainingTotalPollutantG(state: PollutionState): number {
  return (Object.keys(state.pollutants) as PollutantId[]).reduce((sum, pollutant) => sum + remainingPollutantG(state.pollutants[pollutant]), 0);
}

export function clarityIndexPercent(state: PollutionState): number {
  // A qualitative optical indicator driven only by suspended sediment.
  // Dissolved salt is deliberately invisible to this reading.
  return Math.round(clamp(100 - state.pollutants.sediment.suspendedG * 2.8, 0, 100));
}

export function saltRemainingG(state: PollutionState): number {
  return remainingPollutantG(state.pollutants.salt);
}

export function addPollutant(state: PollutionState, pollutant: PollutantId, grams: number): PollutionState {
  if (!Number.isFinite(grams) || grams <= 0 || state.waterBodyMl <= 0) return state;
  const safeGrams = round(grams);
  const current = state.pollutants[pollutant];
  return {
    ...state, matchedSample: false,
    pollutants: { ...state.pollutants, [pollutant]: inventoryWithInput(current, safeGrams, compartmentFor[pollutant]) },
    treatments: [], challengeFiltered: false, challengeDistilled: false,
  };
}

export function loadMatchedPollutionSample(state: PollutionState): PollutionState {
  let next = {
    ...createPollutionState(), trials: state.trials, nextTrialId: state.nextTrialId, hypothesis: state.hypothesis,
    matchedSample: true, selectedMethod: state.selectedMethod,
    challengeActive: state.challengeActive,
  } as PollutionState;
  for (const pollutant of Object.keys(MATCHED_POLLUTION_RECIPE) as PollutantId[]) {
    next = addPollutant(next, pollutant, MATCHED_POLLUTION_RECIPE[pollutant]);
  }
  return { ...next, matchedSample: true, challengeActive: state.challengeActive, challengeFiltered: false, challengeDistilled: false };
}

export function beginPollutionChallenge(state: PollutionState): PollutionState {
  return { ...loadMatchedPollutionSample(state), challengeActive: true, challengeFiltered: false, challengeDistilled: false };
}

export function selectPollutionMethod(state: PollutionState, method: PollutionMethodId): PollutionState {
  return { ...state, selectedMethod: method };
}

export function setPollutionHypothesis(state: PollutionState, hypothesis: string): PollutionState {
  return { ...state, hypothesis: hypothesis.slice(0, 180) };
}

export function advancePollution(state: PollutionState, seconds = 1 / 60): PollutionState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const sediment = state.pollutants.sediment;
  const settled = Math.min(sediment.suspendedG, 2.4 * seconds);
  const nextSediment = {
    ...sediment,
    suspendedG: round(sediment.suspendedG - settled),
    settledG: round(sediment.settledG + settled),
  };
  return { ...state, pollutants: { ...state.pollutants, sediment: nextSediment }, modelTimeSeconds: state.modelTimeSeconds + seconds };
}

function moveCurrentToWaste(entry: PollutantInventory): PollutantInventory {
  const current = remainingPollutantG(entry);
  const recoveredInWater = entry.recoveredWaterG;
  return {
    ...entry, surfaceG: 0, suspendedG: 0, dissolvedG: 0, settledG: 0, recoveredWaterG: 0,
    wasteG: round(entry.wasteG + current + recoveredInWater),
  };
}

function capture(entry: PollutantInventory, compartment: 'surfaceG' | 'suspendedG' | 'settledG', efficiency: number, destination: 'recoveredG' | 'wasteG'): PollutantInventory {
  const amount = round(entry[compartment] * efficiency);
  return { ...entry, [compartment]: round(entry[compartment] - amount), [destination]: round(entry[destination] + amount) };
}

export function applyPollutionMethod(state: PollutionState, method = state.selectedMethod): PollutionState {
  let pollutants = state.pollutants;
  let waterBodyMl = state.waterBodyMl;
  let recoveredWaterMl = state.recoveredWaterMl;
  let wasteWaterMl = state.wasteWaterMl;
  if (method === 'skim') {
    const oil = capture(pollutants.oil, 'surfaceG', 0.78, 'recoveredG');
    pollutants = { ...pollutants, oil };
    if (oil.recoveredG > state.pollutants.oil.recoveredG) {
      const water = Math.min(waterBodyMl, 4);
      waterBodyMl -= water;
      wasteWaterMl += water;
    }
  } else if (method === 'screen') {
    const litter = capture(pollutants.litter, 'surfaceG', 0.96, 'wasteG');
    pollutants = { ...pollutants, litter };
    if (litter.wasteG > state.pollutants.litter.wasteG) {
      const water = Math.min(waterBodyMl, 3);
      waterBodyMl -= water;
      wasteWaterMl += water;
    }
  } else if (method === 'decant') {
    if (pollutants.sediment.settledG > 0.01) {
      const fraction = 0.72;
      const recoveredWater = round(waterBodyMl * fraction);
      waterBodyMl = round(waterBodyMl - recoveredWater);
      recoveredWaterMl = round(recoveredWaterMl + recoveredWater);
      // Dissolved salts move with a proportion of the uniformly mixed water.
      // Remaining suspended particles can also enter the decanted output.
      const sediment = {
        ...pollutants.sediment,
        suspendedG: round(pollutants.sediment.suspendedG * (1 - fraction)),
        recoveredWaterG: round(pollutants.sediment.recoveredWaterG + pollutants.sediment.suspendedG * fraction),
        // Settled sludge remains in the source vessel at the bottom.
      };
      const salt = {
        ...pollutants.salt,
        dissolvedG: round(pollutants.salt.dissolvedG * (1 - fraction)),
        recoveredWaterG: round(pollutants.salt.recoveredWaterG + pollutants.salt.dissolvedG * fraction),
      };
      pollutants = { ...pollutants, sediment, salt };
    }
  } else if (method === 'filter') {
    const sediment = capture(pollutants.sediment, 'suspendedG', 0.94, 'wasteG');
    pollutants = { ...pollutants, sediment };
    if (sediment.wasteG > state.pollutants.sediment.wasteG) {
      const water = Math.min(waterBodyMl, 8);
      waterBodyMl -= water;
      wasteWaterMl += water;
    }
  } else if (method === 'distill') {
    pollutants = {
      oil: moveCurrentToWaste(pollutants.oil),
      litter: moveCurrentToWaste(pollutants.litter),
      sediment: moveCurrentToWaste(pollutants.sediment),
      salt: moveCurrentToWaste(pollutants.salt),
    };
    const availableWaterMl = waterBodyMl + recoveredWaterMl;
    const recovered = round(availableWaterMl * 0.9);
    recoveredWaterMl = round(recoveredWaterMl + recovered);
    // Previously decanted water is fed through the still as well. This avoids
    // calling a salty recovered stream clean just because it left the pond.
    wasteWaterMl = round(wasteWaterMl + availableWaterMl - recovered);
    waterBodyMl = 0;
    recoveredWaterMl = recovered;
  }
  const nextTreatments = [...state.treatments, method];
  const challengeFiltered = state.challengeFiltered || (state.challengeActive && method === 'filter' && saltRemainingG({ ...state, pollutants }) > 0);
  const saltBeforeTreatmentG = state.pollutants.salt.dissolvedG + state.pollutants.salt.recoveredWaterG;
  const saltAfterTreatmentG = pollutants.salt.dissolvedG + pollutants.salt.recoveredWaterG;
  const challengeDistilled = state.challengeDistilled || (
    state.challengeActive && method === 'distill' && state.challengeFiltered
    && saltBeforeTreatmentG > 0 && saltAfterTreatmentG === 0 && pollutants.salt.wasteG > state.pollutants.salt.wasteG
    && recoveredWaterMl > state.recoveredWaterMl
  );
  return {
    ...state, pollutants, waterBodyMl: round(waterBodyMl), recoveredWaterMl: round(recoveredWaterMl), wasteWaterMl: round(wasteWaterMl),
    treatments: nextTreatments, challengeFiltered, challengeDistilled,
  };
}

export function pollutionMassCheck(state: PollutionState, pollutant: PollutantId): PollutionMassCheck {
  const inventory = state.pollutants[pollutant];
  const remainingG = remainingPollutantG(inventory);
  return {
    inputG: round(inventory.inputG), remainingG, recoveredG: round(inventory.recoveredG),
    recoveredWaterG: round(inventory.recoveredWaterG), wasteG: round(inventory.wasteG),
    errorG: signedRound(inventory.inputG - remainingG - inventory.recoveredG - inventory.recoveredWaterG - inventory.wasteG),
  };
}

export function pollutionWaterMassCheck(state: PollutionState): Readonly<{ inputMl: number; bodyMl: number; recoveredMl: number; wasteMl: number; errorMl: number }> {
  return {
    inputMl: state.waterInputMl, bodyMl: round(state.waterBodyMl), recoveredMl: round(state.recoveredWaterMl), wasteMl: round(state.wasteWaterMl),
    errorMl: signedRound(state.waterInputMl - state.waterBodyMl - state.recoveredWaterMl - state.wasteWaterMl),
  };
}

export function recordPollutionTrial(state: PollutionState): PollutionState {
  if (state.treatments.length === 0) return state;
  const input = Object.fromEntries((Object.keys(state.pollutants) as PollutantId[]).map((id) => [id, state.pollutants[id].inputG])) as PollutionVector;
  const wastePollutantG = (Object.keys(state.pollutants) as PollutantId[]).reduce((sum, id) => sum + state.pollutants[id].wasteG, 0);
  const recoveredPollutantG = (Object.keys(state.pollutants) as PollutantId[]).reduce((sum, id) => sum + state.pollutants[id].recoveredG, 0);
  const pollutantInRecoveredWaterG = (Object.keys(state.pollutants) as PollutantId[]).reduce((sum, id) => sum + state.pollutants[id].recoveredWaterG, 0);
  const trial: PollutionTrial = {
    id: state.nextTrialId, matchedInitialSample: state.matchedSample, input,
    treatments: [...state.treatments], hypothesis: state.hypothesis, elapsedModelSeconds: state.modelTimeSeconds,
    remainingG: remainingTotalPollutantG(state),
    clarityPercent: clarityIndexPercent(state), recoveredWaterMl: state.recoveredWaterMl,
    wasteWaterMl: state.wasteWaterMl, recoveredPollutantG: round(recoveredPollutantG),
    pollutantInRecoveredWaterG: round(pollutantInRecoveredWaterG),
    wastePollutantG: round(wastePollutantG), saltRemainingG: saltRemainingG(state),
  };
  return { ...state, trials: [...state.trials, trial], nextTrialId: state.nextTrialId + 1 };
}

export function clearPollutionTrials(state: PollutionState): PollutionState {
  return { ...state, trials: [], nextTrialId: 1 };
}

export function beginMatchedPollutionTrial(state: PollutionState): PollutionState {
  return loadMatchedPollutionSample({ ...state, challengeActive: false, challengeFiltered: false, challengeDistilled: false });
}

export function pollutionChallengeComplete(state: PollutionState): boolean {
  return state.challengeActive && state.challengeFiltered && state.challengeDistilled
    && state.pollutants.salt.dissolvedG === 0 && state.pollutants.salt.recoveredWaterG === 0
    && state.pollutants.salt.wasteG > 0 && state.recoveredWaterMl > 0;
}

export function resetPollutionState(state: PollutionState): PollutionState {
  return { ...createPollutionState(), trials: state.trials, nextTrialId: state.nextTrialId };
}

/** Where every gram of pollutant currently is, in the four places the model tracks. */
export type PollutionOutputs = Readonly<{
  /** Pollutant still in the water body, split by where it sits. */
  body: Readonly<{ surfaceOilG: number; floatingLitterG: number; suspendedSedimentG: number; settledSedimentG: number; dissolvedSaltG: number; totalG: number }>;
  recoveredWater: Readonly<{ ml: number; pollutantG: number; dissolvedSaltG: number; sedimentG: number }>;
  recoveredMaterial: Readonly<{ totalG: number; oilG: number }>;
  waste: Readonly<{ pollutantG: number; waterMl: number; oilG: number; litterG: number; sedimentG: number; saltG: number }>;
}>;

export function pollutionOutputs(state: PollutionState): PollutionOutputs {
  const { oil, litter, sediment, salt } = state.pollutants;
  const recoveredMaterialG = round(oil.recoveredG + litter.recoveredG + sediment.recoveredG + salt.recoveredG);
  const wasteG = round(oil.wasteG + litter.wasteG + sediment.wasteG + salt.wasteG);
  return {
    body: {
      surfaceOilG: round(oil.surfaceG),
      floatingLitterG: round(litter.surfaceG + litter.suspendedG),
      suspendedSedimentG: round(sediment.suspendedG),
      settledSedimentG: round(sediment.settledG),
      dissolvedSaltG: round(salt.dissolvedG),
      totalG: round(remainingTotalPollutantG(state)),
    },
    recoveredWater: {
      ml: round(state.recoveredWaterMl),
      pollutantG: round(oil.recoveredWaterG + litter.recoveredWaterG + sediment.recoveredWaterG + salt.recoveredWaterG),
      dissolvedSaltG: round(salt.recoveredWaterG),
      sedimentG: round(sediment.recoveredWaterG),
    },
    recoveredMaterial: { totalG: recoveredMaterialG, oilG: round(oil.recoveredG) },
    waste: { pollutantG: wasteG, waterMl: round(state.wasteWaterMl), oilG: round(oil.wasteG), litterG: round(litter.wasteG), sedimentG: round(sediment.wasteG), saltG: round(salt.wasteG) },
  };
}

const gramsText = (value: number) => `${value.toFixed(1)} g`;

/**
 * State-aware plain-language description of the water-body scene, used as the
 * accessible name of the 3D canvas and the 2D fallback.
 */
export function describePollutionScene(state: PollutionState, particleView = false): string {
  const outputs = pollutionOutputs(state);
  const { body } = outputs;
  const where: string[] = [];
  if (body.surfaceOilG > 0) where.push(`${gramsText(body.surfaceOilG)} oil film on the surface`);
  if (body.floatingLitterG > 0) where.push(`${gramsText(body.floatingLitterG)} litter floating`);
  if (body.suspendedSedimentG > 0) where.push(`${gramsText(body.suspendedSedimentG)} sediment suspended in the water`);
  if (body.settledSedimentG > 0) where.push(`${gramsText(body.settledSedimentG)} sediment settled on the bed`);
  if (body.dissolvedSaltG > 0) where.push(`${gramsText(body.dissolvedSaltG)} dissolved salt, invisible${particleView ? ' but shown as sodium and chloride ions in particle view' : ''}`);
  const pollutantText = where.length ? where.join(', ') : 'no pollutant added';
  const last = state.treatments.length > 0 ? POLLUTION_METHODS[state.treatments[state.treatments.length - 1]].label : 'none yet';
  const salty = outputs.recoveredWater.dissolvedSaltG > 0 ? ' It still carries dissolved salt.' : '';
  return `Pond with a stormwater creek inflow, ${state.waterBodyMl.toFixed(0)} mL of water and ${pollutantText}. Water clarity ${clarityIndexPercent(state)} percent. Last treatment: ${last}. Recovered water ${outputs.recoveredWater.ml.toFixed(0)} mL.${salty} Recovered material ${gramsText(outputs.recoveredMaterial.totalG)}. Waste ${gramsText(outputs.waste.pollutantG)} of pollutant and ${outputs.waste.waterMl.toFixed(0)} mL of water. Looking clear is not a safety test.`;
}
