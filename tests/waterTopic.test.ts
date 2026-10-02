import { describe, expect, it } from 'vitest';
import {
  advanceHeating,
  advanceWaterCycle,
  calculateBuoyancy,
  calculateDensityFromMassAndVolume,
  calculateSolidDensity,
  createHeatingExperiment,
  allocateHeatingPhases,
  createWaterCycleState,
  HEATING_PARTICLE_COUNT,
  layoutHeatingParticles,
  lensMoleculeLayout,
  relativeMoleculeNumberDensity,
  type HeatingVessel,
  displacementVolumeCm3,
  LIQUID_REFERENCE_DENSITIES,
  measureLiquidSample,
  recordHeatingReading,
  regularVolumeCm3,
  setCycleConditions,
  setHeatingEquipment,
  setHeatingPower,
  setThermometer,
  simulatedBalanceReading,
  SOLID_REFERENCE_DENSITIES,
  surfaceTensionOutcome,
  thermometerTemperature,
  totalCycleWaterKg,
  waterDensityGPerMl,
  waterDensityKgPerM3,
} from '../src/science/waterTopicEngine';
import { ENERGY_MILESTONES_KJ, SAMPLE_MASS_KG, thermalStateAtEnergy } from '../src/science/matterEngine';

describe('Earth water cycle pools', () => {
  it('starts with all three water states in reservoirs that sum to exactly one model kilogram', () => {
    const state = createWaterCycleState();
    expect(totalCycleWaterKg(state.pools)).toBeCloseTo(1, 12);
    expect(state.pools.cloudLiquidKg).toBeGreaterThan(0);
    expect(state.pools.atmosphericVapourKg).toBeGreaterThan(0);
    expect(state.pools.snowAndGlacierIceKg).toBeGreaterThan(0);
  });

  it('moves mass along heating, cooling, rain, freezing, melting and storage routes without creating or losing it', () => {
    let state = createWaterCycleState();
    const totalBefore = totalCycleWaterKg(state.pools);
    const sunny = advanceWaterCycle(setCycleConditions(state, { sunPercent: 100, airTemperatureC: 20, humidityPercent: 35 }), 10);
    expect(sunny.transfersKg.evaporation).toBeGreaterThan(0);
    expect(sunny.state.pools.atmosphericVapourKg).toBeGreaterThan(state.pools.atmosphericVapourKg);
    state = sunny.state;

    const coolHumid = advanceWaterCycle(setCycleConditions(state, { airTemperatureC: 2, humidityPercent: 100 }), 10);
    expect(coolHumid.transfersKg.condensation).toBeGreaterThan(0);
    expect(coolHumid.state.pools.cloudLiquidKg).toBeGreaterThan(state.pools.cloudLiquidKg);
    state = coolHumid.state;

    const coldClouds = advanceWaterCycle(setCycleConditions(state, { airTemperatureC: -12 }), 10);
    expect(coldClouds.transfersKg['cloud-freezing']).toBeGreaterThan(0);
    expect(coldClouds.state.pools.cloudIceKg).toBeGreaterThan(state.pools.cloudIceKg);
    state = coldClouds.state;

    const snow = advanceWaterCycle(setCycleConditions(state, { precipitationOn: true, airTemperatureC: -5 }), 10);
    expect(snow.transfersKg.precipitation).toBeGreaterThan(0);
    expect(snow.state.pools.snowAndGlacierIceKg).toBeGreaterThan(state.pools.snowAndGlacierIceKg);
    expect(totalCycleWaterKg(snow.state.pools)).toBeCloseTo(totalBefore, 12);

    const thaw = advanceWaterCycle(setCycleConditions(coldClouds.state, { airTemperatureC: 12, sunPercent: 100, precipitationOn: false }), 10);
    expect(thaw.transfersKg.melting).toBeGreaterThan(0);
    expect(thaw.transfersKg['cloud-melting']).toBeGreaterThan(0);
    expect(totalCycleWaterKg(thaw.state.pools)).toBeCloseTo(totalBefore, 12);
  });

  it('keeps every pool bounded through long hot and cold runs and labels cloud phase changes separately', () => {
    for (const controls of [{ sunPercent: 100, airTemperatureC: 35, humidityPercent: 100 }, { sunPercent: 0, airTemperatureC: -20, humidityPercent: 100, precipitationOn: true }]) {
      let state = setCycleConditions(createWaterCycleState(), controls);
      for (let index = 0; index < 1000; index += 1) {
        state = advanceWaterCycle(state, 0.12).state;
        expect(totalCycleWaterKg(state.pools)).toBeCloseTo(1, 10);
        for (const value of Object.values(state.pools)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
    const zeros = advanceWaterCycle(createWaterCycleState(), 0);
    expect(zeros.transfersKg.condensation).toBe(0);
    expect(zeros.transfersKg['cloud-freezing']).toBe(0);
  });
});

describe('measured heating investigation', () => {
  it('starts from either real core sample and retains the 0 °C plateau while using realistic heater power', () => {
    const ice = createHeatingExperiment('ice');
    const roomWater = createHeatingExperiment('room-water');
    expect(thermalStateAtEnergy(ice.sample.energyKJ).temperatureC).toBeCloseTo(-20, 8);
    expect(thermalStateAtEnergy(roomWater.sample.energyKJ).temperatureC).toBeCloseTo(22, 8);
    expect(ice.powerKW).toBe(1);
    const atZero = advanceHeating(ice, 8.4);
    expect(atZero.sample.modelTimeSeconds).toBeCloseTo(8.4, 10);
    expect(thermalStateAtEnergy(atZero.sample.energyKJ).temperatureC).toBe(0);
    const onPlateau = advanceHeating(atZero, 1);
    expect(thermalStateAtEnergy(onPlateau.sample.energyKJ).temperatureC).toBe(0);
    expect(thermalStateAtEnergy(onPlateau.sample.energyKJ).fractions.liquid).toBeGreaterThan(0);
    expect(thermalStateAtEnergy(onPlateau.sample.energyKJ).energyKJ).toBeGreaterThan(atZero.sample.energyKJ);
  });

  it('keeps the temperature-time slope tied to heater power and physical model seconds', () => {
    let experiment = createHeatingExperiment('room-water');
    experiment = setHeatingPower(experiment, 2);
    experiment = advanceHeating(experiment, 0.5);
    expect(experiment.sample.modelTimeSeconds).toBeCloseTo(0.5, 10);
    expect(experiment.sample.energyKJ - createHeatingExperiment('room-water').sample.energyKJ).toBeCloseTo(1, 10);
    expect(thermalStateAtEnergy(experiment.sample.energyKJ).temperatureC).toBeGreaterThan(22);
    expect(setHeatingEquipment(experiment, 'immersion-heater').powerKW).toBe(1.5);
    expect(setHeatingPower(experiment, Number.NaN).powerKW).toBe(2);
  });

  it('records the selected thermometer resolution against real sample time, energy and phase', () => {
    const start = createHeatingExperiment('room-water');
    const glass = recordHeatingReading(setThermometer(start, 'glass-thermometer'));
    expect(glass.readings).toHaveLength(1);
    expect(glass.readings[0].temperatureC).toBe(22);
    expect(glass.readings[0].timeSeconds).toBe(0);
    expect(glass.readings[0].liquidFraction).toBe(1);
    const partial = advanceHeating(setHeatingPower(createHeatingExperiment('ice'), 2), 4.6);
    const digital = recordHeatingReading(setThermometer(partial, 'digital-probe'));
    const exact = thermalStateAtEnergy(partial.sample.energyKJ).temperatureC;
    expect(digital.readings[0].temperatureC).toBeCloseTo(Math.round(exact * 10) / 10, 10);
    expect(digital.readings[0].phaseLabel).toContain('Ice + liquid water');
    expect(ENERGY_MILESTONES_KJ.boilingStart).toBeGreaterThan(ENERGY_MILESTONES_KJ.meltingEnd);
    expect(SAMPLE_MASS_KG).toBe(0.2);
    expect(thermometerTemperature(-15.26, 'glass-thermometer')).toBe(-15);
    expect(thermometerTemperature(-15.26, 'digital-probe')).toBe(-15.3);
  });
});

describe('water physical properties', () => {
  it('uses a bounded, rounded authoritative water-density curve with a maximum near 4 °C', () => {
    expect(waterDensityGPerMl(0)).toBeCloseTo(0.99987, 5);
    expect(waterDensityGPerMl(4)).toBe(1);
    expect(waterDensityGPerMl(20)).toBeCloseTo(0.9982, 3);
    expect(waterDensityGPerMl(60)).toBeCloseTo(0.98338, 5);
    expect(waterDensityKgPerM3(20)).toBeCloseTo(waterDensityGPerMl(20) * 1000, 8);
    expect(waterDensityGPerMl(-100)).toBe(waterDensityGPerMl(0));
    expect(waterDensityGPerMl(100)).toBe(waterDensityGPerMl(60));
  });

  it('calculates Archimedes displacement independently from average density and handles neutral buoyancy', () => {
    const boat = calculateBuoyancy(0.22, 450, 1000)!;
    expect(boat.behavior).toBe('floats');
    expect(boat.floats).toBe(true);
    expect(boat.submergedFraction).toBeCloseTo(0.22 / 0.45, 8);
    expect(boat.maximumBuoyantForceN).toBeGreaterThan(boat.weightN);
    const neutral = calculateBuoyancy(0.45, 450, 1000)!;
    expect(neutral.behavior).toBe('neutral');
    expect(neutral.floats).toBe(false);
    expect(neutral.submergedFraction).toBe(1);
    const sink = calculateBuoyancy(0.6, 450, 1000)!;
    expect(sink.behavior).toBe('sinks');
    expect(sink.maximumBuoyantForceN).toBeLessThan(sink.weightN);
    expect(calculateBuoyancy(1, 0, 1000)).toBeNull();
  });

  it('keeps surface support qualitative and separate from a density-based float result', () => {
    expect(surfaceTensionOutcome('gentle', false).supported).toBe(true);
    expect(surfaceTensionOutcome('push-under', false).supported).toBe(false);
    expect(surfaceTensionOutcome('gentle', true).supported).toBe(false);
    expect(surfaceTensionOutcome('gentle', true).detergentWeakensSupport).toBe(true);
    expect(surfaceTensionOutcome('gentle', false).explanation).toContain('not because its average density is below water');
  });
});

describe('liquid and object density measurements', () => {
  it('requires a positive liquid volume and compares instrument-rounded water and ethanol readings with conditioned references', () => {
    expect(LIQUID_REFERENCE_DENSITIES.water20C.densityKgM3).toBe(998.234);
    expect(LIQUID_REFERENCE_DENSITIES.ethanol20C.densityKgM3).toBe(789.37);
    expect(measureLiquidSample('water20C', 0, 34.2)).toBeNull();
    expect(measureLiquidSample('ethanol20C', 50, 34.2, 0)).toBeNull();
    const water = measureLiquidSample('water20C', 50, 34.2)!;
    const ethanol = measureLiquidSample('ethanol20C', 50, 34.2)!;
    expect(water.grossMassG).toBe(84.1);
    expect(water.netMassG).toBe(49.9);
    expect(water.calculatedKgPerM3).toBeCloseTo(water.calculatedGPerMl * 1000, 8);
    expect(ethanol.netMassG).toBeLessThan(water.netMassG);
    expect(ethanol.conditions).toContain('20 °C');
  });

  it('keeps balance mass tied to the actual fill while a coarse meniscus reading changes calculated density', () => {
    const fine = measureLiquidSample('water20C', 47, 34.2, 1, 47)!;
    const coarse = measureLiquidSample('water20C', 50, 34.2, 1, 47)!;
    expect(fine.volumeMl).toBe(47);
    expect(coarse.volumeMl).toBe(50);
    expect(fine.netMassG).toBe(46.9);
    expect(coarse.netMassG).toBe(46.9);
    expect(fine.grossMassG).toBe(81.1);
    expect(coarse.grossMassG).toBe(81.1);
    expect(fine.calculatedKgPerM3).toBeCloseTo(997.872, 2);
    expect(coarse.calculatedKgPerM3).toBeCloseTo(938, 8);
    expect(measureLiquidSample('water20C', 50, 34.2, 1, 0)).toBeNull();
  });

  it('guards regular volume, displacement and mass/volume calculations, with correct SI conversions', () => {
    expect(regularVolumeCm3(2, 3, 4)).toBe(24);
    expect(regularVolumeCm3(2, 0, 4)).toBeNull();
    expect(displacementVolumeCm3(50, 68)).toBe(18);
    expect(displacementVolumeCm3(50, 50)).toBeNull();
    expect(calculateDensityFromMassAndVolume(49.9, 50)?.kgPerM3).toBeCloseTo(998, 2);
    expect(calculateDensityFromMassAndVolume(1, 0)).toBeNull();
    expect(calculateSolidDensity(21.6, 8)?.gPerCm3).toBeCloseTo(2.7, 8);
    expect(calculateSolidDensity(10, 0)).toBeNull();
    expect(simulatedBalanceReading(21.63, 0.1)).toBe(21.6);
    expect(SOLID_REFERENCE_DENSITIES.brass.conditions).toContain('20 °C');
  });
});

describe('purposeful particle views', () => {
  it('derives ethanol molecule number density from density and molar mass, so the lens shows fewer molecules than water', () => {
    expect(relativeMoleculeNumberDensity('water20C')).toBe(1);
    expect(relativeMoleculeNumberDensity('ethanol20C')).toBeCloseTo((789.37 / 46.07) / (998.234 / 18.015), 6);
    expect(relativeMoleculeNumberDensity('ethanol20C')).toBeGreaterThan(0.28);
    expect(relativeMoleculeNumberDensity('ethanol20C')).toBeLessThan(0.34);
    const water = lensMoleculeLayout('water20C');
    const ethanol = lensMoleculeLayout('ethanol20C');
    expect(water).toHaveLength(14);
    expect(ethanol.length).toBeLessThan(water.length / 2);
    expect(ethanol.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps lens molecules inside the lens and separated by liquid-like (touching, not overlapping) spacing', () => {
    const radii = [0.38, 0.38, 0.19] as const;
    for (const sample of ['water20C', 'ethanol20C'] as const) {
      const points = lensMoleculeLayout(sample, radii);
      let nearest = Infinity;
      points.forEach((a, i) => {
        expect(Math.hypot(a.x / radii[0], a.y / radii[1], a.z / radii[2])).toBeLessThanOrEqual(1.11);
        points.slice(i + 1).forEach((b) => { nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)); });
      });
      expect(nearest).toBeGreaterThan(0.12);
      expect(nearest).toBeLessThan(0.45);
    }
  });

  const vessel: HeatingVessel = { centreX: -0.28, floorY: -0.895, innerRadius: 0.61, rimY: 0.76, waterHeight: 0.43, iceBottom: -0.7, iceHeight: 0.46, iceHalfWidth: 0.42 };

  it('allocates one fixed set of identities to the thermal state: ice, liquid or vapour', () => {
    expect(allocateHeatingPhases({ solid: 1, liquid: 0, gas: 0 })).toEqual(Array(HEATING_PARTICLE_COUNT).fill('solid'));
    expect(allocateHeatingPhases({ solid: 0, liquid: 1, gas: 0 })).toEqual(Array(HEATING_PARTICLE_COUNT).fill('liquid'));
    const mixed = allocateHeatingPhases({ solid: 0.25, liquid: 0.5, gas: 0.25 });
    expect(mixed).toHaveLength(HEATING_PARTICLE_COUNT);
    expect(mixed.filter((phase) => phase === 'solid')).toHaveLength(7);
    expect(mixed.filter((phase) => phase === 'gas')).toHaveLength(7);
  });

  it('places ice molecules on an ordered lattice inside the block, liquid below the water surface, and vapour above it', () => {
    const iceOnly = layoutHeatingParticles({ solid: 1, liquid: 0, gas: 0 }, 3.2, { ...vessel, waterHeight: 0, iceBottom: vessel.floorY, iceHeight: 0.92 }, -20);
    for (const particle of iceOnly) {
      expect(Math.abs(particle.position[0] - vessel.centreX)).toBeLessThanOrEqual(vessel.iceHalfWidth);
      expect(particle.position[1]).toBeGreaterThanOrEqual(vessel.floorY);
      expect(particle.position[1]).toBeLessThanOrEqual(vessel.floorY + 0.92);
    }
    const columns = new Set(iceOnly.map((particle) => Math.round((particle.position[0] - vessel.centreX) / 0.27)));
    expect([...columns].sort()).toEqual([-1, 0, 1]);

    const water = layoutHeatingParticles({ solid: 0, liquid: 1, gas: 0 }, 1.7, { ...vessel, iceHeight: 0, iceBottom: vessel.floorY }, 22);
    const surface = vessel.floorY + vessel.waterHeight;
    for (const particle of water) {
      expect(particle.position[1]).toBeLessThan(surface);
      expect(Math.hypot(particle.position[0] - vessel.centreX, particle.position[2])).toBeLessThan(vessel.innerRadius);
    }
    // spread through the whole volume, not clustered on the base
    const heights = water.map((particle) => particle.position[1]).sort((a, b) => a - b);
    expect(heights[heights.length - 1] - heights[0]).toBeGreaterThan((vessel.waterHeight - 0.2) * 0.8);

    const vapour = layoutHeatingParticles({ solid: 0, liquid: 0, gas: 1 }, 5, { ...vessel, waterHeight: 0.05, iceHeight: 0, iceBottom: vessel.floorY }, 120);
    for (const particle of vapour) expect(particle.position[1]).toBeGreaterThan(vessel.floorY + 0.05);
    const xs = vapour.map((particle) => particle.position[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.6);
  });
});
