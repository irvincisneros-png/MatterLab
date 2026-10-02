import {
  addThermalEnergy,
  advanceModelTime,
  createInitialSamples,
  thermalStateAtEnergy,
  type MatterSample,
  type Phase,
} from './matterEngine';

export type WaterTopicMode = 'cycle' | 'heating' | 'properties' | 'density-liquids' | 'density-objects';
export type WaterCyclePools = Readonly<{
  oceanLiquidKg: number;
  surfaceLiquidKg: number;
  groundwaterLiquidKg: number;
  cloudLiquidKg: number;
  cloudIceKg: number;
  atmosphericVapourKg: number;
  snowAndGlacierIceKg: number;
}>;
export type WaterCycleState = Readonly<{
  pools: WaterCyclePools;
  sunPercent: number;
  airTemperatureC: number;
  humidityPercent: number;
  precipitationOn: boolean;
  modelTimeSeconds: number;
}>;
export type CycleProcess = 'evaporation' | 'condensation' | 'cloud-freezing' | 'cloud-melting' | 'precipitation' | 'freezing' | 'melting' | 'runoff' | 'infiltration' | 'groundwater-flow';
export type CycleStep = Readonly<{ state: WaterCycleState; transfersKg: Readonly<Record<CycleProcess, number>> }>;

export const CYCLE_WATER_MASS_KG = 1;
const POOL_NAMES = [
  'oceanLiquidKg', 'surfaceLiquidKg', 'groundwaterLiquidKg', 'cloudLiquidKg', 'cloudIceKg', 'atmosphericVapourKg', 'snowAndGlacierIceKg',
] as const;
type PoolName = (typeof POOL_NAMES)[number];
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function createWaterCycleState(): WaterCycleState {
  return {
    pools: {
      oceanLiquidKg: 0.48, surfaceLiquidKg: 0.07, groundwaterLiquidKg: 0.06,
      cloudLiquidKg: 0.1, cloudIceKg: 0.02, atmosphericVapourKg: 0.17, snowAndGlacierIceKg: 0.1,
    },
    sunPercent: 65,
    airTemperatureC: 8,
    humidityPercent: 70,
    precipitationOn: false,
    modelTimeSeconds: 0,
  };
}

export function totalCycleWaterKg(pools: WaterCyclePools): number {
  return POOL_NAMES.reduce((total, name) => total + pools[name], 0);
}

export function setCycleConditions(
  state: WaterCycleState,
  patch: Partial<Pick<WaterCycleState, 'sunPercent' | 'airTemperatureC' | 'humidityPercent' | 'precipitationOn'>>,
): WaterCycleState {
  return {
    ...state,
    sunPercent: patch.sunPercent === undefined ? state.sunPercent : clamp(finite(patch.sunPercent, state.sunPercent), 0, 100),
    airTemperatureC: patch.airTemperatureC === undefined ? state.airTemperatureC : clamp(finite(patch.airTemperatureC, state.airTemperatureC), -20, 35),
    humidityPercent: patch.humidityPercent === undefined ? state.humidityPercent : clamp(finite(patch.humidityPercent, state.humidityPercent), 0, 100),
    precipitationOn: patch.precipitationOn === undefined ? state.precipitationOn : patch.precipitationOn,
  };
}

function moveMass(pools: Record<PoolName, number>, source: PoolName, destination: PoolName, requestedKg: number): number {
  const moved = clamp(finite(requestedKg), 0, pools[source]);
  if (moved <= 0) return 0;
  pools[source] = Math.max(0, pools[source] - moved);
  pools[destination] += moved;
  return moved;
}

/** A bounded, qualitative water-cycle lesson model, not a climate forecast. */
export function advanceWaterCycle(state: WaterCycleState, seconds = 1): CycleStep {
  if (!Number.isFinite(seconds) || seconds <= 0) return { state, transfersKg: { evaporation: 0, condensation: 0, 'cloud-freezing': 0, 'cloud-melting': 0, precipitation: 0, freezing: 0, melting: 0, runoff: 0, infiltration: 0, 'groundwater-flow': 0 } };
  const dt = Math.min(seconds, 10);
  const pools = { ...state.pools };
  const transfersKg: Record<CycleProcess, number> = {
    evaporation: 0, condensation: 0, 'cloud-freezing': 0, 'cloud-melting': 0, precipitation: 0, freezing: 0, melting: 0, runoff: 0, infiltration: 0, 'groundwater-flow': 0,
  };

  const warmth = clamp((state.airTemperatureC + 10) / 30, 0, 1.5);
  const evaporationRate = 0.0035 * (state.sunPercent / 100) * warmth;
  transfersKg.evaporation = moveMass(pools, 'oceanLiquidKg', 'atmosphericVapourKg', evaporationRate * dt);

  const coolness = clamp((22 - state.airTemperatureC) / 28, 0, 1.2);
  const condensationRate = 0.0032 * (state.humidityPercent / 100) * coolness;
  transfersKg.condensation = moveMass(pools, 'atmosphericVapourKg', 'cloudLiquidKg', condensationRate * dt);

  // Condensation first makes cloud droplets; freezing and melting are separate phase changes.
  if (state.airTemperatureC < 0) {
    transfersKg['cloud-freezing'] = moveMass(pools, 'cloudLiquidKg', 'cloudIceKg', 0.003 * Math.min(1, -state.airTemperatureC / 10) * dt);
  } else {
    transfersKg['cloud-melting'] = moveMass(pools, 'cloudIceKg', 'cloudLiquidKg', 0.002 * Math.min(1, state.airTemperatureC / 8) * dt);
  }

  if (state.precipitationOn) {
    const precipDestination: PoolName = state.airTemperatureC <= 0 ? 'snowAndGlacierIceKg' : 'surfaceLiquidKg';
    if (state.airTemperatureC <= 0) transfersKg.precipitation = moveMass(pools, 'cloudIceKg', precipDestination, 0.018 * dt);
    else transfersKg.precipitation = moveMass(pools, 'cloudLiquidKg', precipDestination, 0.018 * dt);
  }

  if (state.airTemperatureC < 0) {
    transfersKg.freezing = moveMass(pools, 'surfaceLiquidKg', 'snowAndGlacierIceKg', 0.0024 * Math.min(1, -state.airTemperatureC / 10) * dt);
  } else {
    transfersKg.melting = moveMass(pools, 'snowAndGlacierIceKg', 'surfaceLiquidKg', 0.0025 * (state.sunPercent / 100) * Math.min(1, state.airTemperatureC / 8) * dt);
  }

  transfersKg.infiltration = moveMass(pools, 'surfaceLiquidKg', 'groundwaterLiquidKg', 0.0009 * dt);
  transfersKg.runoff = moveMass(pools, 'surfaceLiquidKg', 'oceanLiquidKg', 0.0012 * dt);
  transfersKg['groundwater-flow'] = moveMass(pools, 'groundwaterLiquidKg', 'oceanLiquidKg', 0.0002 * dt);

  // Numerical correction goes only to the ocean pool; it corrects round-off, never a flux.
  const ledgerError = CYCLE_WATER_MASS_KG - totalCycleWaterKg(pools);
  pools.oceanLiquidKg = Math.max(0, pools.oceanLiquidKg + ledgerError);
  return {
    state: { ...state, pools, modelTimeSeconds: state.modelTimeSeconds + dt },
    transfersKg,
  };
}

export type HeatingStart = 'ice' | 'room-water';
export type ThermometerKind = 'digital-probe' | 'glass-thermometer';
export type HeaterKind = 'hot-plate' | 'immersion-heater';
export type HeatingReading = Readonly<{
  trial: number;
  timeSeconds: number;
  temperatureC: number;
  referenceTemperatureC: number;
  phaseLabel: string;
  solidFraction: number;
  liquidFraction: number;
  vapourFraction: number;
}>;
export type HeatingExperiment = Readonly<{
  sample: MatterSample;
  start: HeatingStart;
  thermometer: ThermometerKind;
  heater: HeaterKind;
  powerKW: number;
  trial: number;
  readings: readonly HeatingReading[];
}>;

export function createHeatingExperiment(start: HeatingStart = 'ice'): HeatingExperiment {
  const [ice, water] = createInitialSamples();
  return { sample: { ...(start === 'ice' ? ice : water) }, start, thermometer: 'digital-probe', heater: 'hot-plate', powerKW: 1, trial: 1, readings: [] };
}

export function setHeatingPower(experiment: HeatingExperiment, powerKW: number): HeatingExperiment {
  return { ...experiment, powerKW: clamp(finite(powerKW, experiment.powerKW), 0.1, experiment.heater === 'hot-plate' ? 2 : 1.5) };
}

export function setHeatingEquipment(experiment: HeatingExperiment, heater: HeaterKind): HeatingExperiment {
  const maximum = heater === 'hot-plate' ? 2 : 1.5;
  return { ...experiment, heater, powerKW: Math.min(maximum, experiment.powerKW) };
}

export function setThermometer(experiment: HeatingExperiment, thermometer: ThermometerKind): HeatingExperiment {
  return { ...experiment, thermometer };
}

/** Fixed physical time and heater power determine temperature; playback speed is a UI concern. */
export function advanceHeating(experiment: HeatingExperiment, seconds = 1 / 60): HeatingExperiment {
  if (!Number.isFinite(seconds) || seconds <= 0) return experiment;
  const advancedTime = advanceModelTime(experiment.sample, seconds);
  const heated = addThermalEnergy(advancedTime, experiment.powerKW * seconds);
  return { ...experiment, sample: heated };
}

export function thermometerTemperature(temperatureC: number, thermometer: ThermometerKind): number {
  if (!Number.isFinite(temperatureC)) return 0;
  const resolution = thermometer === 'digital-probe' ? 0.1 : 1;
  return Math.round(temperatureC / resolution) * resolution;
}

export function recordHeatingReading(experiment: HeatingExperiment): HeatingExperiment {
  const thermal = thermalStateAtEnergy(experiment.sample.energyKJ);
  const temperatureC = thermometerTemperature(thermal.temperatureC, experiment.thermometer);
  const reading: HeatingReading = {
    trial: experiment.trial,
    timeSeconds: experiment.sample.modelTimeSeconds,
    temperatureC,
    referenceTemperatureC: thermal.temperatureC,
    phaseLabel: thermal.phaseLabel,
    solidFraction: thermal.fractions.solid,
    liquidFraction: thermal.fractions.liquid,
    vapourFraction: thermal.fractions.gas,
  };
  return { ...experiment, readings: [...experiment.readings, reading] };
}

export function restartHeating(experiment: HeatingExperiment, start: HeatingStart = experiment.start): HeatingExperiment {
  const reset = createHeatingExperiment(start);
  return { ...reset, thermometer: experiment.thermometer, heater: experiment.heater, powerKW: Math.min(experiment.powerKW, experiment.heater === 'hot-plate' ? 2 : 1.5), trial: experiment.trial + 1 };
}

export const WATER_DENSITY_REFERENCE_G_PER_ML = [
  { temperatureC: 0, densityGPerMl: 0.99987 },
  { temperatureC: 4, densityGPerMl: 1.0 },
  { temperatureC: 5, densityGPerMl: 0.999992 },
  { temperatureC: 10, densityGPerMl: 0.99975 },
  { temperatureC: 15.6, densityGPerMl: 0.99907 },
  { temperatureC: 21, densityGPerMl: 0.99802 },
  { temperatureC: 26.7, densityGPerMl: 0.99669 },
  { temperatureC: 32.2, densityGPerMl: 0.9951 },
  { temperatureC: 37.8, densityGPerMl: 0.99318 },
  { temperatureC: 48.9, densityGPerMl: 0.9887 },
  { temperatureC: 60, densityGPerMl: 0.98338 },
] as const;

/** Piecewise-linear interpolation through the rounded USGS reference table. */
export function waterDensityGPerMl(temperatureC: number): number {
  const t = clamp(finite(temperatureC), WATER_DENSITY_REFERENCE_G_PER_ML[0].temperatureC, WATER_DENSITY_REFERENCE_G_PER_ML.at(-1)!.temperatureC);
  const upperIndex = WATER_DENSITY_REFERENCE_G_PER_ML.findIndex((point) => point.temperatureC >= t);
  const upper = WATER_DENSITY_REFERENCE_G_PER_ML[Math.max(1, upperIndex)];
  const lower = WATER_DENSITY_REFERENCE_G_PER_ML[Math.max(0, upperIndex - 1)];
  const fraction = (t - lower.temperatureC) / (upper.temperatureC - lower.temperatureC);
  return lower.densityGPerMl + (upper.densityGPerMl - lower.densityGPerMl) * fraction;
}

export function waterDensityKgPerM3(temperatureC: number): number {
  return waterDensityGPerMl(temperatureC) * 1000;
}

export type BuoyancyResult = Readonly<{
  objectDensityKgM3: number;
  weightN: number;
  maximumBuoyantForceN: number;
  displacedVolumeM3: number;
  submergedFraction: number;
  floats: boolean;
  neutral: boolean;
  behavior: 'floats' | 'neutral' | 'sinks';
}>;

/** Archimedes model for a watertight shape; hollow volume is included in its outer volume. */
export function calculateBuoyancy(massKg: number, outerVolumeMl: number, liquidDensityKgM3: number): BuoyancyResult | null {
  if (![massKg, outerVolumeMl, liquidDensityKgM3].every(Number.isFinite) || massKg <= 0 || outerVolumeMl <= 0 || liquidDensityKgM3 <= 0) return null;
  const volumeM3 = outerVolumeMl * 1e-6;
  const weightN = massKg * 9.80665;
  const maximumBuoyantForceN = liquidDensityKgM3 * volumeM3 * 9.80665;
  const objectDensityKgM3 = massKg / volumeM3;
  const neutral = Math.abs(objectDensityKgM3 - liquidDensityKgM3) <= liquidDensityKgM3 * 1e-8;
  const floats = objectDensityKgM3 < liquidDensityKgM3 && !neutral;
  const displacedVolumeM3 = Math.min(volumeM3, massKg / liquidDensityKgM3);
  return {
    objectDensityKgM3,
    weightN,
    maximumBuoyantForceN,
    displacedVolumeM3,
    submergedFraction: floats ? clamp(displacedVolumeM3 / volumeM3, 0, 1) : 1,
    floats,
    neutral,
    behavior: neutral ? 'neutral' : floats ? 'floats' : 'sinks',
  };
}

export type SurfacePlacement = 'gentle' | 'push-under';
export type SurfaceTensionResult = Readonly<{ supported: boolean; detergentWeakensSupport: boolean; explanation: string }>;

/** Categorical surface-tension demonstration; it deliberately reports no calibrated force. */
export function surfaceTensionOutcome(placement: SurfacePlacement, detergentAdded: boolean): SurfaceTensionResult {
  const supported = placement === 'gentle' && !detergentAdded;
  return {
    supported,
    detergentWeakensSupport: detergentAdded,
    explanation: supported
      ? 'The dense paperclip rests on the water surface because of surface tension, not because its average density is below water.'
      : detergentAdded
        ? 'In this qualitative model, detergent weakens the surface support and the paperclip sinks.'
        : 'Pushing the paperclip through the surface breaks the support; it sinks in the water.',
  };
}

export const LIQUID_REFERENCE_DENSITIES = {
  water20C: { name: 'Pure water', densityKgM3: 998.234, conditions: '20 °C, 1 atm, NIST 0.9982336 g/mL rounded to 998.234 kg/m³' },
  ethanol20C: { name: 'Pure ethanol', densityKgM3: 789.37, conditions: '20 °C, NIST selected values' },
} as const;

export type LiquidSampleId = keyof typeof LIQUID_REFERENCE_DENSITIES;
export type LiquidMeasurement = Readonly<{
  trial: number;
  sample: LiquidSampleId;
  volumeMl: number;
  tareMassG: number;
  grossMassG: number;
  netMassG: number;
  calculatedGPerMl: number;
  calculatedKgPerM3: number;
  referenceKgPerM3: number;
  conditions: string;
}>;

export function calculateDensityFromMassAndVolume(massG: number, volumeMl: number): Readonly<{ gPerMl: number; kgPerM3: number }> | null {
  if (!Number.isFinite(massG) || !Number.isFinite(volumeMl) || massG < 0 || volumeMl <= 0) return null;
  const gPerMl = massG / volumeMl;
  return { gPerMl, kgPerM3: gPerMl * 1000 };
}

export function measureLiquidSample(sample: LiquidSampleId, volumeMl: number, tareMassG: number, trial = 1, trueFillVolumeMl = volumeMl): LiquidMeasurement | null {
  if (!Number.isFinite(volumeMl) || volumeMl <= 0 || !Number.isFinite(trueFillVolumeMl) || trueFillVolumeMl <= 0 || !Number.isFinite(tareMassG) || tareMassG < 0 || !Number.isInteger(trial) || trial < 1) return null;
  const reference = LIQUID_REFERENCE_DENSITIES[sample];
  const exactNetMassG = reference.densityKgM3 / 1000 * trueFillVolumeMl;
  const netMassG = Math.round(exactNetMassG * 10) / 10; // stated balance resolution: 0.1 g
  const grossMassG = Math.round((tareMassG + netMassG) * 10) / 10;
  const measuredNetMassG = Math.round((grossMassG - tareMassG) * 10) / 10;
  const density = calculateDensityFromMassAndVolume(measuredNetMassG, volumeMl);
  if (!density) return null;
  return {
    trial, sample, volumeMl, tareMassG, grossMassG, netMassG: measuredNetMassG,
    calculatedGPerMl: density.gPerMl, calculatedKgPerM3: density.kgPerM3,
    referenceKgPerM3: reference.densityKgM3, conditions: reference.conditions,
  };
}

export type SolidMaterialId = 'aluminum' | 'brass';
export const SOLID_REFERENCE_DENSITIES: Readonly<Record<SolidMaterialId, { name: string; densityGPerCm3: number; densityKgPerM3: number; conditions: string }>> = {
  aluminum: { name: 'Aluminium (typical)', densityGPerCm3: 2.7, densityKgPerM3: 2700, conditions: 'NIST reference table, approximate typical value; temperature unspecified' },
  brass: { name: 'Brass', densityGPerCm3: 8.3909, densityKgPerM3: 8390.9, conditions: '20 °C, NIST reference table' },
};

export function regularVolumeCm3(lengthCm: number, widthCm: number, heightCm: number): number | null {
  if (![lengthCm, widthCm, heightCm].every(Number.isFinite) || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) return null;
  return lengthCm * widthCm * heightCm;
}

export function displacementVolumeCm3(initialMl: number, finalMl: number): number | null {
  if (![initialMl, finalMl].every(Number.isFinite) || initialMl < 0 || finalMl <= initialMl) return null;
  return finalMl - initialMl; // 1 mL displaced = 1 cm³.
}

export function calculateSolidDensity(massG: number, volumeCm3: number): Readonly<{ gPerCm3: number; kgPerM3: number }> | null {
  if (!Number.isFinite(massG) || !Number.isFinite(volumeCm3) || massG < 0 || volumeCm3 <= 0) return null;
  const gPerCm3 = massG / volumeCm3;
  return { gPerCm3, kgPerM3: gPerCm3 * 1000 };
}

export function simulatedBalanceReading(exactMassG: number, resolutionG = 0.1): number | null {
  if (!Number.isFinite(exactMassG) || !Number.isFinite(resolutionG) || exactMassG < 0 || resolutionG <= 0) return null;
  return Math.round(exactMassG / resolutionG) * resolutionG;
}

export function isPhase(phase: string): phase is Phase {
  return phase === 'solid' || phase === 'liquid' || phase === 'gas';
}

/* ------------------------------------------------------------------------- *
 * Purposeful particle views
 *
 * These helpers are pure layout/science functions (no rendering). They give the
 * 3D scene molecule positions that teach something: a magnified "zoom lens" whose
 * molecule count follows real number density, and a heating-vessel layout that
 * keeps ice ordered, liquid close-packed and vapour sparse.
 * ------------------------------------------------------------------------- */

/** Molar masses (g/mol): H₂O 18.015, C₂H₅OH 46.07. */
export const LIQUID_MOLAR_MASS_G_PER_MOL = { water20C: 18.015, ethanol20C: 46.07 } as const;

/** Molecules per unit volume of a sample divided by the same for water at 20 °C (ρ / M, normalised). */
export function relativeMoleculeNumberDensity(sample: LiquidSampleId): number {
  const perVolume = (id: LiquidSampleId) => LIQUID_REFERENCE_DENSITIES[id].densityKgM3 / LIQUID_MOLAR_MASS_G_PER_MOL[id];
  return perVolume(sample) / perVolume('water20C');
}

/** Number of molecules drawn in the zoom lens for pure water; other liquids scale with number density. */
export const LENS_WATER_MOLECULES = 14;
export type LensMolecule = Readonly<{ x: number; y: number; z: number; spin: number }>;

function unitHash(index: number, lane: number) {
  const value = Math.sin((index + 1) * 127.1 + lane * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

/**
 * Close-packed, slightly jittered lattice of molecule centres inside a lens ellipsoid.
 * Spacing grows as the cube root of 1 / number density, so ethanol (fewer, larger molecules per mL)
 * shows fewer molecules in the same lens volume than water.
 */
export function lensMoleculeLayout(sample: LiquidSampleId, radii: readonly [number, number, number] = [0.38, 0.38, 0.19]): LensMolecule[] {
  const relative = relativeMoleculeNumberDensity(sample);
  const target = Math.max(2, Math.round(LENS_WATER_MOLECULES * relative));
  const nearest = 0.235 * Math.cbrt(1 / relative);
  const edge = nearest * Math.SQRT2;
  const points: { x: number; y: number; z: number; r: number }[] = [];
  for (let i = -8; i <= 8; i += 1) for (let j = -8; j <= 8; j += 1) for (let k = -8; k <= 8; k += 1) {
    if ((i + j + k) % 2 !== 0) continue;
    const index = (i + 8) * 289 + (j + 8) * 17 + (k + 8);
    const x = (i * edge) / 2 + (unitHash(index, 0) - 0.5) * nearest * 0.24;
    const y = (j * edge) / 2 + (unitHash(index, 1) - 0.5) * nearest * 0.24;
    const z = (k * edge) / 2 + (unitHash(index, 2) - 0.5) * nearest * 0.24;
    const r = Math.hypot(x / radii[0], y / radii[1], z / radii[2]);
    if (r <= 1.1) points.push({ x, y, z, r });
  }
  return points.sort((a, b) => a.r - b.r).slice(0, target).map((point, index) => ({ x: point.x, y: point.y, z: point.z, spin: unitHash(index, 3) * Math.PI * 2 }));
}

export const HEATING_PARTICLE_COUNT = 27;
export type HeatingVessel = Readonly<{
  centreX: number; floorY: number; innerRadius: number; rimY: number;
  waterHeight: number; iceBottom: number; iceHeight: number; iceHalfWidth: number;
}>;
export type HeatingParticle = Readonly<{ id: number; phase: Phase; position: readonly [number, number, number]; spin: number }>;

function halton(index: number, base: number) {
  let result = 0, fraction = 1 / base, i = index;
  while (i > 0) { result += fraction * (i % base); i = Math.floor(i / base); fraction /= base; }
  return result;
}

/** Largest-remainder allocation of N particles among solid, liquid and gas. */
export function allocateHeatingPhases(fractions: Readonly<Record<Phase, number>>, count = HEATING_PARTICLE_COUNT): Phase[] {
  const names = ['solid', 'liquid', 'gas'] as const;
  const rows = names.map((phase) => {
    const exact = clamp(fractions[phase], 0, 1) * count;
    return { phase, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let placed = rows.reduce((sum, row) => sum + row.amount, 0);
  for (const row of [...rows].sort((a, b) => b.remainder - a.remainder)) {
    if (placed >= count) break;
    row.amount += 1; placed += 1;
  }
  return rows.flatMap((row) => Array.from({ length: row.amount }, () => row.phase));
}

/**
 * Lays out particles in the vessel: ice = ordered 3 × 3 lattice inside the (floating) ice block, liquid =
 * evenly spread, close-spaced molecules that wander through the whole water volume, vapour = a sparse
 * fast-moving scatter in the air above the liquid that is free to leave the open vessel.
 */
export function layoutHeatingParticles(fractions: Readonly<Record<Phase, number>>, timeSeconds: number, vessel: HeatingVessel, temperatureC: number, count = HEATING_PARTICLE_COUNT): HeatingParticle[] {
  const phases = allocateHeatingPhases(fractions, count);
  const solidCount = phases.filter((phase) => phase === 'solid').length;
  const layers = Math.max(1, Math.ceil(solidCount / 9));
  const spacing = Math.min(0.27, (vessel.iceHalfWidth * 2 * 0.74) / 2);
  const vibration = 0.01 + clamp((temperatureC + 30) / 30, 0, 1) * 0.012;
  const surfaceY = vessel.floorY + Math.max(0.02, vessel.waterHeight);
  const airFloor = Math.max(surfaceY, vessel.iceBottom + vessel.iceHeight) + 0.14;
  const liquidRadius = vessel.innerRadius * 0.74;
  let solidSeen = 0, liquidSeen = 0, gasSeen = 0;
  return phases.map((phase, id) => {
    const spin = unitHash(id, 5) * Math.PI * 2;
    if (phase === 'solid') {
      const slot = solidSeen++;
      const column = slot % 3, row = Math.floor((slot % 9) / 3), layer = Math.floor(slot / 9);
      const wobble = (lane: number) => vibration * Math.sin(timeSeconds * 7 + id * 1.9 + lane * 2.1);
      return { id, phase, spin: 0.35 * (id % 2), position: [
        vessel.centreX + (column - 1) * spacing + wobble(0),
        vessel.iceBottom + ((layer + 0.5) * vessel.iceHeight) / layers + wobble(1),
        (row - 1) * spacing + wobble(2),
      ] as const };
    }
    if (phase === 'liquid') {
      const slot = liquidSeen++;
      const angle = halton(slot + 1, 2) * Math.PI * 2 + 0.12 * Math.sin(timeSeconds * 0.9 + id);
      const radius = liquidRadius * Math.sqrt(halton(slot + 1, 3));
      const bottom = vessel.floorY + 0.1;
      const top = Math.max(bottom + 0.02, surfaceY - 0.1);
      let x = vessel.centreX + Math.cos(angle) * radius + 0.035 * Math.sin(timeSeconds * 1.7 + id * 1.3);
      let z = Math.sin(angle) * radius + 0.035 * Math.cos(timeSeconds * 1.5 + id * 0.9);
      let y = bottom + halton(slot + 1, 5) * (top - bottom) + 0.03 * Math.sin(timeSeconds * 1.9 + id * 2.3);
      const insideIce = vessel.iceHeight > 0.01
        && Math.abs(x - vessel.centreX) < vessel.iceHalfWidth + 0.1 && Math.abs(z) < vessel.iceHalfWidth + 0.1
        && y > vessel.iceBottom - 0.1 && y < vessel.iceBottom + vessel.iceHeight + 0.1;
      if (insideIce) {
        const side = x >= vessel.centreX ? 1 : -1;
        x = vessel.centreX + side * (vessel.iceHalfWidth + 0.16);
        z = clamp(z, -0.2, 0.2);
      }
      y = clamp(y, bottom, Math.max(bottom, surfaceY - 0.06));
      return { id, phase, spin, position: [x, y, z] as const };
    }
    const slot = gasSeen++;
    const low = airFloor, high = vessel.rimY + 0.62;
    const yUnit = 0.5 + 0.5 * Math.sin(timeSeconds * (0.9 + 0.5 * unitHash(slot, 6)) + slot * 2.17);
    const y = low + (high - low) * clamp(yUnit * 0.85 + unitHash(slot, 7) * 0.15, 0, 1);
    const reach = y < vessel.rimY - 0.12 ? vessel.innerRadius * 0.74 : vessel.innerRadius + 0.2;
    const x = vessel.centreX + reach * Math.sin(timeSeconds * (0.7 + 0.6 * unitHash(slot, 8)) + slot * 1.7) * (0.55 + 0.45 * unitHash(slot, 9));
    const z = reach * 0.8 * Math.sin(timeSeconds * (0.6 + 0.5 * unitHash(slot, 10)) + slot * 2.9) * (0.5 + 0.5 * unitHash(slot, 11));
    return { id, phase, spin: spin + timeSeconds * 1.4, position: [x, y, z] as const };
  });
}
