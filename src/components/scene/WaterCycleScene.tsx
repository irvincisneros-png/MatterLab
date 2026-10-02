import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MoleculeSet, type MoleculePlacement } from './WaterParticles';
import { SceneLabel } from './WaterLabels';
import type { WaterCycleState } from '../../science/waterTopicEngine';

type Vec3 = readonly [number, number, number];
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ terrain model */
export const TERRAIN = { x0: -5.8, x1: 5.8, z0: -2.0, z1: 2.0, base: -1.5 } as const;

/** River centre line (x, z) from the glacier foot to the ocean. */
const RIVER_POINTS: readonly (readonly [number, number])[] = [[-2.8, 0.7], [-2.35, 1.0], [-1.75, 0.85], [-1.1, 0.5], [-0.45, 0.62], [0.2, 1.0], [0.85, 0.95], [1.55, 0.82], [2.0, 0.8]];
const RIVER_SAMPLES: readonly (readonly [number, number])[] = (() => {
  const curve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
  return curve.getPoints(90).map((point) => [point.x, point.z] as const);
})();
function riverDistance(x: number, z: number) {
  let best = Infinity;
  for (const [rx, rz] of RIVER_SAMPLES) { const d = (x - rx) * (x - rx) + (z - rz) * (z - rz); if (d < best) best = d; }
  return Math.sqrt(best);
}

/** Smooth height field: a plain falling to a beach and ocean basin, a snow-capped peak with two lower hills. */
export function terrainHeight(x: number, z: number): number {
  const plain = 0.16 + 0.34 * (1 - smooth(-2.2, 1.0, x));
  const peak = 1.9 * Math.exp(-(((x + 3.5) ** 2) / 1.5 + ((z + 0.15) ** 2) / 1.9));
  const shoulder = 1.05 * Math.exp(-(((x + 5.0) ** 2) / 1.1 + ((z - 0.9) ** 2) / 1.3));
  const ridge = 0.8 * Math.exp(-(((x + 2.0) ** 2) / 1.3 + ((z + 1.2) ** 2) / 1.1));
  const hill = 0.32 * Math.exp(-(((x + 0.3) ** 2) / 0.8 + ((z + 1.1) ** 2) / 0.9));
  const coast = -0.85 * smooth(0.95, 3.0, x);
  const rolling = 0.04 * Math.sin(1.9 * x + 0.7 * z) * Math.sin(1.4 * z - 0.5 * x) * (1 - smooth(0.3, 1.4, x));
  const channel = 0.1 * Math.exp(-((riverDistance(x, z) / 0.17) ** 2));
  return plain + peak + shoulder + ridge + hill + coast + rolling - channel;
}

const COLOURS = {
  seabedDeep: new THREE.Color('#7fa7a4'), seabedShallow: new THREE.Color('#d6c995'), sand: new THREE.Color('#ecdca8'),
  grassLow: new THREE.Color('#86c46f'), grassHigh: new THREE.Color('#5ba05d'), rockLow: new THREE.Color('#767a80'), rockHigh: new THREE.Color('#948e88'), snow: new THREE.Color('#ffffff'),
};

/** Elevation at which snow starts: lower when more water is stored as snow and glacier ice. */
export const snowLineFor = (glacier: number) => 2.15 - glacier * 0.8;

function terrainColour(x: number, z: number, h: number, slope: number, snowLine: number, out: THREE.Color) {
  const noise = 0.5 + 0.5 * Math.sin(x * 5.3 + z * 3.1) * Math.sin(z * 4.7 - x * 2.3);
  if (h < 0.02) out.copy(COLOURS.seabedDeep).lerp(COLOURS.seabedShallow, smooth(-0.9, 0.0, h));
  else if (h < 0.22) out.copy(COLOURS.sand).lerp(COLOURS.grassLow, smooth(0.08, 0.22, h));
  else out.copy(COLOURS.grassLow).lerp(COLOURS.grassHigh, smooth(0.2, 0.9, h) * 0.7 + noise * 0.3);
  const rock = Math.max(smooth(0.95, 1.5, h), smooth(0.55, 0.95, slope) * smooth(0.45, 0.9, h));
  out.lerp(COLOURS.rockLow.clone().lerp(COLOURS.rockHigh, noise), rock);
  const snow = smooth(snowLine - 0.1, snowLine + 0.18, h + noise * 0.12) * (1 - smooth(0.9, 1.5, slope) * 0.5);
  out.lerp(COLOURS.snow, snow);
}

function useTerrainGeometry(glacier: number) {
  return useMemo(() => {
    const widthSegments = 116, depthSegments = 40;
    const geometry = new THREE.PlaneGeometry(TERRAIN.x1 - TERRAIN.x0, TERRAIN.z1 - TERRAIN.z0, widthSegments, depthSegments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal;
    const colours = new Float32Array(positions.count * 3);
    const colour = new THREE.Color();
    const snowLine = snowLineFor(glacier);
    for (let i = 0; i < positions.count; i += 1) {
      terrainColour(positions.getX(i), positions.getZ(i), positions.getY(i), 1 - normals.getY(i), snowLine, colour);
      colours.set([colour.r, colour.g, colour.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return geometry;
  }, [glacier]);
}

/** Cutaway walls on all four sides: topsoil, subsoil, groundwater-saturated rock (blue) and bedrock, plus the ocean water column. */
function useCutawayGeometry(groundwater: number, seaLevel: number) {
  return useMemo(() => {
    const solid: { positions: number[]; colours: number[]; normals: number[] } = { positions: [], colours: [], normals: [] };
    const water: { positions: number[]; colours: number[]; normals: number[] } = { positions: [], colours: [], normals: [] };
    const thickness = (x: number) => (0.09 + 0.3 * clamp(groundwater / 0.2, 0, 1)) * smooth(-5.8, -4.9, x) * (1 - smooth(2.4, 4.4, x) * 0.35);
    const push = (target: typeof solid, points: readonly (readonly [number, number])[], normal: Vec3, tops: number[], bottoms: number[], cTop: THREE.Color, cBottom: THREE.Color) => {
      for (let i = 0; i < points.length - 1; i += 1) {
        const [ax, az] = points[i], [bx, bz] = points[i + 1];
        const quad = [[ax, tops[i], az, cTop], [ax, bottoms[i], az, cBottom], [bx, bottoms[i + 1], bz, cBottom], [bx, tops[i + 1], bz, cTop]] as const;
        for (const index of [0, 1, 2, 0, 2, 3]) {
          const [x, y, z, colour] = quad[index];
          target.positions.push(x, y, z); target.colours.push(colour.r, colour.g, colour.b); target.normals.push(...normal);
        }
      }
    };
    const sides: { points: (readonly [number, number])[]; normal: Vec3 }[] = [
      { points: Array.from({ length: 117 }, (_, i) => [lerp(TERRAIN.x0, TERRAIN.x1, i / 116), TERRAIN.z1] as const), normal: [0, 0, 1] },
      { points: Array.from({ length: 41 }, (_, i) => [TERRAIN.x1, lerp(TERRAIN.z1, TERRAIN.z0, i / 40)] as const), normal: [1, 0, 0] },
      { points: Array.from({ length: 117 }, (_, i) => [lerp(TERRAIN.x1, TERRAIN.x0, i / 116), TERRAIN.z0] as const), normal: [0, 0, -1] },
      { points: Array.from({ length: 41 }, (_, i) => [TERRAIN.x0, lerp(TERRAIN.z0, TERRAIN.z1, i / 40)] as const), normal: [-1, 0, 0] },
    ];
    const C = (hex: string) => new THREE.Color(hex);
    for (const { points, normal } of sides) {
      const surface = points.map(([x, z]) => terrainHeight(x, z));
      const aTop = surface.map((s) => Math.min(0.45 * s + 0.1 - 0.5, s - 0.4));
      const aBottom = aTop.map((top, i) => top - thickness(points[i][0]));
      const soilBottom = surface.map((s) => s - 0.12);
      const base = surface.map(() => TERRAIN.base);
      push(solid, points, normal, surface, soilBottom, C('#8a6a47'), C('#7a5b3d'));
      push(solid, points, normal, soilBottom, aTop, C('#b08c5f'), C('#9a7850'));
      push(solid, points, normal, aTop, aBottom, C('#74d0f0'), C('#3f93d4'));
      push(solid, points, normal, aBottom, base, C('#8795a2'), C('#5f6b78'));
      push(water, points, normal, surface.map(() => seaLevel), surface.map((s) => Math.min(s, seaLevel)), C('#2f9fd8'), C('#1b78bb'));
    }
    const build = (data: typeof solid) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colours, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      return geometry;
    };
    return { solid: build(solid), water: build(water) };
  }, [groundwater, seaLevel]);
}

/* ------------------------------------------------------------------ small hooks */
function useDispose(...geometries: (THREE.BufferGeometry | THREE.Material | THREE.Texture | undefined)[]) {
  useEffect(() => () => geometries.forEach((item) => item?.dispose()), geometries); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Accumulated animation seconds for decoration (waves, rain, drift); frozen when reduced motion is requested. */
function useAnimationClock(reducedMotion: boolean) {
  const time = useRef(0);
  useFrame((_, delta) => { if (!reducedMotion) time.current += Math.min(delta, 0.1); });
  return time;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------------ ocean */
function Ocean({ seaLevel, reducedMotion, particles }: { seaLevel: number; reducedMotion: boolean; particles: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(5.1, TERRAIN.z1 - TERRAIN.z0, 60, 32);
    plane.rotateX(-Math.PI / 2);
    return plane;
  }, []);
  useDispose(geometry);
  const clock = useAnimationClock(reducedMotion);
  const lastNormals = useRef(0);
  useFrame(() => {
    const target = mesh.current?.geometry; if (!target) return;
    const t = clock.current, positions = target.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i), z = positions.getZ(i);
      const edge = smooth(0, 0.45, x + 2.55 - 0.0) * 1; // calmer where the water meets the beach
      positions.setY(i, 0.022 * edge * (Math.sin(1.7 * x + 1.1 * t) + 0.7 * Math.sin(2.3 * z - 0.9 * t + 0.6 * x)));
    }
    positions.needsUpdate = true;
    if (t - lastNormals.current > 0.06 || lastNormals.current === 0) { target.computeVertexNormals(); lastNormals.current = t || 1e-3; }
  });
  return <mesh ref={mesh} geometry={geometry} position={[(0.7 + TERRAIN.x1) / 2, seaLevel, 0]}>
    <meshPhysicalMaterial color="#2793d1" transparent opacity={particles ? 0.5 : 0.78} roughness={0.14} metalness={0.05} clearcoat={0.9} clearcoatRoughness={0.2} />
  </mesh>;
}

/* ------------------------------------------------------------------ river */
function River({ surfaceKg, reducedMotion }: { surfaceKg: number; reducedMotion: boolean }) {
  const width = 0.05 + clamp(surfaceKg / 0.13, 0, 1) * 0.15;
  const ribbon = useMemo(() => {
    const samples = RIVER_SAMPLES;
    const heights: number[] = [];
    let running = Infinity;
    samples.forEach(([x, z]) => { running = Math.min(running, terrainHeight(x, z) + 0.045); heights.push(running); });
    const positions: number[] = [];
    const indices: number[] = [];
    samples.forEach(([x, z], i) => {
      const [nx, nz] = samples[Math.min(i + 1, samples.length - 1)], [px, pz] = samples[Math.max(i - 1, 0)];
      const tx = nx - px, tz = nz - pz, length = Math.hypot(tx, tz) || 1;
      const sx = -tz / length, sz = tx / length;
      const taper = 0.45 + 0.55 * smooth(0, 0.3, i / (samples.length - 1)) + 0.25 * smooth(0.6, 1, i / (samples.length - 1));
      positions.push(x + sx * width * taper, heights[i], z + sz * width * taper, x - sx * width * taper, heights[i], z - sz * width * taper);
      if (i < samples.length - 1) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return { geometry, heights };
  }, [width]);
  useDispose(ribbon.geometry);
  const glints = useRef<THREE.InstancedMesh>(null);
  const clock = useAnimationClock(reducedMotion);
  useFrame(() => {
    const mesh = glints.current; if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 7; i += 1) {
      const u = (((clock.current * 0.045 + i / 7) % 1) + 1) % 1;
      const index = Math.min(RIVER_SAMPLES.length - 1, Math.floor(u * (RIVER_SAMPLES.length - 1)));
      const [x, z] = RIVER_SAMPLES[index];
      dummy.position.set(x, ribbon.heights[index] + 0.012, z);
      dummy.scale.set(0.09, 0.012, 0.025);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <>
    <mesh geometry={ribbon.geometry}><meshPhysicalMaterial color="#35bcd6" roughness={0.12} clearcoat={0.9} transparent opacity={0.92} side={THREE.DoubleSide} /></mesh>
    <instancedMesh ref={glints} args={[undefined, undefined, 7]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#e6fbff" transparent opacity={0.8} /></instancedMesh>
  </>;
}

/* ------------------------------------------------------------------ glacier */
function GlacierTongue({ glacier }: { glacier: number }) {
  const geometry = useMemo(() => {
    if (glacier < 0.03) return null;
    const nx = 34, nz = 28, x0 = -4.5, x1 = -2.3, z0 = -0.8, z1 = 1.1;
    const radius = 0.5 + 0.5 * Math.sqrt(glacier);
    const grid: { p: THREE.Vector3; mask: number }[] = [];
    for (let j = 0; j <= nz; j += 1) for (let i = 0; i <= nx; i += 1) {
      const x = lerp(x0, x1, i / nx), z = lerp(z0, z1, j / nz);
      const h = terrainHeight(x, z);
      const dx = x + 3.2, dz = z - 0.45;
      const along = dx * 0.87 + dz * 0.5, across = -dx * 0.5 + dz * 0.87;
      const d = Math.hypot(along / (0.78 * radius), across / (0.2 + 0.18 * radius));
      const mask = (1 - d) * smooth(0.95, 1.35, h);
      grid.push({ p: new THREE.Vector3(x, h + 0.03 + 0.04 * mask, z), mask });
    }
    const indices: number[] = [];
    for (let j = 0; j < nz; j += 1) for (let i = 0; i < nx; i += 1) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      const ok = (...v: number[]) => v.every((index) => grid[index].mask > 0.04);
      if (ok(a, c, b)) indices.push(a, c, b);
      if (ok(b, c, d)) indices.push(b, c, d);
    }
    if (!indices.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(grid.flatMap(({ p }) => [p.x, p.y, p.z]), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [glacier]);
  useDispose(geometry ?? undefined);
  return geometry ? <mesh geometry={geometry}><meshPhysicalMaterial color="#a9dcf6" roughness={0.2} clearcoat={0.8} emissive="#5fb6e6" emissiveIntensity={0.18} /></mesh> : null;
}

/* ------------------------------------------------------------------ trees */
function makeTreeGeometry(kind: 'conifer' | 'round') {
  const bark = new THREE.Color('#7a5539'), leaf = new THREE.Color('#4d9a5a');
  const tint = (geometry: THREE.BufferGeometry, colour: THREE.Color) => {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count }, () => [colour.r, colour.g, colour.b]).flat(), 3));
    return geometry;
  };
  const trunk = tint(new THREE.CylinderGeometry(0.022, 0.03, 0.14, 6).translate(0, 0.07, 0), bark);
  const parts = kind === 'conifer'
    ? [trunk, tint(new THREE.ConeGeometry(0.14, 0.26, 7).translate(0, 0.25, 0), leaf), tint(new THREE.ConeGeometry(0.105, 0.22, 7).translate(0, 0.4, 0), leaf.clone().offsetHSL(0, 0, 0.04))]
    : [trunk, tint(new THREE.IcosahedronGeometry(0.15, 1).scale(1, 0.92, 1).translate(0, 0.27, 0), leaf.clone().offsetHSL(0.02, 0.02, 0.07))];
  const merged = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)), false)!;
  parts.forEach((part) => part.dispose());
  merged.computeVertexNormals();
  return merged;
}

function Forest() {
  const placements = useMemo(() => {
    const random = mulberry32(2024);
    const conifers: THREE.Matrix4[] = [], round: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    let guard = 0;
    while (conifers.length + round.length < 62 && guard < 4000) {
      guard += 1;
      const x = lerp(-5.5, 1.1, random()), z = lerp(-1.75, 1.7, random());
      const h = terrainHeight(x, z);
      if (h < 0.24 || h > 1.2 || riverDistance(x, z) < 0.26) continue;
      const slope = Math.hypot(terrainHeight(x + 0.1, z) - h, terrainHeight(x, z + 0.1) - h) / 0.1;
      if (slope > 0.9) continue;
      dummy.position.set(x, h - 0.01, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.75 + random() * 0.65);
      dummy.updateMatrix();
      (h > 0.55 || random() < 0.45 ? conifers : round).push(dummy.matrix.clone());
    }
    return { conifers, round };
  }, []);
  const coniferGeometry = useMemo(() => makeTreeGeometry('conifer'), []);
  const roundGeometry = useMemo(() => makeTreeGeometry('round'), []);
  useDispose(coniferGeometry, roundGeometry);
  const conifers = useRef<THREE.InstancedMesh>(null), round = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const colour = new THREE.Color();
    ([[conifers.current, placements.conifers], [round.current, placements.round]] as const).forEach(([mesh, matrices]) => {
      if (!mesh) return;
      matrices.forEach((matrix, index) => { mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, colour.setHSL(0, 0, 0.82 + ((index * 37) % 17) / 100)); });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [placements]);
  return <>
    <instancedMesh ref={conifers} args={[coniferGeometry, undefined, Math.max(1, placements.conifers.length)]} frustumCulled={false}><meshStandardMaterial vertexColors roughness={0.85} /></instancedMesh>
    <instancedMesh ref={round} args={[roundGeometry, undefined, Math.max(1, placements.round.length)]} frustumCulled={false}><meshStandardMaterial vertexColors roughness={0.85} /></instancedMesh>
  </>;
}

/* ------------------------------------------------------------------ sun, clouds, precipitation */
function Sun({ percent }: { percent: number }) {
  const glow = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d'); if (!context) return null;
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,236,160,1)'); gradient.addColorStop(0.3, 'rgba(255,214,110,0.55)'); gradient.addColorStop(1, 'rgba(255,200,90,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }, []);
  useDispose(glow ?? undefined);
  const scale = 0.85 + percent / 260;
  return <group position={[4.3, 3.15, -1.3]}>
    <mesh scale={scale}><sphereGeometry args={[0.46, 32, 20]} /><meshStandardMaterial color="#ffd15c" emissive="#ffb938" emissiveIntensity={1.4} toneMapped={false} /></mesh>
    {glow && <sprite scale={[1.9 * scale + percent / 110, 1.9 * scale + percent / 110, 1]}><spriteMaterial map={glow} transparent opacity={0.35 + percent / 190} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></sprite>}
  </group>;
}

function makeCloudGeometry() {
  const spheres: readonly [number, number, number, number][] = [[0, 0, 0, 0.56], [0.58, -0.06, 0.05, 0.42], [-0.6, -0.07, 0, 0.44], [0.22, 0.3, -0.04, 0.46], [-0.26, 0.24, 0.06, 0.38], [1.0, -0.14, 0, 0.3], [-1.02, -0.14, 0.05, 0.3], [0.36, 0.04, 0.3, 0.34], [-0.36, 0.0, 0.3, 0.32]];
  const parts = spheres.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 16, 12).translate(x, y, z));
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  merged.scale(1, 0.84, 0.85);
  return merged;
}

const CLOUD_BASE: Vec3 = [0.05, 2.95, 0.1];
function Clouds({ liquidKg, iceKg, raining, particles, reducedMotion }: { liquidKg: number; iceKg: number; raining: boolean; particles: boolean; reducedMotion: boolean }) {
  const geometry = useMemo(makeCloudGeometry, []);
  useDispose(geometry);
  const group = useRef<THREE.Group>(null);
  const clock = useAnimationClock(reducedMotion);
  useFrame(() => { if (group.current) group.current.position.x = CLOUD_BASE[0] + Math.sin(clock.current * 0.12) * 0.16; });
  const total = liquidKg + iceKg;
  if (total <= 0.001) return null;
  const scale = 0.8 + clamp(total / 0.16, 0, 1) * 0.5;
  const colour = iceKg > liquidKg ? '#e3f1ff' : raining ? '#d3dce7' : '#ffffff';
  return <group ref={group} position={CLOUD_BASE}>
    <mesh geometry={geometry} scale={scale}><meshStandardMaterial color={colour} emissive="#dfeeff" emissiveIntensity={particles ? 0.1 : 0.3} roughness={1} transparent={particles} opacity={particles ? 0.2 : 1} depthWrite={!particles} /></mesh>
    <mesh geometry={geometry} scale={scale * 0.5} position={[1.55 * scale, -0.18, -0.15]}><meshStandardMaterial color={colour} emissive="#dfeeff" emissiveIntensity={particles ? 0.1 : 0.3} roughness={1} transparent={particles} opacity={particles ? 0.2 : 1} depthWrite={!particles} /></mesh>
  </group>;
}

function Precipitation({ active, snow, amount, reducedMotion }: { active: boolean; snow: boolean; amount: number; reducedMotion: boolean }) {
  const drops = useMemo(() => {
    const random = mulberry32(77);
    return Array.from({ length: 70 }, () => {
      const x = lerp(-0.85, 0.85, random()), z = lerp(-0.4, 0.8, random());
      return { x, z, ground: terrainHeight(x, z) + 0.03, phase: random(), speed: 0.55 + random() * 0.4, sway: random() * 6 };
    });
  }, []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const clock = useAnimationClock(reducedMotion);
  const top = CLOUD_BASE[1] - 0.2;
  useFrame(() => {
    const instanced = mesh.current; if (!instanced) return;
    const dummy = new THREE.Object3D();
    const visible = active ? Math.round(24 + clamp(amount, 0, 1) * 46) : 0;
    instanced.count = visible;
    for (let i = 0; i < visible; i += 1) {
      const drop = drops[i];
      const fall = top - drop.ground;
      const rate = snow ? 0.22 : 1.1;
      const progress = (((clock.current * rate * drop.speed + drop.phase) % 1) + 1) % 1;
      dummy.position.set(drop.x + (snow ? Math.sin(clock.current * 0.9 + drop.sway) * 0.07 : 0), top - progress * fall, drop.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh key={snow ? 'snow' : 'rain'} ref={mesh} args={[undefined, undefined, 70]} frustumCulled={false}>
    {snow ? <icosahedronGeometry args={[0.05, 0]} /> : <cylinderGeometry args={[0.009, 0.009, 0.15, 5]} />}
    <meshStandardMaterial color={snow ? '#ffffff' : '#2b9fd0'} emissive={snow ? '#d8ecff' : '#0d6f95'} emissiveIntensity={0.4} roughness={0.3} />
  </instancedMesh>;
}

/* ------------------------------------------------------------------ particle view */
function halton(index: number, base: number) {
  let result = 0, fraction = 1 / base, i = index;
  while (i > 0) { result += fraction * (i % base); i = Math.floor(i / base); fraction /= base; }
  return result;
}

/** Drives light re-renders (about 16 Hz) for the sparse vapour drift only while the particle view is on. */
function useParticleTime(active: boolean, reducedMotion: boolean) {
  const [time, setTime] = useState(0);
  const clock = useAnimationClock(reducedMotion);
  const last = useRef(0);
  const { invalidate } = useThree();
  useFrame(() => {
    if (!active || reducedMotion) return;
    if (clock.current - last.current > 0.06) { last.current = clock.current; setTime(clock.current); invalidate(); }
  });
  return time;
}

function CycleParticles({ state, reducedMotion, zoom }: { state: WaterCycleState; reducedMotion: boolean; zoom: number }) {
  const pools = state.pools;
  const time = useParticleTime(true, reducedMotion);
  const total = pools.cloudLiquidKg + pools.cloudIceKg;
  const cloudScale = 0.8 + clamp(total / 0.16, 0, 1) * 0.5;
  const droplets = pools.cloudLiquidKg > 0.002 ? clamp(Math.round(pools.cloudLiquidKg * 90), 2, 14) : 0;
  const crystals = pools.cloudIceKg > 0.002 ? clamp(Math.ceil(pools.cloudIceKg * 120), 1, 8) : 0;
  const cloudCentre = new THREE.Vector3(CLOUD_BASE[0] + Math.sin(time * 0.12) * 0.16, CLOUD_BASE[1], CLOUD_BASE[2]);
  const inCloud = (index: number, count: number, spread: Vec3): THREE.Vector3 => new THREE.Vector3(
    cloudCentre.x + (halton(index + 1, 2) - 0.5) * spread[0] * cloudScale * 2,
    cloudCentre.y + (halton(index + 1, 3) - 0.35) * spread[1] * cloudScale * 2,
    cloudCentre.z + (halton(index + 1, 5) - 0.5) * spread[2] * cloudScale * 2 + count * 0,
  );
  const dropletCentres = Array.from({ length: droplets }, (_, i) => inCloud(i, droplets, [0.78, 0.26, 0.28]));
  const crystalCentres = Array.from({ length: crystals }, (_, i) => inCloud(i + 7, crystals, [0.78, 0.26, 0.28]));
  const dropletMolecules: MoleculePlacement[] = dropletCentres.flatMap((centre, d) => [[0.07, 0.04, 0.02], [-0.06, 0.06, -0.03], [0.0, -0.08, 0.04], [-0.05, -0.02, 0.07], [0.04, 0.0, -0.08]].map((offset, k) => ({
    position: [centre.x + offset[0], centre.y + offset[1], centre.z + offset[2]] as const, spin: d * 1.3 + k * 2.1 + time * 0.7,
  })));
  const hex = [[0, 0], ...Array.from({ length: 6 }, (_, k) => [Math.cos(k * Math.PI / 3), Math.sin(k * Math.PI / 3)])];
  const crystalMolecules: MoleculePlacement[] = crystalCentres.flatMap((centre, c) => hex.map(([hx, hz]) => ({
    position: [centre.x + hx * 0.13, centre.y, centre.z + hz * 0.13] as const, spin: 0.4 + (c % 3) * 0.1,
  })));
  const vapourCount = clamp(Math.round(6 + (pools.atmosphericVapourKg / 1) * 70), 6, 28);
  const vapour: MoleculePlacement[] = Array.from({ length: vapourCount }, (_, i) => {
    const bx = lerp(-4.9, 5.2, halton(i + 1, 2)), by = lerp(0.8, 3.7, halton(i + 1, 3)), bz = lerp(-1.6, 1.7, halton(i + 1, 5));
    const x = bx + Math.sin(time * 0.5 + i * 1.9) * 0.28, z = bz + Math.cos(time * 0.4 + i * 2.7) * 0.22;
    const y = Math.max(by + Math.sin(time * 0.6 + i * 3.1) * 0.2, terrainHeight(x, z) + 0.4);
    return { position: [x, y, z] as const, spin: time * 0.9 + i };
  });
  const crystalGeometry = useMemo(() => new THREE.CylinderGeometry(0.27, 0.27, 0.06, 6), []);
  useDispose(crystalGeometry);
  return <>
    <MoleculeSet items={dropletMolecules} scale={0.55} />
    {dropletCentres.map((centre, i) => <mesh key={`droplet-${i}`} position={centre}><sphereGeometry args={[0.17, 16, 12]} /><meshPhysicalMaterial color="#7fcdf2" transparent opacity={0.3} roughness={0.1} clearcoat={0.8} depthWrite={false} /></mesh>)}
    <MoleculeSet items={crystalMolecules} scale={0.42} />
    {crystalCentres.map((centre, i) => <mesh key={`crystal-${i}`} geometry={crystalGeometry} position={centre} rotation={[0, 0.3, 0]}><meshPhysicalMaterial color="#d4ecff" transparent opacity={0.35} roughness={0.2} clearcoat={0.6} depthWrite={false} /></mesh>)}
    <MoleculeSet items={vapour} scale={1.05} opacity={0.6} />
    {total > 0.001 && <SceneLabel position={[cloudCentre.x, cloudCentre.y + 0.55 * cloudScale, cloudCentre.z]} title="Cloud" subtitle="droplets + ice crystals" pointer="down" zoom={zoom} />}
    <SceneLabel position={[3.1, 2.05, 0.4]} title="Water vapour" subtitle="invisible gas, far apart" tone="vapour" pointer="down" zoom={zoom} />
  </>;
}

function SceneTags({ groundwaterY, zoom }: { groundwaterY: number; zoom: number }) {
  const compact = useThree((state) => state.size.width < 600);
  if (compact) return null;
  return <>
    <SceneLabel position={[-3.5, 2.95, 0.1]} title="Snow and glacier ice" tone="navy" pointer="down" zoom={zoom} />
    <SceneLabel position={[-1.1, 0.62, 0.5]} title="River" tone="navy" pointer="down" zoom={zoom} />
    <SceneLabel position={[3.9, -0.02, 1.4]} title="Ocean" tone="navy" pointer="down" zoom={zoom} />
    <SceneLabel position={[-1.6, groundwaterY, TERRAIN.z1 + 0.02]} title="Groundwater" tone="navy" zoom={zoom} />
  </>;
}

/* ------------------------------------------------------------------ scene */
export function WaterCycleScene({ state, showMolecules, reducedMotion }: { state: WaterCycleState; showMolecules: boolean; reducedMotion: boolean }) {
  const p = state.pools;
  const zoom = useThree((s) => (s.size.width < 600 ? 0.8 : 1));
  const glacier = Math.round(clamp(p.snowAndGlacierIceKg / 0.18, 0, 1) * 20) / 20;
  const ocean = clamp(p.oceanLiquidKg / 0.7, 0.3, 1);
  const seaLevel = -0.03 + (ocean - 0.5) * 0.1;
  const groundwater = Math.round(p.groundwaterLiquidKg * 100) / 100;
  const terrain = useTerrainGeometry(glacier);
  const cut = useCutawayGeometry(groundwater, seaLevel);
  useDispose(terrain, cut.solid, cut.water);
  const rainOn = state.precipitationOn && p.cloudLiquidKg + p.cloudIceKg > 0.002;
  const snowing = state.airTemperatureC <= 0;
  const groundwaterY = Math.min(0.45 * terrainHeight(-1.6, TERRAIN.z1) + 0.1 - 0.5, terrainHeight(-1.6, TERRAIN.z1) - 0.4) - 0.09;
  return <>
    <color attach="background" args={['#cfe9fa']} />
    <ambientLight intensity={0.5} /><hemisphereLight args={['#ffffff', '#9fb4c6', 0.6]} /><directionalLight position={[-3, 6, 5]} intensity={1.5} color="#fff6e8" />
    <directionalLight position={[4.3, 3.15, -1.3]} color="#ffe3ae" intensity={0.25 + state.sunPercent / 110} />
    <mesh position={[0.3, TERRAIN.base - 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[14, 8]} /><meshStandardMaterial color="#b9d5e8" roughness={0.9} /></mesh>
    <mesh geometry={terrain}><meshStandardMaterial vertexColors roughness={0.92} flatShading={false} /></mesh>
    <mesh geometry={cut.solid}><meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={cut.water}><meshStandardMaterial vertexColors transparent opacity={showMolecules ? 0.4 : 0.62} roughness={0.2} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <GlacierTongue glacier={glacier} />
    {p.surfaceLiquidKg > 0.001 && <River surfaceKg={p.surfaceLiquidKg} reducedMotion={reducedMotion} />}
    <Forest />
    <Ocean seaLevel={seaLevel} reducedMotion={reducedMotion} particles={showMolecules} />
    <Sun percent={state.sunPercent} />
    <Clouds liquidKg={p.cloudLiquidKg} iceKg={p.cloudIceKg} raining={rainOn} particles={showMolecules} reducedMotion={reducedMotion} />
    <Precipitation active={rainOn} snow={snowing} amount={(p.cloudLiquidKg + p.cloudIceKg) / 0.12} reducedMotion={reducedMotion} />
    {showMolecules && <CycleParticles state={state} reducedMotion={reducedMotion} zoom={zoom} />}
    <SceneTags groundwaterY={groundwaterY} zoom={zoom} />
  </>;
}
