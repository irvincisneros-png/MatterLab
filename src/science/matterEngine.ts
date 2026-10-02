export const PARTICLE_COUNT = 18;
export const SAMPLE_MASS_KG = 0.2;
export const CHAMBER = {
  halfWidth: 0.72,
  halfDepth: 0.27,
  bottom: -1.04,
  top: 1.04,
  liquidFillHeight: 0.86,
} as const;

export type Phase = 'solid' | 'liquid' | 'gas';
export type SampleId = Phase;

export type PhaseFractions = Readonly<Record<Phase, number>>;

export type MatterSample = Readonly<{
  id: SampleId;
  energyKJ: number;
  modelTimeSeconds: number;
  seed: number;
}>;

export type ThermalState = Readonly<{
  energyKJ: number;
  temperatureC: number;
  fractions: PhaseFractions;
  dominantPhase: Phase;
  phaseLabel: string;
  isChangingState: boolean;
}>;

export type MoleculePosition = Readonly<{
  id: number;
  phase: Phase;
  position: readonly [number, number, number];
}>;

const MASS = SAMPLE_MASS_KG;
const CP_ICE_KJ_KG_C = 2.1;
const CP_WATER_KJ_KG_C = 4.18;
const CP_VAPOUR_KJ_KG_C = 2.0;
const LATENT_FUSION_KJ_KG = 334;
const LATENT_VAPORISATION_KJ_KG = 2256;

export const ENERGY_MILESTONES_KJ = {
  meltingStart: 0,
  meltingEnd: MASS * LATENT_FUSION_KJ_KG,
  boilingStart: MASS * LATENT_FUSION_KJ_KG + MASS * CP_WATER_KJ_KG_C * 100,
  boilingEnd:
    MASS * LATENT_FUSION_KJ_KG +
    MASS * CP_WATER_KJ_KG_C * 100 +
    MASS * LATENT_VAPORISATION_KJ_KG,
} as const;

export const ENERGY_LIMITS_KJ = {
  minimum: -SAMPLE_MASS_KG * CP_ICE_KJ_KG_C * 273.15,
  maximum: ENERGY_MILESTONES_KJ.boilingEnd + SAMPLE_MASS_KG * CP_VAPOUR_KJ_KG_C * 150,
} as const;

export const INITIAL_SAMPLES: readonly MatterSample[] = [
  { id: 'solid', energyKJ: -8.4, modelTimeSeconds: 0, seed: 1407 },
  {
    id: 'liquid',
    energyKJ: ENERGY_MILESTONES_KJ.meltingEnd + MASS * CP_WATER_KJ_KG_C * 22,
    modelTimeSeconds: 0,
    seed: 1413,
  },
  {
    id: 'gas',
    energyKJ: ENERGY_MILESTONES_KJ.boilingEnd + MASS * CP_VAPOUR_KJ_KG_C * 18,
    modelTimeSeconds: 0,
    seed: 1414,
  },
];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const fraction = (value: number): number => clamp(value, 0, 1);

export function liquidSurfaceIntercept(fillHeight: number, tiltDegrees = 0): number {
  const target = clamp(fillHeight, 0, CHAMBER.top - CHAMBER.bottom);
  if (target === 0) return CHAMBER.bottom;
  if (target >= CHAMBER.top - CHAMBER.bottom) return CHAMBER.top;
  const slope = Math.tan((clamp(tiltDegrees, -35, 35) * Math.PI) / 180);
  const width = CHAMBER.halfWidth * 2;
  const averageDepth = (intercept: number) => {
    const strips = 80;
    let total = 0;
    for (let index = 0; index < strips; index += 1) {
      const x = -CHAMBER.halfWidth + ((index + 0.5) / strips) * width;
      total += clamp(intercept - slope * x - CHAMBER.bottom, 0, CHAMBER.top - CHAMBER.bottom);
    }
    return total / strips;
  };
  let low = CHAMBER.bottom - Math.abs(slope) * CHAMBER.halfWidth;
  let high = CHAMBER.top + Math.abs(slope) * CHAMBER.halfWidth;
  for (let iteration = 0; iteration < 36; iteration += 1) {
    const middle = (low + high) / 2;
    if (averageDepth(middle) < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function liquidSurfaceSegment(fillHeight: number, tiltDegrees = 0): readonly [readonly [number, number], readonly [number, number]] {
  const level = liquidSurfaceIntercept(fillHeight, tiltDegrees);
  const slope = Math.tan((clamp(tiltDegrees, -35, 35) * Math.PI) / 180);
  let xMin: number = -CHAMBER.halfWidth;
  let xMax: number = CHAMBER.halfWidth;
  if (slope > 0) xMax = Math.min(xMax, (level - CHAMBER.bottom) / slope);
  if (slope < 0) xMin = Math.max(xMin, (level - CHAMBER.bottom) / slope);
  if (xMin > xMax) xMin = xMax = clamp((xMin + xMax) / 2, -CHAMBER.halfWidth, CHAMBER.halfWidth);
  return [[xMin, level - slope * xMin], [xMax, level - slope * xMax]];
}

export function thermalStateAtEnergy(energyKJ: number): ThermalState {
  energyKJ = Number.isFinite(energyKJ)
    ? clamp(energyKJ, ENERGY_LIMITS_KJ.minimum, ENERGY_LIMITS_KJ.maximum)
    : ENERGY_LIMITS_KJ.minimum;
  const fusion = ENERGY_MILESTONES_KJ.meltingEnd;
  const boilingStart = ENERGY_MILESTONES_KJ.boilingStart;
  const boilingEnd = ENERGY_MILESTONES_KJ.boilingEnd;

  if (energyKJ <= 0) {
    return {
      energyKJ,
      temperatureC: energyKJ / (MASS * CP_ICE_KJ_KG_C),
      fractions: { solid: 1, liquid: 0, gas: 0 },
      dominantPhase: 'solid',
      phaseLabel: 'Ice',
      isChangingState: false,
    };
  }

  if (energyKJ < fusion) {
    const melted = fraction(energyKJ / fusion);
    return {
      energyKJ,
      temperatureC: 0,
      fractions: { solid: 1 - melted, liquid: melted, gas: 0 },
      dominantPhase: melted >= 0.5 ? 'liquid' : 'solid',
      phaseLabel: 'Ice + liquid water · phase change',
      isChangingState: true,
    };
  }

  if (energyKJ <= boilingStart) {
    return {
      energyKJ,
      temperatureC: (energyKJ - fusion) / (MASS * CP_WATER_KJ_KG_C),
      fractions: { solid: 0, liquid: 1, gas: 0 },
      dominantPhase: 'liquid',
      phaseLabel: 'Liquid water',
      isChangingState: false,
    };
  }

  if (energyKJ < boilingEnd) {
    const vapour = fraction((energyKJ - boilingStart) / (boilingEnd - boilingStart));
    return {
      energyKJ,
      temperatureC: 100,
      fractions: { solid: 0, liquid: 1 - vapour, gas: vapour },
      dominantPhase: vapour >= 0.5 ? 'gas' : 'liquid',
      phaseLabel: 'Liquid water + water vapour · phase change',
      isChangingState: true,
    };
  }

  return {
    energyKJ,
    temperatureC: 100 + (energyKJ - boilingEnd) / (MASS * CP_VAPOUR_KJ_KG_C),
    fractions: { solid: 0, liquid: 0, gas: 1 },
    dominantPhase: 'gas',
    phaseLabel: 'Water vapour',
    isChangingState: false,
  };
}

export function createInitialSamples(): MatterSample[] {
  return INITIAL_SAMPLES.map((sample) => ({ ...sample }));
}

export function addThermalEnergy(sample: MatterSample, deltaKJ: number): MatterSample {
  if (!Number.isFinite(deltaKJ)) return sample;
  return {
    ...sample,
    energyKJ: clamp(sample.energyKJ + deltaKJ, ENERGY_LIMITS_KJ.minimum, ENERGY_LIMITS_KJ.maximum),
  };
}

export function advanceModelTime(sample: MatterSample, fixedStepSeconds = 0.08): MatterSample {
  if (!Number.isFinite(fixedStepSeconds) || fixedStepSeconds <= 0) return sample;
  return { ...sample, modelTimeSeconds: sample.modelTimeSeconds + fixedStepSeconds };
}

export function setModelTime(sample: MatterSample, seconds: number): MatterSample {
  if (!Number.isFinite(seconds) || seconds < 0) return sample;
  return { ...sample, modelTimeSeconds: seconds };
}

function hashedUnit(seed: number, id: number, lane: number): number {
  const raw = Math.sin(seed * 12.9898 + id * 78.233 + lane * 37.719) * 43758.5453;
  return raw - Math.floor(raw);
}

/** Triangle-wave reflection: a molecule bouncing between two walls. */
export function reflected(value: number, min: number, max: number): number {
  const span = max - min;
  const cycle = ((value - min) % (2 * span) + 2 * span) % (2 * span);
  return cycle <= span ? min + cycle : max - (cycle - span);
}

export type IceSite = Readonly<{ x: number; y: number; z: number }>;

/**
 * Ice-like lattice site for molecule `index`: a patch of the open, hexagonal
 * ring pattern that ice forms (seen face-on, every molecule is linked to three
 * neighbours and the links close into six-sided rings). `spacing` is the
 * distance between linked neighbours. Sites fill bottom-up in zigzag chains of
 * six, so a partly melted sample keeps a compact, ordered block. A very small
 * alternating z offset gives the "puckered" look of real ice layers.
 * x and z are centred on 0; y starts at 0 and rises.
 */
export function iceLatticeSite(index: number, spacing: number): IceSite {
  const chain = Math.floor(index / 6);
  const k = index % 6;
  const upper = (k + chain) % 2 === 1;
  return {
    x: (k - 2.5) * 0.866 * spacing,
    y: chain * 1.5 * spacing + (upper ? 0.5 * spacing : 0),
    z: (upper ? 1 : -1) * 0.15 * spacing,
  };
}

/** Height of the lattice (bottom row to top row) for `count` molecules. */
export function iceLatticeHeight(count: number, spacing: number): number {
  let top = 0;
  for (let index = 0; index < count; index += 1) top = Math.max(top, iceLatticeSite(index, spacing).y);
  return top;
}

/** Linked neighbour pairs of the 18-site ice lattice (each molecule has at most three). */
export const ICE_LATTICE_LINKS: readonly (readonly [number, number])[] = (() => {
  const links: [number, number][] = [];
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const chain = Math.floor(index / 6);
    const k = index % 6;
    if (k < 5) links.push([index, index + 1]);
    if ((k + chain) % 2 === 1 && chain < 2) links.push([index, index + 6]);
  }
  return links;
})();

function allocateRenderedPhases(fractions: PhaseFractions, count: number): Phase[] {
  const entries = (['solid', 'liquid', 'gas'] as const).map((phase) => {
    const exact = fractions[phase] * count;
    return { phase, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let assigned = entries.reduce((total, entry) => total + entry.amount, 0);
  for (const entry of [...entries].sort((a, b) => b.remainder - a.remainder)) {
    if (assigned >= count) break;
    entry.amount += 1;
    assigned += 1;
  }
  const phases: Phase[] = [];
  for (const entry of entries) {
    for (let index = 0; index < entry.amount; index += 1) phases.push(entry.phase);
  }
  return phases;
}

/**
 * Slow collective drift of a liquid molecule about its loose site. Neighbouring
 * sites move almost together (the phase depends on the site position), so
 * molecules slide past one another without ever overlapping, and the
 * arrangement keeps changing: close together but never a fixed pattern.
 */
export function liquidDrift(id: number, t: number, siteX: number, siteY: number): readonly [number, number, number] {
  const p1 = t * 2.4 + siteX * 4.1 + siteY * 2.7;
  const p2 = t * 1.8 - siteX * 2.3 + siteY * 3.6;
  return [
    0.06 * Math.sin(p1) + 0.03 * Math.sin(p2 * 1.7 + id * 0.3),
    0.055 * Math.sin(p2) + 0.03 * Math.sin(p1 * 1.3 + 1 + id * 0.2),
    0.05 * Math.sin(t * 1.0 + siteX * 3 + siteY * 5),
  ];
}

export type GasBox = Readonly<{ x: readonly [number, number]; y: readonly [number, number]; z: readonly [number, number] }>;

/**
 * Gas molecule: one of 18 cells (3 x 3 x 2) spreads the molecules through the
 * whole box, then each one moves quickly in a straight line and bounces off the
 * walls. Cells overlap by a third, so molecules are far apart on average.
 */
export function gasPosition(seed: number, id: number, t: number, box: GasBox, speed = 1): readonly [number, number, number] {
  const order = Array.from({ length: PARTICLE_COUNT }, (_, k) => k).sort((a, b) => hashedUnit(seed, a, 11) - hashedUnit(seed, b, 11));
  const cell = order.indexOf(id);
  const u = hashedUnit(seed, id, 0);
  const v = hashedUnit(seed, id, 1);
  const w = hashedUnit(seed, id, 2);
  const axis = (range: readonly [number, number], index: number, cells: number, unit: number, velocity: number): number => {
    const width = (range[1] - range[0]) / cells;
    const lo = Math.max(range[0], range[0] + index * width - width / 3);
    const hi = Math.min(range[1], range[0] + (index + 1) * width + width / 3);
    return reflected(lo + unit * (hi - lo) + t * velocity, lo, hi);
  };
  const vx = (id % 2 === 0 ? 1 : -1) * (1.3 + 0.6 * u) * speed;
  const vy = (id % 3 === 0 ? 1 : -1) * (1.2 + 0.6 * v) * speed;
  const vz = (id % 2 === 0 ? -1 : 1) * (0.6 + 0.4 * w) * speed;
  return [axis(box.x, cell % 3, 3, u, vx), axis(box.y, Math.floor(cell / 3) % 3, 3, v, vy), axis(box.z, Math.floor(cell / 9), 2, w, vz)];
}

/**
 * Push apart any two points closer than `minDistance` (a few symmetric passes)
 * and keep them inside `limits`. Deterministic and continuous in the inputs, so
 * animation stays smooth; it only stops molecules drawn on top of each other.
 */
export function relaxSeparation(points: [number, number, number][], minDistance: number, limits: GasBox, passes = 4): void {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[j][0] - points[i][0];
        const dy = points[j][1] - points[i][1];
        const dz = points[j][2] - points[i][2];
        const distance = Math.hypot(dx, dy, dz);
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) / 2;
        const nx = distance > 1e-6 ? dx / distance : 1;
        const ny = distance > 1e-6 ? dy / distance : 0;
        const nz = distance > 1e-6 ? dz / distance : 0;
        points[i][0] -= nx * push; points[i][1] -= ny * push; points[i][2] -= nz * push;
        points[j][0] += nx * push; points[j][1] += ny * push; points[j][2] += nz * push;
      }
    }
    for (const point of points) {
      point[0] = clamp(point[0], limits.x[0], limits.x[1]);
      point[1] = clamp(point[1], limits.y[0], limits.y[1]);
      point[2] = clamp(point[2], limits.z[0], limits.z[1]);
    }
  }
}

/** Nominal nearest-neighbour spacing of the ice lattice in chamber units. */
export const ICE_SPACING = 0.22;

/**
 * Derives a stable set of water-molecule positions from the thermodynamic state.
 * The same 18 identities survive every phase change; only their arrangement and
 * motion change. Coordinates are local to the chamber before its display tilt.
 *
 *  - solid: regular hexagonal ice-like sites; molecules only vibrate about them.
 *  - liquid: packed about as closely as the solid, but with every molecule
 *    displaced from any pattern and drifting past its neighbours.
 *  - gas: spread through the whole chamber, far apart, moving fast.
 */
export function deriveMoleculePositions(
  sample: MatterSample,
  tiltDegrees = 0,
  count = PARTICLE_COUNT,
): MoleculePosition[] {
  const state = thermalStateAtEnergy(sample.energyKJ);
  const phaseOfParticle = allocateRenderedPhases(state.fractions, count);
  const t = sample.modelTimeSeconds;
  const tilt = (clamp(tiltDegrees, -35, 35) * Math.PI) / 180;
  const liquidHeight = CHAMBER.liquidFillHeight * state.fractions.liquid;
  const solidHeight = CHAMBER.liquidFillHeight * 1.09 * state.fractions.solid;
  const liquidTop = liquidSurfaceIntercept(liquidHeight, tiltDegrees);
  const surfaceSlope = Math.tan(tilt);
  const floatingBase = state.fractions.liquid > 0
    ? Math.max(CHAMBER.bottom, liquidTop - 0.917 * solidHeight)
    : CHAMBER.bottom;
  const solidCount = phaseOfParticle.filter((phase) => phase === 'solid').length;
  // Warmer ice vibrates more (still in place); liquid wanders further than ice vibrates.
  const warmth = clamp((state.temperatureC + 30) / 30, 0, 1);
  const vibration = 0.016 + warmth * 0.016;
  const latticeHeight = iceLatticeHeight(Math.max(1, solidCount), ICE_SPACING);
  const latticeBase = floatingBase + Math.max(0.1, (solidHeight - latticeHeight) / 2);

  // Liquid sites: a looser 4 x 3 x 2 grid, scrambled by identity, with a large random offset.
  const liquidOrder = Array.from({ length: count }, (_, id) => id).sort((a, b) => hashedUnit(sample.seed, a, 9) - hashedUnit(sample.seed, b, 9));
  const liquidSiteOf = (id: number) => liquidOrder.indexOf(id);
  const liquidFloor = CHAMBER.bottom + 0.15;
  const liquidCeiling = Math.max(liquidFloor + 0.05, liquidTop - 0.15);

  const molecules = Array.from({ length: count }, (_, id) => {
    const phase = phaseOfParticle[id] ?? state.dominantPhase;
    const u = hashedUnit(sample.seed, id, 0);
    const v = hashedUnit(sample.seed, id, 1);
    const w = hashedUnit(sample.seed, id, 2);
    let x = 0;
    let y = CHAMBER.bottom + 0.5;
    let z = 0;

    if (phase === 'solid') {
      const site = iceLatticeSite(id, ICE_SPACING);
      const phaseAngle = t * 9 + id * 1.91;
      x = site.x + vibration * Math.sin(phaseAngle);
      y = latticeBase + site.y + vibration * Math.sin(phaseAngle * 1.17 + 1.3);
      z = site.z + vibration * 0.8 * Math.cos(phaseAngle * 0.83);
    } else if (phase === 'liquid') {
      const site = liquidSiteOf(id);
      const column = site % 4;
      const rowIndex = Math.floor(site / 4) % 3;
      const layer = Math.floor(site / 12);
      const siteX = (column - 1.5) * 0.25 + (rowIndex % 2 === 0 ? -0.04 : 0.04);
      const [dx, dy, dz] = liquidDrift(id, t, siteX, rowIndex);
      x = clamp(siteX + dx + (u - 0.5) * 0.08, -0.56, 0.56);
      // Keep the molecule beneath the free surface at its own x (the surface stays level in the world).
      const columnTop = Math.max(liquidFloor + 0.04, liquidTop - surfaceSlope * x - 0.15);
      const rowGap = Math.min(0.23, (columnTop - liquidFloor) / 2);
      y = clamp(liquidFloor + 0.02 + rowGap * rowIndex + dy + (v - 0.5) * 0.06, liquidFloor, Math.min(columnTop, liquidCeiling + Math.abs(surfaceSlope) * 0.6));
      y = clamp(y, liquidFloor, CHAMBER.top - 0.16);
      z = clamp((layer - 0.5) * 0.22 + dz + (w - 0.5) * 0.04, -0.2, 0.2);
    } else {
      // Gas: through the whole chamber above any liquid or ice, far apart on average, moving fast.
      const lower = Math.max(CHAMBER.bottom + 0.16, liquidTop + 0.16, floatingBase + solidHeight + 0.12);
      const upper = CHAMBER.top - 0.16;
      [x, y, z] = gasPosition(sample.seed, id, t, { x: [-0.6, 0.6], y: [lower, Math.max(lower + 0.1, upper)], z: [-0.22, 0.22] });
    }

    return { id, phase, position: [x, y, z] as [number, number, number] };
  });
  const liquidPoints = molecules.filter((m) => m.phase === 'liquid').map((m) => m.position as [number, number, number]);
  relaxSeparation(liquidPoints, 0.18, { x: [-0.45, 0.45], y: [liquidFloor, Math.max(liquidFloor + 0.1, liquidTop - 0.1 + Math.abs(surfaceSlope) * 0.2)], z: [-0.22, 0.22] });
  const gasLower = Math.max(CHAMBER.bottom + 0.16, liquidTop + 0.16, floatingBase + solidHeight + 0.12);
  const gasPoints = molecules.filter((m) => m.phase === 'gas').map((m) => m.position as [number, number, number]);
  relaxSeparation(gasPoints, 0.34, { x: [-0.6, 0.6], y: [gasLower, Math.max(gasLower + 0.1, CHAMBER.top - 0.16)], z: [-0.22, 0.22] });
  return molecules;
}

export function formatTemperature(value: number): string {
  return `${Math.round(value)} °C`;
}

export function classifyPhase(state: ThermalState): Phase | 'melting' | 'boiling' {
  if (state.isChangingState) return state.temperatureC === 0 ? 'melting' : 'boiling';
  return state.dominantPhase;
}
