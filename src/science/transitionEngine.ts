import {
  addThermalEnergy,
  ENERGY_MILESTONES_KJ,
  SAMPLE_MASS_KG,
  thermalStateAtEnergy,
  type MatterSample,
  type Phase,
} from './matterEngine';

export type TransitionId = 'melting' | 'freezing' | 'vaporisation' | 'condensation' | 'sublimation' | 'deposition';
export type VaporisationMode = 'evaporation' | 'boiling';
export type ReservoirMasses = Readonly<Record<Phase, number>>;

export type TransitionState = Readonly<{
  transition: TransitionId;
  mode: VaporisationMode;
  energyKJ: number;
  modelTimeSeconds: number;
  surfaceTempC: number;
  airTempC: number;
  humidityPercent: number;
  reservoirsKg: ReservoirMasses;
}>;

export type TransferObservation = Readonly<{
  temperatureC: number;
  reservoirsKg: ReservoirMasses;
  fractions: ReservoirMasses;
  transferRateKgPerSecond: number;
  transferredKg: number;
  direction: readonly [Phase, Phase] | null;
  thermal: boolean;
}>;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const thermalIds = new Set<TransitionId>(['melting', 'freezing', 'vaporisation']);

function massesFromEnergy(energyKJ: number): ReservoirMasses {
  const fractions = thermalStateAtEnergy(energyKJ).fractions;
  return {
    solid: fractions.solid * SAMPLE_MASS_KG,
    liquid: fractions.liquid * SAMPLE_MASS_KG,
    gas: fractions.gas * SAMPLE_MASS_KG,
  };
}

/**
 * Set up an honest starting condition for the selected change. The thermal
 * examples begin from the existing pure-water energy model; surface examples
 * begin with a source reservoir and transfer only when time advances.
 */
export function createTransitionState(transition: TransitionId, mode: VaporisationMode = 'evaporation'): TransitionState {
  const boiling = transition === 'vaporisation' && mode === 'boiling';
  let energyKJ = 0;
  let surfaceTempC = 22;
  let airTempC = 22;
  let humidityPercent = 45;
  let reservoirsKg: ReservoirMasses = { solid: SAMPLE_MASS_KG, liquid: 0, gas: 0 };

  if (transition === 'melting') {
    energyKJ = -8.4;
    reservoirsKg = massesFromEnergy(energyKJ);
  } else if (transition === 'freezing') {
    energyKJ = ENERGY_MILESTONES_KJ.meltingEnd + SAMPLE_MASS_KG * 4.18 * 22;
    reservoirsKg = massesFromEnergy(energyKJ);
  } else if (transition === 'vaporisation') {
    if (boiling) {
      energyKJ = ENERGY_MILESTONES_KJ.meltingEnd + SAMPLE_MASS_KG * 4.18 * 92;
      reservoirsKg = massesFromEnergy(energyKJ);
      surfaceTempC = 92;
    } else {
      energyKJ = ENERGY_MILESTONES_KJ.meltingEnd + SAMPLE_MASS_KG * 4.18 * 24;
      reservoirsKg = { solid: 0, liquid: SAMPLE_MASS_KG, gas: 0 };
      surfaceTempC = 24;
      airTempC = 24;
      humidityPercent = 30;
    }
  } else if (transition === 'condensation') {
    reservoirsKg = { solid: 0, liquid: 0, gas: SAMPLE_MASS_KG };
    surfaceTempC = 4;
    airTempC = 22;
    humidityPercent = 82;
  } else if (transition === 'sublimation') {
    reservoirsKg = { solid: SAMPLE_MASS_KG, liquid: 0, gas: 0 };
    surfaceTempC = -8;
    airTempC = -8;
    humidityPercent = 24;
  } else if (transition === 'deposition') {
    reservoirsKg = { solid: 0, liquid: 0, gas: SAMPLE_MASS_KG };
    surfaceTempC = -9;
    airTempC = 5;
    humidityPercent = 86;
  }

  return { transition, mode, energyKJ, modelTimeSeconds: 0, surfaceTempC, airTempC, humidityPercent, reservoirsKg };
}

/** Buck-style saturation pressure used only to give humidity controls a causal direction. */
export function saturationVapourPressureKPa(temperatureC: number, overIce = false): number {
  const safeTemperature = clamp(Number.isFinite(temperatureC) ? temperatureC : 0, -80, 80);
  const exponent = overIce
    ? (22.587 * safeTemperature) / (safeTemperature + 273.86)
    : (17.625 * safeTemperature) / (safeTemperature + 243.04);
  return 0.61094 * Math.exp(exponent);
}

export function observationAt(state: TransitionState): TransferObservation {
  const isThermal = thermalIds.has(state.transition) && !(state.transition === 'vaporisation' && state.mode === 'evaporation');
  const reservoirsKg = isThermal ? massesFromEnergy(state.energyKJ) : state.reservoirsKg;
  const temperatureC = isThermal ? thermalStateAtEnergy(state.energyKJ).temperatureC : state.surfaceTempC;
  const fractions = {
    solid: reservoirsKg.solid / SAMPLE_MASS_KG,
    liquid: reservoirsKg.liquid / SAMPLE_MASS_KG,
    gas: reservoirsKg.gas / SAMPLE_MASS_KG,
  };
  const { transition, humidityPercent, airTempC, surfaceTempC } = state;
  const airVapourPressure = (humidityPercent / 100) * saturationVapourPressureKPa(airTempC);
  const waterSurfacePressure = saturationVapourPressureKPa(surfaceTempC);
  const iceSurfacePressure = saturationVapourPressureKPa(surfaceTempC, true);
  let transferRateKgPerSecond = 0;
  let direction: readonly [Phase, Phase] | null = null;

  if (transition === 'vaporisation' && state.mode === 'evaporation') {
    const flux = waterSurfacePressure - airVapourPressure;
    if (Math.abs(flux) > 1e-8) direction = flux > 0 ? ['liquid', 'gas'] : ['gas', 'liquid'];
    transferRateKgPerSecond = 0.003 * Math.abs(flux);
  } else if (transition === 'condensation') {
    const flux = airVapourPressure - waterSurfacePressure;
    if (Math.abs(flux) > 1e-8) direction = flux > 0 ? ['gas', 'liquid'] : ['liquid', 'gas'];
    transferRateKgPerSecond = 0.003 * Math.abs(flux);
  } else if (transition === 'sublimation') {
    const flux = iceSurfacePressure - airVapourPressure;
    if (Math.abs(flux) > 1e-8) direction = flux > 0 ? ['solid', 'gas'] : ['gas', 'solid'];
    transferRateKgPerSecond = 0.012 * Math.abs(flux);
  } else if (transition === 'deposition') {
    const flux = airVapourPressure - iceSurfacePressure;
    if (Math.abs(flux) > 1e-8) direction = flux > 0 ? ['gas', 'solid'] : ['solid', 'gas'];
    transferRateKgPerSecond = 0.009 * Math.abs(flux);
  }

  if (direction && reservoirsKg[direction[0]] <= 1e-12) {
    direction = null;
    transferRateKgPerSecond = 0;
  }

  return {
    temperatureC,
    reservoirsKg,
    fractions,
    transferRateKgPerSecond: Math.max(0, transferRateKgPerSecond),
    transferredKg: direction ? reservoirsKg[direction[1]] : 0,
    direction,
    thermal: isThermal,
  };
}

/** A small energy action, routed through the verified pure-water engine. */
export function addTransitionEnergy(state: TransitionState, deltaKJ: number): TransitionState {
  if (!Number.isFinite(deltaKJ) || !thermalIds.has(state.transition) || (state.transition === 'vaporisation' && state.mode === 'evaporation')) return state;
  const sample: MatterSample = { id: 'liquid', energyKJ: state.energyKJ, modelTimeSeconds: state.modelTimeSeconds, seed: 41 };
  const next = addThermalEnergy(sample, deltaKJ);
  return { ...state, energyKJ: next.energyKJ, reservoirsKg: massesFromEnergy(next.energyKJ) };
}

export function setTransitionEnvironment(
  state: TransitionState,
  patch: Partial<Pick<TransitionState, 'surfaceTempC' | 'humidityPercent'>>,
): TransitionState {
  const surfaceMinimum = state.transition === 'vaporisation' || state.transition === 'condensation' ? 0 : -25;
  const surfaceMaximum = state.transition === 'sublimation' || state.transition === 'deposition' ? 0 : state.transition === 'vaporisation' ? 60 : 80;
  return {
    ...state,
    surfaceTempC: patch.surfaceTempC === undefined ? state.surfaceTempC : clamp(Number.isFinite(patch.surfaceTempC) ? patch.surfaceTempC : state.surfaceTempC, surfaceMinimum, surfaceMaximum),
    humidityPercent: patch.humidityPercent === undefined ? state.humidityPercent : clamp(Number.isFinite(patch.humidityPercent) ? patch.humidityPercent : state.humidityPercent, 0, 100),
  };
}

export function setVaporisationMode(state: TransitionState, mode: VaporisationMode): TransitionState {
  return state.transition === 'vaporisation' && state.mode !== mode ? createTransitionState('vaporisation', mode) : state;
}

/**
 * Advance model time. Surface fluxes are deliberately qualitative and
 * accelerated; one source mass can never exceed the conserved sample ledger.
 */
export function advanceTransition(state: TransitionState, seconds = 0.1): TransitionState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const observation = observationAt(state);
  const nextTime = state.modelTimeSeconds + seconds;
  if (observation.thermal || !observation.direction) return { ...state, modelTimeSeconds: nextTime };

  const [source, destination] = observation.direction;
  const moved = Math.min(observation.reservoirsKg[source], observation.transferRateKgPerSecond * seconds);
  if (moved <= 0) return { ...state, modelTimeSeconds: nextTime };
  const nextMasses = {
    ...observation.reservoirsKg,
    [source]: Math.max(0, observation.reservoirsKg[source] - moved),
    [destination]: Math.min(SAMPLE_MASS_KG, observation.reservoirsKg[destination] + moved),
  };
  const remainder = SAMPLE_MASS_KG - (nextMasses.solid + nextMasses.liquid + nextMasses.gas);
  nextMasses[destination] += remainder;
  return { ...state, modelTimeSeconds: nextTime, reservoirsKg: nextMasses };
}

/** Stable phase allocation preserves every H₂O identity and exact count. */
export function allocateMoleculePhases(fractions: ReservoirMasses, count = 18): Phase[] {
  const entries = (['solid', 'liquid', 'gas'] as const).map((phase) => {
    const exact = clamp(fractions[phase], 0, 1) * count;
    return { phase, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let assigned = entries.reduce((sum, entry) => sum + entry.amount, 0);
  for (const entry of [...entries].sort((a, b) => b.remainder - a.remainder)) {
    if (assigned >= count) break;
    entry.amount += 1;
    assigned += 1;
  }
  return entries.flatMap(({ phase, amount }) => Array.from({ length: amount }, () => phase));
}
