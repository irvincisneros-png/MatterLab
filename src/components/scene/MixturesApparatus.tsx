import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ATOM_COLOURS, LabBeaker, LabBench, LabBond, LabWaterMolecule } from './LabPrimitives';
import { SEPARATION_MATERIALS, type SeparationMaterialId, type SeparationOutput, type SeparationState, type SeparationTechnique } from '../../science/mixturesEngine';

export type Vec3 = readonly [number, number, number];
export type Masses = Readonly<Partial<Record<SeparationMaterialId, number>>>;

/** Height of the bench surface. Every piece of apparatus is seated on (or clamped above) this plane. */
export const BENCH_Y = -0.83;
const BEAKER_R = 0.42;
const BEAKER_H = 1.0;

function unit(seed: number) {
  const value = Math.sin(seed * 78.233 + 16.17) * 43758.5453;
  return value - Math.floor(value);
}

/* ------------------------------------------------------------------ framing */

export interface StageFrame { readonly cx: number; readonly cy: number; readonly halfW: number; readonly halfH: number }

export const SEPARATION_FRAMES: Readonly<Record<SeparationTechnique, StageFrame>> = {
  filter: { cx: -0.2, cy: 0.05, halfW: 2.05, halfH: 1.32 },
  sieve: { cx: -0.35, cy: -0.1, halfW: 2.0, halfH: 1.15 },
  magnet: { cx: -0.2, cy: -0.1, halfW: 2.0, halfH: 1.1 },
  'settle-decant': { cx: 0.1, cy: -0.05, halfW: 2.15, halfH: 1.15 },
  evaporate: { cx: 0, cy: -0.02, halfW: 1.45, halfH: 1.25 },
  distill: { cx: -0.2, cy: 0.05, halfW: 2.3, halfH: 1.3 },
  dissolve: { cx: 0, cy: -0.1, halfW: 1.6, halfH: 1.15 },
};

export const APPARATUS_DESCRIPTION: Readonly<Record<SeparationTechnique, string>> = {
  filter: 'Retort stand and ring clamp holding a glass funnel lined with a folded filter-paper cone, its stem inside a receiving beaker.',
  sieve: 'A mesh sieve resting on the rim of a glass bowl.',
  magnet: 'A bar magnet in a plastic sleeve, dipped into the sample to collect iron filings and lifted out again.',
  'settle-decant': 'A beaker tipped onto a wedge so the clear upper liquid pours into a second beaker, leaving the sediment behind.',
  evaporate: 'An evaporating basin on a gauze and tripod over a Bunsen burner.',
  distill: 'A flask heated on a tripod, a clamped Liebig condenser and a receiving beaker.',
  dissolve: 'A beaker of sample with water being added and stirred.',
};

/* ------------------------------------------------------------ small helpers */

function Glass({ opacity = 0.26, colour = '#d6edf7' }: { opacity?: number; colour?: string }) {
  return <meshPhysicalMaterial color={colour} transparent opacity={opacity} roughness={0.1} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />;
}

function Metal({ colour = '#5f7690' }: { colour?: string }) {
  return <meshStandardMaterial color={colour} metalness={0.45} roughness={0.34} />;
}

interface InstanceItem { p: Vec3; s?: number | Vec3; r?: Vec3 }

function Instances({ items, children, castShadow = false }: { items: readonly InstanceItem[]; children: ReactNode; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    items.forEach((item, index) => {
      dummy.position.set(...item.p);
      dummy.rotation.set(...(item.r ?? [0, 0, 0]));
      if (typeof item.s === 'number') dummy.scale.setScalar(item.s);
      else if (item.s) dummy.scale.set(...item.s);
      else dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [items]);
  if (items.length === 0) return null;
  return <instancedMesh key={items.length} ref={ref} args={[undefined as never, undefined as never, items.length]} frustumCulled={false} castShadow={castShadow}>{children}</instancedMesh>;
}

/** Stack grains in settled layers. Returns instance transforms and the pile's top height. */
function packGrains(count: number, grainR: number, packR: number, startY: number, seed: number) {
  const perLayer = Math.max(3, Math.floor((packR / (grainR * 1.9)) ** 2));
  const step = grainR * 1.5;
  const items: InstanceItem[] = [];
  for (let index = 0; index < count; index += 1) {
    const layer = Math.floor(index / perLayer);
    const j = index % perLayer;
    const radius = packR * Math.sqrt((j + 0.5) / perLayer) * Math.pow(0.93, layer);
    const angle = j * 2.39996 + layer * 0.9 + unit(seed + index) * 0.4;
    const jitter = (unit(seed * 3 + index) - 0.5) * grainR * 0.35;
    items.push({
      p: [Math.cos(angle) * radius, startY + grainR + layer * step + jitter, Math.sin(angle) * radius],
      s: grainR * (0.85 + unit(seed + index * 5) * 0.4),
      r: [unit(index + seed) * 6, unit(index * 2 + seed) * 6, unit(index * 3 + seed) * 6],
    });
  }
  const layers = Math.ceil(count / perLayer);
  return { items, topY: count > 0 ? startY + grainR * 2 + (layers - 1) * step : startY };
}

/* -------------------------------------------------------- vessel contents */

interface GrainSpec { id: SeparationMaterialId; count: number; r: number; cube: boolean }

function grainSpecs(masses: Masses, crystallised: number): GrainSpec[] {
  const m = (id: SeparationMaterialId) => masses[id] ?? 0;
  const specs: GrainSpec[] = [];
  if (m('iron') > 0) specs.push({ id: 'iron', count: Math.min(40, Math.max(4, Math.round(m('iron') * 1.4))), r: 0.021, cube: false });
  if (m('gravel') > 0) specs.push({ id: 'gravel', count: Math.min(14, Math.max(3, Math.round(m('gravel') / 3.5))), r: 0.066, cube: false });
  if (m('sand') > 0) specs.push({ id: 'sand', count: Math.min(60, Math.max(6, Math.round(m('sand') * 1.1))), r: 0.03, cube: false });
  if (m('debris') > 0) specs.push({ id: 'debris', count: Math.min(10, Math.max(2, Math.round(m('debris')))), r: 0.07, cube: false });
  if (m('sediment') > 0) specs.push({ id: 'sediment', count: Math.min(30, Math.max(4, Math.round(m('sediment')))), r: 0.018, cube: false });
  if (m('sugar') > 0) specs.push({ id: 'sugar', count: Math.min(30, Math.max(4, Math.round(m('sugar')))), r: 0.03, cube: true });
  const salt = m('salt') + crystallised;
  if (salt > 0) specs.push({ id: 'salt', count: Math.min(34, Math.max(5, Math.round(salt * 1.1))), r: 0.034, cube: true });
  return specs;
}

export interface ContentsProps {
  masses: Masses;
  innerR: number;
  /** Local y of the inside floor. */
  floorY: number;
  /** Largest sensible liquid depth for this vessel. */
  maxLiquidH: number;
  seed?: number;
  modelTime?: number;
  /** When set, liquid is clipped by a world-level plane (used for tilted vessels). */
  liquidWorldY?: number;
}

/** Settled solids on the bottom, liquid layers on top, and particle-view water molecules and ions dispersed in the liquid. */
export function VesselContents({ masses, innerR, floorY, maxLiquidH, seed = 3, modelTime = 0, liquidWorldY }: ContentsProps) {
  const water = masses.water ?? 0;
  const oil = masses.oil ?? 0;
  const dissolved = masses['dissolved-salt'] ?? 0;
  const crystallised = water <= 0 ? dissolved : 0;
  const packR = Math.max(0.1, innerR - 0.07);
  const layout = useMemo(() => {
    let cursor = floorY + 0.012;
    const groups = grainSpecs(masses, crystallised).map((spec, index) => {
      const packed = packGrains(spec.count, spec.r, packR, cursor, seed * 11 + index * 31);
      cursor = packed.topY - spec.r * 0.4;
      return { spec, items: packed.items };
    });
    return { groups, topY: cursor + 0.02 };
  }, [masses, crystallised, packR, floorY, seed]);

  const liquidG = water + oil;
  const liquidH = liquidG > 0 ? maxLiquidH * Math.min(1, 0.18 + (liquidG / 130) * 0.82) : 0;
  const waterH = liquidG > 0 ? liquidH * (water / liquidG) : 0;
  const oilH = liquidH - waterH;
  const clip = useMemo(() => liquidWorldY === undefined ? undefined : [new THREE.Plane(new THREE.Vector3(0, -1, 0), liquidWorldY)], [liquidWorldY]);

  const dispersed = useMemo(() => {
    if (water <= 0) return { molecules: [] as Vec3[], sodium: [] as Vec3[], chloride: [] as Vec3[] };
    const lowY = Math.max(floorY + 0.07, layout.topY + 0.04);
    const highY = floorY + waterH - 0.07;
    const place = (index: number, salt: number): Vec3 => {
      const radius = Math.sqrt(unit(seed * 9 + index * 1.7 + salt)) * (innerR - 0.12);
      const angle = unit(seed * 5 + index * 2.3 + salt) * Math.PI * 2;
      const y = highY > lowY ? lowY + unit(seed * 7 + index * 3.1 + salt) * (highY - lowY) : lowY;
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    };
    const moleculeCount = waterH > 0.14 ? Math.min(9, Math.ceil(water / 11)) : 0;
    const ionPairs = waterH > 0.14 && dissolved > 0 ? Math.min(7, Math.ceil(dissolved / 2.2)) : 0;
    return {
      molecules: Array.from({ length: moleculeCount }, (_, index) => place(index, 0)),
      sodium: Array.from({ length: ionPairs }, (_, index) => place(index + 40, 11)),
      chloride: Array.from({ length: ionPairs }, (_, index) => place(index + 80, 23)),
    };
  }, [water, dissolved, waterH, layout.topY, floorY, innerR, seed]);

  return <group>
    {layout.groups.map(({ spec, items }) => {
      const material = SEPARATION_MATERIALS[spec.id];
      return <Instances key={spec.id} items={items}>
        {spec.cube ? <boxGeometry args={[1.5, 1.5, 1.5]} /> : <dodecahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial color={material.colour} roughness={spec.id === 'iron' ? 0.35 : 0.85} metalness={spec.id === 'iron' ? 0.55 : 0} flatShading />
      </Instances>;
    })}
    {waterH > 0.004 && <mesh position={[0, floorY + waterH / 2, 0]}>
      <cylinderGeometry args={[innerR - 0.012, innerR - 0.012, waterH, 48]} />
      <meshPhysicalMaterial color="#8dd3e6" transparent opacity={0.3} roughness={0.12} side={THREE.DoubleSide} depthWrite={false} clippingPlanes={clip} />
    </mesh>}
    {oilH > 0.004 && <mesh position={[0, floorY + waterH + oilH / 2, 0]}>
      <cylinderGeometry args={[innerR - 0.012, innerR - 0.012, oilH, 48]} />
      <meshPhysicalMaterial color="#d9a21b" transparent opacity={0.5} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} clippingPlanes={clip} />
    </mesh>}
    {dispersed.molecules.map((p, index) => <group key={`h2o-${index}`} position={[...p]} rotation={[unit(index + seed) * 3, modelTime * 0.2 + unit(index * 2) * 6, unit(index * 3) * 3]}><LabWaterMolecule scale={0.4} /></group>)}
    <Instances items={dispersed.sodium.map((p) => ({ p }))}><sphereGeometry args={[0.036, 14, 10]} /><meshPhysicalMaterial color={ATOM_COLOURS.sodium} roughness={0.25} clearcoat={0.6} /></Instances>
    <Instances items={dispersed.chloride.map((p) => ({ p }))}><sphereGeometry args={[0.048, 14, 10]} /><meshPhysicalMaterial color={ATOM_COLOURS.chloride} roughness={0.25} clearcoat={0.6} /></Instances>
  </group>;
}

function emptyMasses(): Masses { return {}; }

/** A beaker seated on the bench with its contents. */
function Beaker({ x, z = 0, radius = BEAKER_R, height = BEAKER_H, masses = emptyMasses(), seed = 1, modelTime = 0, graduated = true }: { x: number; z?: number; radius?: number; height?: number; masses?: Masses; seed?: number; modelTime?: number; graduated?: boolean }) {
  return <group position={[x, BENCH_Y + height / 2, z]}>
    <LabBeaker radius={radius} height={height} graduated={graduated} capacityMl={100} particleLens position={[0, 0, 0]} />
    <VesselContents masses={masses} innerR={radius - 0.03} floorY={-height / 2 + 0.09} maxLiquidH={height - 0.28} seed={seed} modelTime={modelTime} />
  </group>;
}

/* ------------------------------------------------------------- recovered samples */

function RecoveredSample({ x, z, output, seed }: { x: number; z: number; output: SeparationOutput; seed: number }) {
  const masses = output.massesG;
  const liquid = (masses.water ?? 0) + (masses.oil ?? 0) > 0;
  const solidsOnly = Object.fromEntries(Object.entries(masses).filter(([id]) => SEPARATION_MATERIALS[id as SeparationMaterialId].phase === 'solid' && id !== 'water')) as Masses;
  if (output.label === 'Water vapour') return null;
  if (liquid) return <Beaker x={x} z={z} radius={0.2} height={0.42} masses={masses} seed={seed} graduated={false} />;
  return <group position={[x, BENCH_Y, z]}>
    <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.22, 0.22, 0.06, 32, 1, true]} /><Glass opacity={0.4} /></mesh>
    <mesh position={[0, 0.004, 0]}><cylinderGeometry args={[0.22, 0.22, 0.008, 32]} /><Glass opacity={0.55} /></mesh>
    <group position={[0, 0.0, 0]}><VesselContents masses={solidsOnly} innerR={0.2} floorY={0.008} maxLiquidH={0.1} seed={seed} /></group>
  </group>;
}

function RecoveredRow({ outputs, z = 0.95, exclude }: { outputs: readonly SeparationOutput[]; z?: number; exclude?: SeparationOutput }) {
  const shown = outputs.filter((output) => output !== exclude && output.label !== 'Water vapour').slice(-4);
  return <>{shown.map((output, index) => <RecoveredSample key={`${output.label}-${index}`} x={-1.2 + index * 0.62} z={z} output={output} seed={index + 4} />)}</>;
}

/* -------------------------------------------------------------- stands, burners */

function RetortStand({ x, z = -0.1, height = 1.3, armY, armToX }: { x: number; z?: number; height?: number; armY: number; armToX: number }) {
  const rodX = x;
  return <group>
    <mesh position={[x - 0.02, BENCH_Y + 0.03, z]}><boxGeometry args={[0.85, 0.06, 0.56]} /><meshStandardMaterial color="#35506f" metalness={0.2} roughness={0.5} /></mesh>
    <mesh position={[rodX, BENCH_Y + 0.06 + height / 2, z]}><cylinderGeometry args={[0.026, 0.026, height, 16]} /><Metal colour="#c3cdd8" /></mesh>
    <mesh position={[rodX, armY, z]}><boxGeometry args={[0.1, 0.09, 0.1]} /><Metal colour="#35506f" /></mesh>
    <mesh position={[(rodX + armToX) / 2, armY, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.017, 0.017, Math.abs(rodX - armToX), 12]} /><Metal colour="#c3cdd8" /></mesh>
  </group>;
}

function WireMesh({ size }: { size: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = '#59636e';
    ctx.lineWidth = 6;
    for (let step = 0; step <= 128; step += 32) { ctx.beginPath(); ctx.moveTo(step, 0); ctx.lineTo(step, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, step); ctx.lineTo(128, step); ctx.stroke(); }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(size * 7, size * 7);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [size]);
  useLayoutEffect(() => () => texture?.dispose(), [texture]);
  return <meshStandardMaterial color="#e7edf3" map={texture ?? undefined} alphaMap={undefined} roughness={0.6} side={THREE.DoubleSide} transparent opacity={0.92} />;
}

/** Tripod and gauze over a Bunsen burner on a heat-proof mat. `top` is the gauze height above the bench. */
function HeatStation({ x, z = 0, top = 0.62, flame }: { x: number; z?: number; top?: number; flame: boolean }) {
  const ringR = 0.46;
  const legs = [0, 1, 2].map((index) => {
    const angle = index * ((Math.PI * 2) / 3) + Math.PI / 6;
    return { from: [Math.cos(angle) * ringR, BENCH_Y + top, Math.sin(angle) * ringR] as Vec3, to: [Math.cos(angle) * (ringR + 0.14), BENCH_Y + 0.05, Math.sin(angle) * (ringR + 0.14)] as Vec3 };
  });
  return <group position={[x, 0, z]}>
    <mesh position={[0, BENCH_Y + 0.02, 0]}><boxGeometry args={[1.25, 0.04, 1.25]} /><meshStandardMaterial color="#8e9aa6" roughness={0.8} /></mesh>
    {legs.map((leg, index) => <LabBond key={index} from={leg.from} to={leg.to} radius={0.022} colour="#56616d" />)}
    <mesh position={[0, BENCH_Y + top, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[ringR, 0.024, 8, 40]} /><Metal colour="#56616d" /></mesh>
    <mesh position={[0, BENCH_Y + top + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.0, 1.0]} /><WireMesh size={1} /></mesh>
    {/* Bunsen burner */}
    <mesh position={[0, BENCH_Y + 0.07, 0]}><cylinderGeometry args={[0.19, 0.22, 0.05, 28]} /><Metal colour="#44505c" /></mesh>
    <mesh position={[0, BENCH_Y + 0.25, 0]}><cylinderGeometry args={[0.04, 0.04, 0.34, 14]} /><Metal colour="#aab6c2" /></mesh>
    <mesh position={[0, BENCH_Y + 0.14, 0]}><cylinderGeometry args={[0.055, 0.055, 0.07, 14]} /><Metal colour="#ef6858" /></mesh>
    <mesh position={[0.2, BENCH_Y + 0.095, 0.08]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 0.26, 10]} /><meshStandardMaterial color="#2b3a4b" roughness={0.7} /></mesh>
    {flame && <group position={[0, BENCH_Y + 0.42, 0]}>
      <mesh position={[0, (top - 0.42) / 2, 0]}><coneGeometry args={[0.07, top - 0.43, 16]} /><meshBasicMaterial color="#4f9bff" transparent opacity={0.6} /></mesh>
      <mesh position={[0, (top - 0.42) / 2 - 0.03, 0]}><coneGeometry args={[0.035, top - 0.5, 12]} /><meshBasicMaterial color="#e3f2ff" transparent opacity={0.9} /></mesh>
    </group>}
  </group>;
}

/* --------------------------------------------------------------------- rigs */

interface RigProps { state: SeparationState; modelTime: number }

function useRigState(state: SeparationState, technique: SeparationTechnique) {
  const last = state.lastAction;
  const justRan = last?.technique === technique;
  const latest = justRan && last.movedG > 0 ? state.outputs.at(-1) : undefined;
  return { justRan, latest, remaining: state.remainingG };
}

const MIN_FUNNEL_Y = 0.12;

const easeInOut = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * 0 → 1 over `seconds` each time `trigger` changes to a new action, so a
 * technique is shown being carried out rather than jumping to its end state.
 * Reduced motion skips straight to the end.
 */
function useActionProgress(trigger: unknown, seconds: number) {
  const [progress, setProgress] = useState(1);
  const start = useRef<number | null>(null);
  const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  useEffect(() => {
    start.current = null;
    setProgress(trigger && !reduced ? 0 : 1);
  }, [trigger, reduced]);
  useFrame(({ clock }) => {
    if (progress >= 1) return;
    if (start.current === null) start.current = clock.elapsedTime;
    setProgress(clamp01((clock.elapsedTime - start.current) / seconds));
  });
  return progress;
}

function addMasses(a: Masses, b: Masses, scaleB: number): Masses {
  const out: Partial<Record<SeparationMaterialId, number>> = { ...a };
  for (const [id, mass] of Object.entries(b)) out[id as SeparationMaterialId] = (out[id as SeparationMaterialId] ?? 0) + (mass ?? 0) * scaleB;
  return out;
}

function FilterRig({ state, modelTime }: RigProps) {
  const { justRan, latest, remaining } = useRigState(state, 'filter');
  const filtered = justRan && ((state.lastAction?.movedG ?? 0) > 0 || (remaining.water ?? 0) > 0);
  const rx = 0.1;
  const coneBottom = BENCH_Y + BEAKER_H + MIN_FUNNEL_Y;
  const funnelProfile = useMemo(() => [new THREE.Vector2(0.03, -0.5), new THREE.Vector2(0.03, 0), new THREE.Vector2(0.565, 0.56)], []);
  const ringH = 0.34;
  const ringR = 0.035 + 0.968 * ringH;
  const residue = useMemo(() => {
    if (!latest) return [] as InstanceItem[];
    const total = Object.values(latest.massesG).reduce((sum, mass) => sum + (mass ?? 0), 0);
    const count = Math.min(46, Math.max(8, Math.round(total * 1.1)));
    return Array.from({ length: count }, (_, index): InstanceItem => {
      const y = 0.1 + Math.pow(unit(index + 3), 0.8) * Math.min(0.3, 0.1 + count * 0.004);
      const maxR = Math.max(0.02, y - 0.02 - 0.032);
      const radius = maxR * (0.4 + 0.6 * unit(index * 7 + 1));
      const angle = unit(index * 1.9) * Math.PI * 2;
      return { p: [Math.cos(angle) * radius, y, Math.sin(angle) * radius], s: 0.03 * (0.8 + unit(index) * 0.5), r: [index, index * 2, index * 3] };
    });
  }, [latest]);
  const residueColour = latest ? SEPARATION_MATERIALS[(Object.keys(latest.massesG).find((id) => (latest.massesG[id as SeparationMaterialId] ?? 0) > 0) ?? 'sand') as SeparationMaterialId].colour : '#d9bd82';
  const filtrate: Masses = filtered ? remaining : emptyMasses();
  const feed: Masses = filtered ? emptyMasses() : remaining;
  return <group>
    <Beaker x={-1.5} masses={feed} seed={2} modelTime={modelTime} />
    <Beaker x={rx} masses={filtrate} seed={5} modelTime={modelTime} />
    <RetortStand x={1.18} height={1.32} armY={coneBottom + ringH} armToX={rx + ringR} />
    <group position={[rx, coneBottom, 0]}>
      <mesh><latheGeometry args={[funnelProfile, 56]} /><Glass opacity={0.32} colour="#cfe9f4" /></mesh>
      <mesh position={[0, 0.02 + 0.26, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.52, 0.52, 9, 1, true]} /><meshStandardMaterial color="#fbfdff" roughness={0.9} flatShading side={THREE.DoubleSide} transparent opacity={0.38} depthWrite={false} /></mesh>
      <mesh position={[0, ringH, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[ringR + 0.012, 0.02, 10, 48]} /><Metal colour="#35506f" /></mesh>
      <Instances items={residue}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={residueColour} roughness={0.85} flatShading /></Instances>
      {filtered && <mesh position={[0, -0.57, 0]}><sphereGeometry args={[0.022, 12, 10]} /><meshPhysicalMaterial color="#8dd3e6" transparent opacity={0.8} /></mesh>}
    </group>
    <RecoveredRow outputs={state.outputs} exclude={latest} />
  </group>;
}

function SieveRig({ state, modelTime }: RigProps) {
  const { justRan, latest, remaining } = useRigState(state, 'sieve');
  const bowlProfile = useMemo(() => [new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0.01), new THREE.Vector2(0.64, 0.5), new THREE.Vector2(0.66, 0.52)], []);
  const mesh = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#46515d';
    ctx.lineWidth = 5;
    for (let step = 0; step <= 128; step += 16) { ctx.beginPath(); ctx.moveTo(step, 0); ctx.lineTo(step, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, step); ctx.lineTo(128, step); ctx.stroke(); }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 3);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useLayoutEffect(() => () => mesh?.dispose(), [mesh]);
  const bx = 0.45;
  const rimY = BENCH_Y + 0.52;
  const caught: Masses = latest ? latest.massesG : emptyMasses();
  const below: Masses = justRan ? remaining : emptyMasses();
  const feed: Masses = justRan ? emptyMasses() : remaining;
  const caughtGrains = useMemo(() => grainSpecs(caught, 0).map((spec, index) => ({ spec, packed: packGrains(spec.count, spec.r, 0.4, 0, 20 + index) })), [caught]);
  return <group>
    <Beaker x={-1.5} masses={feed} seed={2} modelTime={modelTime} />
    <group position={[bx, BENCH_Y, 0]}>
      <mesh><latheGeometry args={[bowlProfile, 56]} /><Glass opacity={0.3} /></mesh>
      <group position={[0, 0.01, 0]}><VesselContents masses={below} innerR={0.46} floorY={0.01} maxLiquidH={0.3} seed={6} modelTime={modelTime} /></group>
    </group>
    <group position={[bx, rimY, 0]}>
      <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.72, 0.7, 0.14, 48, 1, true]} /><Metal colour="#35506f" /></mesh>
      <mesh position={[0, 0.145, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.72, 0.02, 8, 48]} /><Metal colour="#9fb4c8" /></mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.7, 48]} /><meshStandardMaterial color="#e7edf3" map={mesh ?? undefined} transparent alphaTest={0.2} side={THREE.DoubleSide} roughness={0.5} /></mesh>
      <mesh position={[0.72, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 0.5, 12]} /><Metal colour="#35506f" /></mesh>
      {caughtGrains.map(({ spec, packed }) => <Instances key={spec.id} items={packed.items.map((item) => ({ ...item, p: [item.p[0], item.p[1] + 0.055, item.p[2]] as Vec3 }))}>
        <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={SEPARATION_MATERIALS[spec.id].colour} roughness={0.85} flatShading />
      </Instances>)}
    </group>
    <RecoveredRow outputs={state.outputs} exclude={latest} />
  </group>;
}

function MagnetRig({ state, modelTime }: RigProps) {
  const { justRan, latest, remaining } = useRigState(state, 'magnet');
  const attractedG = latest?.massesG.iron ?? 0;
  const mx = 0.75;
  const bodyY = BENCH_Y + 0.12;
  const spikes = useMemo(() => {
    if (attractedG <= 0) return [] as InstanceItem[];
    const count = Math.min(46, Math.max(10, Math.round(attractedG * 1.8)));
    const up = new THREE.Vector3(0, 1, 0);
    return Array.from({ length: count }, (_, index): InstanceItem => {
      const pole = index % 2 === 0 ? -1 : 1;
      const along = 0.58 - unit(index * 1.3) * 0.2;
      const angle = (unit(index * 2.7) - 0.5) * Math.PI * 1.5;
      const normal = new THREE.Vector3(pole * 0.55, Math.cos(angle), Math.sin(angle) * 1.2).normalize();
      const root = new THREE.Vector3(pole * along, Math.cos(angle) * 0.12, Math.sin(angle) * 0.12);
      const length = 0.07 + unit(index * 5.1) * 0.07;
      const centre = root.clone().addScaledVector(normal, length / 2);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
      const euler = new THREE.Euler().setFromQuaternion(quaternion);
      return { p: [centre.x, centre.y, centre.z], s: [1, length, 1], r: [euler.x, euler.y, euler.z] };
    });
  }, [attractedG]);
  const progress = useActionProgress(justRan ? state.lastAction : null, 3.6);
  const beakerX = -1.3;
  // Path: lift and carry (0–0.3), lower into the sample (0.3–0.45), hold (0.45–0.55), lift out (0.55–0.7), return (0.7–1).
  const carry = easeInOut(clamp01(progress / 0.3)) * (1 - easeInOut(clamp01((progress - 0.7) / 0.3)));
  const dip = easeInOut(clamp01((progress - 0.3) / 0.15)) * (1 - easeInOut(clamp01((progress - 0.55) / 0.15)));
  const animating = justRan && attractedG > 0 && progress < 1;
  const x = animating ? mx + (beakerX - mx) * carry : mx;
  const y = animating ? bodyY + carry * 1.25 - dip * 0.95 : bodyY;
  const upright = animating ? carry : 0;
  const collected = !animating || progress >= 0.45;
  // Until the magnet reaches the sample, the iron is still in the beaker.
  const feed: Masses = animating && progress < 0.45 ? addMasses(remaining, { iron: attractedG }, 1) : remaining;
  return <group>
    <Beaker x={beakerX} masses={feed} seed={2} modelTime={modelTime} />
    <group position={[x, y, animating ? 0.1 * (1 - carry) : 0.1]} rotation={[0, -0.15 * (1 - upright), (Math.PI / 2) * upright]}>
      <mesh><boxGeometry args={[1.26, 0.3, 0.3]} /><meshPhysicalMaterial color="#eef6fb" transparent opacity={0.22} roughness={0.2} depthWrite={false} /></mesh>
      <mesh position={[-0.28, 0, 0]}><boxGeometry args={[0.6, 0.24, 0.24]} /><meshStandardMaterial color="#e43d39" roughness={0.35} metalness={0.2} /></mesh>
      <mesh position={[0.32, 0, 0]}><boxGeometry args={[0.6, 0.24, 0.24]} /><meshStandardMaterial color="#c7d2de" roughness={0.3} metalness={0.5} /></mesh>
      {collected && <Instances items={spikes}><cylinderGeometry args={[0.006, 0.012, 1, 6]} /><meshStandardMaterial color={SEPARATION_MATERIALS.iron.colour} roughness={0.35} metalness={0.7} /></Instances>}
    </group>
    {justRan && attractedG <= 0 && <mesh position={[mx, BENCH_Y + 0.003, 0.1]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.7, 0.72, 40]} /><meshBasicMaterial color="#9fb4c8" transparent opacity={0.4} /></mesh>}
    <RecoveredRow outputs={state.outputs} exclude={latest} />
  </group>;
}

function DecantRig({ state, modelTime }: RigProps) {
  const { justRan, latest, remaining } = useRigState(state, 'settle-decant');
  const poured = justRan && !!latest;
  const progress = useActionProgress(poured ? state.lastAction : null, 3.2);
  const tiltFraction = easeInOut(clamp01(progress / 0.45));
  const pourFraction = easeInOut(clamp01((progress - 0.35) / 0.6));
  const tilt = (40 * Math.PI) / 180 * tiltFraction;
  const wedgeTilt = (40 * Math.PI) / 180;
  const pivotX = -0.95;
  const pivot: Vec3 = [pivotX + BEAKER_R, BENCH_Y, 0];
  const receiverX = pivot[0] + 1.08;
  const wedge = useMemo(() => {
    const shape = new THREE.Shape();
    const length = 0.86;
    shape.moveTo(0, 0);
    shape.lineTo(-length * Math.cos(wedgeTilt), length * Math.sin(wedgeTilt));
    shape.lineTo(-length * Math.cos(wedgeTilt), 0);
    shape.closePath();
    return shape;
  }, [wedgeTilt]);
  const lipX = pivot[0] + BEAKER_H * Math.sin(tilt);
  const lipY = BENCH_Y + BEAKER_H * Math.cos(tilt);
  const receiverTop = BENCH_Y + 0.7;
  // The decanted liquid leaves the tilted beaker and arrives in the receiver as the pour progresses.
  const tilted: Masses = poured && latest ? addMasses(remaining, latest.massesG, 1 - pourFraction) : remaining;
  const received: Masses = poured && latest ? addMasses(emptyMasses(), latest.massesG, pourFraction) : emptyMasses();
  const levelFraction = (tilted.water ?? 0) + (tilted.oil ?? 0);
  const surfaceY = BENCH_Y + 0.95 + (0.22 - 0.95) * Math.max(tiltFraction * 0.55, pourFraction);
  const pouring = poured && progress > 0.35 && progress < 0.97;
  return <group>
    {!poured && <Beaker x={pivotX} masses={remaining} seed={2} modelTime={modelTime} />}
    {poured && <>
      <mesh position={[pivot[0], BENCH_Y, -0.3]} rotation={[0, 0, 0]}>
        <extrudeGeometry args={[wedge, { depth: 0.6, bevelEnabled: false }]} />
        <meshStandardMaterial color="#2f8aa5" roughness={0.65} />
      </mesh>
      <group position={[...pivot]} rotation={[0, 0, -tilt]}>
        <group position={[-BEAKER_R, BEAKER_H / 2, 0]}>
          <LabBeaker radius={BEAKER_R} height={BEAKER_H} graduated capacityMl={100} particleLens position={[0, 0, 0]} />
          <VesselContents masses={tilted} innerR={BEAKER_R - 0.03} floorY={-BEAKER_H / 2 + 0.09} maxLiquidH={BEAKER_H - 0.28} seed={2} liquidWorldY={levelFraction > 0 ? surfaceY : undefined} />
        </group>
      </group>
      {pouring && <LabBond from={[lipX, lipY, 0]} to={[lipX + 0.1, receiverTop - 0.22, 0]} radius={0.016} colour="#8dd3e6" />}
    </>}
    <Beaker x={receiverX} radius={0.42} height={0.7} masses={received} seed={5} modelTime={modelTime} graduated />
    <RecoveredRow outputs={state.outputs} exclude={latest} />
  </group>;
}

function EvaporateRig({ state, modelTime }: RigProps) {
  const { justRan, latest, remaining } = useRigState(state, 'evaporate');
  const basinProfile = useMemo(() => [new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0.008), new THREE.Vector2(0.52, 0.17), new THREE.Vector2(0.56, 0.2), new THREE.Vector2(0.545, 0.205), new THREE.Vector2(0.5, 0.17), new THREE.Vector2(0.29, 0.03), new THREE.Vector2(0, 0.025)], []);
  const gaugeTop = 0.62 + 0.032;
  const vapour = justRan && latest ? Array.from({ length: 7 }, (_, index) => ({ x: (unit(index * 3) - 0.5) * 0.7, y: 0.3 + index * 0.05 + Math.sin(modelTime * 1.6 + index) * 0.02, r: 0.07 + index * 0.012 })) : [];
  return <group>
    <HeatStation x={0} top={0.62} flame={justRan} />
    <group position={[0, BENCH_Y + gaugeTop, 0]}>
      <mesh><latheGeometry args={[basinProfile, 56]} /><meshStandardMaterial color="#f6f3ec" roughness={0.35} side={THREE.DoubleSide} /></mesh>
      <group position={[0, 0.0, 0]}><VesselContents masses={remaining} innerR={0.48} floorY={0.03} maxLiquidH={0.14} seed={4} modelTime={modelTime} /></group>
      {vapour.map((puff, index) => <mesh key={index} position={[puff.x, puff.y + 0.2, 0]}><sphereGeometry args={[puff.r, 14, 10]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.35 - index * 0.03} depthWrite={false} /></mesh>)}
    </group>
    <RecoveredRow outputs={state.outputs} exclude={latest} z={0.95} />
  </group>;
}

function DistillRig({ state, modelTime }: RigProps) {
  const { justRan, latest, remaining } = useRigState(state, 'distill');
  const s = 0.8;
  const fx = -1.45;
  const gaugeTop = 0.62 + 0.032;
  const flaskProfile = useMemo(() => [
    new THREE.Vector2(0, 0), new THREE.Vector2(0.46 * s, 0), new THREE.Vector2(0.47 * s, 0.04 * s), new THREE.Vector2(0.15 * s, 0.7 * s), new THREE.Vector2(0.14 * s, 0.9 * s), new THREE.Vector2(0.17 * s, 0.93 * s),
  ], [s]);
  const neckTop = BENCH_Y + gaugeTop + 0.93 * s;
  const entry: Vec3 = [-0.9, BENCH_Y + 1.42, 0];
  const exit: Vec3 = [0.85, BENCH_Y + 1.12, 0];
  const slope = Math.atan2(exit[1] - entry[1], exit[0] - entry[0]);
  const length = Math.hypot(exit[0] - entry[0], exit[1] - entry[1]);
  const mid: Vec3 = [(entry[0] + exit[0]) / 2, (entry[1] + exit[1]) / 2, 0];
  const receiverX = exit[0] + 0.1;
  const clampX = 0.0;
  const clampY = entry[1] + (exit[1] - entry[1]) * ((clampX - entry[0]) / (exit[0] - entry[0]));
  const standZ = -0.42;
  const remainingInFlask = remaining;
  const collected: Masses = justRan && latest ? latest.massesG : emptyMasses();
  return <group>
    <HeatStation x={fx} top={0.62} flame={justRan} />
    <group position={[fx, BENCH_Y + gaugeTop, 0]}>
      <mesh><latheGeometry args={[flaskProfile, 48]} /><Glass opacity={0.3} /></mesh>
      <group position={[0, 0.0, 0]}><VesselContents masses={remainingInFlask} innerR={0.34} floorY={0.02} maxLiquidH={0.42} seed={7} modelTime={modelTime} /></group>
    </group>
    <mesh position={[fx, neckTop + 0.04, 0]}><cylinderGeometry args={[0.16, 0.12, 0.1, 20]} /><meshStandardMaterial color="#8a4a38" roughness={0.8} /></mesh>
    <LabBond from={[fx, neckTop + 0.06, 0]} to={[fx, entry[1], 0]} radius={0.028} colour="#cfe3ee" />
    <LabBond from={[fx, entry[1], 0]} to={[entry[0] + 0.03, entry[1], 0]} radius={0.028} colour="#cfe3ee" />
    <group position={[...mid]} rotation={[0, 0, slope]}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, length, 28, 1, true]} /><Glass opacity={0.3} colour="#bfe3f2" /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.092, 0.092, length - 0.04, 28]} /><meshPhysicalMaterial color="#7fc2e8" transparent opacity={0.28} depthWrite={false} /></mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, length + 0.3, 14]} /><Glass opacity={0.55} colour="#e8f6fb" /></mesh>
      <mesh position={[length / 2 - 0.1, 0.12, 0]}><cylinderGeometry args={[0.02, 0.02, 0.2, 10]} /><meshStandardMaterial color="#205fe8" roughness={0.6} /></mesh>
      <mesh position={[-length / 2 + 0.1, -0.12, 0]}><cylinderGeometry args={[0.02, 0.02, 0.2, 10]} /><meshStandardMaterial color="#205fe8" roughness={0.6} /></mesh>
    </group>
    <RetortStand x={0.0 + clampX} z={standZ} height={1.62} armY={clampY} armToX={clampX} />
    <mesh position={[clampX, clampY, standZ / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.017, 0.017, Math.abs(standZ), 10]} /><Metal colour="#c3cdd8" /></mesh>
    <mesh position={[clampX, clampY, 0]} rotation={[0, Math.PI / 2, slope]}><torusGeometry args={[0.115, 0.018, 8, 28]} /><Metal colour="#35506f" /></mesh>
    <Beaker x={receiverX} radius={0.36} height={0.8} masses={collected} seed={5} modelTime={modelTime} graduated />
    {justRan && latest && <mesh position={[exit[0] + 0.15, exit[1] - 0.35, 0]}><sphereGeometry args={[0.02, 10, 8]} /><meshPhysicalMaterial color="#8dd3e6" transparent opacity={0.8} /></mesh>}
    <RecoveredRow outputs={state.outputs} exclude={latest} z={0.95} />
  </group>;
}

function DissolveRig({ state, modelTime }: RigProps) {
  const { justRan } = useRigState(state, 'dissolve');
  return <group>
    <Beaker x={0} radius={0.52} height={1.15} masses={state.remainingG} seed={2} modelTime={modelTime} />
    <group position={[0.2, BENCH_Y + 0.62, 0.15]} rotation={[0, 0, justRan ? 0.12 : 0.2]}>
      <mesh><cylinderGeometry args={[0.014, 0.014, 1.1, 8]} /><Glass opacity={0.7} colour="#ffffff" /></mesh>
    </group>
    <RecoveredRow outputs={state.outputs} />
  </group>;
}

export function SeparationRig({ state, modelTime, technique }: RigProps & { technique: SeparationTechnique }): ReactElement {
  return <group>
    <LabBench position={[0, BENCH_Y - 0.05, 0]} width={5.6} depth={3.1} />
    {technique === 'filter' && <FilterRig state={state} modelTime={modelTime} />}
    {technique === 'sieve' && <SieveRig state={state} modelTime={modelTime} />}
    {technique === 'magnet' && <MagnetRig state={state} modelTime={modelTime} />}
    {technique === 'settle-decant' && <DecantRig state={state} modelTime={modelTime} />}
    {technique === 'evaporate' && <EvaporateRig state={state} modelTime={modelTime} />}
    {technique === 'distill' && <DistillRig state={state} modelTime={modelTime} />}
    {technique === 'dissolve' && <DissolveRig state={state} modelTime={modelTime} />}
  </group>;
}

