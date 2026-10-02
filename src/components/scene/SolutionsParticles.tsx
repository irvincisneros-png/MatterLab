import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SUCROSE_ATOMS, SUCROSE_BONDS } from '../../science/sucroseStructure';
import { ATOM_COLOURS } from './LabPrimitives';
import { massLedgerAt, solubilityCapacityG, SOLUTES, type SoluteId, type SolutionsState } from '../../science/solutionsEngine';

/*
 * Schematic particle scene for the Solutions laboratory.
 *
 * - Undissolved NaCl / KCl are rock-salt lattices (alternating cation / anion on a cubic grid)
 *   resting on the beaker floor. Their size and number follow the undissolved mass; the outer
 *   corner sites erode first.
 * - Undissolved sucrose is a small molecular crystal of whole, bonded molecules.
 * - Sand is a heap of grains that never disperses.
 * - While dissolving, ions leave crystal corners with a short-lived hydration shell of water
 *   (O towards a cation, H towards an anion) before dispersing.
 * Everything is drawn with instanced meshes so marker counts stay cheap.
 */

export type Vec3 = readonly [number, number, number];
export type Quat4 = readonly [number, number, number, number];
export type Item = { p: Vec3; s: number; q?: Quat4 };
export type CationKind = 'sodium' | 'potassium';
export type ParticleModel = { cations: Item[]; anions: Item[]; sucrose: Item[]; sand: Item[]; waters: Item[]; bonds: Item[]; halos: Item[] };

export const FLOOR_Y = -0.918;
const TAU = Math.PI * 2;
export const CATION_RADIUS: Record<CationKind, number> = { sodium: 0.03, potassium: 0.04 };
export const ANION_RADIUS = 0.043;
const ION_SPACING = 0.125;
const SUCROSE_SPACING = 0.22;
const SUCROSE_SCALE = 0.72;
const SAND_COLOUR = '#8d9eb2';
const WATER_SCALE = 0.36;
const SHELL_WATER_SCALE = 0.55;
const MAX_DISSOLVED_MARKERS = 24;
const BULK_WATER_COUNT = 40;

const frac = (value: number) => value - Math.floor(value);
const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const SEED = (id: number, lane: number) => frac(Math.sin((id + 1) * 78.233 + lane * 32.53) * 43758.5453);

const emptyModel = (): ParticleModel => ({ cations: [], anions: [], sucrose: [], sand: [], waters: [], bonds: [], halos: [] });

/* ---------- lattice sites ---------- */

type Site = { i: number; j: number; k: number; cation: boolean };
const siteCache = new Map<number, Site[]>();
/** Sites of an edge^3 cubic lattice, innermost / lowest first, so the outer top corners are the last to be kept. */
function orderedSites(edge: number): Site[] {
  const hit = siteCache.get(edge);
  if (hit) return hit;
  const centre = (edge - 1) / 2;
  const lowCentre = 0.3 * (edge - 1);
  const list: { site: Site; key: number }[] = [];
  for (let k = 0; k < edge; k += 1) for (let j = 0; j < edge; j += 1) for (let i = 0; i < edge; i += 1) {
    const key = (i - centre) ** 2 + (j - centre) ** 2 + 1.5 * (k - lowCentre) ** 2 + SEED(i * 19 + j * 7 + k, 40) * 0.05;
    list.push({ site: { i, j, k, cation: (i + j + k) % 2 === 0 }, key });
  }
  const sites = list.sort((a, b) => a.key - b.key).map((entry) => entry.site);
  siteCache.set(edge, sites);
  return sites;
}

type Crystal = {
  cx: number; cz: number; yaw: number; edge: number; share: number; spacing: number;
  scale: number; baseY: number; ionic: boolean; order: Site[];
};

function siteWorld(crystal: Crystal, site: Site): Vec3 {
  const half = (crystal.edge - 1) / 2;
  const lx = (site.i - half) * crystal.spacing;
  const lz = (site.j - half) * crystal.spacing;
  const cos = Math.cos(crystal.yaw);
  const sin = Math.sin(crystal.yaw);
  return [crystal.cx + lx * cos - lz * sin, crystal.baseY + site.k * crystal.spacing, crystal.cz + lx * sin + lz * cos];
}

const randomQuat = (a: number, b: number, c: number): Quat4 => {
  const u1 = SEED(a, 51), u2 = SEED(b, 52), u3 = SEED(c, 53);
  const r1 = Math.sqrt(1 - u1), r2 = Math.sqrt(u1);
  return [r1 * Math.sin(TAU * u2), r1 * Math.cos(TAU * u2), r2 * Math.sin(TAU * u3), r2 * Math.cos(TAU * u3)];
};

function placeCrystal(model: ParticleModel, crystal: Crystal, cationKind: CationKind, hidden: number, crystalIndex: number, radiusScale = 1) {
  const sites = crystal.order.slice(0, Math.max(0, crystal.share - hidden));
  if (crystal.ionic) {
    // Thin lattice bonds between neighbouring kept sites make the cubic rock-salt arrangement readable.
    const present = new Set(sites.map((site) => `${site.i},${site.j},${site.k}`));
    const yaw = new THREE.Quaternion().setFromAxisAngle(tmpUp, crystal.yaw);
    const axes = [new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2), new THREE.Quaternion(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)]
      .map((axis) => { const q = yaw.clone().multiply(axis); return [q.x, q.y, q.z, q.w] as Quat4; });
    for (const site of sites) {
      const a = siteWorld(crystal, site);
      ([[1, 0, 0], [0, 0, 1], [0, 1, 0]] as const).forEach((step, axisIndex) => {
        if (!present.has(`${site.i + step[0]},${site.j + step[1]},${site.k + step[2]}`)) return;
        const b = siteWorld(crystal, { ...site, i: site.i + step[0], j: site.j + step[1], k: site.k + step[2] });
        model.bonds.push({ p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: crystal.spacing / ION_SPACING, q: axes[axisIndex === 0 ? 0 : axisIndex === 1 ? 2 : 1] });
      });
    }
  }
  for (const site of sites) {
    const p = siteWorld(crystal, site);
    if (crystal.ionic) {
      if (site.cation) model.cations.push({ p, s: CATION_RADIUS[cationKind] * radiusScale });
      else model.anions.push({ p, s: ANION_RADIUS * radiusScale });
    } else {
      model.sucrose.push({ p, s: crystal.scale, q: randomQuat(crystalIndex * 31 + site.i * 5 + site.j * 3, site.k + site.i * 7 + crystalIndex, site.j * 11 + site.k * 13 + crystalIndex) });
    }
  }
}

/* ---------- planning the undissolved solid ---------- */

type Detacher = { index: number; crystal: number; site: Site; start: Vec3; };
type Blocker = { cx: number; cz: number; half: number; top: number };
export type SolidPlan = {
  kind: 'none' | 'ionic' | 'molecular' | 'sand';
  key: string;
  cationKind: CationKind;
  crystals: Crystal[];
  hidden: number[];
  detachers: Detacher[];
  blockers: Blocker[];
  sand: { count: number; pitch: number; grain: number; radius: number } | null;
  topY: number;
  dissolving: boolean;
};

const HEX_DIRECTIONS = (spacing: number, ringLimit: number): [number, number][] => {
  const slots: [number, number][] = [];
  for (let q = -ringLimit; q <= ringLimit; q += 1) for (let r = -ringLimit; r <= ringLimit; r += 1) {
    if (Math.abs(q + r) > ringLimit) continue;
    slots.push([spacing * (q + r / 2), spacing * (r * Math.sqrt(3) / 2)]);
  }
  return slots.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
};
const HEX_ION = HEX_DIRECTIONS(0.3, 2);
const HEX_SUCROSE = HEX_DIRECTIONS(0.34, 1);
const COARSE_RING_RADIUS = [0, 0, 0.3, 0.34, 0.36];

function crystalCentre(fine: boolean, ionic: boolean, index: number, count: number): [number, number] {
  if (fine) {
    const slots = ionic ? HEX_ION : HEX_SUCROSE;
    return slots[index] ?? [0, 0];
  }
  if (count === 1) return [-0.04, 0.04];
  const radius = COARSE_RING_RADIUS[Math.min(4, count)];
  const angle = 0.55 + index * TAU / count;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export function planSolid(state: SolutionsState, particleView: boolean): SolidPlan {
  const definition = SOLUTES[state.soluteId];
  const ledger = massLedgerAt(state);
  const undissolved = ledger.undissolvedG;
  const cationKind: CationKind = state.soluteId === 'potassium-chloride' ? 'potassium' : 'sodium';
  const capacity = solubilityCapacityG(state.soluteId, state.temperatureC);
  const dissolving = !state.metastable && undissolved > 0.02 && ledger.dissolvedG < Math.min(ledger.addedG, capacity) - 0.02 && definition.kind !== 'insoluble';
  const none: SolidPlan = { kind: 'none', key: 'none', cationKind, crystals: [], hidden: [], detachers: [], blockers: [], sand: null, topY: FLOOR_Y, dissolving };
  if (undissolved < 0.02) return none;
  const fine = state.particleSize === 'fine';

  if (definition.kind === 'insoluble') {
    const count = fine ? Math.min(320, Math.ceil(undissolved * 5)) : Math.min(150, Math.ceil(undissolved * 1.6));
    const grain = fine ? 0.026 : 0.047;
    const pitch = Math.min(fine ? 0.04 : 0.075, 0.6 / Math.sqrt(count));
    const radius = pitch * Math.sqrt(count);
    const topY = FLOOR_Y + grain + 0.5 * radius;
    return { ...none, kind: 'sand', key: `sand|${fine}|${count}`, sand: { count, pitch, grain, radius }, topY, blockers: [{ cx: 0, cz: 0, half: radius + grain, top: topY }] };
  }

  const ionic = definition.kind === 'ionic';
  const spec = ionic
    ? fine
      ? { spacing: ION_SPACING, scale: 1, maxEdge: 2, maxCount: 14, perCap: 8, count: Math.max(3, Math.ceil(undissolved / 1.5)), total: Math.ceil(undissolved * 8) }
      : { spacing: ION_SPACING, scale: 1, maxEdge: 5, maxCount: 3, perCap: 125, count: Math.ceil(undissolved / 9), total: Math.ceil(undissolved * 8) }
    : fine
      ? { spacing: SUCROSE_SPACING, scale: SUCROSE_SCALE, maxEdge: 2, maxCount: 7, perCap: 3, count: Math.max(3, Math.ceil(undissolved / 4)), total: Math.ceil(undissolved / 2) }
      : { spacing: SUCROSE_SPACING, scale: SUCROSE_SCALE, maxEdge: 2, maxCount: 3, perCap: 8, count: Math.ceil(undissolved / 10), total: Math.ceil(undissolved / 3) };
  let count = Math.min(spec.maxCount, Math.max(1, spec.count));
  const total = Math.min(Math.max(1, spec.total), count * spec.perCap);
  count = Math.min(count, total);

  const crystals: Crystal[] = [];
  for (let index = 0; index < count; index += 1) {
    const share = Math.floor(total / count) + (index < total % count ? 1 : 0);
    if (share <= 0) continue;
    const edge = Math.min(spec.maxEdge, Math.max(1, Math.ceil(Math.cbrt(share - 1e-9))));
    const [cx, cz] = crystalCentre(fine, ionic, index, count);
    crystals.push({
      cx, cz, yaw: (SEED(index, 60) - 0.5) * (fine ? 2.4 : 0.5), edge, share, spacing: spec.spacing, scale: spec.scale,
      baseY: FLOOR_Y + (ionic ? ANION_RADIUS : spec.spacing * 0.46), ionic, order: orderedSites(edge),
    });
  }

  // Detaching ions / molecules: only while dissolving and only when the particle view is on.
  const hidden = crystals.map(() => 0);
  const detachers: Detacher[] = [];
  if (dissolving && particleView) {
    const wanted = ionic ? (fine ? 6 : 4) : 3;
    for (let index = 0; index < wanted; index += 1) {
      const c = index % crystals.length;
      const crystal = crystals[c];
      if (crystal.share - hidden[c] < 4) continue;
      const site = crystal.order[crystal.share - 1 - hidden[c]];
      hidden[c] += 1;
      detachers.push({ index, crystal: c, site, start: siteWorld(crystal, site) });
    }
  }

  let topY = FLOOR_Y;
  const blockers: Blocker[] = crystals.map((crystal) => {
    let maxK = 0;
    for (const site of crystal.order.slice(0, crystal.share)) maxK = Math.max(maxK, site.k);
    const top = crystal.baseY + maxK * crystal.spacing + (ionic ? ANION_RADIUS : spec.spacing * 0.5);
    topY = Math.max(topY, top);
    return { cx: crystal.cx, cz: crystal.cz, half: (crystal.edge - 1) * crystal.spacing * 0.5 * 1.42 + (ionic ? 0.08 : 0.14), top };
  });
  return {
    kind: ionic ? 'ionic' : 'molecular', key: `${state.soluteId}|${fine}|${total}|${count}|${hidden.join(',')}`,
    cationKind, crystals, hidden, detachers, blockers, sand: null, topY, dissolving,
  };
}

/** Static undissolved solid: rebuilt only when the plan key changes. */
export function buildSolidModel(plan: SolidPlan): ParticleModel {
  const model = emptyModel();
  if (plan.kind === 'ionic' || plan.kind === 'molecular') {
    plan.crystals.forEach((crystal, index) => placeCrystal(model, crystal, plan.cationKind, plan.hidden[index] ?? 0, index));
  } else if (plan.kind === 'sand' && plan.sand) {
    pushSandHeap(model.sand, plan.sand.count, plan.sand.pitch, plan.sand.grain, FLOOR_Y, plan.sand.radius, [0, 0]);
  }
  return model;
}

function pushSandHeap(into: Item[], count: number, pitch: number, grain: number, floorY: number, radius: number, centre: [number, number], height = 0.5) {
  for (let index = 0; index < count; index += 1) {
    const r = pitch * Math.sqrt(index + 0.5);
    const a = index * 2.399963;
    const x = centre[0] + Math.cos(a) * r + (SEED(index, 61) - 0.5) * pitch * 0.5;
    const z = centre[1] + Math.sin(a) * r + (SEED(index, 62) - 0.5) * pitch * 0.5;
    const y = floorY + grain + Math.max(0, radius - r) * height + SEED(index, 63) * grain * 0.3;
    into.push({ p: [x, y, z], s: grain * (0.8 + SEED(index, 64) * 0.4), q: randomQuat(index, index + 3, index + 7) });
  }
}

/* ---------- dynamic (moving) particles ---------- */

const blocked = (plan: SolidPlan, x: number, y: number, z: number, margin: number) => plan.blockers.some((b) => y < b.top + margin && Math.hypot(x - b.cx, z - b.cz) < b.half + margin);

/** Low-discrepancy slot through the liquid column, skipping the space occupied by solid. */
function bulkPoint(plan: SolidPlan, id: number, lane: number, rMax: number, yMin: number, yMax: number, margin: number): Vec3 {
  let last: Vec3 = [0, yMax, 0];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shift = lane * 0.31 + attempt * 0.137;
    const r = rMax * Math.sqrt(frac(0.5 + id * 0.7548776662 + shift));
    const angle = TAU * frac(id * 0.6180339887 + shift * 1.7);
    const y = yMin + (yMax - yMin) * frac(0.5 + id * 0.5698402909 + shift * 0.9);
    last = [Math.cos(angle) * r, y, Math.sin(angle) * r];
    if (!blocked(plan, last[0], last[1], last[2], margin)) return last;
  }
  return [last[0], Math.min(yMax, Math.max(last[1], plan.topY + margin)), last[2]];
}

const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpUp = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();
function quatFromEuler(x: number, y: number, z: number): Quat4 {
  tmpQuat.setFromEuler(tmpEuler.set(x, y, z));
  return [tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w];
}
/** Water with its H-side (local +y) pointing along (dx, dy, dz). */
function quatPointing(dx: number, dy: number, dz: number): Quat4 {
  tmpQuat.setFromUnitVectors(tmpUp, tmpDir.set(dx, dy, dz).normalize());
  return [tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w];
}

function wobble(id: number, time: number, stirring: boolean): Vec3 {
  const amp = stirring ? 0.05 : 0.011;
  const rate = stirring ? 1.7 : 0.6;
  return [Math.sin(time * rate + id * 1.7) * amp, Math.sin(time * rate * 0.8 + id * 2.3) * amp * 0.8, Math.cos(time * rate * 0.9 + id * 1.1) * amp];
}
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function buildDynamicModel(state: SolutionsState, plan: SolidPlan, particleView: boolean): ParticleModel {
  const model = emptyModel();
  if (!particleView) return model;
  const definition = SOLUTES[state.soluteId];
  const ledger = massLedgerAt(state);
  const time = state.modelTimeSeconds;
  const stirring = state.stirring;
  const dissolvedUnits = Math.min(MAX_DISSOLVED_MARKERS, Math.ceil(ledger.dissolvedG / 2.5));

  // Water: spread through the whole liquid, up to the meniscus, and kept out of the solid.
  for (let id = 0; id < BULK_WATER_COUNT; id += 1) {
    const base = bulkPoint(plan, id, 0, 0.68, -0.86, -0.27, 0.17);
    const p = add(base, wobble(id + 100, time, stirring));
    const spin = stirring ? time * 0.9 : time * 0.15;
    model.waters.push({ p, s: WATER_SCALE, q: quatFromEuler(SEED(id, 70) * TAU + spin, SEED(id, 71) * TAU, SEED(id, 72) * TAU + spin * 0.6) });
  }

  if (definition.kind === 'ionic') {
    for (let id = 0; id < dissolvedUnits; id += 1) {
      model.cations.push({ p: add(bulkPoint(plan, id, 1, 0.66, -0.86, -0.27, 0.1), wobble(id, time, stirring)), s: CATION_RADIUS[plan.cationKind] });
      model.anions.push({ p: add(bulkPoint(plan, id, 2, 0.66, -0.86, -0.27, 0.1), wobble(id + 40, time, stirring)), s: ANION_RADIUS });
    }
  } else if (definition.kind === 'molecular') {
    const spin = stirring ? 0.9 : 0.12;
    for (let id = 0; id < dissolvedUnits; id += 1) {
      model.sucrose.push({
        p: add(bulkPoint(plan, id, 3, 0.58, -0.76, -0.38, 0.14), wobble(id, time, stirring)), s: SUCROSE_SCALE,
        q: quatFromEuler(SEED(id, 80) * TAU + time * spin, SEED(id, 81) * TAU + time * spin * 0.7, SEED(id, 82) * TAU),
      });
    }
  }

  // Ions (or whole molecules) leaving the crystal, with a short hydration shell for ions.
  if (plan.detachers.length > 0) {
    const period = stirring ? 2.6 : 3.8;
    const total = plan.detachers.length;
    plan.detachers.forEach((detacher, order) => {
      const phase = time / period + order / total;
      const cycle = Math.floor(phase);
      const u = phase - cycle;
      const crystal = plan.crystals[detacher.crystal];
      const ionic = crystal.ionic;
      const destination = ionic
        ? bulkPoint(plan, cycle * 13 + detacher.index * 5 + 300, 4, 0.62, -0.8, -0.32, 0.12)
        : bulkPoint(plan, cycle * 13 + detacher.index * 5 + 300, 5, 0.5, -0.74, -0.4, 0.16);
      const e = smooth(u);
      const start = detacher.start;
      const p: Vec3 = [start[0] + (destination[0] - start[0]) * e, start[1] + (destination[1] - start[1]) * e + Math.sin(Math.PI * u) * 0.04, start[2] + (destination[2] - start[2]) * e];
      const grow = u < 0.08 ? 0.75 + 0.25 * (u / 0.08) : 1;
      const fade = Math.min(1, Math.max(0, (1 - u) / 0.14));
      const factor = grow * fade;
      if (factor <= 0.01) return;
      if (!ionic) {
        model.sucrose.push({ p, s: SUCROSE_SCALE * factor, q: randomQuat(detacher.index + cycle, cycle + 5, detacher.index + 9) });
        return;
      }
      const cation = detacher.site.cation;
      const radius = cation ? CATION_RADIUS[plan.cationKind] : ANION_RADIUS;
      (cation ? model.cations : model.anions).push({ p, s: radius * factor });
      const shell = Math.min(smooth((u - 0.05) / 0.1), smooth((0.86 - u) / 0.14));
      if (shell <= 0.02) return;
      // Outward direction of this corner from the crystal centre; shell waters sit above and around it.
      const ox = start[0] - crystal.cx, oz = start[2] - crystal.cz;
      const olen = Math.hypot(ox, oz) || 1;
      const outward: Vec3 = [ox / olen, 0, oz / olen];
      const side: Vec3 = [-outward[2], 0, outward[0]];
      const spin = time * 0.7 + detacher.index;
      const directions: Vec3[] = [
        [outward[0] * 0.5, 1, outward[2] * 0.5],
        [outward[0] + side[0] * 0.9, 0.15, outward[2] + side[2] * 0.9],
        [outward[0] - side[0] * 0.9, -0.25, outward[2] - side[2] * 0.9],
        [-outward[0] * 0.8, -0.55, -outward[2] * 0.8],
      ];
      const distance = cation ? radius + 0.085 : radius + 0.1;
      model.halos.push({ p, s: (distance + 0.11) * shell });
      directions.forEach((direction, k) => {
        const length = Math.hypot(...direction);
        const rotated: Vec3 = [
          (direction[0] * Math.cos(spin * 0.4) - direction[2] * Math.sin(spin * 0.4)) / length,
          direction[1] / length,
          (direction[0] * Math.sin(spin * 0.4) + direction[2] * Math.cos(spin * 0.4)) / length,
        ];
        const position: Vec3 = [p[0] + rotated[0] * distance, p[1] + rotated[1] * distance, p[2] + rotated[2] * distance];
        // The water's H side is local +y: O faces a cation, H faces an anion.
        const axis = cation ? rotated : [-rotated[0], -rotated[1], -rotated[2]] as const;
        model.waters.push({ p: position, s: SHELL_WATER_SCALE * shell * (k === 2 ? 0.96 : 1), q: quatPointing(axis[0], axis[1], axis[2]) });
      });
    });
  }
  return model;
}

/* ---------- weighing dish heap ---------- */

export function buildDishModel(soluteId: SoluteId): { model: ParticleModel; cationKind: CationKind } {
  const model = emptyModel();
  const definition = SOLUTES[soluteId];
  const surface = 0.0225;
  const cationKind: CationKind = soluteId === 'potassium-chloride' ? 'potassium' : 'sodium';
  if (definition.kind === 'ionic') {
    const scale = 0.4;
    const spacing = ION_SPACING * scale;
    const plans: { cx: number; cz: number; yaw: number; edge: number; share: number }[] = [
      { cx: -0.07, cz: 0.04, yaw: 0.35, edge: 3, share: 15 },
      { cx: 0.09, cz: -0.05, yaw: -0.5, edge: 2, share: 8 },
      { cx: 0.03, cz: 0.12, yaw: 0.9, edge: 2, share: 5 },
      { cx: -0.1, cz: -0.11, yaw: 0.2, edge: 2, share: 4 },
    ];
    plans.forEach((entry, index) => placeCrystal(model, {
      ...entry, spacing, scale: 1, baseY: surface + ANION_RADIUS * scale, ionic: true, order: orderedSites(entry.edge),
    }, cationKind, 0, index, scale));
  } else if (definition.kind === 'molecular') {
    const scale = 0.34;
    const crystal: Crystal = { cx: 0, cz: 0, yaw: 0.3, edge: 3, share: 9, spacing: SUCROSE_SPACING * scale * 1.18, scale, baseY: surface + 0.05, ionic: false, order: orderedSites(3) };
    placeCrystal(model, crystal, cationKind, 0, 5);
    placeCrystal(model, { ...crystal, cx: 0.1, cz: -0.1, edge: 2, share: 3, yaw: 1 }, cationKind, 0, 9);
  } else {
    pushSandHeap(model.sand, 34, 0.027, 0.017, surface - 0.003, 0.14, [0, 0.01], 0.4);
  }
  return { model, cationKind };
}

/* ---------- instanced rendering ---------- */

type Geometries = { carbon: THREE.BufferGeometry; oxygen: THREE.BufferGeometry; hydrogen: THREE.BufferGeometry; bonds: THREE.BufferGeometry; sphere: THREE.BufferGeometry; grain: THREE.BufferGeometry; waterO: THREE.BufferGeometry; waterH: THREE.BufferGeometry; waterBond: THREE.BufferGeometry; latticeBond: THREE.BufferGeometry };
let shared: Geometries | undefined;
function geometries(): Geometries {
  if (shared) return shared;
  const merged = (parts: THREE.BufferGeometry[]) => { const out = mergeGeometries(parts, false)!; parts.forEach((part) => part.dispose()); return out; };
  const centre = SUCROSE_ATOMS.reduce((sum, atom) => sum.add(new THREE.Vector3(...atom.position)), new THREE.Vector3()).divideScalar(SUCROSE_ATOMS.length);
  const points = SUCROSE_ATOMS.map((atom) => new THREE.Vector3(...atom.position).sub(centre).multiplyScalar(0.027));
  const atomsFor = (element: 'carbon' | 'oxygen' | 'hydrogen') => merged(SUCROSE_ATOMS.flatMap((atom, index) => {
    if (atom.element !== element) return [];
    const geometry = new THREE.SphereGeometry(element === 'hydrogen' ? 0.019 : element === 'oxygen' ? 0.029 : 0.027, 10, 8);
    geometry.translate(points[index].x, points[index].y, points[index].z);
    return [geometry];
  }));
  const bonds = merged(SUCROSE_BONDS.map(([a, b]) => {
    const direction = points[b].clone().sub(points[a]);
    const middle = points[a].clone().add(points[b]).multiplyScalar(0.5);
    const geometry = new THREE.CylinderGeometry(0.006, 0.006, direction.length(), 6);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    geometry.translate(middle.x, middle.y, middle.z);
    return geometry;
  }));
  // Water: O at the origin, H atoms 104.5 degrees apart on the +y side (matches LabWaterMolecule).
  const bond = 0.15, half = 52.25 * Math.PI / 180;
  const hs: [number, number][] = [[-Math.sin(half) * bond, Math.cos(half) * bond], [Math.sin(half) * bond, Math.cos(half) * bond]];
  const waterH = merged(hs.map(([x, y]) => { const g = new THREE.SphereGeometry(0.055, 12, 8); g.translate(x, y, 0); return g; }));
  const waterBond = merged(hs.map(([x, y]) => {
    const length = Math.hypot(x, y);
    const g = new THREE.CylinderGeometry(0.013, 0.013, length, 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, 0).normalize()));
    g.translate(x / 2, y / 2, 0);
    return g;
  }));
  shared = {
    carbon: atomsFor('carbon'), oxygen: atomsFor('oxygen'), hydrogen: atomsFor('hydrogen'), bonds,
    sphere: new THREE.SphereGeometry(1, 14, 10), grain: new THREE.DodecahedronGeometry(1, 0),
    waterO: new THREE.SphereGeometry(0.092, 16, 12), waterH, waterBond,
    latticeBond: new THREE.CylinderGeometry(0.0075, 0.0075, ION_SPACING, 6),
  };
  return shared;
}

const materialCache = new Map<string, THREE.Material>();
function material(key: string, make: () => THREE.Material): THREE.Material {
  let hit = materialCache.get(key);
  if (!hit) { hit = make(); materialCache.set(key, hit); }
  return hit;
}
const physical = (color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 0.4, ...extra });

const tmpMatrix = new THREE.Matrix4();
const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpRotation = new THREE.Quaternion();

function Instances({ items, geometry, material: mat, capacity }: { items: readonly Item[]; geometry: THREE.BufferGeometry; material: THREE.Material; capacity: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const count = Math.min(items.length, capacity);
    for (let index = 0; index < count; index += 1) {
      const item = items[index];
      tmpPosition.set(item.p[0], item.p[1], item.p[2]);
      if (item.q) tmpRotation.set(item.q[0], item.q[1], item.q[2], item.q[3]); else tmpRotation.identity();
      tmpScale.setScalar(item.s);
      mesh.setMatrixAt(index, tmpMatrix.compose(tmpPosition, tmpRotation, tmpScale));
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, capacity]);
  return <instancedMesh ref={ref} args={[geometry, mat, capacity]} frustumCulled={false} dispose={null} />;
}

export function ParticleLayer({ model, cationKind }: { model: ParticleModel; cationKind: CationKind }) {
  const g = geometries();
  const cationColour = cationKind === 'potassium' ? ATOM_COLOURS.potassium : ATOM_COLOURS.sodium;
  const ion = (colour: string) => material(`ion-${colour}`, physical(colour, { roughness: 0.2, clearcoat: 0.75 }));
  return <>
    <Instances items={model.cations} geometry={g.sphere} material={ion(cationColour)} capacity={600} />
    <Instances items={model.anions} geometry={g.sphere} material={ion(ATOM_COLOURS.chloride)} capacity={600} />
    <Instances items={model.bonds} geometry={g.latticeBond} material={material('lattice-bond', () => new THREE.MeshStandardMaterial({ color: '#c3d3e0', roughness: 0.4 }))} capacity={1200} />
    <Instances items={model.sucrose} geometry={g.carbon} material={material('carbon', physical(ATOM_COLOURS.carbon))} capacity={120} />
    <Instances items={model.sucrose} geometry={g.oxygen} material={material('oxygen', physical(ATOM_COLOURS.oxygen))} capacity={120} />
    <Instances items={model.sucrose} geometry={g.hydrogen} material={material('hydrogen', physical(ATOM_COLOURS.hydrogen))} capacity={120} />
    <Instances items={model.sucrose} geometry={g.bonds} material={material('bond', () => new THREE.MeshStandardMaterial({ color: '#b5c0cc', roughness: 0.42 }))} capacity={120} />
    <Instances items={model.sand} geometry={g.grain} material={material('sand', () => new THREE.MeshStandardMaterial({ color: SAND_COLOUR, roughness: 0.85, flatShading: true }))} capacity={400} />
    <Instances items={model.halos} geometry={g.sphere} material={material('hydration-halo', () => new THREE.MeshBasicMaterial({ color: '#7fe0ec', transparent: true, opacity: 0.22, depthWrite: false }))} capacity={24} />
    <Instances items={model.waters} geometry={g.waterO} material={material('oxygen', physical(ATOM_COLOURS.oxygen))} capacity={160} />
    <Instances items={model.waters} geometry={g.waterH} material={material('hydrogen', physical(ATOM_COLOURS.hydrogen))} capacity={160} />
    <Instances items={model.waters} geometry={g.waterBond} material={material('water-bond', () => new THREE.MeshStandardMaterial({ color: '#d5e0ea', roughness: 0.32 }))} capacity={160} />
  </>;
}
