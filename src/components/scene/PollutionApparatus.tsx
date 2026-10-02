import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LabBeaker } from './LabPrimitives';
import { pollutionOutputs, type PollutionMethodId, type PollutionState } from '../../science/pollutionEngine';

type Vec3 = readonly [number, number, number];

export const LITTER_COLOURS = ['#ef6858', '#e7a839', '#637de1', '#35a8a4'] as const;
export const OIL_COLOUR = '#d99a2b';
export const SEDIMENT_COLOUR = '#9a7755';
export const WATER_COLOUR = '#3aa9cf';

function Glass({ opacity = 0.2 }: { opacity?: number }) {
  return <meshPhysicalMaterial color="#e5f4fc" transparent opacity={opacity} roughness={0.08} metalness={0.02} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />;
}

function Steel({ colour = '#9fb2c2' }: { colour?: string }) {
  return <meshStandardMaterial color={colour} metalness={0.55} roughness={0.32} />;
}

/** A tube (hose, siphon, delivery adapter) along a smooth path. */
export function ApparatusTube({ points, radius = 0.028, colour = '#d8edf4', glass = true }: { points: readonly Vec3[]; radius?: number; colour?: string; glass?: boolean }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 40, radius, 10, false), [points, radius]);
  return <mesh geometry={geometry}>{glass
    ? <meshPhysicalMaterial color={colour} transparent opacity={0.72} roughness={0.1} clearcoat={1} />
    : <meshStandardMaterial color={colour} roughness={0.5} />}</mesh>;
}

/** A single piece of floating or captured litter: bottle, can, bag, cup or wrapper. */
export function LitterPiece({ kind, scale = 1 }: { kind: number; scale?: number }) {
  const colour = LITTER_COLOURS[kind % LITTER_COLOURS.length];
  const variant = kind % 5;
  return <group scale={scale}>
    {variant === 0 && <>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.034, 0.034, 0.15, 14]} /><meshPhysicalMaterial color="#cfe9ef" transparent opacity={0.72} roughness={0.08} clearcoat={1} /></mesh>
      <mesh position={[0.1, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.034, 0.05, 14]} /><meshPhysicalMaterial color="#cfe9ef" transparent opacity={0.72} roughness={0.08} /></mesh>
      <mesh position={[0.135, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.014, 0.014, 0.025, 10]} /><meshStandardMaterial color={colour} roughness={0.4} /></mesh>
      <mesh position={[-0.01, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.0345, 0.0345, 0.05, 14]} /><meshStandardMaterial color={colour} roughness={0.45} transparent opacity={0.9} /></mesh>
    </>}
    {variant === 1 && <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.032, 0.032, 0.1, 16]} /><meshStandardMaterial color={colour} metalness={0.55} roughness={0.28} /></mesh>}
    {variant === 2 && <mesh scale={[0.1, 0.022, 0.075]}><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color="#f4f3ec" roughness={0.6} transparent opacity={0.92} /></mesh>}
    {variant === 3 && <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.027, 0.075, 14]} /><meshStandardMaterial color={colour} roughness={0.5} /></mesh>}
    {variant === 4 && <mesh rotation={[0, 0.4, 0]}><boxGeometry args={[0.11, 0.006, 0.065]} /><meshStandardMaterial color={colour} roughness={0.35} metalness={0.2} /></mesh>}
  </group>;
}

function Box({ size, position, colour, rough = 0.5, metal = 0 }: { size: Vec3; position: Vec3; colour: string; rough?: number; metal?: number }) {
  return <mesh position={[...position]}><boxGeometry args={[...size]} /><meshStandardMaterial color={colour} roughness={rough} metalness={metal} /></mesh>;
}

/** Lab bench that carries the treatment apparatus. Its top surface is y = 0 in local coordinates. */
export function TreatmentBench() {
  const top = useMemo(() => new RoundedBoxGeometry(3.5, 0.18, 2.7, 4, 0.07), []);
  return <group>
    <mesh geometry={top} position={[0, -0.09, 0]}><meshStandardMaterial color="#f2f7fb" roughness={0.45} /></mesh>
    <mesh position={[0, -0.57, 0]}><boxGeometry args={[3.3, 0.78, 2.5]} /><meshStandardMaterial color="#7f9bb6" roughness={0.42} metalness={0.15} /></mesh>
    <mesh position={[0, -0.28, 1.255]}><boxGeometry args={[3.3, 0.04, 0.02]} /><meshBasicMaterial color="#4fb6d6" /></mesh>
    <mesh position={[0, -1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.6, 48]} /><meshBasicMaterial color="#9fb7cd" transparent opacity={0.12} depthWrite={false} /></mesh>
  </group>;
}

/** The pump that draws water from the water body into the treatment rigs. */
export function FeedPump() {
  return <group position={[-1.32, 0, -0.9]}>
    <Box size={[0.5, 0.26, 0.4]} position={[0, 0.13, 0]} colour="#486a86" rough={0.35} metal={0.2} />
    <Box size={[0.4, 0.04, 0.3]} position={[0, 0.28, 0]} colour="#c5d6e3" rough={0.3} metal={0.3} />
    <mesh position={[0, 0.2, 0.205]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 0.025, 20]} /><meshStandardMaterial color="#dbe7f0" metalness={0.4} roughness={0.3} /></mesh>
    <mesh position={[-0.1, 0.34, 0]}><cylinderGeometry args={[0.04, 0.04, 0.14, 12]} /><meshStandardMaterial color="#5b7a92" roughness={0.5} /></mesh>
  </group>;
}

function SkimRig({ state }: { state: PollutionState }) {
  const drum = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (drum.current) drum.current.rotation.z -= delta * 1.2; });
  const oil = state.pollutants.oil;
  const coated = oil.recoveredG > 0;
  return <group position={[0.55, 0, -0.62]}>
    <mesh position={[0, 0.225, 0]}><boxGeometry args={[1.5, 0.45, 0.82]} /><Glass /></mesh>
    <mesh position={[0, 0.17, 0]}><boxGeometry args={[1.46, 0.32, 0.78]} /><meshPhysicalMaterial color={WATER_COLOUR} transparent opacity={0.42} roughness={0.1} /></mesh>
    {oil.surfaceG > 0 && <mesh position={[-0.28, 0.335, 0]} scale={[Math.min(1, 0.4 + oil.surfaceG * 0.1), 1, 1]}><boxGeometry args={[0.66, 0.012, 0.66]} /><meshPhysicalMaterial color={OIL_COLOUR} transparent opacity={0.8} roughness={0.15} clearcoat={0.9} /></mesh>}
    {[-0.3, -0.15, 0, 0.15, 0.3].map((z) => <mesh key={z} position={[-0.62, 0.345, z]}><sphereGeometry args={[0.04, 14, 10]} /><meshStandardMaterial color="#f0843a" roughness={0.4} /></mesh>)}
    <mesh position={[-0.62, 0.345, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.008, 0.008, 0.62, 6]} /><meshStandardMaterial color="#f0843a" /></mesh>
    {[-0.42, 0.42].map((z) => <mesh key={z} position={[0.12, 0.58, z]}><cylinderGeometry args={[0.018, 0.018, 0.36, 10]} /><Steel /></mesh>)}
    <group ref={drum} position={[0.12, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh><cylinderGeometry args={[0.15, 0.15, 0.7, 28]} /><meshStandardMaterial color={coated ? '#b87c1c' : '#6e8396'} metalness={0.3} roughness={0.45} /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[Math.cos(i * 1.047) * 0.152, 0.001, Math.sin(i * 1.047) * 0.152]} rotation={[Math.PI / 2, 0, i * 1.047]}><boxGeometry args={[0.02, 0.7, 0.02]} /><meshStandardMaterial color="#44596b" roughness={0.5} /></mesh>)}
    </group>
    <mesh position={[0.3, 0.52, 0]} rotation={[0, 0, -0.55]}><boxGeometry args={[0.2, 0.015, 0.62]} /><Steel colour="#dbe7f0" /></mesh>
    <mesh position={[0.46, 0.42, 0]} rotation={[0, 0, -0.45]}><boxGeometry args={[0.28, 0.012, 0.5]} /><Steel colour="#dbe7f0" /></mesh>
    <group position={[0.7, 0, 0.2]}>
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[0.3, 0.2, 0.42]} /><Glass opacity={0.3} /></mesh>
      {coated && <mesh position={[0, 0.05, 0]} scale={[1, Math.min(1, 0.4 + oil.recoveredG * 0.12), 1]}><boxGeometry args={[0.27, 0.1, 0.39]} /><meshPhysicalMaterial color={OIL_COLOUR} transparent opacity={0.9} roughness={0.15} clearcoat={0.9} /></mesh>}
    </group>
  </group>;
}

function ScreenRig({ state }: { state: PollutionState }) {
  const caught = Math.min(6, Math.ceil(state.pollutants.litter.wasteG / 1.5));
  const bars = Array.from({ length: 11 }, (_, i) => -0.31 + i * 0.062);
  return <group position={[0.45, 0, -0.62]}>
    <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.6, 0.4, 0.78]} /><Glass /></mesh>
    <mesh position={[0, 0.15, 0]}><boxGeometry args={[1.56, 0.28, 0.74]} /><meshPhysicalMaterial color={WATER_COLOUR} transparent opacity={0.42} roughness={0.1} /></mesh>
    <group position={[0.18, 0.2, 0]} rotation={[0, 0, -0.5]}>
      {bars.map((z) => <mesh key={z} position={[0, 0.3, z]}><cylinderGeometry args={[0.012, 0.012, 0.7, 8]} /><Steel colour="#c3d1dc" /></mesh>)}
      <mesh position={[0, 0.64, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.74, 10]} /><Steel /></mesh>
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.74, 10]} /><Steel /></mesh>
      {Array.from({ length: caught }, (_, i) => <group key={i} position={[-0.05, 0.12 + (i % 3) * 0.12, -0.25 + (i % 3) * 0.12 + Math.floor(i / 3) * 0.12]} rotation={[0.3, i, 0.2]}><LitterPiece kind={i + 1} scale={0.9} /></group>)}
    </group>
    <group position={[0.78, 0, 0.12]}>
      <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.3, 0.24, 0.42]} /><meshStandardMaterial color="#9db8cc" metalness={0.5} roughness={0.4} wireframe /></mesh>
      <mesh position={[0, 0.005, 0]}><boxGeometry args={[0.3, 0.01, 0.42]} /><Steel colour="#7b95a9" /></mesh>
    </group>
    {[-0.42, 0.42].map((z) => <mesh key={z} position={[0.18, 0.52, z]}><cylinderGeometry args={[0.014, 0.014, 0.42, 8]} /><Steel /></mesh>)}
  </group>;
}

function DecantRig({ state }: { state: PollutionState }) {
  const sediment = state.pollutants.sediment;
  const settledHeight = Math.min(0.2, 0.02 + Math.sqrt(sediment.settledG) * 0.03);
  const haze = Math.min(0.35, sediment.suspendedG * 0.012);
  return <group position={[-0.05, 0, -0.62]}>
    <Box size={[0.8, 0.14, 0.8]} position={[0, 0.07, 0]} colour="#dce8f1" rough={0.4} />
    <group position={[0, 0.64, 0]}>
      <LabBeaker radius={0.34} height={1.0} fill={0.78} capacityMl={1000} waterColor={WATER_COLOUR} />
      <mesh position={[0, -0.5 + 0.08 + settledHeight / 2, 0]}><cylinderGeometry args={[0.31, 0.31, Math.max(0.005, settledHeight), 32]} /><meshStandardMaterial color={SEDIMENT_COLOUR} roughness={0.9} /></mesh>
      {haze > 0 && <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.31, 0.31, 0.75, 32]} /><meshBasicMaterial color="#a98a62" transparent opacity={haze * 0.8} depthWrite={false} /></mesh>}
    </group>
    <ApparatusTube points={[[0.12, 1.05, 0], [0.12, 1.3, 0], [-0.12, 1.36, 0.08], [-0.55, 1.22, 0.62], [-0.9, 1.05, 1.15], [-1.0, 0.9, 1.45]]} radius={0.026} />
    <mesh position={[0.12, 0.7, 0]}><cylinderGeometry args={[0.018, 0.018, 0.74, 8]} /><meshPhysicalMaterial color="#d8edf4" transparent opacity={0.8} /></mesh>
  </group>;
}

function FilterRig({ state }: { state: PollutionState }) {
  const sedimentTrapped = Math.min(1, state.pollutants.sediment.wasteG / 20);
  const paper = useMemo(() => new THREE.Color('#f7f5ef').lerp(new THREE.Color('#a8885f'), sedimentTrapped), [sedimentTrapped]);
  const flaskProfile = useMemo(() => [new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.31, 0.03), new THREE.Vector2(0.09, 0.5), new THREE.Vector2(0.075, 0.62), new THREE.Vector2(0.095, 0.64), new THREE.Vector2(0.075, 0.62)], []);
  return <group position={[0.35, 0, -0.62]}>
    <Box size={[0.56, 0.05, 0.5]} position={[0.6, 0.025, 0]} colour="#486a86" rough={0.4} metal={0.2} />
    <mesh position={[0.62, 0.75, 0]}><cylinderGeometry args={[0.016, 0.016, 1.5, 10]} /><Steel /></mesh>
    <mesh position={[0.31, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.014, 0.014, 0.62, 8]} /><Steel /></mesh>
    <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.28, 0.013, 8, 36]} /><Steel /></mesh>
    <group position={[0, 0.82, 0]}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.31, 0.04, 0.4, 36, 1, true]} /><Glass opacity={0.28} /></mesh>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.285, 0.036, 0.36, 36, 1, true]} /><meshStandardMaterial color={paper} roughness={0.95} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.12, 0]}><cylinderGeometry args={[0.032, 0.032, 0.28, 12]} /><Glass opacity={0.4} /></mesh>
    </group>
    <group position={[0, 0.0, 0]}>
      <mesh><latheGeometry args={[flaskProfile, 40]} /><Glass opacity={0.3} /></mesh>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.24, 0.285, 0.18, 36]} /><meshPhysicalMaterial color={WATER_COLOUR} transparent opacity={0.4} roughness={0.1} /></mesh>
    </group>
  </group>;
}

function DistillRig({ state }: { state: PollutionState }) {
  const justDistilled = state.treatments[state.treatments.length - 1] === 'distill';
  const jacket = useMemo(() => ({ start: new THREE.Vector3(0.4, 1.0, -0.55), end: new THREE.Vector3(-0.5, 0.86, 0.38) }), []);
  const dir = jacket.end.clone().sub(jacket.start);
  const length = dir.length();
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), [dir.x, dir.y, dir.z]);
  const middle = jacket.start.clone().add(jacket.end).multiplyScalar(0.5);
  const remaining = Math.min(1, state.waterBodyMl / 1000);
  return <group position={[0, 0, 0]}>
    <group position={[0.62, 0, -0.76]}>
      <Box size={[0.66, 0.14, 0.58]} position={[0, 0.07, 0]} colour="#2f4d66" rough={0.35} metal={0.25} />
      <mesh position={[0, 0.155, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.2, 0.03, 10, 36]} /><meshStandardMaterial color={justDistilled ? '#ef6858' : '#6f8394'} emissive={justDistilled ? '#ef6858' : '#000000'} emissiveIntensity={justDistilled ? 0.8 : 0} roughness={0.35} /></mesh>
      <mesh position={[0, 0.52, 0]}><sphereGeometry args={[0.27, 28, 20]} /><Glass opacity={0.28} /></mesh>
      <mesh position={[0, 0.42, 0]} scale={[1, 0.62, 1]}><sphereGeometry args={[0.24, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshPhysicalMaterial color={WATER_COLOUR} transparent opacity={0.25 + 0.2 * remaining} roughness={0.1} /></mesh>
      <mesh position={[0, 0.88, 0]}><cylinderGeometry args={[0.065, 0.085, 0.34, 18]} /><Glass opacity={0.3} /></mesh>
      <mesh position={[0, 1.08, 0]}><cylinderGeometry args={[0.08, 0.065, 0.06, 18]} /><meshStandardMaterial color="#44596b" roughness={0.5} /></mesh>
      <mesh position={[0.1, 1.04, 0.06]} rotation={[0, 0, 0.2]}><cylinderGeometry args={[0.008, 0.008, 0.4, 8]} /><meshStandardMaterial color="#e8eef3" roughness={0.3} /></mesh>
      <mesh position={[0.1, 0.84, 0.06]}><sphereGeometry args={[0.022, 12, 10]} /><meshStandardMaterial color="#ef6858" roughness={0.3} /></mesh>
    </group>
    <ApparatusTube points={[[0.62, 1.0, -0.76], [0.55, 1.1, -0.7], [0.4, 1.02, -0.55]]} radius={0.04} />
    <mesh position={[...middle.toArray() as [number, number, number]]} quaternion={quaternion}>
      <cylinderGeometry args={[0.1, 0.1, length, 22, 1, true]} /><Glass opacity={0.26} />
    </mesh>
    <mesh position={[...middle.toArray() as [number, number, number]]} quaternion={quaternion}>
      <cylinderGeometry args={[0.035, 0.035, length * 1.06, 12]} /><meshPhysicalMaterial color="#d8edf4" transparent opacity={0.8} roughness={0.1} clearcoat={1} />
    </mesh>
    <mesh position={[...middle.toArray() as [number, number, number]]} quaternion={quaternion}>
      <cylinderGeometry args={[0.083, 0.083, length * 0.86, 20, 1, true]} /><meshBasicMaterial color={WATER_COLOUR} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    <ApparatusTube points={[[-0.43, 0.84, 0.36], [-0.6, 0.82, 0.5], [-0.92, 0.9, 0.78], [-1.02, 0.86, 0.86]]} radius={0.04} />
    <ApparatusTube points={[[-0.3, 0.75, 0.2], [-0.62, 0.55, -0.1], [-0.95, 0.3, -0.3]]} radius={0.02} colour="#4fb6d6" glass={false} />
    <ApparatusTube points={[[0.2, 0.96, -0.5], [0.22, 1.12, -0.42], [-0.3, 1.14, -0.4], [-0.55, 0.92, -0.2]]} radius={0.02} colour="#4fb6d6" glass={false} />
    <mesh position={[-0.14, 0.45, 0.08]}><cylinderGeometry args={[0.016, 0.016, 0.9, 8]} /><Steel /></mesh>
    <Box size={[0.4, 0.04, 0.3]} position={[-0.14, 0.02, 0.08]} colour="#486a86" rough={0.4} metal={0.2} />
  </group>;
}

export function TreatmentRig({ method, state }: { method: PollutionMethodId; state: PollutionState }) {
  return <group>
    {method === 'skim' && <>
      <SkimRig state={state} />
      <ApparatusTube points={[[1.1, 0.15, -0.35], [1.0, 0.1, 0.2], [0.55, 0.3, 0.6], [0.1, 0.62, 0.8]]} radius={0.022} colour="#e7b24a" />
    </>}
    {method === 'screen' && <ScreenRig state={state} />}
    {method === 'decant' && <DecantRig state={state} />}
    {method === 'filter' && <FilterRig state={state} />}
    {method === 'distill' && <DistillRig state={state} />}
  </group>;
}

/** Output 2: recovered water. */
export function RecoveredWaterBeaker({ state }: { state: PollutionState }) {
  const out = pollutionOutputs(state).recoveredWater;
  const turbid = out.sedimentG > 0.1;
  return <group position={[-1.1, 0.4, 0.78]}>
    <LabBeaker radius={0.33} height={0.8} fill={out.ml / 1000} capacityMl={1000} waterColor={turbid ? '#b4a07a' : '#63bfd9'} />
    <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.36, 0.4, 36]} /><meshBasicMaterial color="#36adb1" /></mesh>
  </group>;
}

/** Output 3: recovered material (oil collected by the skimmer). */
export function RecoveredMaterialJar({ state }: { state: PollutionState }) {
  const out = pollutionOutputs(state).recoveredMaterial;
  const height = out.totalG > 0 ? Math.min(0.34, 0.06 + out.totalG * 0.06) : 0;
  return <group position={[0.05, 0, 0.78]}>
    <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.3, 0.3, 0.5, 36, 1, true]} /><Glass opacity={0.24} /></mesh>
    <mesh position={[0, 0.006, 0]}><cylinderGeometry args={[0.3, 0.3, 0.012, 36]} /><Glass opacity={0.35} /></mesh>
    <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.018, 8, 40]} /><meshStandardMaterial color="#e8f1f7" roughness={0.3} /></mesh>
    {height > 0 && <mesh position={[0, 0.012 + height / 2, 0]}><cylinderGeometry args={[0.285, 0.285, height, 36]} /><meshPhysicalMaterial color={OIL_COLOUR} transparent opacity={0.9} roughness={0.12} clearcoat={0.9} /></mesh>}
    <mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.33, 0.37, 36]} /><meshBasicMaterial color="#e8ad37" /></mesh>
    <mesh position={[0.42, 0.03, 0.2]} rotation={[0, 0, 0.1]}><cylinderGeometry args={[0.26, 0.26, 0.05, 28]} /><meshStandardMaterial color="#f0b53c" roughness={0.35} /></mesh>
  </group>;
}

/** Output 4: waste (litter, sludge, salt left behind and waste water). */
export function WasteBin({ state }: { state: PollutionState }) {
  const out = pollutionOutputs(state).waste;
  const fill = out.pollutantG + out.waterMl > 0 ? Math.min(0.42, 0.07 + out.pollutantG * 0.005 + out.waterMl * 0.0016) : 0;
  const litterCount = Math.min(5, Math.ceil(out.litterG / 1.6));
  return <group position={[1.15, 0, 0.78]}>
    <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.37, 0.31, 0.6, 36, 1, true]} /><meshStandardMaterial color="#6e8da5" roughness={0.45} metalness={0.2} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0.005, 0]}><cylinderGeometry args={[0.31, 0.31, 0.01, 36]} /><meshStandardMaterial color="#5b788f" /></mesh>
    <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.37, 0.022, 8, 40]} /><meshStandardMaterial color="#4f6c84" roughness={0.4} /></mesh>
    <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.352, 0.34, 0.045, 36, 1, true]} /><meshStandardMaterial color="#e36d62" roughness={0.5} side={THREE.DoubleSide} /></mesh>
    {fill > 0 && <>
      <mesh position={[0, 0.012 + fill / 2, 0]}><cylinderGeometry args={[0.33 + fill * 0.05, 0.31, fill, 32]} /><meshStandardMaterial color="#6b5d4a" roughness={0.6} transparent opacity={0.95} /></mesh>
      {out.sedimentG > 0 && <mesh position={[0, 0.02 + fill, 0]} scale={[1, 0.35, 1]}><sphereGeometry args={[0.28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={SEDIMENT_COLOUR} roughness={0.95} /></mesh>}
      {out.saltG > 0 && Array.from({ length: Math.min(9, Math.ceil(out.saltG / 1.4)) }, (_, i) => <mesh key={i} position={[Math.cos(i * 2.4) * 0.17, fill + 0.03, Math.sin(i * 2.4) * 0.17]} rotation={[i, i * 0.5, i * 0.2]}><boxGeometry args={[0.05, 0.05, 0.05]} /><meshStandardMaterial color="#f7fbff" roughness={0.2} /></mesh>)}
      {Array.from({ length: litterCount }, (_, i) => <group key={i} position={[Math.cos(i * 1.9) * 0.16, fill + 0.05, Math.sin(i * 1.9) * 0.14]} rotation={[0.3, i, 0.2]}><LitterPiece kind={i + 1} /></group>)}
    </>}
  </group>;
}
