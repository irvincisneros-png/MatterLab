/**
 * Small, deliberately transparent models for two atomic-gas examples.
 *
 * The controls are illustrative rather than calibrated plasma or BEC solvers.
 * Counts and fractions below are exact model ledgers; the rendered markers are
 * representative samples and must not be read as the number of real atoms.
 */

export type AdvancedExperiment = 'plasma' | 'bec';
export type PlasmaCharge = -1 | 0 | 1;

export const PLASMA_NUCLEI = 24;
export const BEC_MARKERS = 48;
export const BEC_CRITICAL_TEMPERATURE_NK = 180;
export const BEC_TEMPERATURE_BOUNDS_NK = { minimum: 10, maximum: 360 } as const;

export type PlasmaState = Readonly<{
  energyInput: number;
  electricField: number;
  ionisedNuclei: number;
  modelTimeSeconds: number;
}>;

export type PlasmaLedger = Readonly<{
  nuclei: number;
  neutralAtoms: number;
  positiveIons: number;
  freeElectrons: number;
  boundElectrons: number;
  totalElectrons: number;
  netChargeInElementaryCharges: number;
}>;

export type BecState = Readonly<{
  temperatureNK: number;
  criticalTemperatureNK: number;
  atomCount: number;
  modelTimeSeconds: number;
}>;

export type BecFractions = Readonly<{
  condensed: number;
  thermal: number;
}>;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

/** A relative-energy response curve, not a hydrogen ionisation probability. */
export function ionisedNucleiAtEnergy(energyInput: number, nuclei = PLASMA_NUCLEI): number {
  const safeEnergy = Number.isFinite(energyInput) ? clamp(energyInput, 0, 100) : 0;
  const safeNuclei = Number.isFinite(nuclei) ? Math.max(0, Math.floor(nuclei)) : 0;
  const fraction = clamp((safeEnergy - 10) / 90, 0, 1);
  return Math.round(fraction * safeNuclei);
}

export function createPlasmaState(): PlasmaState {
  const energyInput = 28;
  return {
    energyInput,
    electricField: 38,
    ionisedNuclei: ionisedNucleiAtEnergy(energyInput),
    modelTimeSeconds: 0,
  };
}

/**
 * Increasing the relative energy ionises neutral hydrogen; reducing it lets
 * the same ions and free electrons recombine. The one-to-one electron pairing
 * is an explicit model rule, not a kinetic prediction.
 */
export function setPlasmaEnergy(state: PlasmaState, energyInput: number): PlasmaState {
  if (!Number.isFinite(energyInput)) return state;
  const boundedEnergy = clamp(energyInput, 0, 100);
  return {
    ...state,
    energyInput: boundedEnergy,
    ionisedNuclei: ionisedNucleiAtEnergy(boundedEnergy),
  };
}

export function setPlasmaElectricField(state: PlasmaState, electricField: number): PlasmaState {
  if (!Number.isFinite(electricField)) return state;
  return { ...state, electricField: clamp(electricField, -100, 100) };
}

export function advancePlasma(state: PlasmaState, seconds = 0.12): PlasmaState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  return { ...state, modelTimeSeconds: state.modelTimeSeconds + seconds };
}

export function plasmaLedgerAt(state: PlasmaState, nuclei = PLASMA_NUCLEI): PlasmaLedger {
  const safeNuclei = Number.isFinite(nuclei) ? Math.max(0, Math.floor(nuclei)) : 0;
  const ions = clamp(Math.floor(state.ionisedNuclei), 0, safeNuclei);
  const neutrals = safeNuclei - ions;
  const freeElectrons = ions;
  const boundElectrons = neutrals;
  return {
    nuclei: safeNuclei,
    neutralAtoms: neutrals,
    positiveIons: ions,
    freeElectrons,
    boundElectrons,
    totalElectrons: freeElectrons + boundElectrons,
    netChargeInElementaryCharges: ions - freeElectrons,
  };
}

/** Relative qE response; the sign reverses for opposite charges and for E. */
export function plasmaForceResponse(charge: PlasmaCharge, electricField: number): number {
  if (!Number.isFinite(electricField)) return 0;
  return charge * clamp(electricField, -100, 100);
}

export function createBecState(): BecState {
  return {
    temperatureNK: 220,
    criticalTemperatureNK: BEC_CRITICAL_TEMPERATURE_NK,
    atomCount: BEC_MARKERS,
    modelTimeSeconds: 0,
  };
}

/** Ideal-gas fraction for a fixed, ideal harmonic trap below Tc. */
export function becCondensateFractionAtTemperature(
  temperatureNK: number,
  criticalTemperatureNK = BEC_CRITICAL_TEMPERATURE_NK,
): number {
  if (!Number.isFinite(temperatureNK) || !Number.isFinite(criticalTemperatureNK) || criticalTemperatureNK <= 0) return 0;
  // The model's supported range is positive, while this guard also keeps an
  // accidental external call from implying a temperature below absolute zero.
  const safeTemperature = Math.max(Number.MIN_VALUE, temperatureNK);
  if (safeTemperature >= criticalTemperatureNK) return 0;
  return clamp(1 - (safeTemperature / criticalTemperatureNK) ** 3, 0, 1);
}

export function becFractionsAt(state: BecState): BecFractions {
  const condensed = becCondensateFractionAtTemperature(state.temperatureNK, state.criticalTemperatureNK);
  return { condensed, thermal: 1 - condensed };
}

export function setBecTemperature(state: BecState, temperatureNK: number): BecState {
  if (!Number.isFinite(temperatureNK)) return state;
  return {
    ...state,
    temperatureNK: clamp(temperatureNK, BEC_TEMPERATURE_BOUNDS_NK.minimum, BEC_TEMPERATURE_BOUNDS_NK.maximum),
  };
}

export function advanceBec(state: BecState, seconds = 0.12): BecState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  return { ...state, modelTimeSeconds: state.modelTimeSeconds + seconds };
}

/** Split the constant atom ledger into the two model components. */
export function becAtomCounts(state: BecState): Readonly<{ condensed: number; thermal: number; total: number }> {
  const total = Math.max(0, Math.floor(state.atomCount));
  const condensed = clamp(Math.round(becFractionsAt(state).condensed * total), 0, total);
  return { condensed, thermal: total - condensed, total };
}
