export type SolutionsMode = 'dissolving' | 'investigation' | 'temperature' | 'particles' | 'comparison';
export type SoluteId = 'salt' | 'sugar' | 'potassium-chloride' | 'sand';
export type SoluteKind = 'ionic' | 'molecular' | 'insoluble';
export type ParticleSize = 'coarse' | 'fine';
export type ComparisonPreset = 'dilute' | 'concentrated' | 'saturated' | 'hot-clear';
export type SolubilityPoint = Readonly<{ temperatureC: number; capacityG: number }>;
export type ConcentrationReference = Readonly<{
  soluteId: SoluteId;
  temperatureC: number;
  solventMassG: number;
  dissolvedG: number;
}>;

export const SOLVENT_MASS_G = 100;
export const SOLUTION_TEMPERATURE_RANGE_C = { minimum: 0, maximum: 100 } as const;
export const SOLUTE_MASS_LIMIT_G = 600;
export const SOLUTE_ADD_STEP_G = 5;
export const METASTABLE_SEED_MASS_G = 0.2;

/** Rounded classroom reference curves, expressed per 100 g of fixed water. */
export const SOLUTES: Readonly<Record<SoluteId, Readonly<{
  id: SoluteId;
  name: string;
  formula: string;
  kind: SoluteKind;
  description: string;
  molarMassGPerMol: number | null;
  cation?: string;
  anion?: string;
  curve: readonly SolubilityPoint[];
}>>> = {
  salt: {
    id: 'salt', name: 'Sodium chloride', formula: 'NaCl', kind: 'ionic',
    description: 'Soluble ionic crystal; each formula unit separates into Na⁺ and Cl⁻ in water.',
    molarMassGPerMol: 58.44, cation: 'Na⁺', anion: 'Cl⁻',
    curve: [
      { temperatureC: 0, capacityG: 35.5 }, { temperatureC: 20, capacityG: 36 },
      { temperatureC: 40, capacityG: 36.5 }, { temperatureC: 60, capacityG: 37.5 },
      { temperatureC: 80, capacityG: 38 }, { temperatureC: 100, capacityG: 39 },
    ],
  },
  sugar: {
    id: 'sugar', name: 'Sucrose', formula: 'C₁₂H₂₂O₁₁', kind: 'molecular',
    description: 'Soluble molecular crystal; whole sucrose molecules separate and disperse.',
    molarMassGPerMol: 342.2965,
    curve: [
      { temperatureC: 0, capacityG: 179 }, { temperatureC: 20, capacityG: 204 },
      { temperatureC: 40, capacityG: 241 }, { temperatureC: 60, capacityG: 288 },
      { temperatureC: 80, capacityG: 363 }, { temperatureC: 100, capacityG: 487 },
    ],
  },
  'potassium-chloride': {
    id: 'potassium-chloride', name: 'Potassium chloride', formula: 'KCl', kind: 'ionic',
    description: 'Soluble ionic crystal; each formula unit separates into K⁺ and Cl⁻ in water.',
    molarMassGPerMol: 74.5513, cation: 'K⁺', anion: 'Cl⁻',
    curve: [
      { temperatureC: 0, capacityG: 28 }, { temperatureC: 20, capacityG: 33 },
      { temperatureC: 40, capacityG: 38 }, { temperatureC: 60, capacityG: 44 },
      { temperatureC: 80, capacityG: 50 }, { temperatureC: 100, capacityG: 55 },
    ],
  },
  sand: {
    id: 'sand', name: 'Sand', formula: 'mineral grains', kind: 'insoluble',
    description: 'Effectively insoluble grains at this model scale; it stays as a separate solid.',
    molarMassGPerMol: null,
    curve: [
      { temperatureC: 0, capacityG: 0 }, { temperatureC: 20, capacityG: 0 },
      { temperatureC: 40, capacityG: 0 }, { temperatureC: 60, capacityG: 0 },
      { temperatureC: 80, capacityG: 0 }, { temperatureC: 100, capacityG: 0 },
    ],
  },
};

export type SolutionTrialStatus = 'equilibrium-with-excess' | 'lower-bound-unsaturated' | 'not-equilibrated' | 'metastable';
export type SolubilityTrial = Readonly<{
  id: number;
  soluteId: SoluteId;
  temperatureC: number;
  solventMassG: number;
  addedG: number;
  dissolvedG: number;
  undissolvedG: number;
  status: SolutionTrialStatus;
  measurementG: number | null;
  lowerBoundG: number;
}>;

export type SolutionsState = Readonly<{
  mode: SolutionsMode;
  soluteId: SoluteId;
  temperatureC: number;
  solventMassG: number;
  addedG: number;
  dissolvedG: number;
  modelTimeSeconds: number;
  stirring: boolean;
  particleSize: ParticleSize;
  metastable: boolean;
  seedAddedG: number;
  challengeActive: boolean;
  challengeCooled: boolean;
  challengeSeeded: boolean;
  hotClearHistory: boolean;
  comparisonReference: ConcentrationReference | null;
  trials: readonly SolubilityTrial[];
  nextTrialId: number;
}>;

export type SolutionMassLedger = Readonly<{
  addedG: number;
  dissolvedG: number;
  undissolvedG: number;
  massErrorG: number;
}>;

export type ConstituentLedger = Readonly<{
  kind: SoluteKind;
  totalFormulaUnitsMol: number | null;
  dissolvedFormulaUnitsMol: number | null;
  undissolvedFormulaUnitsMol: number | null;
  totalCationMol: number;
  dissolvedCationMol: number;
  undissolvedCationMol: number;
  totalAnionMol: number;
  dissolvedAnionMol: number;
  undissolvedAnionMol: number;
  totalSucroseMoleculesMol: number;
  dissolvedSucroseMoleculesMol: number;
  undissolvedSucroseMoleculesMol: number;
  sodiumMassG: number;
  chlorideMassG: number;
  potassiumMassG: number;
  sucroseMassG: number;
  insolubleSolidMassG: number;
}>;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const roundMass = (value: number) => Math.round(Math.max(0, value) * 1_000_000) / 1_000_000;

export function solubilityCapacityG(soluteId: SoluteId, temperatureC: number): number {
  const curve = SOLUTES[soluteId].curve;
  const temperature = clamp(Number.isFinite(temperatureC) ? temperatureC : 20, 0, 100);
  if (temperature <= curve[0].temperatureC) return curve[0].capacityG;
  for (let index = 1; index < curve.length; index += 1) {
    const right = curve[index];
    const left = curve[index - 1];
    if (temperature <= right.temperatureC) {
      const ratio = (temperature - left.temperatureC) / (right.temperatureC - left.temperatureC);
      return left.capacityG + (right.capacityG - left.capacityG) * ratio;
    }
  }
  return curve[curve.length - 1].capacityG;
}

export function createSolutionsState(mode: SolutionsMode = 'dissolving', soluteId: SoluteId = 'salt'): SolutionsState {
  return {
    mode, soluteId, temperatureC: 20, solventMassG: SOLVENT_MASS_G,
    addedG: 0, dissolvedG: 0, modelTimeSeconds: 0, stirring: false,
    particleSize: 'coarse', metastable: false, seedAddedG: 0,
    challengeActive: false, challengeCooled: false, challengeSeeded: false, hotClearHistory: false, comparisonReference: null,
    trials: [], nextTrialId: 1,
  };
}

export function setSolutionsMode(state: SolutionsState, mode: SolutionsMode): SolutionsState {
  return mode === state.mode ? state : { ...state, mode, modelTimeSeconds: 0 };
}

/** Particle-model lessons open on an existing below-saturation solution so dispersed particles are visible at once. */
export const PARTICLE_MODEL_START_G = 20;
export function prepareParticleModelSolution(state: SolutionsState): SolutionsState {
  if (state.mode !== 'particles' || state.addedG > 0 || SOLUTES[state.soluteId].kind === 'insoluble') return state;
  const massG = Math.min(PARTICLE_MODEL_START_G, solubilityCapacityG(state.soluteId, state.temperatureC));
  return { ...state, addedG: massG, dissolvedG: massG };
}

export function setSolute(state: SolutionsState, soluteId: SoluteId): SolutionsState {
  if (state.soluteId === soluteId) return state;
  return {
    ...state, soluteId, temperatureC: 20, addedG: 0, dissolvedG: 0,
    modelTimeSeconds: 0, metastable: false, seedAddedG: 0,
    challengeCooled: false, challengeSeeded: false, hotClearHistory: false, comparisonReference: null,
  };
}

export function addSolute(state: SolutionsState, massG = SOLUTE_ADD_STEP_G): SolutionsState {
  if (!Number.isFinite(massG) || massG <= 0 || state.addedG >= SOLUTE_MASS_LIMIT_G) return state;
  const addition = Math.min(massG, SOLUTE_MASS_LIMIT_G - state.addedG);
  if (addition <= 0) return state;
  const nextAdded = roundMass(state.addedG + addition);
  return {
    ...state,
    addedG: nextAdded,
    dissolvedG: Math.min(state.dissolvedG, solubilityCapacityG(state.soluteId, state.temperatureC)),
    metastable: false,
    seedAddedG: 0,
    challengeSeeded: false,
    hotClearHistory: false,
    modelTimeSeconds: 0,
  };
}

export function setSolutionTemperature(state: SolutionsState, temperatureC: number): SolutionsState {
  if (!Number.isFinite(temperatureC)) return state;
  const nextTemperature = clamp(temperatureC, SOLUTION_TEMPERATURE_RANGE_C.minimum, SOLUTION_TEMPERATURE_RANGE_C.maximum);
  if (nextTemperature === state.temperatureC) return state;
  const nextCapacity = solubilityCapacityG(state.soluteId, nextTemperature);
  const hasNoGrains = state.addedG - state.dissolvedG <= 0.02;
  const cooledFromHotClearSample = nextTemperature < state.temperatureC
    && state.hotClearHistory
    && hasNoGrains
    && state.dissolvedG > nextCapacity + 0.02;
  if (cooledFromHotClearSample) {
    return {
      ...state, temperatureC: nextTemperature, metastable: true,
      challengeCooled: state.challengeCooled || state.challengeActive,
      modelTimeSeconds: 0,
    };
  }
  if (state.metastable && nextCapacity >= state.dissolvedG - 0.02) {
    return { ...state, temperatureC: nextTemperature, metastable: false, modelTimeSeconds: 0 };
  }
  if (state.metastable) return { ...state, temperatureC: nextTemperature, modelTimeSeconds: 0 };
  // If a clear sample is cooled without the hot, seed-free preparation, this
  // simple classroom model treats the excess as crystallised rather than
  // silently labelling it a supersaturated solution.
  if (nextTemperature < state.temperatureC && state.dissolvedG > nextCapacity + 0.02 && hasNoGrains) {
    return { ...state, temperatureC: nextTemperature, dissolvedG: nextCapacity, modelTimeSeconds: 0 };
  }
  return { ...state, temperatureC: nextTemperature, modelTimeSeconds: 0 };
}

export function setStirring(state: SolutionsState, stirring: boolean): SolutionsState {
  return { ...state, stirring };
}

export function setParticleSize(state: SolutionsState, particleSize: ParticleSize): SolutionsState {
  return { ...state, particleSize };
}

/** Playback seconds of the accelerated model for 10 g to dissolve, stirred coarse grains at 20 C, is about 7 s. */
const BASE_RATE_G_PER_SECOND = 0.86;
/** Differences larger than this dissolve proportionally faster so large additions still finish in tens of seconds. */
const RATE_BOOST_KNEE_G = 10;
const RATE_BOOST_SCALE_G = 20;
const MAX_SUBSTEP_SECONDS = 0.1;

function dissolutionRateGPerSecond(state: SolutionsState, differenceG: number): number {
  const definition = SOLUTES[state.soluteId];
  if (definition.kind === 'insoluble') return 0;
  const temperatureFactor = 0.55 + state.temperatureC / 100;
  const stirringFactor = state.stirring ? 3.2 : 1;
  const sizeFactor = state.particleSize === 'fine' ? 1.8 : 0.68;
  // A bigger gap between dissolved mass and its target (more crystal surface, or a large
  // excess to crystallise) transfers faster; the last ~10 g approach is linear in time.
  const driveFactor = 1 + Math.max(0, Math.abs(differenceG) - RATE_BOOST_KNEE_G) / RATE_BOOST_SCALE_G;
  // The accelerated transfer rate is a visual teaching control, not a measured
  // rate for the real substance. It never changes the equilibrium capacity.
  return BASE_RATE_G_PER_SECOND * temperatureFactor * stirringFactor * sizeFactor * driveFactor;
}

export function advanceSolutions(state: SolutionsState, seconds = 1 / 60): SolutionsState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const capacity = solubilityCapacityG(state.soluteId, state.temperatureC);
  const targetDissolved = state.metastable ? state.dissolvedG : Math.min(state.addedG, capacity);
  // Sub-stepping keeps a one-second Step identical to sixty 1/60 s frames.
  const substeps = Math.max(1, Math.ceil(seconds / MAX_SUBSTEP_SECONDS));
  const dt = seconds / substeps;
  let dissolvedG = state.dissolvedG;
  for (let index = 0; index < substeps; index += 1) {
    const difference = targetDissolved - dissolvedG;
    if (Math.abs(difference) <= 0) break;
    const moved = Math.min(Math.abs(difference), dissolutionRateGPerSecond(state, difference) * dt);
    dissolvedG = roundMass(dissolvedG + Math.sign(difference) * moved);
  }
  const ledger = massLedgerAt({ ...state, dissolvedG });
  const hotClearHistory = state.hotClearHistory || (state.temperatureC > 20 && state.addedG > 0 && ledger.undissolvedG <= 0.02);
  return { ...state, dissolvedG, hotClearHistory, modelTimeSeconds: state.modelTimeSeconds + seconds };
}

export function seedSupersaturatedSolution(state: SolutionsState): SolutionsState {
  if (!state.metastable) return state;
  const addedG = Math.min(METASTABLE_SEED_MASS_G, SOLUTE_MASS_LIMIT_G - state.addedG);
  const capacity = solubilityCapacityG(state.soluteId, state.temperatureC);
  const dissolvedG = Math.min(state.dissolvedG, capacity);
  return {
    ...state, addedG: roundMass(state.addedG + addedG), dissolvedG,
    metastable: false, seedAddedG: roundMass(state.seedAddedG + addedG),
    hotClearHistory: false,
    challengeSeeded: state.challengeSeeded || (state.challengeActive && state.challengeCooled),
    modelTimeSeconds: 0,
  };
}

export function prepareHotClearSucrose(state: SolutionsState): SolutionsState {
  return {
    ...state, mode: 'comparison', soluteId: 'sugar', temperatureC: 80,
    solventMassG: SOLVENT_MASS_G, addedG: 250, dissolvedG: 250, modelTimeSeconds: 0,
    stirring: false, particleSize: 'coarse', metastable: false, seedAddedG: 0,
    challengeCooled: false, challengeSeeded: false, hotClearHistory: true, comparisonReference: null,
  };
}

export function loadComparisonPreset(state: SolutionsState, preset: ComparisonPreset): SolutionsState {
  if (preset === 'hot-clear') return prepareHotClearSucrose(state);
  const capacity = solubilityCapacityG('sugar', 20);
  const addedG = preset === 'dilute' ? 40 : preset === 'concentrated' ? 150 : capacity + 25;
  const dissolvedG = preset === 'saturated' ? capacity : addedG;
  const referenceAddedG = preset === 'dilute' ? 150 : 40;
  return {
    ...state, mode: 'comparison', soluteId: 'sugar', temperatureC: 20, solventMassG: SOLVENT_MASS_G,
    addedG, dissolvedG, modelTimeSeconds: 0, stirring: false,
    metastable: false, seedAddedG: 0, challengeCooled: false, challengeSeeded: false, hotClearHistory: false,
    comparisonReference: { soluteId: 'sugar', temperatureC: 20, solventMassG: SOLVENT_MASS_G, dissolvedG: referenceAddedG },
  };
}

export function beginSupersaturationChallenge(state: SolutionsState): SolutionsState {
  const prepared = prepareHotClearSucrose(state);
  return { ...prepared, challengeActive: true, challengeCooled: false, challengeSeeded: false };
}

export function endSolutionsChallenge(state: SolutionsState): SolutionsState {
  return { ...state, challengeActive: false, challengeCooled: false, challengeSeeded: false };
}

export function beginNewSolubilityTrial(state: SolutionsState): SolutionsState {
  return {
    ...state, addedG: 0, dissolvedG: 0, modelTimeSeconds: 0, metastable: false,
    seedAddedG: 0, nextTrialId: state.nextTrialId,
    challengeCooled: false, challengeSeeded: false, hotClearHistory: false, comparisonReference: null,
  };
}

export function massLedgerAt(state: SolutionsState): SolutionMassLedger {
  const addedG = roundMass(state.addedG);
  const dissolvedG = roundMass(clamp(state.dissolvedG, 0, addedG));
  const undissolvedG = roundMass(addedG - dissolvedG);
  return { addedG, dissolvedG, undissolvedG, massErrorG: roundMass(addedG - dissolvedG - undissolvedG) };
}

export function constituentLedgerAt(state: SolutionsState): ConstituentLedger {
  const definition = SOLUTES[state.soluteId];
  const { addedG, dissolvedG, undissolvedG } = massLedgerAt(state);
  if (definition.kind === 'ionic') {
    const molarMass = definition.molarMassGPerMol ?? 1;
    const totalFormulaUnitsMol = addedG / molarMass;
    const dissolvedFormulaUnitsMol = dissolvedG / molarMass;
    const undissolvedFormulaUnitsMol = undissolvedG / molarMass;
    const sodium = state.soluteId === 'salt';
    const cationMass = sodium ? 22.989769 : 39.0983;
    const cationMassG = addedG * cationMass / molarMass;
    return {
      kind: 'ionic', totalFormulaUnitsMol, dissolvedFormulaUnitsMol, undissolvedFormulaUnitsMol,
      totalCationMol: totalFormulaUnitsMol, dissolvedCationMol: dissolvedFormulaUnitsMol, undissolvedCationMol: undissolvedFormulaUnitsMol,
      totalAnionMol: totalFormulaUnitsMol, dissolvedAnionMol: dissolvedFormulaUnitsMol, undissolvedAnionMol: undissolvedFormulaUnitsMol,
      totalSucroseMoleculesMol: 0, dissolvedSucroseMoleculesMol: 0, undissolvedSucroseMoleculesMol: 0,
      sodiumMassG: sodium ? cationMassG : 0,
      chlorideMassG: addedG - cationMassG,
      potassiumMassG: sodium ? 0 : cationMassG,
      sucroseMassG: 0,
      insolubleSolidMassG: 0,
    };
  }
  if (definition.kind === 'molecular') {
    const molarMass = definition.molarMassGPerMol ?? 1;
    return {
      kind: 'molecular', totalFormulaUnitsMol: addedG / molarMass,
      dissolvedFormulaUnitsMol: dissolvedG / molarMass, undissolvedFormulaUnitsMol: undissolvedG / molarMass,
      totalCationMol: 0, dissolvedCationMol: 0, undissolvedCationMol: 0,
      totalAnionMol: 0, dissolvedAnionMol: 0, undissolvedAnionMol: 0,
      totalSucroseMoleculesMol: addedG / molarMass,
      dissolvedSucroseMoleculesMol: dissolvedG / molarMass,
      undissolvedSucroseMoleculesMol: undissolvedG / molarMass,
      sodiumMassG: 0, chlorideMassG: 0, potassiumMassG: 0, sucroseMassG: addedG, insolubleSolidMassG: 0,
    };
  }
  return {
    kind: 'insoluble', totalFormulaUnitsMol: null, dissolvedFormulaUnitsMol: null, undissolvedFormulaUnitsMol: null,
    totalCationMol: 0, dissolvedCationMol: 0, undissolvedCationMol: 0,
    totalAnionMol: 0, dissolvedAnionMol: 0, undissolvedAnionMol: 0,
    totalSucroseMoleculesMol: 0, dissolvedSucroseMoleculesMol: 0, undissolvedSucroseMoleculesMol: 0,
    sodiumMassG: 0, chlorideMassG: 0, potassiumMassG: 0, sucroseMassG: 0, insolubleSolidMassG: addedG,
  };
}

export function isAtEquilibrium(state: SolutionsState, toleranceG = 0.01): boolean {
  if (state.metastable) return false;
  const target = Math.min(state.addedG, solubilityCapacityG(state.soluteId, state.temperatureC));
  return Math.abs(target - state.dissolvedG) <= toleranceG;
}

export function hasExcessSolute(state: SolutionsState, minimumG = 0.1): boolean {
  return massLedgerAt(state).undissolvedG >= minimumG;
}

export function isExactSolubilityMeasurement(state: SolutionsState): boolean {
  return isAtEquilibrium(state) && hasExcessSolute(state);
}

export function recordSolubilityTrial(state: SolutionsState): SolutionsState {
  if (state.addedG <= 0) return state;
  const ledger = massLedgerAt(state);
  const exact = isExactSolubilityMeasurement(state);
  const status: SolutionTrialStatus = state.metastable
    ? 'metastable'
    : !isAtEquilibrium(state)
      ? 'not-equilibrated'
      : exact
        ? 'equilibrium-with-excess'
        : 'lower-bound-unsaturated';
  const trial: SolubilityTrial = {
    id: state.nextTrialId, soluteId: state.soluteId, temperatureC: state.temperatureC,
    solventMassG: state.solventMassG, addedG: ledger.addedG,
    dissolvedG: ledger.dissolvedG, undissolvedG: ledger.undissolvedG,
    status, measurementG: exact ? ledger.dissolvedG : null, lowerBoundG: ledger.dissolvedG,
  };
  return { ...state, trials: [...state.trials, trial], nextTrialId: state.nextTrialId + 1 };
}

export function clearSolubilityTrials(state: SolutionsState): SolutionsState {
  return { ...state, trials: [], nextTrialId: 1 };
}

export function relativeConcentrationLabel(state: SolutionsState): 'less-than-reference' | 'more-than-reference' | 'same-as-reference' | 'uncompared' {
  const reference = state.comparisonReference;
  if (!reference
    || reference.soluteId !== state.soluteId
    || reference.temperatureC !== state.temperatureC
    || reference.solventMassG !== state.solventMassG) return 'uncompared';
  if (Math.abs(state.dissolvedG - reference.dissolvedG) <= 0.01) return 'same-as-reference';
  return state.dissolvedG < reference.dissolvedG ? 'less-than-reference' : 'more-than-reference';
}

export function supersaturationChallengeComplete(state: SolutionsState): boolean {
  return state.challengeActive && state.challengeCooled && state.challengeSeeded && !state.metastable && hasExcessSolute(state);
}
