import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ATOM_COLOURS, StudioLights } from './LabPrimitives';
import {
  ApparatusTube,
  FeedPump,
  LitterPiece,
  OIL_COLOUR,
  RecoveredMaterialJar,
  RecoveredWaterBeaker,
  TreatmentBench,
  TreatmentRig,
  WasteBin,
  WATER_COLOUR,
} from './PollutionApparatus';
import { describePollutionScene, pollutionOutputs, type PollutionState } from '../../science/pollutionEngine';

type Vec3 = readonly [number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (id: number, lane: number) => {
  const value = Math.sin((id + 1) * 78.233 + lane * 32.53) * 43758.5453;
  return value - Math.floor(value);
};

/* ------------------------------------------------------------------ */
/* Terrain model: a clay-lined pond with sloping banks and a creek inflow */
/* ------------------------------------------------------------------ */

export const GROUND_Y = 0.34;
export const WATER_Y = 0.2;
const SLAB = { width: 3.8, depth: 3.4 } as const;
const POND = { cx: 0.12, cz: 0.18, a: 1.12, b: 0.86 } as const;

const pondRadiusFactor = (theta: number) => 1 + 0.07 * Math.sin(2 * theta + 0.6) + 0.05 * Math.sin(3 * theta + 2.1) + 0.03 * Math.sin(5 * theta + 0.3);
/** 1 on the (irregular) waterline ellipse, less than 1 inside the pond. */
export function pondMetric(x: number, z: number) {
  const nx = (x - POND.cx) / POND.a;
  const nz = (z - POND.cz) / POND.b;
  return Math.hypot(nx, nz) / pondRadiusFactor(Math.atan2(nz, nx));
}
const pondPoint = (theta: number, scale: number): [number, number] => {
  const r = pondRadiusFactor(theta) * scale;
  return [POND.cx + POND.a * Math.cos(theta) * r, POND.cz + POND.b * Math.sin(theta) * r];
};

const CREEK_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1.0, 0, -1.72), new THREE.Vector3(-0.98, 0, -1.38), new THREE.Vector3(-0.68, 0, -1.08),
  new THREE.Vector3(-0.46, 0, -0.8), new THREE.Vector3(-0.28, 0, -0.5),
]);
const CREEK_POINTS = CREEK_CURVE.getSpacedPoints(60);
const creekBedY = (t: number) => 0.225 - 0.05 * t;

function creekNearest(x: number, z: number) {
  let best = Infinity;
  let index = 0;
  for (let i = 0; i < CREEK_POINTS.length; i += 1) {
    const dx = CREEK_POINTS[i].x - x;
    const dz = CREEK_POINTS[i].z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; index = i; }
  }
  return { dist: Math.sqrt(best), t: index / (CREEK_POINTS.length - 1) };
}

export function terrainHeight(x: number, z: number) {
  const base = GROUND_Y + 0.02 * Math.sin(1.9 * x + 0.4) * Math.cos(1.5 * z) + 0.07 * smooth(1.5, 2.3, Math.hypot(x, z * 1.1));
  const d = pondMetric(x, z);
  const bedMin = -0.44 + 0.1 * ((z - POND.cz) / POND.b);
  const s = smooth(0.12, 1.32, d);
  let h = bedMin + (base - bedMin) * Math.pow(s, 1.3);
  const creek = creekNearest(x, z);
  if (creek.dist < 0.5) {
    const blend = 1 - smooth(0.1, 0.34, creek.dist);
    const bed = creekBedY(creek.t);
    if (h > bed) h -= blend * (h - bed);
  }
  return h;
}

const COLOURS = {
  grass: new THREE.Color('#7ec26a'), grassLight: new THREE.Color('#97d37c'), bankMud: new THREE.Color('#b19b6d'),
  sand: new THREE.Color('#c8b185'), deep: new THREE.Color('#8d7a5c'), topsoil: new THREE.Color('#7b5b3d'),
  clay: new THREE.Color('#a9805a'), rock: new THREE.Color('#8a97a5'), grassLip: new THREE.Color('#6aa855'),
};

function terrainColour(x: number, z: number, h: number, colour: THREE.Color) {
  const noise = 0.5 + 0.5 * Math.sin(x * 7.3 + z * 5.1) * Math.cos(z * 6.7 - x * 2.9);
  if (h > WATER_Y + 0.07) colour.copy(COLOURS.grass).lerp(COLOURS.grassLight, noise * 0.6 + 0.1 * Math.sin(x * 2.1));
  else if (h > WATER_Y - 0.02) colour.copy(COLOURS.bankMud).lerp(COLOURS.grass, smooth(WATER_Y + 0.0, WATER_Y + 0.07, h) * 0.8);
  else colour.copy(COLOURS.sand).lerp(COLOURS.deep, clamp((WATER_Y - h) / 0.62, 0, 1)).multiplyScalar(0.94 + noise * 0.1);
  return colour;
}

function buildTerrain() {
  const segX = 128, segZ = 112;
  const geometry = new THREE.PlaneGeometry(SLAB.width, SLAB.depth, segX, segZ);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = terrainHeight(x, z);
    position.setY(i, h);
    terrainColour(x, z, h, colour);
    colours[i * 3] = colour.r; colours[i * 3 + 1] = colour.g; colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Vertical cut-away skirt with soil strata, so the pond reads as a solid diorama block. */
function buildSkirt() {
  const positions: number[] = [];
  const colours: number[] = [];
  const bands: { colour: THREE.Color; drop: (h: number) => number; bottom: (h: number) => number }[] = [
    { colour: COLOURS.grassLip, drop: (h) => h, bottom: (h) => h - 0.05 },
    { colour: COLOURS.topsoil, drop: (h) => h - 0.05, bottom: () => 0.12 },
    { colour: COLOURS.clay, drop: () => 0.12, bottom: () => -0.34 },
    { colour: COLOURS.rock, drop: () => -0.34, bottom: () => -0.95 },
  ];
  const edges: { from: Vec3; to: Vec3 }[] = [
    { from: [-SLAB.width / 2, 0, SLAB.depth / 2], to: [SLAB.width / 2, 0, SLAB.depth / 2] },
    { from: [SLAB.width / 2, 0, SLAB.depth / 2], to: [SLAB.width / 2, 0, -SLAB.depth / 2] },
    { from: [SLAB.width / 2, 0, -SLAB.depth / 2], to: [-SLAB.width / 2, 0, -SLAB.depth / 2] },
    { from: [-SLAB.width / 2, 0, -SLAB.depth / 2], to: [-SLAB.width / 2, 0, SLAB.depth / 2] },
  ];
  const steps = 48;
  for (const edge of edges) {
    for (let i = 0; i < steps; i += 1) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const x0 = edge.from[0] + (edge.to[0] - edge.from[0]) * t0, z0 = edge.from[2] + (edge.to[2] - edge.from[2]) * t0;
      const x1 = edge.from[0] + (edge.to[0] - edge.from[0]) * t1, z1 = edge.from[2] + (edge.to[2] - edge.from[2]) * t1;
      const h0 = terrainHeight(x0, z0), h1 = terrainHeight(x1, z1);
      for (const band of bands) {
        const a = [x0, band.drop(h0), z0], b = [x1, band.drop(h1), z1], c = [x1, band.bottom(h1), z1], d = [x0, band.bottom(h0), z0];
        positions.push(...a, ...b, ...c, ...a, ...c, ...d);
        for (let k = 0; k < 6; k += 1) colours.push(band.colour.r, band.colour.g, band.colour.b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function pondShape(scale: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 72; i += 1) {
    const [x, z] = pondPoint((i / 72) * Math.PI * 2, scale);
    if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
  }
  return shape;
}

function buildCreekRibbon() {
  const positions: number[] = [];
  const indices: number[] = [];
  const count = CREEK_POINTS.length;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const p = CREEK_POINTS[i];
    const next = CREEK_POINTS[Math.min(count - 1, i + 1)];
    const prev = CREEK_POINTS[Math.max(0, i - 1)];
    const tangent = next.clone().sub(prev).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const width = 0.095 + 0.07 * t;
    const y = creekBedY(t) + 0.032;
    positions.push(p.x + normal.x * width, y, p.z + normal.z * width, p.x - normal.x * width, y, p.z - normal.z * width);
    if (i < count - 1) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Rock({ position, scale, seed }: { position: Vec3; scale: number; seed: number }) {
  return <mesh position={[...position]} rotation={[seed, seed * 2, 0]} scale={[scale * (0.9 + hash(seed, 1) * 0.5), scale * (0.55 + hash(seed, 2) * 0.3), scale * (0.8 + hash(seed, 3) * 0.4)]}>
    <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={seed % 2 ? '#a3adb7' : '#8d99a6'} roughness={0.95} flatShading />
  </mesh>;
}

function ReedClump({ position, seed }: { position: Vec3; seed: number }) {
  return <group position={[...position]}>
    {Array.from({ length: 6 }, (_, i) => {
      const height = 0.38 + hash(seed + i, 4) * 0.34;
      const lean = (hash(seed + i, 5) - 0.5) * 0.32;
      const angle = hash(seed + i, 6) * Math.PI * 2;
      return <group key={i} position={[Math.cos(angle) * 0.05, 0, Math.sin(angle) * 0.05]} rotation={[lean, 0, (hash(seed + i, 7) - 0.5) * 0.3]}>
        <mesh position={[0, height / 2, 0]}><cylinderGeometry args={[0.004, 0.011, height, 6]} /><meshStandardMaterial color={i % 2 ? '#6aa556' : '#7dba63'} roughness={0.7} /></mesh>
        {i % 3 === 0 && <mesh position={[0, height * 0.94, 0]}><capsuleGeometry args={[0.017, 0.07, 4, 8]} /><meshStandardMaterial color="#7a5638" roughness={0.8} /></mesh>}
      </group>;
    })}
  </group>;
}

function Tree({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return <group position={[...position]} scale={scale}>
    <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.04, 0.06, 0.4, 8]} /><meshStandardMaterial color="#8a6a4a" roughness={0.9} /></mesh>
    <mesh position={[0, 0.55, 0]}><icosahedronGeometry args={[0.25, 1]} /><meshStandardMaterial color="#58aa5e" roughness={0.85} flatShading /></mesh>
    <mesh position={[0.1, 0.78, 0.04]}><icosahedronGeometry args={[0.18, 1]} /><meshStandardMaterial color="#6cbd6c" roughness={0.85} flatShading /></mesh>
    <mesh position={[-0.12, 0.7, -0.05]}><icosahedronGeometry args={[0.15, 1]} /><meshStandardMaterial color="#4f9f58" roughness={0.85} flatShading /></mesh>
  </group>;
}

function Bush({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return <group position={[...position]} scale={scale}>
    <mesh position={[0, 0.07, 0]}><icosahedronGeometry args={[0.13, 1]} /><meshStandardMaterial color="#5fb361" roughness={0.9} flatShading /></mesh>
    <mesh position={[0.1, 0.05, 0.04]}><icosahedronGeometry args={[0.09, 1]} /><meshStandardMaterial color="#76c46f" roughness={0.9} flatShading /></mesh>
  </group>;
}

/** Culvert outfall plus the small creek that carries stormwater into the pond. */
function Inflow() {
  const ribbon = useMemo(buildCreekRibbon, []);
  const foam = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    foam.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = (clock.elapsedTime * 0.11 + i / 7) % 1;
      const p = CREEK_CURVE.getPointAt(Math.min(0.999, t));
      mesh.position.set(p.x, creekBedY(t) + 0.04, p.z);
      const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI);
      mesh.scale.set(0.05 * pulse, 0.012 * pulse, 0.03 * pulse);
    });
  });
  return <group>
    <mesh geometry={ribbon}><meshPhysicalMaterial color="#58bfdc" transparent opacity={0.86} roughness={0.08} clearcoat={1} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} /></mesh>
    {Array.from({ length: 7 }, (_, i) => <mesh key={i} ref={(el) => { foam.current[i] = el; }} scale={[0.05, 0.012, 0.03]}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#effcff" transparent opacity={0.8} /></mesh>)}
    <group position={[-1.0, GROUND_Y, -1.6]}>
      <mesh position={[0, 0.16, 0.0]}><boxGeometry args={[0.7, 0.34, 0.26]} /><meshStandardMaterial color="#cfd8df" roughness={0.85} /></mesh>
      <mesh position={[0, 0.24, 0.14]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.14, 0.14, 0.12, 28]} /><meshStandardMaterial color="#b8c4ce" roughness={0.8} /></mesh>
      <mesh position={[0, 0.24, 0.2]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.105, 28]} /><meshBasicMaterial color="#1f3a4c" /></mesh>
      <mesh position={[0, 0.2, 0.215]}><boxGeometry args={[0.5, 0.012, 0.01]} /><meshBasicMaterial color="#58bfdc" /></mesh>
      <mesh position={[0.3, 0.355, 0]}><boxGeometry args={[0.1, 0.03, 0.26]} /><meshStandardMaterial color="#e36d62" roughness={0.5} /></mesh>
    </group>
    <Rock position={[-1.22, terrainHeight(-1.22, -1.2) + 0.03, -1.2]} scale={0.1} seed={3} />
    <Rock position={[-0.72, terrainHeight(-0.72, -0.78) + 0.02, -0.78]} scale={0.08} seed={7} />
    <Rock position={[-0.82, terrainHeight(-0.82, -1.3) + 0.03, -1.3]} scale={0.09} seed={11} />
  </group>;
}

function Shoreline() {
  const reeds = useMemo(() => {
    const result: { position: Vec3; seed: number }[] = [];
    [0.2, 0.55, 0.9, 1.5, 2.1, 2.55, 3.1, 3.55, 4.2, 4.7, 5.3, 5.8].forEach((theta, i) => {
      const [x, z] = pondPoint(theta, 1.03 + (i % 3) * 0.05);
      if (creekNearest(x, z).dist < 0.4) return;
      result.push({ position: [x, terrainHeight(x, z) - 0.01, z], seed: i * 3 });
    });
    return result;
  }, []);
  const rocks = useMemo(() => [0.45, 1.2, 1.95, 2.8, 3.3, 3.95, 4.55, 5.05, 5.55].map((theta, i) => {
    const [x, z] = pondPoint(theta, 1.17 + (i % 2) * 0.1);
    return { position: [x, terrainHeight(x, z) + 0.02, z] as Vec3, scale: 0.06 + hash(i, 9) * 0.07, seed: i + 1 };
  }), []);
  return <group>
    {reeds.map((reed) => <ReedClump key={reed.seed} position={reed.position} seed={reed.seed} />)}
    {rocks.map((rock) => <Rock key={rock.seed} position={rock.position} scale={rock.scale} seed={rock.seed} />)}
    <Tree position={[1.4, terrainHeight(1.4, -1.1), -1.1]} scale={1.15} />
    <Bush position={[1.55, terrainHeight(1.55, 0.95), 0.95]} scale={1.3} />
    <Bush position={[-1.55, terrainHeight(-1.55, 1.15), 1.15]} scale={1.1} />
    <Bush position={[0.4, terrainHeight(0.4, -1.45), -1.45]} scale={0.9} />
  </group>;
}

/* ------------------------------------------------------------------ */
/* Pollutants: each sits in its own part of the water body              */
/* ------------------------------------------------------------------ */

function OilFilm({ massG, waterY }: { massG: number; waterY: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      const r = 1 + 0.16 * Math.sin(a * 3 + 1) + 0.09 * Math.sin(a * 5 + 2.2) + 0.06 * Math.sin(a * 2);
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.78); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.78);
    }
    return new THREE.ShapeGeometry(shape, 6);
  }, []);
  if (massG <= 0) return null;
  const scale = clamp(0.24 + Math.sqrt(massG) * 0.1, 0.24, 0.7);
  return <mesh geometry={geometry} position={[POND.cx - 0.18, waterY + 0.006, POND.cz - 0.1]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[scale, scale, 1]} renderOrder={3}>
    <meshPhysicalMaterial color={OIL_COLOUR} transparent opacity={0.82} roughness={0.12} metalness={0.15} clearcoat={1} iridescence={1} iridescenceIOR={1.6} side={THREE.DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
  </mesh>;
}

function FloatingLitter({ index, massG, waterY }: { index: number; massG: number; waterY: number }) {
  const ref = useRef<THREE.Group>(null);
  const angle = index * 2.399 + 0.5;
  const radius = 0.2 + hash(index, 3) * 0.55;
  const [x, z] = pondPoint(angle, radius);
  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const t = clock.elapsedTime;
    group.position.y = waterY + 0.016 + Math.sin(t * 1.3 + index) * 0.006;
    group.rotation.x = Math.sin(t * 0.9 + index * 2) * 0.06;
    group.rotation.y = index * 0.8 + Math.sin(t * 0.2 + index) * 0.3;
    group.position.x = x + Math.sin(t * 0.15 + index * 3) * 0.03;
  });
  return <group ref={ref} position={[x, waterY + 0.016, z]}><group scale={1.5}><LitterPiece kind={index + (massG > 6 ? 1 : 0)} /></group></group>;
}

function SuspendedSediment({ count, waterY }: { count: number; waterY: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const seeds = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const [x, z] = pondPoint(i * 2.399, 0.15 + hash(i, 1) * 0.6);
    const bed = terrainHeight(x, z);
    return { x, z, low: bed + 0.07, high: 0, phase: hash(i, 2) * 6.28, size: 0.032 + hash(i, 3) * 0.022, spin: hash(i, 4) * 3 };
  }), []);
  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const helper = new THREE.Object3D();
    const t = clock.elapsedTime;
    seeds.forEach((seed, i) => {
      const lift = 0.5 + 0.5 * Math.sin(t * 0.35 + seed.phase);
      const high = Math.max(seed.low + 0.02, waterY - 0.05);
      helper.position.set(seed.x + Math.sin(t * 0.3 + seed.phase) * 0.03, seed.low + (high - seed.low) * (0.25 + 0.75 * lift), seed.z + Math.cos(t * 0.27 + seed.phase) * 0.03);
      helper.rotation.set(t * seed.spin, t * 0.4, 0);
      helper.scale.setScalar(i < count ? seed.size : 0);
      helper.updateMatrix();
      instanced.setMatrixAt(i, helper.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, undefined, 28]} frustumCulled={false}><meshStandardMaterial color="#a67f58" roughness={0.9} flatShading /></instancedMesh>;
}

/** Sediment that has settled out and now lies on the sloping bed. */
function BedDeposit({ settledG }: { settledG: number }) {
  const thickness = Math.round(Math.min(0.16, Math.sqrt(settledG) * 0.032) * 200) / 200;
  const geometry = useMemo(() => {
    if (thickness <= 0) return null;
    const g = new THREE.PlaneGeometry(2.8, 2.3, 84, 68);
    g.rotateX(-Math.PI / 2);
    g.translate(POND.cx, 0, POND.cz);
    const pos = g.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    const base = new THREE.Color();
    const silt = new THREE.Color('#6f4f33');
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = pondMetric(x, z);
      const bed = terrainHeight(x, z);
      const lump = 0.75 + 0.25 * Math.sin(x * 9 + z * 7);
      const cover = smooth(0.9, 0.5, d);
      pos.setY(i, d < 1.02 ? bed + 0.004 + thickness * cover * lump : bed - 0.1);
      terrainColour(x, z, bed, base);
      base.lerp(silt, smooth(0, 0.35, cover));
      colours[i * 3] = base.r; colours[i * 3 + 1] = base.g; colours[i * 3 + 2] = base.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.computeVertexNormals();
    return g;
  }, [thickness]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={0.95} /></mesh>;
}

function SaltIons({ pairs, waterY }: { pairs: number; waterY: number }) {
  const group = useRef<THREE.Group>(null);
  const items = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const [x, z] = pondPoint(i * 2.399 + 1, 0.15 + hash(i, 6) * 0.65);
    const bed = terrainHeight(x, z);
    return { x, z, y: bed + 0.1 + hash(i, 7) * Math.max(0.08, waterY - bed - 0.2), phase: hash(i, 8) * 6.28 };
  }), [waterY]);
  useFrame(({ clock }) => {
    group.current?.children.forEach((child, i) => {
      const item = items[Math.floor(i / 2)];
      const t = clock.elapsedTime + item.phase;
      child.position.set(item.x + Math.sin(t * 0.8) * 0.03 + (i % 2) * 0.095, item.y + Math.sin(t * 1.1) * 0.02, item.z + Math.cos(t * 0.7) * 0.03);
    });
  });
  return <group ref={group}>
    {items.slice(0, pairs).flatMap((item, i) => [
      <mesh key={`na-${i}`} position={[item.x, item.y, item.z]}><sphereGeometry args={[0.052, 16, 12]} /><meshPhysicalMaterial color={ATOM_COLOURS.sodium} roughness={0.2} clearcoat={0.7} emissive={ATOM_COLOURS.sodium} emissiveIntensity={0.25} /></mesh>,
      <mesh key={`cl-${i}`} position={[item.x + 0.095, item.y, item.z]}><sphereGeometry args={[0.07, 16, 12]} /><meshPhysicalMaterial color={ATOM_COLOURS.chloride} roughness={0.2} clearcoat={0.7} emissive={ATOM_COLOURS.chloride} emissiveIntensity={0.25} /></mesh>,
    ])}
  </group>;
}

function WaterBody({ state, particleView, waterY }: { state: PollutionState; particleView: boolean; waterY: number }) {
  const surface = useMemo(() => new THREE.ShapeGeometry(pondShape(1.08), 24), []);
  useEffect(() => () => surface.dispose(), [surface]);
  const suspended = state.pollutants.sediment.suspendedG;
  const turbidity = clamp(suspended * 0.009, 0, 0.16);
  const waterColour = useMemo(() => new THREE.Color(WATER_COLOUR).lerp(new THREE.Color('#b8925f'), clamp(suspended / 40, 0, 0.6)), [suspended]);
  return <group>
    <mesh geometry={surface} position={[0, waterY, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <meshPhysicalMaterial color={waterColour} transparent opacity={particleView ? 0.26 : 0.58} roughness={0.06} metalness={0.02} clearcoat={1} depthWrite={false} />
    </mesh>
    {turbidity > 0.002 && [0, 1, 2, 3, 4].map((i) => waterY - 0.06 - i * 0.13).map((y) => (
      <mesh key={y} geometry={surface} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <meshBasicMaterial color="#b08a56" transparent opacity={turbidity} depthWrite={false} />
      </mesh>
    ))}
  </group>;
}

/** Moves the HTML label chips (rendered by the lab) onto their 3D anchors every frame. */
function TagProjector({ overlay, anchors }: { overlay: React.RefObject<HTMLDivElement | null>; anchors: readonly { id: string; position: Vec3; below?: boolean }[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const vector = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const root = overlay.current;
    if (!root) return;
    for (const anchor of anchors) {
      const element = root.querySelector<HTMLElement>(`[data-tag="${anchor.id}"]`);
      if (!element) continue;
      vector.set(...anchor.position).project(camera);
      const visible = vector.z < 1;
      const half = element.offsetWidth / 2 + 4;
      const x = clamp((vector.x * 0.5 + 0.5) * size.width, half, Math.max(half, size.width - half));
      const rawY = (-vector.y * 0.5 + 0.5) * size.height;
      const y = anchor.below ? clamp(rawY, 0, size.height - element.offsetHeight - 4) : clamp(rawY, element.offsetHeight + 4, size.height);
      element.style.opacity = visible ? '1' : '0';
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${anchor.below ? '0%' : '-100%'})`;
    }
  });
  return null;
}


type Layout = { pond: Vec3; bench: Vec3; benchRotation: number };
const SIDE_LAYOUT: Layout = { pond: [-2.1, 0, 0], bench: [2.0, GROUND_Y, 0], benchRotation: 0 };
const STACKED_LAYOUT: Layout = { pond: [0, 0, 1.95], bench: [0, GROUND_Y, -2.15], benchRotation: 0 };

function SceneCamera({ stacked, revision }: { stacked: boolean; revision: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const tangent = Math.tan((camera.fov * Math.PI) / 360);
    const spanWidth = stacked ? 4.4 : 8.3;
    const spanHeight = stacked ? 7.4 : 4.6;
    const distance = Math.max(spanWidth / (2 * tangent * aspect), spanHeight / (2 * tangent));
    const direction = stacked ? new THREE.Vector3(0.12, 0.78, 0.62) : new THREE.Vector3(0.08, 0.78, 1);
    const target = stacked ? new THREE.Vector3(0, 0.3, -0.1) : new THREE.Vector3(-0.1, 0.38, 0.05);
    camera.position.copy(target).addScaledVector(direction.normalize(), distance);
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [camera, size.width, size.height, stacked, revision]);
  return <OrbitControls ref={controls as never} makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={4} maxDistance={32} maxPolarAngle={Math.PI * 0.46} />;
}

export function PollutionWorld({ state, particleView, viewRevision, overlay }: { state: PollutionState; particleView: boolean; viewRevision: number; overlay: React.RefObject<HTMLDivElement | null> }) {
  const { gl, size } = useThree();
  const stacked = size.width / Math.max(1, size.height) < 1.35;
  const layout = stacked ? STACKED_LAYOUT : SIDE_LAYOUT;
  const terrain = useMemo(buildTerrain, []);
  const skirt = useMemo(buildSkirt, []);
  useEffect(() => () => { terrain.dispose(); skirt.dispose(); }, [terrain, skirt]);
  const description = describePollutionScene(state, particleView);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', description);
    return () => { canvas.removeAttribute('role'); canvas.removeAttribute('aria-label'); };
  }, [gl, description]);

  const outputs = pollutionOutputs(state);
  const body = outputs.body;
  // The pond level follows the conserved water volume (skimming and filtering take a little; decanting and distilling take most).
  const waterY = -0.52 + (WATER_Y + 0.52) * clamp(state.waterBodyMl / state.waterInputMl, 0, 1);
  const sedimentCount = Math.min(28, Math.ceil(body.suspendedSedimentG / 1.4));
  const litterCount = Math.min(10, Math.ceil(body.floatingLitterG / 1.2));
  const ionPairs = particleView ? Math.min(14, Math.ceil(body.dissolvedSaltG / 1.5)) : 0;
  const bench = layout.bench;
  const anchors = useMemo(() => {
    const at = (group: Vec3, x: number, y: number, z: number): Vec3 => [group[0] + x, group[1] + y, group[2] + z];
    const compact = layout === STACKED_LAYOUT;
    return [
      { id: 'body', position: compact ? at(layout.pond, 0.1, 0.5, 1.2) : at(layout.pond, -1.15, 0.62, 0.95) },
      { id: 'rig', position: at(layout.bench, 0.55, compact ? 1.0 : 1.75, compact ? -0.2 : -0.9) },
      { id: 'water', position: at(layout.bench, -1.1, compact ? 1.7 : -0.02, compact ? 0.78 : 1.3), below: !compact },
      { id: 'material', position: at(layout.bench, 0.05, compact ? 0.5 : -0.02, compact ? 0.78 : 1.3), below: !compact },
      { id: 'waste', position: at(layout.bench, 1.15, compact ? 1.12 : -0.02, compact ? 0.78 : 1.3), below: !compact },
    ] as const;
  }, [layout]);

  return <>
    <color attach="background" args={['#eaf5ff']} />
    <StudioLights />
    <SceneCamera stacked={stacked} revision={viewRevision} />
    <TagProjector overlay={overlay} anchors={anchors} />
    <group position={[...layout.pond]}>
      <mesh geometry={terrain}><meshStandardMaterial vertexColors roughness={0.92} /></mesh>
      <mesh geometry={skirt}><meshStandardMaterial vertexColors roughness={0.95} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -1.0, 0]}><boxGeometry args={[SLAB.width + 0.16, 0.1, SLAB.depth + 0.16]} /><meshStandardMaterial color="#d7e5f1" roughness={0.5} /></mesh>
      <mesh position={[0, -1.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.9, 48]} /><meshBasicMaterial color="#8fb0cb" transparent opacity={0.1} depthWrite={false} /></mesh>
      <Inflow />
      <Shoreline />
      <BedDeposit settledG={body.settledSedimentG} />
      <WaterBody state={state} particleView={particleView} waterY={waterY} />
      <OilFilm massG={body.surfaceOilG} waterY={waterY} />
      {Array.from({ length: litterCount }, (_, i) => <FloatingLitter key={i} index={i} massG={body.floatingLitterG} waterY={waterY} />)}
      <SuspendedSediment count={sedimentCount} waterY={waterY} />
      {ionPairs > 0 && <SaltIons pairs={ionPairs} waterY={waterY} />}
    </group>

    <group position={[...bench]}>
      <TreatmentBench />
      <FeedPump />
      <TreatmentRig method={state.selectedMethod} state={state} />
      <RecoveredWaterBeaker state={state} />
      <RecoveredMaterialJar state={state} />
      <WasteBin state={state} />
    </group>
    <ApparatusTube
      points={stacked
        ? [[layout.pond[0] + 1.0, 0.1, layout.pond[2] - 0.5], [layout.pond[0] + 1.1, 0.55, layout.pond[2] - 1.7], [bench[0] - 1.2, 0.85, bench[2] + 1.9], [bench[0] - 1.32, bench[1] + 0.2, bench[2] - 0.9]]
        : [[layout.pond[0] + 0.85, 0.12, layout.pond[2] + 0.1], [layout.pond[0] + 1.5, 0.9, layout.pond[2] - 0.2], [bench[0] - 2.0, 1.0, bench[2] - 0.7], [bench[0] - 1.38, bench[1] + 0.33, bench[2] - 0.9]]}
      radius={0.04}
      colour="#4f6f89"
      glass={false}
    />
  </>;
}
