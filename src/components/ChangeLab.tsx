import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ATOM_COLOURS, LabBeaker, LabBench, StudioLights } from './scene/LabPrimitives';
import { LatticeLinks } from './scene/StatesLattice';
import { ArrowUp, Beaker, Check, ChevronRight, Droplets, Flame, Focus, Info, Pause, Play, RotateCcw, Snowflake, Sparkles, StepForward } from 'lucide-react';
import {
  addTransitionEnergy,
  advanceTransition,
  allocateMoleculePhases,
  createTransitionState,
  observationAt,
  setTransitionEnvironment,
  setVaporisationMode,
  type TransitionId,
  type TransitionState,
  type VaporisationMode,
} from '../science/transitionEngine';
import { gasPosition, iceLatticeHeight, iceLatticeSite, liquidDrift, relaxSeparation, SAMPLE_MASS_KG, thermalStateAtEnergy, type Phase } from '../science/matterEngine';
import './ChangeLab.css';
import { watchContextLoss } from './scene/contextLoss';
import { AdaptiveQuality } from './scene/AdaptiveQuality';

export type { TransitionId } from '../science/transitionEngine';
export type ChangeLabProps = {
  initialTransition?: TransitionId;
  onTransitionChange?: (id: TransitionId) => void;
};

type PhaseKey = Phase;
type Position = readonly [number, number, number];
type Molecule = { id: number; phase: PhaseKey; position: Position };

const TRANSITIONS: readonly { id: TransitionId; name: string; from: string; to: string; icon: typeof Flame; tint: string }[] = [
  { id: 'melting', name: 'Melting', from: 'Ice', to: 'Liquid', icon: Flame, tint: 'coral' },
  { id: 'freezing', name: 'Freezing', from: 'Liquid', to: 'Ice', icon: Snowflake, tint: 'blue' },
  { id: 'vaporisation', name: 'Vaporisation', from: 'Liquid', to: 'Gas', icon: ArrowUp, tint: 'yellow' },
  { id: 'condensation', name: 'Condensation', from: 'Gas', to: 'Liquid', icon: Droplets, tint: 'teal' },
  { id: 'sublimation', name: 'Sublimation', from: 'Ice', to: 'Gas', icon: ArrowUp, tint: 'violet' },
  { id: 'deposition', name: 'Deposition', from: 'Gas', to: 'Ice', icon: Snowflake, tint: 'blue' },
];

const PHASE_LABELS: Record<Phase, string> = { solid: 'Ice', liquid: 'Liquid water', gas: 'Water vapour' };
const PHASE_COLOURS: Record<Phase, string> = { solid: '#2366e8', liquid: '#06aabc', gas: '#d99500' };

function isThermalScenario(state: TransitionState) {
  return state.transition !== 'condensation' && state.transition !== 'sublimation' && state.transition !== 'deposition'
    && !(state.transition === 'vaporisation' && state.mode === 'evaporation');
}

function seeded(id: number, lane: number) {
  const value = Math.sin((id + 1) * 78.233 + lane * 32.53) * 43758.5453;
  return value - Math.floor(value);
}

/** Nearest-neighbour spacing of the ice lattice in the beaker model. */
const BEAKER_ICE_SPACING = 0.235;

function positionsFor(state: TransitionState): Molecule[] {
  const observation = observationAt(state);
  const phases = allocateMoleculePhases(observation.fractions);
  const time = state.modelTimeSeconds;
  const liquidHeight = observation.fractions.liquid * 0.92;
  const liquidTop = -0.78 + liquidHeight;
  const iceHeight = observation.fractions.solid * 1.003;
  const iceBottom = observation.fractions.liquid > 0.001 ? Math.max(-0.78, liquidTop - 0.917 * iceHeight) : -0.78;
  const iceTop = iceBottom + iceHeight;
  const gasFloor = Math.max(-0.72, liquidTop, iceTop);
  const solidCount = phases.filter((phase) => phase === 'solid').length;
  const latticeHeight = iceLatticeHeight(Math.max(1, solidCount), BEAKER_ICE_SPACING);
  const latticeBase = iceBottom + Math.max(0.08, (iceHeight - latticeHeight) / 2);
  // Scramble liquid identities over a 4 x 3 x 2 loose grid so no pattern shows.
  const liquidOrder = Array.from({ length: 18 }, (_, id) => id).sort((a, b) => seeded(a, 9) - seeded(b, 9));
  const vibration = state.transition === 'sublimation' ? 0.02 : 0.014 + 0.012 * Math.min(1, Math.max(0, (observation.temperatureC + 30) / 30));
  const molecules: Molecule[] = Array.from({ length: 18 }, (_, id) => {
    const phase = phases[id] ?? 'gas';
    const u = seeded(id, 0);
    const v = seeded(id, 1);
    const w = seeded(id, 2);
    let x = (u - 0.5) * 0.94;
    let y = -0.75 + v * 1.5;
    let z = (w - 0.5) * 0.4;
    if (phase === 'solid' && state.transition === 'deposition') {
      const frostAngle = id * 2.399;
      x = Math.sin(frostAngle) * 0.56 + (u - 0.5) * 0.08;
      y = -0.02 + (id % 5) * 0.12 + (v - 0.5) * 0.06;
      z = Math.cos(frostAngle) * 0.12;
    } else if (phase === 'solid') {
      // Ice: fixed hexagonal sites; the molecules only vibrate about them.
      const site = iceLatticeSite(id, BEAKER_ICE_SPACING);
      const angle = time * 9 + id * 1.91;
      x = site.x + vibration * Math.sin(angle);
      y = latticeBase + site.y + vibration * Math.sin(angle * 1.17 + 1.3);
      z = site.z + vibration * 0.8 * Math.cos(angle * 0.83);
    } else if (phase === 'liquid' && state.transition === 'condensation') {
      const dropAngle = id * 2.399;
      x = Math.sin(dropAngle) * 0.58 + (u - 0.5) * 0.055;
      y = 0.48 + (id % 4) * 0.14 + (v - 0.5) * 0.055;
      z = Math.cos(dropAngle) * 0.12 + (w - 0.5) * 0.045;
    } else if (phase === 'liquid') {
      // Liquid: as closely packed as the solid, but disordered and drifting past neighbours.
      const site = liquidOrder.indexOf(id);
      const column = site % 4;
      const rowIndex = Math.floor(site / 4) % 3;
      const layer = Math.floor(site / 12);
      const siteX = (column - 1.5) * 0.28 + (rowIndex % 2 === 0 ? -0.04 : 0.04);
      const [dx, dy, dz] = liquidDrift(id, time, siteX, rowIndex);
      x = Math.min(0.42, Math.max(-0.42, siteX + dx * 0.9 + (u - 0.5) * 0.06));
      const floor = -0.72;
      const ceiling = Math.max(floor + 0.03, liquidTop - 0.12);
      const rowGap = Math.min(0.3, (ceiling - floor) / 2);
      y = Math.min(Math.max(floor + 0.02 + rowGap * rowIndex + dy * 0.9 + (v - 0.5) * 0.05, floor), ceiling);
      z = (layer - 0.5) * 0.25 + dz * 0.9 + (w - 0.5) * 0.04;
    } else {
      // Gas: widely spread, fast. Each molecule bounces between the walls along its own path.
      const boilingBubbles = state.transition === 'vaporisation' && state.mode === 'boiling' && observation.fractions.liquid > 0.01;
      const lower = boilingBubbles ? -0.62 : gasFloor + 0.06;
      [x, y, z] = gasPosition(1000, id, time, { x: [-0.42, 0.42], y: [lower, Math.max(lower + 0.1, 0.86)], z: [-0.2, 0.2] }, 0.8);
    }
    return { id, phase, position: [x, y, z] as [number, number, number] };
  });
  const liquids = molecules.filter((m) => m.phase === 'liquid' && state.transition !== 'condensation').map((m) => m.position as [number, number, number]);
  relaxSeparation(liquids, 0.17, { x: [-0.45, 0.45], y: [-0.72, Math.max(-0.69, liquidTop - 0.1)], z: [-0.2, 0.2] });
  const gases = molecules.filter((m) => m.phase === 'gas').map((m) => m.position as [number, number, number]);
  relaxSeparation(gases, 0.2, { x: [-0.45, 0.45], y: [-0.72, 0.86], z: [-0.2, 0.2] });
  return molecules;
}

function Molecules({ particles, visible }: { particles: Molecule[]; visible: boolean }) {
  const oxygen = useRef<THREE.InstancedMesh>(null);
  const hydrogen = useRef<THREE.InstancedMesh>(null);
  const bond = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  const oxygenGeometry = useMemo(() => new THREE.SphereGeometry(0.068, 16, 12), []);
  const hydrogenGeometry = useMemo(() => new THREE.SphereGeometry(0.039, 12, 10), []);
  const bondGeometry = useMemo(() => new THREE.CylinderGeometry(0.009, 0.009, 1, 8), []);
  const oxygenMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: ATOM_COLOURS.oxygen, roughness: 0.27, clearcoat: 0.55 }), []);
  const hydrogenMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: ATOM_COLOURS.hydrogen, roughness: 0.24, clearcoat: 0.5 }), []);
  const bondMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#526c86', roughness: 0.48 }), []);

  useEffect(() => {
    const oxygenMesh = oxygen.current;
    const hydrogenMesh = hydrogen.current;
    const bondMesh = bond.current;
    if (!oxygenMesh || !hydrogenMesh || !bondMesh) return;
    const helper = new THREE.Object3D();
    const axis = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    particles.forEach(({ id, position: [x, y, z] }, index) => {
      const centre = new THREE.Vector3(x, y, z);
      helper.position.copy(centre);
      helper.scale.setScalar(1);
      helper.updateMatrix();
      oxygenMesh.setMatrixAt(index, helper.matrix);
      [-1, 1].forEach((side, hydrogenIndex) => {
        const angle = Math.sin(id * 1.4 + index) * 0.4 + side * 0.88;
        const atom = centre.clone().add(new THREE.Vector3(Math.sin(angle) * 0.09, Math.cos(angle) * 0.09, hydrogenIndex ? 0.018 : -0.018));
        const atomIndex = index * 2 + hydrogenIndex;
        helper.position.copy(atom);
        helper.scale.setScalar(1);
        helper.updateMatrix();
        hydrogenMesh.setMatrixAt(atomIndex, helper.matrix);
        direction.copy(atom).sub(centre);
        const length = direction.length();
        quaternion.setFromUnitVectors(axis, direction.normalize());
        helper.position.copy(centre).add(atom).multiplyScalar(0.5);
        helper.quaternion.copy(quaternion);
        helper.scale.set(1, length, 1);
        helper.updateMatrix();
        bondMesh.setMatrixAt(atomIndex, helper.matrix);
      });
    });
    oxygenMesh.instanceMatrix.needsUpdate = true;
    hydrogenMesh.instanceMatrix.needsUpdate = true;
    bondMesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [invalidate, particles]);

  return (
    <group visible={visible}>
      <instancedMesh ref={oxygen} args={[oxygenGeometry, oxygenMaterial, particles.length]} />
      <instancedMesh ref={hydrogen} args={[hydrogenGeometry, hydrogenMaterial, particles.length * 2]} />
      <instancedMesh ref={bond} args={[bondGeometry, bondMaterial, particles.length * 2]} />
      <LatticeLinks molecules={particles} radius={0.0065} />
    </group>
  );
}

function ReservoirShapes({ state, particlesVisible }: { state: TransitionState; particlesVisible: boolean }) {
  const observation = observationAt(state);
  const { solid, liquid } = observation.fractions;
  const phase = state.transition;
  const liquidHeight = liquid * 0.92;
  const liquidTop = -0.78 + liquidHeight;
  const solidHeight = solid * 1.003;
  const solidBase = liquid > 0.002 ? Math.max(-0.78, liquidTop - 0.917 * solidHeight) : -0.78;
  return (
    <group>
      {liquid > 0.002 && phase !== 'condensation' && (
        <>
          <mesh position={[0, -0.78 + liquidHeight / 2, 0]}>
            <cylinderGeometry args={[0.55, 0.58, Math.max(0.03, liquidHeight), 40, 1, false]} />
            <meshPhysicalMaterial color="#32a6c8" roughness={0.18} metalness={0.02} transparent opacity={particlesVisible ? 0.22 : 0.74} clearcoat={0.78} />
          </mesh>
          <mesh position={[0, liquidTop + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.54, 48]} /><meshPhysicalMaterial color="#48b8d1" transparent opacity={particlesVisible ? 0.18 : 0.38} roughness={0.1} clearcoat={0.95} side={THREE.DoubleSide} depthWrite={false} /></mesh>
          <mesh position={[0, liquidTop + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.54, 0.012, 8, 48]} /><meshBasicMaterial color="#d5f5fa" transparent opacity={0.6} /></mesh>
        </>
      )}
      {solid > 0.002 && phase !== 'deposition' && (
        <mesh position={[0, solidBase + solidHeight / 2, 0]} scale={[1, Math.max(0.08, solidHeight), 1]}>
          <boxGeometry args={[0.97, 1, 0.97]} />
          <meshPhysicalMaterial color="#b6e6f0" roughness={0.22} transparent opacity={particlesVisible ? 0.16 : 0.87} clearcoat={0.76} />
        </mesh>
      )}
      {phase === 'condensation' && liquid > 0.002 && Array.from({ length: Math.max(1, Math.round(liquid * 13)) }, (_, i) => {
        const angle = i * 2.399;
        return <mesh key={`drop-${i}`} position={[Math.sin(angle) * 0.58, 0.48 + (i % 4) * 0.14, Math.cos(angle) * 0.12]} scale={[0.075, 0.1, 0.065]}><sphereGeometry args={[1, 18, 14]} /><meshPhysicalMaterial color="#55bed0" roughness={0.1} clearcoat={0.9} /></mesh>;
      })}
      {phase === 'deposition' && solid > 0.002 && Array.from({ length: Math.max(1, Math.round(solid * 12)) }, (_, i) => {
        const angle = i * 2.399;
        return <mesh key={`frost-${i}`} position={[Math.sin(angle) * 0.72, -0.08 + (i % 5) * 0.14, Math.cos(angle) * 0.42 + 0.32]} scale={[0.1, 0.14, 0.085]}><icosahedronGeometry args={[1, 0]} /><meshPhysicalMaterial color="#d0f0f8" roughness={0.32} clearcoat={0.55} /></mesh>;
      })}
      {phase === 'condensation' && liquid > 0.002 && Array.from({ length: Math.max(5, Math.round(liquid * 18)) }, (_, i) => {
        const angle = i * 2.399;
        return <mesh key={`condensation-bead-${i}`} position={[Math.sin(angle) * 0.73, 0.06 + (i % 5) * 0.15, Math.cos(angle) * 0.5 + 0.32]} scale={[0.045, 0.075 + (i % 2) * 0.015, 0.035]}><sphereGeometry args={[1, 14, 10]} /><meshPhysicalMaterial color="#71cfe1" roughness={0.1} metalness={0.02} clearcoat={0.98} /></mesh>;
      })}
      {phase === 'vaporisation' && state.mode === 'boiling' && liquid > 0.03 && Array.from({ length: 8 }, (_, i) => {
        const height = Math.max(0.08, liquidHeight - 0.16);
        const y = -0.68 + (((state.modelTimeSeconds * 0.34 + i * 0.173) % 1) * height);
        return <mesh key={`boil-bubble-${i}`} position={[Math.sin(i * 2.11) * 0.28, y, Math.cos(i * 1.73) * 0.23]} scale={0.035 + (i % 3) * 0.012}><sphereGeometry args={[1, 14, 10]} /><meshPhysicalMaterial color="#c7f2f5" transparent opacity={0.55} roughness={0.08} clearcoat={0.95} /></mesh>;
      })}
    </group>
  );
}

type HeaterState = 'idle' | 'heating' | 'cooling';

const DEFAULT_CAMERA_DIRECTION = new THREE.Vector3(2.55, 1.15, 4.4).normalize();
const CAMERA_TARGET = new THREE.Vector3(0, -0.28, 0);

function Instrument({ state, particles, showMolecules, reducedMotion, viewRevision, heater }: { state: TransitionState; particles: Molecule[]; showMolecules: boolean; reducedMotion: boolean; viewRevision: number; heater: HeaterState }) {
  const { gl } = useThree();
  const camera = useThree((threeState) => threeState.camera);
  const size = useThree((threeState) => threeState.size);
  const controls = useRef<OrbitControlsType | null>(null);
  const sceneDescription = `Graduated glass beaker and controlled hotplate for ${state.transition}, with a water sample and visible H₂O molecules when particle view is on.`;
  useEffect(() => {
    gl.setClearColor('#f2f7fd', 0);
    return () => {};
  }, [gl]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', sceneDescription);
    return () => { canvas.removeAttribute('role'); canvas.removeAttribute('aria-label'); };
  }, [gl, sceneDescription]);
  useEffect(() => {
    // Frame the whole bench: the hot plate and beaker must never be cropped, whatever the aspect ratio.
    const aspect = size.width / Math.max(1, size.height);
    const tangent = Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    const distance = Math.max(3.9 / (2 * tangent), 4.6 / (2 * tangent * aspect));
    camera.position.copy(CAMERA_TARGET).addScaledVector(DEFAULT_CAMERA_DIRECTION, distance);
    controls.current?.target.copy(CAMERA_TARGET);
    controls.current?.update();
  }, [camera, viewRevision, size.width, size.height]);
  // The plate only glows while energy is being added; it shows a cool blue while energy is being removed.
  const cold = state.transition === 'freezing' || state.transition === 'condensation' || state.transition === 'deposition';
  const heat = heater === 'heating';
  const cooling = heater === 'cooling';
  const coilColor = heat ? '#ef6858' : cooling ? '#2d9fe0' : '#6f8394';
  const glow = heat ? 1 : cooling ? 0.55 : 0;
  return (
    <>
      <color attach="background" args={['#f2f7fd']} />
      <StudioLights />
      <pointLight position={[-2, 1, 1]} intensity={heat || cooling ? 0.72 : 0.25} color={coilColor} />
      <LabBench position={[0, -1.34, 0]} width={4.4} depth={2.7} />
      <group position={[0, -0.98, 0]}>
        <mesh position={[0, 0, 0]} geometry={new RoundedBoxGeometry(2.45, 0.36, 1.52, 6, 0.11)} castShadow receiveShadow><meshStandardMaterial color="#31536f" roughness={0.34} metalness={0.18} /></mesh>
        <mesh position={[0, 0.185, 0]} geometry={new RoundedBoxGeometry(2.0, 0.055, 1.22, 5, 0.035)}><meshPhysicalMaterial color="#243c4b" roughness={0.2} metalness={0.2} /></mesh>
        <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.62, 0.05, 12, 56]} /><meshStandardMaterial color={coilColor} emissive={coilColor} emissiveIntensity={0.9 * glow} roughness={0.3} metalness={0.2} /></mesh>
        <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.42, 0.026, 9, 48]} /><meshStandardMaterial color={coilColor} emissive={coilColor} emissiveIntensity={0.55 * glow} roughness={0.34} metalness={0.14} /></mesh>
        <mesh position={[0.7, 0.055, 0.78]} geometry={new RoundedBoxGeometry(0.67, 0.22, 0.035, 4, 0.03)}><meshStandardMaterial color="#142f43" roughness={0.23} /></mesh>
        <mesh position={[0.7, 0.06, 0.805]} geometry={new RoundedBoxGeometry(0.5, 0.11, 0.01, 3, 0.018)}><meshBasicMaterial color={heat ? '#ffd2bc' : cooling ? '#b4e8ff' : '#c9d6df'} /></mesh>
        <mesh position={[-0.82, 0.05, 0.77]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.09, 28]} /><meshStandardMaterial color="#c7d5df" metalness={0.5} roughness={0.26} /></mesh>
        <mesh position={[-0.82, 0.13, 0.77]}><sphereGeometry args={[0.045, 16, 12]} /><meshStandardMaterial color={coilColor} emissive={coilColor} emissiveIntensity={0.6 * glow} /></mesh>
        <mesh position={[0.98, -0.13, -0.52]}><boxGeometry args={[0.055, 1.35, 0.055]} /><meshStandardMaterial color="#526f82" metalness={0.55} roughness={0.28} /></mesh>
        <mesh position={[0.7, 0.5, -0.52]}><boxGeometry args={[0.58, 0.05, 0.055]} /><meshStandardMaterial color="#69879a" metalness={0.5} roughness={0.26} /></mesh>
        <mesh position={[0.7, 0.47, -0.52]}><boxGeometry args={[0.06, 0.18, 0.06]} /><meshStandardMaterial color="#69879a" metalness={0.5} roughness={0.26} /></mesh>
      </group>
      <LabBeaker radius={0.68} height={1.82} particleLens={showMolecules} graduated capacityMl={300} waterColor="#45afc9" position={[0, 0.13, 0]} />
      <mesh position={[0, -0.76, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.7, 0.035, 10, 48]} /><meshStandardMaterial color={coilColor} roughness={0.34} metalness={0.2} emissive={coilColor} emissiveIntensity={0.48 * glow} /></mesh>
      {cold && <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.58, 0.035, 10, 48]} /><meshStandardMaterial color="#82d2e2" roughness={0.24} metalness={0.22} /></mesh>}
      <ReservoirShapes state={state} particlesVisible={showMolecules} />
      <Molecules particles={particles} visible={showMolecules} />
      <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={!reducedMotion} dampingFactor={0.09} minDistance={3.2} maxDistance={12} minPolarAngle={0.42} maxPolarAngle={2.5} />
    </>
  );
}

function ErrorBoundary({ children, onFailure }: { children: ReactNode; onFailure: () => void }) {
  return <BoundaryImpl onFailure={onFailure}>{children}</BoundaryImpl>;
}

type BoundaryState = { hasError: boolean };
class BoundaryImpl extends Component<{ children: ReactNode; onFailure: () => void }, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState { return { hasError: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

function canUseWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const detailsFor: Record<TransitionId, { summary: string; hint: string; challenge: string; right: string; wrong: string }> = {
  melting: { summary: 'A solid gains thermal energy and becomes liquid.', hint: 'At 0 °C, added energy changes the ice and water proportions while temperature holds steady.', challenge: 'What will move ice toward melting?', right: 'Add heat', wrong: 'Remove heat' },
  freezing: { summary: 'Liquid water loses thermal energy and becomes ice.', hint: 'Near 0 °C, cooling changes the water and ice proportions while temperature holds steady.', challenge: 'What will move water toward ice?', right: 'Remove heat', wrong: 'Add heat' },
  vaporisation: { summary: 'Liquid water becomes water vapour.', hint: 'Evaporation leaves from the surface below boiling. Boiling happens through the liquid at 100 °C in this model.', challenge: 'What speeds evaporation?', right: 'Drier air', wrong: 'More humid air' },
  condensation: { summary: 'Water vapour cools and gathers as liquid droplets.', hint: 'A cool surface removes energy from vapour. The accelerated rate is illustrative, not a weather forecast.', challenge: 'What encourages condensation?', right: 'Cool surface', wrong: 'Warm surface' },
  sublimation: { summary: 'Ice becomes water vapour without passing through liquid water.', hint: 'Ice exposed to dry air can sublime below freezing; this route skips the liquid reservoir entirely.', challenge: 'What speeds sublimation?', right: 'Drier air', wrong: 'More humid air' },
  deposition: { summary: 'Water vapour becomes ice without first becoming liquid.', hint: 'Frost can grow where moist air meets a cold surface. The rate here is qualitative.', challenge: 'What encourages frost?', right: 'Cold, humid air', wrong: 'Warm, dry air' },
};

function formatKg(value: number) { return `${(value * 1000).toFixed(value > 0.019 ? 0 : 1)} g`; }
function temperatureText(value: number) { return `${Math.round(value)} °C`; }

const INTENDED_TRANSFER: Partial<Record<TransitionId, readonly [Phase, Phase]>> = {
  vaporisation: ['liquid', 'gas'], condensation: ['gas', 'liquid'],
  sublimation: ['solid', 'gas'], deposition: ['gas', 'solid'],
};
function targetProgress(current: TransitionState, baseline: TransitionState) {
  const intended = INTENDED_TRANSFER[current.transition];
  if (!intended) return 0;
  const [source, destination] = intended;
  const now = observationAt(current).reservoirsKg;
  const before = observationAt(baseline).reservoirsKg;
  return Math.max(0, Math.min(now[destination] - before[destination], before[source] - now[source]));
}

export function ChangeLab({ initialTransition = 'melting', onTransitionChange }: ChangeLabProps): ReactElement {
  const [state, setState] = useState<TransitionState>(() => createTransitionState(initialTransition));
  const [playing, setPlaying] = useState(false);
  const [showMolecules, setShowMolecules] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [prediction, setPrediction] = useState<'right' | 'wrong' | null>(null);
  const [challengeBaseline, setChallengeBaseline] = useState<TransitionState | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(() => !canUseWebGL());
  const [canvasKey, setCanvasKey] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [viewRevision, setViewRevision] = useState(0);
  const [heater, setHeater] = useState<HeaterState>('idle');
  const heaterTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    setPlaying(false);
    setPrediction(null);
    setChallengeBaseline(null);
    setState(createTransitionState(initialTransition));
    setViewRevision((revision) => revision + 1);
  }, [initialTransition]);

  useEffect(() => {
    if (!playing) return;
    const fixedStep = 1 / 60;
    let previousFrame = performance.now();
    let accumulator = 0;
    let requestId = 0;
    const frame = (now: number) => {
      accumulator += Math.min(0.1, Math.max(0, (now - previousFrame) / 1000));
      previousFrame = now;
      const steps = Math.min(6, Math.floor(accumulator / fixedStep));
      if (steps > 0) {
        accumulator -= steps * fixedStep;
        setState((current) => {
          let next = current;
          for (let index = 0; index < steps; index += 1) next = advanceTransition(next, fixedStep);
          return next;
        });
      }
      requestId = window.requestAnimationFrame(frame);
    };
    requestId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(requestId);
  }, [playing]);

  const active = TRANSITIONS.find((entry) => entry.id === state.transition) ?? TRANSITIONS[0];
  const details = state.transition === 'vaporisation' && state.mode === 'boiling'
    ? { ...detailsFor.vaporisation, summary: 'Liquid water boils into vapour through the sample as it reaches its boiling point.', hint: 'Heat warms the liquid to 100 °C. On the plateau, added energy changes liquid into vapour and visible bubbles mark bulk boiling.', challenge: 'What lets boiling continue at 100 °C?', right: 'Add heat', wrong: 'Remove heat' }
    : detailsFor[state.transition];
  const observation = observationAt(state);
  const thermal = thermalStateAtEnergy(state.energyKJ);
  const transferMode = !observation.thermal;
  const particles = useMemo(() => positionsFor(state), [state]);
  const challengeDone = Boolean(prediction === 'right' && challengeBaseline && (
    observation.thermal
      ? (state.transition === 'freezing' ? challengeBaseline.energyKJ - state.energyKJ > 3 : state.energyKJ - challengeBaseline.energyKJ > 3)
      : targetProgress(state, challengeBaseline) > 0.004
  ));
  const activeFlow = observation.thermal
    ? `${active.from} → ${active.to}`
    : observation.direction
      ? `${PHASE_LABELS[observation.direction[0]]} → ${PHASE_LABELS[observation.direction[1]]}`
      : 'No net transfer';

  const selectTransition = (id: TransitionId) => {
    window.clearTimeout(heaterTimer.current);
    setHeater('idle');
    setPlaying(false);
    setPrediction(null);
    setChallengeBaseline(null);
    setState(createTransitionState(id));
    onTransitionChange?.(id);
  };
  useEffect(() => () => window.clearTimeout(heaterTimer.current), []);
  const setHeatCool = (direction: 'heat' | 'cool') => {
    setHeater(direction === 'heat' ? 'heating' : 'cooling');
    window.clearTimeout(heaterTimer.current);
    heaterTimer.current = window.setTimeout(() => setHeater('idle'), 1800);
    if (transferMode) {
      setState((current) => setTransitionEnvironment(current, { surfaceTempC: current.surfaceTempC + (direction === 'heat' ? 5 : -5) }));
    } else {
      setState((current) => addTransitionEnergy(current, direction === 'heat' ? 10 : -10));
    }
  };
  const reset = () => {
    window.clearTimeout(heaterTimer.current);
    setHeater('idle');
    setPlaying(false);
    setPrediction(null);
    setChallengeBaseline(null);
    setState(createTransitionState(state.transition, state.mode));
    setViewRevision((revision) => revision + 1);
  };
  const changeMode = (mode: VaporisationMode) => {
    setPlaying(false);
    setPrediction(null);
    setChallengeBaseline(null);
    setState((current) => setVaporisationMode(current, mode));
  };
  const beginChallenge = () => {
    setShowChallenge((visible) => !visible);
    setPrediction(null);
    setChallengeBaseline(state);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input, select, textarea, button')) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); }
    if (event.key.toLowerCase() === 'h') setHeatCool('heat');
    if (event.key.toLowerCase() === 'c') setHeatCool('cool');
  };
  const recoverGraphics = () => {
    setGraphicsFailed(false);
    setCanvasReady(false);
    setCanvasKey((key) => key + 1);
  };

  return (
    <section ref={rootRef} className="change-lab" data-reduced-motion={reduceMotion ? 'true' : 'false'} data-model-time={state.modelTimeSeconds.toFixed(4)} tabIndex={0} onKeyDown={handleKeyDown} aria-label="MatterLab Change Station">
      <header className="cl-header">
        <div className="cl-brand"><span className="cl-brand-mark"><Beaker size={20} strokeWidth={2.1} /></span><span><strong>Change Station</strong><small>One sample of water · six ways to change</small></span></div>
        <div className="cl-header-note"><span className="cl-live-dot" /> MODEL SAMPLE <b>0.20 kg H₂O</b></div>
      </header>

      <nav className="cl-transition-tabs" aria-label="Choose a change of state">
        {TRANSITIONS.map(({ id, name, from, to, icon: Icon, tint }) => (
          <button type="button" key={id} className={`cl-tab ${state.transition === id ? 'is-active' : ''} tint-${tint}`} onClick={() => selectTransition(id)} aria-pressed={state.transition === id}>
            <Icon size={17} strokeWidth={2.2} /><span><b>{name}</b><small>{from} <ChevronRight size={11} /> {to}</small></span>
          </button>
        ))}
      </nav>

      <div className="cl-workspace">
        <section className="cl-scene-panel" aria-label="Interactive water sample">
          <div className="cl-scene-topline"><div><span className="cl-scene-eyebrow">THE CHANGE</span><h1>{active.name}</h1></div><span className={`cl-condition-chip ${transferMode ? 'is-transfer' : 'is-equilibrium'}`}>{transferMode ? observation.direction ? 'SURFACE TRANSFER' : 'NO NET TRANSFER' : 'THERMAL MODEL'}</span></div>
          <div className="cl-scene-wrap" data-graphics={canvasReady && !graphicsFailed ? 'ready' : graphicsFailed ? 'fallback' : 'starting'} data-heater={heater}>
            {!graphicsFailed && <ErrorBoundary onFailure={() => { setGraphicsFailed(true); setCanvasReady(false); }}>
              <Canvas key={canvasKey} camera={{ position: [2.55, 1.15, 4.4], fov: 34 }} shadows="percentage" dpr={[1, 1.8]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => {
                setCanvasReady(true);
                setGraphicsFailed(false);
                const canvas = gl.domElement;
                watchContextLoss(canvas, () => { setGraphicsFailed(true); setCanvasReady(false); });
              }} fallback={<span aria-hidden="true">3D view unavailable</span>}>
                <Instrument state={state} particles={particles} showMolecules={showMolecules} reducedMotion={reduceMotion} viewRevision={viewRevision} heater={heater} />
              <AdaptiveQuality /></Canvas>
            </ErrorBoundary>}
            {graphicsFailed && <div className="cl-2d-equivalent" role="group" aria-label={`Two dimensional view: ${PHASE_LABELS.solid} ${Math.round(observation.fractions.solid * 100)} percent, ${PHASE_LABELS.liquid} ${Math.round(observation.fractions.liquid * 100)} percent, ${PHASE_LABELS.gas} ${Math.round(observation.fractions.gas * 100)} percent`}>
              <div className="cl-fallback-vessel">
                <span className="cl-fallback-rim" />
                <div className="cl-fallback-reservoirs">
                  {(['solid', 'liquid', 'gas'] as const).map((phase) => <span key={phase} className={`cl-fallback-phase ${phase} ${state.transition === 'condensation' && phase === 'liquid' ? 'condensing' : ''} ${state.transition === 'deposition' && phase === 'solid' ? 'frosting' : ''}`} style={{ height: `${Math.max(3, observation.fractions[phase] * 100)}%` }} />)}
                  {((state.transition === 'condensation' && observation.fractions.liquid > 0.002) || (state.transition === 'deposition' && observation.fractions.solid > 0.002)) && <span className={`cl-fallback-surface-products ${state.transition}`} aria-hidden="true">{Array.from({ length: Math.max(1, Math.round((state.transition === 'condensation' ? observation.fractions.liquid : observation.fractions.solid) * 13)) }, (_, index) => <i key={index} style={{ left: `${25 + (index * 17) % 50}%`, top: `${9 + (index % 4) * 12}%` }} />)}</span>}
                  {showMolecules && particles.map((molecule) => <i key={molecule.id} className={`cl-fallback-molecule ${molecule.phase}`} style={{ left: `${14 + ((molecule.position[0] + 0.55) / 1.1) * 72}%`, bottom: `${8 + ((molecule.position[1] + 0.78) / 1.56) * 82}%` }} />)}
                </div>
                <span className="cl-fallback-base" />
              </div>
              <p><b>2D science view</b><span>The sample and controls are still live. Each dot represents an H₂O molecule.</span></p>
              <button type="button" className="cl-retry-graphics" onClick={recoverGraphics}>Try 3D again</button>
            </div>}
            <span className={`cl-heater-chip ${heater}`} role="status">{heater === 'heating' ? 'Hot plate on: adding energy' : heater === 'cooling' ? 'Cooling: removing energy' : 'Hot plate off'}</span>
            <div className="cl-scene-badge"><span className={`cl-temp-orb ${observation.temperatureC < 5 ? 'cold' : observation.temperatureC > 70 ? 'hot' : ''}`}>{temperatureText(observation.temperatureC)}</span><span><b>{isThermalScenario(state) ? thermal.phaseLabel.split(' · ')[0] : 'Surface transfer'}</b><small>{activeFlow}</small></span></div>
            <div className="cl-scene-caption"><span className="cl-atom-key"><i /> O <i className="hydrogen" /> H</span><span>H₂O molecules keep the same identity</span><span className="cl-orbit-hint">Drag to orbit · scroll or pinch to zoom</span></div>
          </div>
          <div className="cl-scene-toolbar">
            <div className="cl-play-tools"><button type="button" className="cl-play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause model' : 'Play model'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}<span>{playing ? 'Pause' : 'Play'}</span></button><button type="button" className="cl-icon-button" aria-label="Advance model one second" title="Step one second" onClick={() => { setPlaying(false); setState((current) => advanceTransition(current, 1)); }}><StepForward size={18} /><span>Step</span></button><button type="button" className="cl-icon-button" aria-label="Reset this change" title="Reset" onClick={reset}><RotateCcw size={17} /><span>Reset</span></button><button type="button" className="cl-camera-button" aria-label="Reset camera view" title="Reset camera view" onClick={() => setViewRevision((revision) => revision + 1)}><Focus size={17} /></button></div>
            <button type="button" className={`cl-particle-toggle ${showMolecules ? 'is-on' : ''}`} onClick={() => setShowMolecules((value) => !value)} aria-pressed={showMolecules}><span className="cl-mini-molecule" />{showMolecules ? 'Molecules on' : 'Molecules off'}</button>
          </div>
        </section>

        <aside className="cl-control-panel" aria-label="Change controls and water ledger">
          <div className="cl-panel-heading"><div><span className="cl-panel-kicker">TRY IT</span><h2>Change the conditions</h2></div><button className="cl-info-button" type="button" aria-label={showDetails ? 'Hide model detail' : 'Show model detail'} aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}><Info size={17} /></button></div>
          <p className="cl-explanation">{details.summary}</p>
          {state.transition === 'vaporisation' && <div className="cl-mode-switch" role="group" aria-label="Vaporisation type"><button type="button" className={state.mode === 'evaporation' ? 'selected' : ''} aria-pressed={state.mode === 'evaporation'} onClick={() => changeMode('evaporation')}><span>Evaporation</span><small>below boiling</small></button><button type="button" className={state.mode === 'boiling' ? 'selected' : ''} aria-pressed={state.mode === 'boiling'} onClick={() => changeMode('boiling')}><span>Boiling</span><small>through the liquid</small></button></div>}

          {transferMode ? <div className="cl-environment-block">
            <div className="cl-control-caption"><span>ENVIRONMENT</span><small>air {temperatureText(state.airTempC)} · held steady</small></div>
            <label className="cl-range-control"><span><b>Surface temperature</b><output>{temperatureText(state.surfaceTempC)}</output></span><input aria-label="Surface temperature" type="range" min={state.transition === 'vaporisation' || state.transition === 'condensation' ? 0 : -25} max={state.transition === 'sublimation' || state.transition === 'deposition' ? 0 : 60} step={1} value={state.surfaceTempC} onChange={(event) => setState((current) => setTransitionEnvironment(current, { surfaceTempC: Number(event.target.value) }))} style={{ '--range-accent': state.surfaceTempC < 0 ? 'var(--toy-blue,#64b3d0)' : 'var(--toy-coral,#ee8e63)' } as CSSProperties} /><span className="cl-range-ends"><small>Colder</small><small>Warmer</small></span></label>
            <label className="cl-range-control"><span><b>Nearby air humidity</b><output>{Math.round(state.humidityPercent)}%</output></span><input aria-label="Relative humidity of nearby air" type="range" min={0} max={100} step={1} value={state.humidityPercent} onChange={(event) => setState((current) => setTransitionEnvironment(current, { humidityPercent: Number(event.target.value) }))} style={{ '--range-accent': 'var(--toy-teal,#48aaa9)' } as CSSProperties} /><span className="cl-range-ends"><small>Drier air</small><small>More moisture</small></span></label>
            <p className="cl-rate-note"><Sparkles size={14} /> These accelerated surface-transfer rates are illustrative, not calibrated predictions.</p>
          </div> : <div className="cl-thermal-block">
            <div className="cl-control-caption"><span>ENERGY INPUT</span><small>large actions · 10 kJ each</small></div>
            <div className="cl-heat-cool"><button type="button" className="cl-action heat" onClick={() => setHeatCool('heat')}><Flame size={19} /><span>Heat</span><small>+10 kJ</small></button><button type="button" className="cl-action cool" onClick={() => setHeatCool('cool')}><Snowflake size={19} /><span>Cool</span><small>−10 kJ</small></button></div>
            <div className="cl-energy-readout"><span>Model energy</span><b>{state.energyKJ.toFixed(1)} <small>kJ</small></b></div>
            {thermal.isChangingState && <p className="cl-rate-note plateau"><span className="cl-plateau-icon">=</span> Temperature holds at {temperatureText(thermal.temperatureC)} while energy changes the phase fractions.</p>}
          </div>}

          <div className="cl-ledger" aria-label="Conserved water reservoir ledger">
            <div className="cl-ledger-heading"><div><span className="cl-panel-kicker">WATER LEDGER</span><b>Same H₂O, three reservoirs</b></div><span>{formatKg(SAMPLE_MASS_KG)}</span></div>
            {(['solid', 'liquid', 'gas'] as const).map((phase) => <div className="cl-ledger-row" key={phase}>
              <div className="cl-ledger-label"><i style={{ backgroundColor: PHASE_COLOURS[phase] }} /><span>{PHASE_LABELS[phase]}</span><b>{formatKg(observation.reservoirsKg[phase])}</b></div>
              <div className="cl-ledger-track"><span style={{ width: `${observation.fractions[phase] * 100}%`, backgroundColor: PHASE_COLOURS[phase] }} /></div>
            </div>)}
            <div className="cl-ledger-foot"><span>18 H₂O identities</span><b><Check size={13} /> total stays 200 g</b></div>
          </div>

          {showDetails && <div className="cl-detail-note"><Info size={14} /><p>{transferMode ? details.hint : `${details.hint} Energy and temperature follow the verified fixed-pressure water model.`}</p></div>}

          <div className="cl-panel-actions">{transferMode && <div className="cl-heat-cool compact"><button type="button" className="cl-action heat" onClick={() => setHeatCool('heat')}><Flame size={18} /><span>Warm surface</span><small>+5 °C</small></button><button type="button" className="cl-action cool" onClick={() => setHeatCool('cool')}><Snowflake size={18} /><span>Cool surface</span><small>−5 °C</small></button></div>}<button type="button" className={`cl-challenge-launch ${showChallenge ? 'selected' : ''}`} onClick={beginChallenge}><Sparkles size={16} /><span>{showChallenge ? 'Close prediction' : 'Try a prediction'}</span><ChevronRight size={15} /></button></div>

          {showChallenge && <div className="cl-challenge" aria-live="polite"><div className="cl-challenge-title"><span>QUICK CHALLENGE</span>{challengeDone && <b><Check size={13} /> explored</b>}</div><p>{details.challenge}</p><div className="cl-prediction-options"><button type="button" className={prediction === 'right' ? 'picked' : ''} aria-pressed={prediction === 'right'} onClick={() => { setPrediction('right'); setChallengeBaseline(state); }}>{details.right}</button><button type="button" className={prediction === 'wrong' ? 'picked' : ''} aria-pressed={prediction === 'wrong'} onClick={() => { setPrediction('wrong'); setChallengeBaseline(state); }}>{details.wrong}</button></div>{prediction && <p className={`cl-challenge-feedback ${prediction === 'right' ? 'correct' : ''}`}>{prediction === 'right' ? challengeDone ? 'You predicted well and caused a real change in the sample.' : 'Good prediction. Now use the controls to make the change happen.' : 'Try again by thinking about the direction of energy or moisture transfer.'}</p>}</div>}
        </aside>
      </div>

      <footer className="cl-footer"><span><kbd>Space</kbd> play / pause <kbd>H</kbd> heat <kbd>C</kbd> cool</span></footer>
    </section>
  );
}

export default ChangeLab;
