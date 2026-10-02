import { describe, expect, it } from 'vitest';
import {
  CHAMBER,
  createInitialSamples,
  deriveMoleculePositions,
  ICE_LATTICE_LINKS,
  ICE_SPACING,
  iceLatticeSite,
  ENERGY_LIMITS_KJ,
  ENERGY_MILESTONES_KJ,
  liquidSurfaceIntercept,
  liquidSurfaceSegment,
  PARTICLE_COUNT,
  SAMPLE_MASS_KG,
  thermalStateAtEnergy,
  addThermalEnergy,
  advanceModelTime,
  type MatterSample,
} from '../src/science/matterEngine';

const total = (fractions: { solid: number; liquid: number; gas: number }) =>
  fractions.solid + fractions.liquid + fractions.gas;

describe('water thermal model', () => {
  it('starts the equal-mass comparison at distinct, consistent thermal conditions', () => {
    const [ice, liquid, vapour] = createInitialSamples();
    expect(SAMPLE_MASS_KG).toBe(0.2);
    expect(thermalStateAtEnergy(ice.energyKJ).temperatureC).toBeCloseTo(-20, 8);
    expect(thermalStateAtEnergy(liquid.energyKJ).temperatureC).toBeCloseTo(22, 8);
    expect(thermalStateAtEnergy(vapour.energyKJ).temperatureC).toBeCloseTo(118, 8);
    expect(thermalStateAtEnergy(ice.energyKJ).fractions).toEqual({ solid: 1, liquid: 0, gas: 0 });
    expect(thermalStateAtEnergy(liquid.energyKJ).fractions).toEqual({ solid: 0, liquid: 1, gas: 0 });
    expect(thermalStateAtEnergy(vapour.energyKJ).fractions).toEqual({ solid: 0, liquid: 0, gas: 1 });
  });

  it('holds temperature constant while latent energy changes phase fractions', () => {
    const meltMiddle = thermalStateAtEnergy(ENERGY_MILESTONES_KJ.meltingEnd / 2);
    expect(meltMiddle.temperatureC).toBe(0);
    expect(meltMiddle.fractions.solid).toBeCloseTo(0.5, 8);
    expect(meltMiddle.fractions.liquid).toBeCloseTo(0.5, 8);
    expect(meltMiddle.fractions.gas).toBe(0);
    expect(meltMiddle.isChangingState).toBe(true);
    expect(total(meltMiddle.fractions)).toBeCloseTo(1, 10);

    const boilMiddle = thermalStateAtEnergy(
      (ENERGY_MILESTONES_KJ.boilingStart + ENERGY_MILESTONES_KJ.boilingEnd) / 2,
    );
    expect(boilMiddle.temperatureC).toBe(100);
    expect(boilMiddle.fractions.solid).toBe(0);
    expect(boilMiddle.fractions.liquid).toBeCloseTo(0.5, 8);
    expect(boilMiddle.fractions.gas).toBeCloseTo(0.5, 8);
    expect(boilMiddle.isChangingState).toBe(true);
    expect(total(boilMiddle.fractions)).toBeCloseTo(1, 10);
  });

  it('keeps all phase fractions between zero and one and conserves them across the energy range', () => {
    for (let energy = ENERGY_LIMITS_KJ.minimum; energy <= ENERGY_LIMITS_KJ.maximum; energy += 2.3) {
      const state = thermalStateAtEnergy(energy);
      expect(total(state.fractions)).toBeCloseTo(1, 9);
      for (const fraction of Object.values(state.fractions)) {
        expect(fraction).toBeGreaterThanOrEqual(0);
        expect(fraction).toBeLessThanOrEqual(1);
      }
      expect(state.temperatureC).toBeGreaterThanOrEqual(-273.15);
      expect(Number.isFinite(state.temperatureC)).toBe(true);
    }
  });

  it('bounds heat input at absolute zero and the labelled maximum model temperature', () => {
    const [ice, , vapour] = createInitialSamples();
    const overcooled = addThermalEnergy(ice, -1_000_000);
    const overheated = addThermalEnergy(vapour, 1_000_000);
    expect(thermalStateAtEnergy(overcooled.energyKJ).temperatureC).toBeCloseTo(-273.15, 8);
    expect(thermalStateAtEnergy(overheated.energyKJ).temperatureC).toBeCloseTo(250, 8);
    expect(addThermalEnergy(ice, Number.NaN)).toBe(ice);
  });

  it('separates playback time from heat and keeps manual time steps deterministic', () => {
    const original = createInitialSamples()[0];
    const slowPlaybackStep = advanceModelTime(original, 1 / 60);
    const classroomStep = advanceModelTime(original, 0.08);
    expect(slowPlaybackStep.modelTimeSeconds).toBeCloseTo(1 / 60, 10);
    expect(classroomStep.modelTimeSeconds).toBeCloseTo(0.08, 10);
    expect(slowPlaybackStep.energyKJ).toBe(original.energyKJ);
    expect(classroomStep.energyKJ).toBe(original.energyKJ);
    expect(addThermalEnergy(slowPlaybackStep, 20).modelTimeSeconds).toBe(slowPlaybackStep.modelTimeSeconds);
  });
});

describe('water molecule identities, arrangements and chamber limits', () => {
  const energyStates = [
    -40,
    -8.4,
    0,
    1,
    ENERGY_MILESTONES_KJ.meltingEnd / 2,
    ENERGY_MILESTONES_KJ.meltingEnd - 0.01,
    ENERGY_MILESTONES_KJ.meltingEnd + 10,
    ENERGY_MILESTONES_KJ.boilingStart,
    ENERGY_MILESTONES_KJ.boilingStart + 0.01,
    (ENERGY_MILESTONES_KJ.boilingStart + ENERGY_MILESTONES_KJ.boilingEnd) / 2,
    ENERGY_MILESTONES_KJ.boilingEnd - 0.01,
    ENERGY_MILESTONES_KJ.boilingEnd,
    ENERGY_LIMITS_KJ.maximum,
  ];

  it('keeps the same 18 indexed H₂O models through solid, liquid, gas and mixed phases', () => {
    const ids = Array.from({ length: PARTICLE_COUNT }, (_, index) => index);
    for (const energyKJ of energyStates) {
      for (const tilt of [-35, 0, 35]) {
        const sample: MatterSample = { ...createInitialSamples()[0], energyKJ, modelTimeSeconds: 8.4 };
        const molecules = deriveMoleculePositions(sample, tilt);
        expect(molecules).toHaveLength(PARTICLE_COUNT);
        expect(molecules.map((molecule) => molecule.id)).toEqual(ids);
        expect(new Set(molecules.map((molecule) => molecule.id)).size).toBe(PARTICLE_COUNT);
        expect(Object.values(molecules.reduce((counts, molecule) => {
          counts[molecule.phase] = (counts[molecule.phase] ?? 0) + 1;
          return counts;
        }, {} as Record<string, number>)).reduce((a, b) => a + b, 0)).toBe(PARTICLE_COUNT);
      }
    }
  });

  it('keeps every molecule centre inside the chamber over tilt, phase and long model time', () => {
    const tilts = [-35, -20, 0, 20, 35];
    const times = [0, 1 / 60, 0.08, 1, 10, 40];
    for (const energyKJ of energyStates) {
      for (const tilt of tilts) {
        for (const modelTimeSeconds of times) {
          const sample: MatterSample = { id: 'liquid', seed: 1413, energyKJ, modelTimeSeconds };
          const positions = deriveMoleculePositions(sample, tilt);
          expect(positions).toHaveLength(PARTICLE_COUNT);
          for (const molecule of positions) {
            const [x, y, z] = molecule.position;
            expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
            expect(x).toBeGreaterThanOrEqual(-CHAMBER.halfWidth);
            expect(x).toBeLessThanOrEqual(CHAMBER.halfWidth);
            expect(y).toBeGreaterThanOrEqual(CHAMBER.bottom);
            expect(y).toBeLessThanOrEqual(CHAMBER.top);
            expect(z).toBeGreaterThanOrEqual(-CHAMBER.halfDepth);
            expect(z).toBeLessThanOrEqual(CHAMBER.halfDepth);
          }
        }
      }
    }
  });

  it('keeps a tilted liquid free surface horizontal in world coordinates and conserves clipped fill depth', () => {
    for (const fillHeight of [0.04, 0.12, 0.4, 0.86, 1.2]) {
      for (const tilt of [-35, -20, 0, 20, 35]) {
        const [[x1, y1], [x2, y2]] = liquidSurfaceSegment(fillHeight, tilt);
        const angle = (tilt * Math.PI) / 180;
        const worldY1 = x1 * Math.sin(angle) + y1 * Math.cos(angle);
        const worldY2 = x2 * Math.sin(angle) + y2 * Math.cos(angle);
        expect(worldY1).toBeCloseTo(worldY2, 8);
        expect(y1).toBeGreaterThanOrEqual(CHAMBER.bottom - 1e-8);
        expect(y2).toBeGreaterThanOrEqual(CHAMBER.bottom - 1e-8);
        const intercept = liquidSurfaceIntercept(fillHeight, tilt);
        const samples = 200;
        let areaHeight = 0;
        for (let index = 0; index < samples; index += 1) {
          const x = -CHAMBER.halfWidth + ((index + 0.5) / samples) * CHAMBER.halfWidth * 2;
          const localFill = Math.max(0, Math.min(CHAMBER.top - CHAMBER.bottom, intercept - Math.tan(angle) * x - CHAMBER.bottom));
          areaHeight += localFill / samples;
        }
        expect(areaHeight).toBeCloseTo(fillHeight, 2);
      }
    }
  });
});

describe('phase arrangements read correctly', () => {
  const [ice, water, vapour] = createInitialSamples();
  const nearest = (molecules: ReturnType<typeof deriveMoleculePositions>) => molecules.map((a) => Math.min(...molecules.filter((b) => b.id !== a.id).map((b) => Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]))));
  const travel = (sample: MatterSample, from: number, to: number) => {
    const a = deriveMoleculePositions({ ...sample, modelTimeSeconds: from });
    const b = deriveMoleculePositions({ ...sample, modelTimeSeconds: to });
    return a.reduce((sum, m, i) => sum + Math.hypot(m.position[0] - b[i].position[0], m.position[1] - b[i].position[1], m.position[2] - b[i].position[2]), 0) / a.length;
  };

  it('puts ice on a regular hexagonal lattice and only vibrates molecules about their sites', () => {
    expect(ICE_LATTICE_LINKS).toHaveLength(21);
    const links = new Map<number, number>();
    for (const [a, b] of ICE_LATTICE_LINKS) {
      links.set(a, (links.get(a) ?? 0) + 1);
      links.set(b, (links.get(b) ?? 0) + 1);
      const sa = iceLatticeSite(a, ICE_SPACING), sb = iceLatticeSite(b, ICE_SPACING);
      expect(Math.hypot(sa.x - sb.x, sa.y - sb.y, sa.z - sb.z) / ICE_SPACING).toBeGreaterThan(0.99);
      expect(Math.hypot(sa.x - sb.x, sa.y - sb.y, sa.z - sb.z) / ICE_SPACING).toBeLessThan(1.06);
    }
    expect(Math.max(...links.values())).toBeLessThanOrEqual(3);
    for (const time of [0, 0.7, 3.3, 19]) {
      const molecules = deriveMoleculePositions({ ...ice, modelTimeSeconds: time });
      const origin = deriveMoleculePositions({ ...ice, modelTimeSeconds: 0 });
      molecules.forEach((m, i) => {
        expect(Math.hypot(m.position[0] - origin[i].position[0], m.position[1] - origin[i].position[1], m.position[2] - origin[i].position[2])).toBeLessThan(0.1);
      });
      // Neighbouring oxygen spheres (radius 0.078) nearly touch but never overlap.
      expect(Math.min(...nearest(molecules))).toBeGreaterThan(0.17);
    }
  });

  it('keeps liquid close together but moving, and gas spread out and much faster', () => {
    const meanNearest = (sample: MatterSample) => {
      let total = 0, samples = 0;
      for (let t = 0; t < 10; t += 0.5) { const n = nearest(deriveMoleculePositions({ ...sample, modelTimeSeconds: t })); total += n.reduce((a, b) => a + b, 0) / n.length; samples += 1; }
      return total / samples;
    };
    expect(meanNearest(water)).toBeLessThan(0.3);
    expect(meanNearest(water)).toBeGreaterThan(0.17);
    // Gas molecules are visibly much farther apart than in the condensed states.
    expect(meanNearest(vapour)).toBeGreaterThan(meanNearest(ice) * 1.5);
    expect(meanNearest(vapour)).toBeGreaterThan(meanNearest(water) * 1.5);
    for (let t = 0; t < 10; t += 0.5) expect(Math.min(...nearest(deriveMoleculePositions({ ...water, modelTimeSeconds: t })))).toBeGreaterThan(0.15);
    const liquidSpeed = travel(water, 1, 1.2), gasSpeed = travel(vapour, 1, 1.2);
    expect(gasSpeed).toBeGreaterThan(liquidSpeed * 5);
    // Liquid is not a lattice: it does not sit on the same sites over time.
    expect(travel(water, 0, 2.5)).toBeGreaterThan(0.05);
    // Gas fills the chamber height; ice stays compact at the bottom.
    const gasY = deriveMoleculePositions({ ...vapour, modelTimeSeconds: 3 }).map((m) => m.position[1]);
    const iceY = deriveMoleculePositions({ ...ice, modelTimeSeconds: 3 }).map((m) => m.position[1]);
    expect(Math.max(...gasY) - Math.min(...gasY)).toBeGreaterThan(Math.max(...iceY) - Math.min(...iceY));
  });
});
