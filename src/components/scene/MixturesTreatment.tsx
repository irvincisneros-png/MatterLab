import { useMemo, type ReactElement } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { LabBench } from './LabPrimitives';
import { createIndustrialWaterState, type IndustrialWaterState } from '../../science/mixturesEngine';
import { BENCH_Y, type StageFrame, type Vec3 } from './MixturesApparatus';

export const TREATMENT_FRAME: StageFrame = { cx: -0.18, cy: 0.1, halfW: 3.2, halfH: 1.2 };

const H = (height: number) => BENCH_Y + height;
const SLAB = 0.12;

function unit(seed: number) {
  const value = Math.sin(seed * 91.7 + 13.1) * 43758.5453;
  return value - Math.floor(value);
}

function Block({ x0, x1, z0 = -0.6, z1 = 0.6, y0, y1, colour, opacity, roughness = 0.7 }: { x0: number; x1: number; z0?: number; z1?: number; y0: number; y1: number; colour: string; opacity?: number; roughness?: number }) {
  return <mesh position={[(x0 + x1) / 2, H((y0 + y1) / 2), (z0 + z1) / 2]}>
    <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
    <meshStandardMaterial color={colour} roughness={roughness} transparent={opacity !== undefined} opacity={opacity ?? 1} depthWrite={opacity === undefined} />
  </mesh>;
}

/** Glass-walled open tank. Heights are measured above the bench. Optional lower wall on the +x side makes an overflow weir. */
function GlassTank({ x0, x1, z0 = -0.6, z1 = 0.6, floor, wall, leftWall, weirCrest, water, waterColour, waterOpacity = 0.55 }: {
  x0: number; x1: number; z0?: number; z1?: number; floor: number; wall: number; leftWall?: number; weirCrest?: number; water: number; waterColour: string; waterOpacity?: number;
}) {
  const t = 0.04;
  const glass = { colour: '#cde8f3', opacity: 0.3, roughness: 0.1 };
  const rightWall = weirCrest ?? wall;
  return <group>
    <Block x0={x0 - t} x1={x1 + t} z0={z0 - t} z1={z1 + t} y0={floor - 0.03} y1={floor} colour="#9fb2c4" />
    <Block x0={x0 - t} x1={x1 + t} z0={z1} z1={z1 + t} y0={floor} y1={wall} colour={glass.colour} opacity={glass.opacity} roughness={glass.roughness} />
    <Block x0={x0 - t} x1={x1 + t} z0={z0 - t} z1={z0} y0={floor} y1={wall} colour={glass.colour} opacity={glass.opacity} roughness={glass.roughness} />
    <Block x0={x0 - t} x1={x0} z0={z0} z1={z1} y0={floor} y1={leftWall ?? wall} colour={glass.colour} opacity={glass.opacity} roughness={glass.roughness} />
    <Block x0={x1} x1={x1 + t} z0={z0} z1={z1} y0={floor} y1={rightWall} colour={glass.colour} opacity={glass.opacity} roughness={glass.roughness} />
    <Block x0={x0} x1={x1} z0={z0} z1={z1} y0={floor} y1={water} colour={waterColour} opacity={waterOpacity} roughness={0.2} />
    <Block x0={x0 - t} x1={x1 + t} z0={z1} z1={z1 + 0.012} y0={wall - 0.02} y1={wall} colour="#7ea4bd" roughness={0.4} />
  </group>;
}

function Arrow({ position, rotationZ = 0, rotationX = 0, length = 0.22, colour = '#205fe8', phase = 0, modelTime }: { position: Vec3; rotationZ?: number; rotationX?: number; length?: number; colour?: string; phase?: number; modelTime: number }) {
  const pulse = 0.6 + 0.4 * Math.sin(modelTime * 3 + phase);
  return <group position={[...position]} rotation={[rotationX, 0, rotationZ]} scale={[1, 1, 1]}>
    <mesh position={[-length * 0.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.014, 0.014, length * 0.7, 8]} /><meshBasicMaterial color={colour} transparent opacity={pulse} /></mesh>
    <mesh position={[length * 0.35, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.045, 0.1, 12]} /><meshBasicMaterial color={colour} transparent opacity={pulse} /></mesh>
  </group>;
}

function Pipe({ from, to, radius = 0.05, colour = '#9fb7c9' }: { from: Vec3; to: Vec3; radius?: number; colour?: string }) {
  const { middle, length, quaternion } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    return { middle: a.clone().add(b).multiplyScalar(0.5), length: direction.length(), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()) };
  }, [from, to]);
  return <mesh position={middle} quaternion={quaternion}><cylinderGeometry args={[radius, radius, length, 14]} /><meshStandardMaterial color={colour} metalness={0.25} roughness={0.35} /></mesh>;
}

function mix(a: string, b: string, t: number) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).getHexString()}`;
}

function StageChip({ position, step, label, quiet = false }: { position: Vec3; step: string; label: string; quiet?: boolean }) {
  return <Html position={[...position]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
    <div className={`ml-stage-chip${quiet ? ' is-quiet' : ''}`}><b>{step}</b><span>{label}</span></div>
  </Html>;
}

export function TreatmentTrain({ state, modelTime }: { state: IndustrialWaterState; modelTime: number }): ReactElement {
  const initial = useMemo(() => createIndustrialWaterState(), []);
  const screenRan = state.stages.includes('screen');
  const filterRan = state.stages.includes('filter');
  const screenDebris = state.stageLog.filter((entry) => entry.stage === 'screen').reduce((sum, entry) => sum + entry.debrisG, 0);
  const filterDebris = state.stageLog.filter((entry) => entry.stage === 'filter').reduce((sum, entry) => sum + entry.debrisG, 0);
  const remainingTurbidity = (state.sedimentG + state.debrisG) / (initial.sedimentG + initial.debrisG);
  const rawColour = '#a58c63';
  const tankColour = mix('#8fd3e6', rawColour, filterRan ? 0.15 + remainingTurbidity * 0.35 : state.flocculated ? 0.8 : 1);
  const treatedColour = mix('#8fd3e6', rawColour, remainingTurbidity * 0.8);
  const flocClumps = useMemo(() => {
    const count = Math.round(7 + state.coagulantDosePercent * 0.1);
    return Array.from({ length: count }, (_, index) => ({
      p: [-1.62 + unit(index + 2) * 1.0, 0.5 + unit(index * 3 + 1) * 0.3 + (filterRan ? 0 : 0.18) * unit(index), -0.46 + unit(index * 5) * 0.92] as Vec3,
      r: 0.04 + (state.coagulantDosePercent / 100) * 0.035 + unit(index * 7) * 0.02,
    }));
  }, [state.coagulantDosePercent, filterRan]);
  const dustCount = Math.round(Math.min(34, state.sedimentG * (filterRan ? 0.7 : 1)));
  const dust = useMemo(() => Array.from({ length: dustCount }, (_, index) => [-1.65 + unit(index + 40) * 1.05, 0.38 + unit(index * 2 + 5) * 0.45, -0.52 + unit(index * 3 + 9) * 1.04] as Vec3), [dustCount]);
  const sludge = Math.min(0.1, 0.006 + (state.flocculated ? state.sedimentG * 0.0018 : state.sedimentG * 0.0006) + (filterRan ? 0.01 : 0));
  const paddle = modelTime * 1.4;
  const floatingDebris = screenRan ? 0 : Math.min(12, Math.round(state.debrisG));
  const caughtDebris = Math.min(12, Math.round(screenDebris));
  const filterSurfaceDebris = Math.min(5, Math.round(filterDebris));
  const dirt = Math.min(0.07, state.wasteSedimentG * 0.0035);
  const debrisColours = ['#8a6a43', '#5f7f4a', '#b9553f', '#6d7480', '#c9a35a'];
  const clearLevel = filterRan ? 0.46 : 0.17;
  const metal = { color: '#c3cdd8', metalness: 0.6, roughness: 0.3 } as const;
  return <group>
    <LabBench position={[-0.15, BENCH_Y - 0.05, 0]} width={7} depth={2.7} />
    <Block x0={-3.3} x1={3.0} z0={-0.9} z1={0.9} y0={0} y1={SLAB} colour="#c3ced9" roughness={0.8} />

    {/* ---- 1. Inflow channel with bar screen ---- */}
    <group>
      <Block x0={-2.8} x1={-1.85} z0={-0.4} z1={0.4} y0={SLAB} y1={0.62} colour="#aab9c8" roughness={0.85} />
      <GlassTank x0={-2.75} x1={-1.9} z0={-0.34} z1={0.34} floor={0.62} wall={1.06} weirCrest={0.9} water={0.92} waterColour={rawColour} waterOpacity={0.62} />
      <Pipe from={[-3.15, H(0.82), 0]} to={[-2.75, H(0.82), 0]} radius={0.075} colour="#6fa4c0" />
      <Arrow position={[-3.02, H(1.0), 0]} modelTime={modelTime} phase={0} />
      <Arrow position={[-2.4, H(1.12), 0]} modelTime={modelTime} phase={1} />
      {/* bar screen: bars lean downstream */}
      <group position={[-2.12, H(0.62), 0]} rotation={[0, 0, -0.32]}>
        {Array.from({ length: 9 }, (_, index) => <mesh key={index} position={[0, 0.27, -0.27 + index * 0.0675]}><cylinderGeometry args={[0.012, 0.012, 0.56, 8]} /><meshStandardMaterial color="#35506f" metalness={0.5} roughness={0.35} /></mesh>)}
        <mesh position={[0, 0.56, 0]}><boxGeometry args={[0.04, 0.03, 0.62]} /><meshStandardMaterial color="#35506f" metalness={0.5} roughness={0.35} /></mesh>
        <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.04, 0.03, 0.62]} /><meshStandardMaterial color="#35506f" metalness={0.5} roughness={0.35} /></mesh>
        {Array.from({ length: caughtDebris }, (_, index) => <mesh key={`caught-${index}`} position={[-0.055 - unit(index) * 0.03, 0.14 + (index % 6) * 0.07 + unit(index + 7) * 0.02, -0.22 + unit(index * 3 + 2) * 0.44]} rotation={[unit(index) * 3, unit(index + 5) * 3, unit(index + 9) * 3]} scale={[1.7, 0.7, 1]}>
          <dodecahedronGeometry args={[0.052, 0]} /><meshStandardMaterial color={debrisColours[index % debrisColours.length]} roughness={0.85} flatShading />
        </mesh>)}
      </group>
      {Array.from({ length: floatingDebris }, (_, index) => <mesh key={`float-${index}`} position={[-2.68 + unit(index * 2) * 0.4, H(0.95) + Math.sin(modelTime * 1.3 + index) * 0.01, -0.22 + unit(index * 3 + 4) * 0.44]} rotation={[unit(index) * 3, unit(index + 5) * 3, unit(index + 9) * 3]} scale={[1.7, 0.7, 1]}>
        <dodecahedronGeometry args={[0.052, 0]} /><meshStandardMaterial color={debrisColours[index % debrisColours.length]} roughness={0.85} flatShading />
      </mesh>)}
      {/* chute carries screened water over the gap into the flocculation tank */}
      <mesh position={[-1.8, H(0.91), 0]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.34, 0.025, 0.5]} /><meshPhysicalMaterial color="#8dd3e6" transparent opacity={0.7} roughness={0.15} /></mesh>
    </group>

    {/* ---- 2. Flocculation tank with paddle mixer ---- */}
    <group>
      <Block x0={-1.75} x1={-0.5} z0={-0.7} z1={0.7} y0={SLAB} y1={0.3} colour="#aab9c8" roughness={0.85} />
      <GlassTank x0={-1.7} x1={-0.55} floor={0.3} wall={1.0} leftWall={0.9} weirCrest={0.84} water={0.86} waterColour={tankColour} waterOpacity={0.58} />
      <Block x0={-1.7} x1={-0.55} y0={0.3} y1={0.3 + sludge} colour="#8a7350" roughness={0.95} />
      {/* bridge, motor, shaft and paddles */}
      <Block x0={-1.2} x1={-1.05} z0={-0.66} z1={0.66} y0={1.0} y1={1.05} colour="#4a5b6e" roughness={0.5} />
      <mesh position={[-1.125, H(1.14), 0]}><cylinderGeometry args={[0.1, 0.1, 0.17, 20]} /><meshStandardMaterial color="#205fe8" metalness={0.3} roughness={0.35} /></mesh>
      <mesh position={[-1.125, H(0.72), 0]}><cylinderGeometry args={[0.022, 0.022, 0.72, 12]} /><meshStandardMaterial {...metal} /></mesh>
      {[0.46, 0.7].map((height, level) => <group key={height} position={[-1.125, H(height), 0]} rotation={[0, paddle + level * Math.PI / 2, 0]}>
        <mesh><boxGeometry args={[0.56, 0.02, 0.025]} /><meshStandardMaterial {...metal} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.27, 0, 0]}><boxGeometry args={[0.04, 0.13, 0.15]} /><meshStandardMaterial {...metal} /></mesh>)}
      </group>)}
      {/* coagulant dosing */}
      <mesh position={[-1.55, H(1.1), -0.5]}><boxGeometry args={[0.22, 0.2, 0.2]} /><meshStandardMaterial color="#efb317" roughness={0.45} /></mesh>
      <Pipe from={[-1.55, H(1.0), -0.5]} to={[-1.55, H(0.9), -0.5]} radius={0.015} colour="#7f8c99" />
      <mesh position={[-1.55, H(0.88) - ((modelTime * 0.9) % 1) * 0.04, -0.5]}><sphereGeometry args={[0.018, 10, 8]} /><meshPhysicalMaterial color="#efb317" transparent opacity={0.85} /></mesh>
      {/* suspended particles and flocs */}
      {state.flocculated
        ? flocClumps.map((clump, index) => <group key={`floc-${index}`} position={[clump.p[0], H(clump.p[1]), clump.p[2]]}>
          {[[0, 0, 0], [0.55, 0.2, 0.1], [-0.4, 0.3, -0.25], [0.1, -0.4, 0.3]].map((offset, k) => <mesh key={k} position={[offset[0] * clump.r, offset[1] * clump.r, offset[2] * clump.r]}><sphereGeometry args={[clump.r * (k === 0 ? 1 : 0.7), 10, 8]} /><meshStandardMaterial color="#c9b18a" roughness={0.95} /></mesh>)}
        </group>)
        : dust.map((p, index) => <mesh key={`dust-${index}`} position={[p[0], H(p[1]), p[2]]}><sphereGeometry args={[0.014, 6, 5]} /><meshStandardMaterial color="#6e5a3a" roughness={0.9} /></mesh>)}
      {state.flocculated && filterRan && dust.map((p, index) => <mesh key={`rd-${index}`} position={[p[0], H(p[1]), p[2]]}><sphereGeometry args={[0.012, 6, 5]} /><meshStandardMaterial color="#6e5a3a" roughness={0.9} /></mesh>)}
      <Arrow position={[-1.82, H(1.08), 0.2]} rotationZ={-0.25} modelTime={modelTime} phase={2} />
    </group>

    {/* ---- overflow weir and launder ---- */}
    <group>
      <Block x0={-0.51} x1={0.34} z0={-0.22} z1={0.22} y0={0.78} y1={0.8} colour="#9fb2c4" />
      <Block x0={-0.51} x1={0.34} z0={-0.25} z1={-0.22} y0={0.78} y1={0.92} colour="#9fb2c4" />
      <Block x0={-0.51} x1={0.34} z0={0.22} z1={0.25} y0={0.78} y1={0.92} colour="#9fb2c4" />
      <Block x0={-0.51} x1={0.34} z0={-0.22} z1={0.22} y0={0.8} y1={0.84} colour="#8dd3e6" opacity={0.7} roughness={0.15} />
      <mesh position={[-0.57, H(0.83), 0]} rotation={[0, 0, -0.9]}><boxGeometry args={[0.1, 0.012, 0.4]} /><meshPhysicalMaterial color="#8dd3e6" transparent opacity={0.7} roughness={0.12} /></mesh>
      <Arrow position={[-0.1, H(0.93), 0]} modelTime={modelTime} phase={3} />
      <mesh position={[0.37, H(0.76), 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.12, 0.012, 0.38]} /><meshPhysicalMaterial color="#8dd3e6" transparent opacity={0.7} roughness={0.12} /></mesh>
    </group>

    {/* ---- 3. Filter bed ---- */}
    <group>
      <Block x0={0.2} x1={1.58} z0={-0.7} z1={0.7} y0={0} y1={SLAB} colour="#aab9c8" roughness={0.85} />
      <GlassTank x0={0.3} x1={1.5} floor={SLAB} wall={0.9} leftWall={0.76} water={0.72} waterColour={mix('#8fd3e6', rawColour, filterRan ? 0.15 : state.flocculated ? 0.55 : 0.85)} waterOpacity={0.45} />
      {/* underdrain chamber and perforated plate */}
      <Block x0={0.3} x1={1.5} y0={SLAB + 0.002} y1={0.2} colour={treatedColour} opacity={filterRan ? 0.4 : 0.22} roughness={0.2} />
      <Block x0={0.3} x1={1.5} y0={0.2} y1={0.22} colour="#35506f" roughness={0.5} />
      {Array.from({ length: 10 }, (_, index) => <mesh key={`hole-${index}`} position={[0.4 + index * 0.115, H(0.221), 0.61]}><boxGeometry args={[0.04, 0.012, 0.004]} /><meshBasicMaterial color="#c3d4e4" /></mesh>)}
      {/* media layers: gravel, sand, anthracite */}
      <Block x0={0.3} x1={1.5} y0={0.22} y1={0.32} colour="#8b8f95" />
      <Block x0={0.3} x1={1.5} y0={0.32} y1={0.46} colour="#d9bd82" />
      <Block x0={0.3} x1={1.5} y0={0.46} y1={0.6} colour="#2d333b" />
      {Array.from({ length: 16 }, (_, index) => <mesh key={`gravel-${index}`} position={[0.37 + (index % 8) * 0.15, H(0.26 + Math.floor(index / 8) * 0.055 + unit(index) * 0.008), 0.605]}><dodecahedronGeometry args={[0.04, 0]} /><meshStandardMaterial color="#a7abb0" roughness={0.9} flatShading /></mesh>)}
      {Array.from({ length: 32 }, (_, index) => <mesh key={`coal-${index}`} position={[0.34 + (index % 16) * 0.073, H(0.5 + Math.floor(index / 16) * 0.06 + unit(index + 4) * 0.012), 0.605]}><dodecahedronGeometry args={[0.028, 0]} /><meshStandardMaterial color="#4b535c" roughness={0.6} flatShading /></mesh>)}
      {dirt > 0 && <Block x0={0.3} x1={1.5} y0={0.6} y1={0.6 + dirt} colour="#7b6540" roughness={0.95} />}
      {Array.from({ length: filterSurfaceDebris }, (_, index) => <mesh key={`fd-${index}`} position={[0.5 + index * 0.2, H(0.64 + dirt), -0.1 + unit(index) * 0.2]} scale={[1.6, 0.6, 1]}><dodecahedronGeometry args={[0.045, 0]} /><meshStandardMaterial color={debrisColours[index % 5]} roughness={0.85} flatShading /></mesh>)}
      <Arrow position={[0.9, H(0.86), 0]} rotationZ={-Math.PI / 2} modelTime={modelTime} phase={5} />
      <Arrow position={[0.9, H(0.165), 0.45]} length={0.2} modelTime={modelTime} phase={6} />
    </group>

    {/* ---- clear water outlet ---- */}
    <group>
      <Block x0={1.65} x1={2.6} z0={-0.5} z1={0.5} y0={0} y1={SLAB} colour="#aab9c8" roughness={0.85} />
      <Pipe from={[1.5, H(0.17), 0]} to={[1.88, H(0.17), 0]} radius={0.05} colour="#6fa4c0" />
      <Arrow position={[1.7, H(0.28), 0]} modelTime={modelTime} phase={7} />
      <GlassTank x0={1.85} x1={2.5} z0={-0.4} z1={0.4} floor={SLAB} wall={0.7} water={clearLevel} waterColour={treatedColour} waterOpacity={filterRan ? 0.5 : 0.3} />
      <Pipe from={[2.54, H(0.34), 0]} to={[2.85, H(0.34), 0]} radius={0.04} colour="#6fa4c0" />
      {Array.from({ length: filterRan ? Math.min(14, Math.round(state.sedimentG * 0.4)) : 0 }, (_, index) => <mesh key={`haze-${index}`} position={[1.95 + unit(index + 60) * 0.45, H(0.2 + unit(index * 2 + 3) * (clearLevel - 0.14)), -0.3 + unit(index * 4) * 0.6]}><sphereGeometry args={[0.012, 6, 5]} /><meshStandardMaterial color="#6e5a3a" roughness={0.9} /></mesh>)}
    </group>

    <StageChip position={[-2.25, H(1.42), 0]} step="1" label="Bar screen" />
    <StageChip position={[-1.125, H(1.42), 0]} step="2" label="Flocculation tank" />
    <StageChip position={[0.9, H(1.1), 0]} step="3" label="Filter bed" />
    <StageChip position={[2.17, H(0.9), 0]} step="" label="Clear water outlet" quiet />
  </group>;
}
