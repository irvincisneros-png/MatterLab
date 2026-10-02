import { Component, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Atom, Check, ChevronRight, CircleHelp, Info, Pause, Play, RotateCcw, RotateCw, Sparkles, StepForward, Thermometer, Zap } from 'lucide-react';
import { LabBench, StudioLights } from './scene/LabPrimitives';
import {
  advanceBec,
  advancePlasma,
  becAtomCounts,
  becCondensateFractionAtTemperature,
  becFractionsAt,
  BEC_CRITICAL_TEMPERATURE_NK,
  BEC_MARKERS,
  createBecState,
  createPlasmaState,
  PLASMA_NUCLEI,
  plasmaForceResponse,
  plasmaLedgerAt,
  setBecTemperature,
  setPlasmaElectricField,
  setPlasmaEnergy,
  type AdvancedExperiment,
  type BecState,
  type PlasmaState,
} from '../science/advancedMatterEngine';
import './AdvancedLab.css';
import { watchContextLoss } from './scene/contextLoss';
import { AdaptiveQuality } from './scene/AdaptiveQuality';

export type { AdvancedExperiment } from '../science/advancedMatterEngine';

export type AdvancedLabProps = {
  initialExperiment?: AdvancedExperiment;
  onExperimentChange?: (id: AdvancedExperiment) => void;
};

type Position = readonly [number, number, number];
type PlasmaParticle = { id: string; kind: 'neutral' | 'ion' | 'electron'; position: Position };
type BecAtom = { id: number; kind: 'condensed' | 'thermal'; position: Position };
type FieldDirection = -1 | 1;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const seeded = (id: number, lane: number) => {
  const value = Math.sin((id + 2) * 78.233 + lane * 32.53) * 43758.5453;
  return value - Math.floor(value);
};

function reflected(value: number, minimum: number, maximum: number) {
  const span = maximum - minimum;
  const cycle = ((value - minimum) % (span * 2) + span * 2) % (span * 2);
  return cycle <= span ? minimum + cycle : maximum - (cycle - span);
}

function gasSpeed(id: number, lane: number) {
  const direction = seeded(id, lane) < 0.5 ? -1 : 1;
  return direction * (0.34 + seeded(id, lane + 20) * 0.5);
}

function plasmaParticles(state: PlasmaState, _reducedMotion: boolean): PlasmaParticle[] {
  const ledger = plasmaLedgerAt(state);
  const time = state.modelTimeSeconds;
  const nuclei: PlasmaParticle[] = Array.from({ length: PLASMA_NUCLEI }, (_, id) => {
    const kind = id < ledger.positiveIons ? 'ion' : 'neutral';
    const zStart = (seeded(id, 2) - 0.5) * 0.28;
    const radialLimitX = Math.sqrt(Math.max(0.1, 0.78 ** 2 - zStart ** 2)) - 0.12;
    const xStart = (seeded(id, 0) - 0.5) * Math.min(1.16, radialLimitX * 1.8);
    const yStart = (seeded(id, 1) - 0.5) * 1.5;
    const x = reflected(xStart + gasSpeed(id, 30) * time, -radialLimitX, radialLimitX);
    const y = reflected(yStart + gasSpeed(id, 31) * time, -0.84, 0.84);
    const z = reflected(zStart + gasSpeed(id, 32) * time * 0.28, -0.28, 0.28);
    return { id: `nucleus-${id}`, kind, position: [x, y, z] };
  });
  const electrons: PlasmaParticle[] = Array.from({ length: ledger.freeElectrons }, (_, id) => {
    const zStart = (seeded(id, 6) - 0.5) * 0.3;
    const radialLimitX = Math.sqrt(Math.max(0.1, 0.78 ** 2 - zStart ** 2)) - 0.08;
    const xStart = (seeded(id, 4) - 0.5) * Math.min(1.3, radialLimitX * 1.8);
    const yStart = (seeded(id, 5) - 0.5) * 1.56;
    const x = reflected(xStart + gasSpeed(id, 40) * time, -radialLimitX, radialLimitX);
    const y = reflected(yStart + gasSpeed(id, 41) * time, -0.88, 0.88);
    const z = reflected(zStart + gasSpeed(id, 42) * time * 0.32, -0.3, 0.3);
    return { id: `free-electron-${id}`, kind: 'electron', position: [x, y, z] };
  });
  return [...nuclei, ...electrons];
}

function becAtoms(state: BecState, _reducedMotion: boolean): BecAtom[] {
  const counts = becAtomCounts(state);
  const time = state.modelTimeSeconds;
  return Array.from({ length: counts.total }, (_, id) => {
    const kind = id < counts.condensed ? 'condensed' : 'thermal';
    const a = seeded(id, 10) * Math.PI * 2;
    const b = Math.acos(2 * seeded(id, 11) - 1);
    const r = kind === 'condensed' ? 0.2 + seeded(id, 12) * 0.12 : 0.53 + seeded(id, 12) * 0.32;
    const drift = kind === 'condensed' ? 0.025 : 0.06;
    const x = Math.sin(b) * Math.cos(a + time * drift) * r + Math.sin(time * 0.45 + id) * drift * 0.25;
    const y = Math.cos(b) * r + Math.sin(time * drift * 0.8 + id * 0.9) * drift * 0.34;
    const z = Math.sin(b) * Math.sin(a + time * drift) * r + Math.cos(time * 0.37 + id) * drift * 0.24;
    return { id, kind, position: [x, y, z] as const };
  });
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

function ChamberBase({ tint }: { tint: string }) {
  return (
    <group position={[0, -1.22, 0]}>
      <mesh><cylinderGeometry args={[1.23, 1.33, 0.18, 56]} /><meshStandardMaterial color="#e4edf7" roughness={0.58} /></mesh>
      <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[1.08, 1.14, 0.12, 56]} /><meshStandardMaterial color="#235cda" metalness={0.12} roughness={0.42} /></mesh>
      <mesh position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.9, 0.035, 10, 56]} /><meshStandardMaterial color={tint} metalness={0.3} roughness={0.3} /></mesh>
    </group>
  );
}

function PlasmaElectrodes() {
  return <>
    {([-1, 1] as const).map((side) => <group key={side} position={[side * 0.94, 0, 0]}>
      <mesh><boxGeometry args={[0.09, 1.72, 0.58]} /><meshPhysicalMaterial color={side < 0 ? '#df8275' : '#8e7dd0'} transparent opacity={0.72} metalness={0.27} roughness={0.24} clearcoat={0.85} emissive={side < 0 ? '#812e37' : '#433286'} emissiveIntensity={0.15} /></mesh>
      {[-0.86, 0.86].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.105, 0.105, 0.12, 24]} /><meshStandardMaterial color={side < 0 ? '#bd655e' : '#6957aa'} metalness={0.4} roughness={0.26} /></mesh>)}
      <mesh position={[side * 0.09, 0, 0]}><boxGeometry args={[0.018, 1.5, 0.6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.44} /></mesh>
    </group>)}
    {[0, 1, 2, 3].map((index) => {
      const angle = index * Math.PI / 2 + Math.PI / 4;
      const x = Math.cos(angle) * 1.13, z = Math.sin(angle) * 1.13;
      return <group key={index} position={[x, 0, z]}>
        <mesh><cylinderGeometry args={[0.022, 0.022, 2.22, 10]} /><meshStandardMaterial color="#829aad" metalness={0.48} roughness={0.28} /></mesh>
        {[-1.08, 1.08].map((y) => <mesh key={y} position={[0, y, 0]}><sphereGeometry args={[0.047, 12, 10]} /><meshStandardMaterial color="#dce7ef" metalness={0.38} roughness={0.26} /></mesh>)}
      </group>;
    })}
  </>;
}

function BecOpticalFrame({ glow }: { glow: number }) {
  return <>
    <mesh rotation={[0.18, 0.18, 0.06]}><torusGeometry args={[1.14, 0.026, 10, 64]} /><meshStandardMaterial color="#8170bd" metalness={0.43} roughness={0.27} /></mesh>
    <mesh rotation={[Math.PI / 2, 0.26, 0]}><torusGeometry args={[1.14, 0.026, 10, 64]} /><meshStandardMaterial color="#a394c8" metalness={0.42} roughness={0.27} /></mesh>
    <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 2.04, 8]} /><meshBasicMaterial color="#b9a3f6" transparent opacity={0.18 + glow * 0.22} depthWrite={false} /></mesh>
    <mesh position={[0.02, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 2.04, 8]} /><meshBasicMaterial color="#a78cf0" transparent opacity={0.15 + glow * 0.2} depthWrite={false} /></mesh>
    {[[1.12, 0, 0], [-1.12, 0, 0], [0, 0, 1.12], [0, 0, -1.12]].map(([x, y, z], index) => <mesh key={index} position={[x, y, z]}><boxGeometry args={[0.15, 0.14, 0.14]} /><meshStandardMaterial color="#d7cdf5" metalness={0.28} roughness={0.24} emissive="#896bd6" emissiveIntensity={0.25 + glow * 0.35} /></mesh>)}
    <mesh position={[0, -1.17, 0]}><cylinderGeometry args={[0.22, 0.28, 0.24, 36]} /><meshPhysicalMaterial color="#d5deec" metalness={0.56} roughness={0.25} clearcoat={0.8} /></mesh>
    <mesh position={[0, -1.3, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.25, 0.024, 10, 36]} /><meshStandardMaterial color="#8b78bf" metalness={0.4} roughness={0.28} /></mesh>
  </>;
}

function NeutralHydrogen({ position }: { position: Position }) {
  return (
    <group position={position}>
      <mesh><sphereGeometry args={[0.09, 18, 14]} /><meshPhysicalMaterial color="#63c4bc" roughness={0.27} clearcoat={0.8} /></mesh>
      <mesh rotation={[0.55, 0.2, 0.15]}><torusGeometry args={[0.128, 0.008, 6, 28]} /><meshBasicMaterial color="#f7d780" transparent opacity={0.88} /></mesh>
      <mesh position={[0.12, 0.04, 0.02]}><sphereGeometry args={[0.027, 12, 10]} /><meshStandardMaterial color="#fff0ae" emissive="#dfb451" emissiveIntensity={0.32} /></mesh>
    </group>
  );
}

function PositiveIon({ position }: { position: Position }) {
  return (
    <group position={position}>
      <mesh><sphereGeometry args={[0.105, 18, 14]} /><meshPhysicalMaterial color="#a18be3" roughness={0.2} clearcoat={1} emissive="#684da8" emissiveIntensity={0.23} /></mesh>
      <mesh rotation={[Math.PI / 2, 0.35, 0]}><torusGeometry args={[0.145, 0.013, 8, 28]} /><meshBasicMaterial color="#d9caff" transparent opacity={0.92} /></mesh>
    </group>
  );
}

function FreeElectron({ position }: { position: Position }) {
  return <mesh position={position}><sphereGeometry args={[0.053, 16, 12]} /><meshPhysicalMaterial color="#ff937d" roughness={0.16} clearcoat={1} emissive="#c94e70" emissiveIntensity={0.36} /></mesh>;
}

function ForceArrow({ direction, y, colour, opacity = 1 }: { direction: FieldDirection; y: number; colour: string; opacity?: number }) {
  const rotation = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
  return (
    <group position={[0, y, 0]} rotation={[0, 0, rotation]}>
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.36, 8]} /><meshBasicMaterial color={colour} transparent opacity={opacity} /></mesh>
      <mesh position={[0, 0.22, 0]}><coneGeometry args={[0.06, 0.14, 12]} /><meshBasicMaterial color={colour} transparent opacity={opacity} /></mesh>
    </group>
  );
}

function PlasmaWorld({ state, particles }: { state: PlasmaState; particles: PlasmaParticle[] }) {
  const ledger = plasmaLedgerAt(state);
  const fieldDirection: FieldDirection = state.electricField < 0 ? -1 : 1;
  const ionDirection = (Math.sign(plasmaForceResponse(1, state.electricField)) || fieldDirection) as FieldDirection;
  const electronDirection = (Math.sign(plasmaForceResponse(-1, state.electricField)) || fieldDirection * -1) as FieldDirection;
  const fieldOpacity = clamp(Math.abs(state.electricField) / 100, 0.08, 0.82);
  return (
    <>
      <color attach="background" args={['#f0f7ff']} />
      <StudioLights />
      <LabBench position={[0, -1.36, 0]} width={3.9} depth={2.9} />
      <pointLight position={[-2, 1.1, 1]} intensity={1.2} color="#ef826f" />
      <pointLight position={[2, 0.4, -1]} intensity={1.4} color="#8672d0" />
      <ChamberBase tint="#dd8b73" />
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.87, 0.92, 2.16, 48, 1, true]} /><meshPhysicalMaterial color="#9cc5c6" transparent opacity={0.15} roughness={0.12} metalness={0.08} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh position={[0, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.88, 0.055, 12, 56]} /><meshStandardMaterial color="#bdc9bb" metalness={0.2} roughness={0.3} /></mesh>
      <mesh position={[0, -1.08, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.86, 0.07, 12, 56]} /><meshStandardMaterial color="#d77c69" metalness={0.2} roughness={0.32} emissive="#a8444f" emissiveIntensity={0.1} /></mesh>
      <PlasmaElectrodes />
      {[-0.25, 0, 0.25].map((z) => <mesh key={z} position={[0, 1.3, z]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.008, 0.008, 1.8, 8]} /><meshBasicMaterial color="#557b95" transparent opacity={fieldOpacity * 0.42} /></mesh>)}
      {Math.abs(state.electricField) > 2 && <>
        <ForceArrow direction={fieldDirection} y={1.08} colour="#426f8c" opacity={fieldOpacity} />
        {ledger.positiveIons > 0 && <ForceArrow direction={ionDirection} y={0.48} colour="#a18be3" opacity={fieldOpacity} />}
        {ledger.freeElectrons > 0 && <ForceArrow direction={electronDirection} y={-0.12} colour="#eb7a75" opacity={fieldOpacity} />}
      </>}
      {particles.map((particle) => {
        if (particle.kind === 'ion') return <PositiveIon key={particle.id} position={particle.position} />;
        if (particle.kind === 'electron') return <FreeElectron key={particle.id} position={particle.position} />;
        return <NeutralHydrogen key={particle.id} position={particle.position} />;
      })}
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.2} maxDistance={7.5} maxPolarAngle={Math.PI * 0.84} />
    </>
  );
}

function BecWorld({ state, atoms }: { state: BecState; atoms: BecAtom[] }) {
  const condensedFraction = becCondensateFractionAtTemperature(state.temperatureNK, state.criticalTemperatureNK);
  const glow = 0.08 + condensedFraction * 0.32;
  return (
    <>
      <color attach="background" args={['#f3f7ff']} />
      <StudioLights />
      <LabBench position={[0, -1.36, 0]} width={3.9} depth={2.9} />
      <pointLight position={[0, 0.1, 0]} intensity={0.9 + condensedFraction} color="#9c75dc" />
      <ChamberBase tint="#9881ce" />
      <mesh><sphereGeometry args={[1.08, 40, 32]} /><meshPhysicalMaterial color="#c4b6d2" transparent opacity={0.105} roughness={0.12} metalness={0.04} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <BecOpticalFrame glow={glow} />
      {[0, 1, 2].map((index) => <mesh key={index} rotation={[index * 0.46, index * 0.8, index * 0.28]}><torusGeometry args={[1.045 + index * 0.008, 0.018, 8, 60]} /><meshStandardMaterial color={index === 1 ? '#9a84ca' : '#b1a4c0'} metalness={0.2} roughness={0.34} transparent opacity={0.72} /></mesh>)}
      <mesh position={[0, -1.08, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.92, 0.07, 12, 56]} /><meshStandardMaterial color="#8d75bc" metalness={0.28} roughness={0.3} /></mesh>
      {condensedFraction > 0.015 && [0, 1, 2].map((index) => <mesh key={`wave-${index}`} rotation={[0.4 + index * 0.75, index * 0.62, index * 0.35]} scale={0.42 + index * 0.16 + Math.sin(state.modelTimeSeconds * 0.7 + index) * 0.018}>
        <torusGeometry args={[0.9, 0.012, 8, 64]} />
        <meshBasicMaterial color={index === 1 ? '#a188e2' : '#cab5f2'} transparent opacity={glow * (1 - index * 0.16)} />
      </mesh>)}
      <mesh><sphereGeometry args={[0.23 + condensedFraction * 0.12, 28, 22]} /><meshBasicMaterial color="#9473d4" transparent opacity={condensedFraction * 0.1} depthWrite={false} /></mesh>
      {atoms.map((atom) => <mesh key={atom.id} position={atom.position}>
        <sphereGeometry args={[atom.kind === 'condensed' ? 0.067 : 0.072, 16, 12]} />
        <meshPhysicalMaterial color={atom.kind === 'condensed' ? '#b7a2f4' : '#f3bd82'} roughness={0.22} clearcoat={0.86} emissive={atom.kind === 'condensed' ? '#755ac1' : '#ab6b43'} emissiveIntensity={atom.kind === 'condensed' ? 0.22 : 0.08} />
      </mesh>)}
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.2} maxDistance={7.5} maxPolarAngle={Math.PI * 0.84} />
    </>
  );
}

function TwoDimensionalView({ experiment, plasma, bec, plasmaView, becView }: { experiment: AdvancedExperiment; plasma: PlasmaState; bec: BecState; plasmaView: PlasmaParticle[]; becView: BecAtom[] }) {
  if (experiment === 'plasma') {
    const ledger = plasmaLedgerAt(plasma);
    const hasChargedSpecies = ledger.positiveIons > 0 && ledger.freeElectrons > 0;
    return (
      <div className="al-fallback al-fallback-plasma" role="img" aria-label={`2D hydrogen plasma view. ${ledger.neutralAtoms} neutral hydrogen atoms, ${ledger.positiveIons} positive ions and ${ledger.freeElectrons} free electrons. Net charge is zero.`}>
        <div className={`al-fallback-rig ${plasma.electricField < 0 ? 'is-reversed' : ''}`}><span className="al-fallback-glass"><i className="al-field-line" />{hasChargedSpecies && <><i className="al-force-plus" /><i className="al-force-minus" /></>}{plasmaView.map((particle) => <i key={particle.id} className={`al-fallback-particle ${particle.kind}`} style={{ left: `${50 + particle.position[0] * 30}%`, top: `${49 - particle.position[1] * 28}%` }} />)}</span><span className="al-fallback-base" /></div>
        <p><b>2D hydrogen plasma view</b><span>{hasChargedSpecies ? 'Counts, charges and the live model still work. Arrows show qE force directions.' : 'The field direction remains visible; force arrows appear when charged particles are present.'}</span></p>
      </div>
    );
  }
  const fractions = becFractionsAt(bec);
  return (
    <div className="al-fallback al-fallback-bec" role="img" aria-label={`2D rubidium-87 trap. Temperature ${Math.round(bec.temperatureNK)} nanokelvins, condensate fraction ${Math.round(fractions.condensed * 100)} percent, ${BEC_MARKERS} schematic atom markers.`}>
      <div className="al-fallback-trap"><i className="al-fallback-cloud" style={{ opacity: 0.08 + fractions.condensed * 0.52 }} />{becView.map((atom) => <i key={atom.id} className={`al-fallback-atom ${atom.kind}`} style={{ left: `${50 + atom.position[0] * 35}%`, top: `${50 - atom.position[1] * 35}%` }} />)}</div>
      <p><b>2D ultracold trap view</b><span>Every atom remains represented; the centre shows shared-state density.</span></p>
    </div>
  );
}

export function AdvancedLab({ initialExperiment = 'plasma', onExperimentChange }: AdvancedLabProps): ReactElement {
  const [experiment, setExperiment] = useState<AdvancedExperiment>(initialExperiment);
  const [plasma, setPlasma] = useState<PlasmaState>(() => createPlasmaState());
  const [bec, setBec] = useState<BecState>(() => createBecState());
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(() => !canUseWebGL());
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [plasmaChallenge, setPlasmaChallenge] = useState<ReadonlySet<FieldDirection>>(() => new Set());
  const [becChallenge, setBecChallenge] = useState({ cooled: false, rewarmed: false });
  const rootRef = useRef<HTMLElement>(null);
  const initialValue = useRef(initialExperiment);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (initialValue.current === initialExperiment) return;
    initialValue.current = initialExperiment;
    const next = initialExperiment ?? 'plasma';
    setExperiment(next);
    setPlaying(false);
    setChallengeOpen(false);
    setShowDetails(false);
    if (next === 'plasma') setPlasma(createPlasmaState());
    else setBec(createBecState());
    setPlasmaChallenge(new Set());
    setBecChallenge({ cooled: false, rewarmed: false });
  }, [initialExperiment]);

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
        if (experiment === 'plasma') {
          setPlasma((current) => {
            let next = current;
            for (let index = 0; index < steps; index += 1) next = advancePlasma(next, fixedStep);
            return next;
          });
        } else {
          setBec((current) => {
            let next = current;
            for (let index = 0; index < steps; index += 1) next = advanceBec(next, fixedStep);
            return next;
          });
        }
      }
      requestId = window.requestAnimationFrame(frame);
    };
    requestId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(requestId);
  }, [experiment, playing]);

  const plasmaView = useMemo(() => plasmaParticles(plasma, reducedMotion), [plasma, reducedMotion]);
  const becView = useMemo(() => becAtoms(bec, reducedMotion), [bec, reducedMotion]);
  const plasmaLedger = plasmaLedgerAt(plasma);
  const becFractions = becFractionsAt(bec);
  const becCounts = becAtomCounts(bec);
  const plasmaChallengeDone = plasmaLedger.positiveIons > 0 && plasmaChallenge.has(1) && plasmaChallenge.has(-1);
  const becChallengeDone = becChallenge.cooled && becChallenge.rewarmed && bec.temperatureNK >= bec.criticalTemperatureNK && becFractions.condensed === 0;
  const fieldDirection: FieldDirection = plasma.electricField < 0 ? -1 : 1;
  const fieldArrow = Math.abs(plasma.electricField) < 2 ? 'off' : fieldDirection > 0 ? '→' : '←';
  const ionForceArrow = plasmaForceResponse(1, plasma.electricField) === 0 ? 'none' : plasmaForceResponse(1, plasma.electricField) > 0 ? '→' : '←';
  const electronForceArrow = plasmaForceResponse(-1, plasma.electricField) === 0 ? 'none' : plasmaForceResponse(-1, plasma.electricField) > 0 ? '→' : '←';

  const selectExperiment = (id: AdvancedExperiment) => {
    if (id === experiment) return;
    setPlaying(false);
    setExperiment(id);
    setShowDetails(false);
    setChallengeOpen(false);
    onExperimentChange?.(id);
  };

  const reset = () => {
    setPlaying(false);
    setPlasma(createPlasmaState());
    setBec(createBecState());
    setPlasmaChallenge(new Set());
    setBecChallenge({ cooled: false, rewarmed: false });
  };

  const setEnergy = (value: number) => setPlasma((current) => setPlasmaEnergy(current, value));
  const setField = (value: number) => {
    setPlasma((current) => setPlasmaElectricField(current, value));
    const direction: FieldDirection = value < 0 ? -1 : 1;
    if (challengeOpen && plasmaLedger.positiveIons > 0 && Math.abs(value) >= 2) {
      setPlasmaChallenge((current) => new Set(current).add(direction));
    }
  };

  const setTemperature = (value: number) => {
    setBec((current) => {
      const next = setBecTemperature(current, value);
      if (challengeOpen) {
        setBecChallenge((progress) => ({
          cooled: progress.cooled || next.temperatureNK < next.criticalTemperatureNK,
          rewarmed: progress.rewarmed || (progress.cooled && next.temperatureNK >= next.criticalTemperatureNK),
        }));
      }
      return next;
    });
  };

  const toggleChallenge = () => {
    setChallengeOpen((open) => !open);
    setPlasmaChallenge(new Set());
    setBecChallenge({ cooled: false, rewarmed: false });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input, select, textarea, button')) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); }
    if (event.key.toLowerCase() === 'r') reset();
  };

  const retryGraphics = () => {
    if (!canUseWebGL()) return;
    setGraphicsFailed(false);
    setCanvasReady(false);
    setCanvasKey((key) => key + 1);
  };
  const resetCamera = () => {
    setCanvasReady(false);
    setCanvasKey((key) => key + 1);
  };
  const activeDescription = experiment === 'plasma'
    ? 'An illustrative hydrogen gas model. Relative energy changes the balance of neutral atoms and paired ions plus free electrons.'
    : 'An illustrative trapped rubidium-87 gas. Cooling below the chosen critical temperature increases its shared quantum-state fraction.';

  return (
    <section ref={rootRef} className={`advanced-lab al-${experiment}`} data-model-time={(experiment === 'plasma' ? plasma.modelTimeSeconds : bec.modelTimeSeconds).toFixed(4)} tabIndex={0} onKeyDown={handleKeyDown} aria-label="MatterLab Beyond Three advanced experiments">
      <header className="al-header">
        <div className="al-brand"><span className="al-brand-mark"><Atom size={21} strokeWidth={2.1} /></span><span><strong>Beyond Three</strong><small>Two atomic gases · optional experiments</small></span></div>
        <span className="al-model-pill"><i /> LIVE MODEL</span>
      </header>

      <nav className="al-experiment-tabs" aria-label="Choose an advanced experiment">
        <button type="button" className={experiment === 'plasma' ? 'is-active' : ''} aria-pressed={experiment === 'plasma'} onClick={() => selectExperiment('plasma')}><Zap size={18} /><span><b>Plasma</b><small>Hydrogen gas</small></span><ChevronRight size={16} /></button>
        <button type="button" className={experiment === 'bec' ? 'is-active' : ''} aria-pressed={experiment === 'bec'} onClick={() => selectExperiment('bec')}><Sparkles size={18} /><span><b>Bose–Einstein condensate</b><small>Rubidium-87 · ultracold trap</small></span><ChevronRight size={16} /></button>
      </nav>

      <div className="al-workspace">
        <section className="al-scene-panel" aria-label={experiment === 'plasma' ? 'Hydrogen plasma chamber' : 'Ultracold rubidium trap'}>
          <div className="al-scene-topline"><div><span className="al-eyebrow">{experiment === 'plasma' ? 'CHARGES IN A GAS' : 'A SHARED QUANTUM STATE'}</span><h1>{experiment === 'plasma' ? 'Hydrogen plasma' : 'Ultracold rubidium'}</h1></div><span className={`al-condition-chip ${experiment}`}>{experiment === 'plasma' ? plasmaLedger.positiveIons > 0 ? 'IONISED GAS' : 'NEUTRAL GAS' : 'TRAPPED ⁸⁷RB'}</span></div>
      <div className="al-scene-wrap" data-graphics={canvasReady && !graphicsFailed ? 'ready' : graphicsFailed ? 'fallback' : 'starting'} data-charge-forces={experiment === 'plasma' ? plasmaLedger.positiveIons > 0 && plasmaLedger.freeElectrons > 0 ? 'present' : 'absent' : 'not-applicable'}>
            {!graphicsFailed && <ErrorBoundary key={canvasKey} onFailure={() => { setGraphicsFailed(true); setCanvasReady(false); }}>
              <Canvas key={`${experiment}-${canvasKey}`} className="al-canvas" camera={{ position: [3.65, 2.35, 5.55], fov: 35 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => {
                setCanvasReady(true);
                setGraphicsFailed(false);
                const canvas = gl.domElement;
                watchContextLoss(canvas, () => { setGraphicsFailed(true); setCanvasReady(false); });
              }} fallback={null}>
                {experiment === 'plasma' ? <PlasmaWorld state={plasma} particles={plasmaView} /> : <BecWorld state={bec} atoms={becView} />}
              <AdaptiveQuality /></Canvas>
            </ErrorBoundary>}
            {graphicsFailed && <>
              <TwoDimensionalView experiment={experiment} plasma={plasma} bec={bec} plasmaView={plasmaView} becView={becView} />
              <button className="al-retry-graphics" type="button" onClick={retryGraphics}>Try 3D again</button>
            </>}
            {experiment === 'plasma' ? <div className="al-scene-readout plasma-readout"><b>{plasmaLedger.positiveIons} H⁺</b><i /> <b>{plasmaLedger.freeElectrons} e⁻</b><small>{plasmaLedger.neutralAtoms} neutral H</small></div> : <div className="al-scene-readout bec-readout"><b>{Math.round(bec.temperatureNK)} <small>nK</small></b><i /><b>{Math.round(becFractions.condensed * 100)}<small>% shared</small></b></div>}
            <div className="al-scene-caption"><span><i className={experiment === 'plasma' ? 'warm' : 'cool'} /></span>{experiment === 'plasma' ? 'Hydrogen particles · schematic paths' : 'Rubidium atoms · density wave is schematic'}</div>
          </div>
          <div className="al-scene-toolbar">
            <div className="al-play-tools">
              <button type="button" className="al-play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause model' : 'Play model'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}<span>{playing ? 'Pause' : 'Play'}</span></button>
              <button type="button" className="al-tool-button" aria-label="Advance model one second" title="Step model" onClick={() => { setPlaying(false); if (experiment === 'plasma') setPlasma((current) => advancePlasma(current, 1)); else setBec((current) => advanceBec(current, 1)); }}><StepForward size={18} /><span>Step</span></button>
              <button type="button" className="al-tool-button" aria-label="Reset experiment" title="Reset experiment" onClick={reset}><RotateCcw size={17} /><span>Reset</span></button>
            </div>
            <button type="button" className="al-view-button" aria-label="Reset camera view" onClick={resetCamera}><RotateCw size={16} /><span>Reset view</span></button>
          </div>
          {experiment === 'plasma' && <div className="al-force-note" aria-live="polite">
            <b>E {fieldArrow}</b><span>{plasmaLedger.positiveIons > 0 ? `H⁺ force ${ionForceArrow}` : 'No H⁺ present'}</span><span>{plasmaLedger.freeElectrons > 0 ? `e⁻ force ${electronForceArrow}` : 'No free e⁻ present'}</span><span>Neutral H: q = 0</span>
          </div>}
        </section>

        <aside className="al-control-panel" aria-label="Experiment controls and conserved counts">
          <div className="al-panel-heading"><div><span className="al-kicker">TRY IT</span><h2>{experiment === 'plasma' ? 'Change the energy and field' : 'Cool the trapped gas'}</h2></div><button className="al-info-button" type="button" aria-label={showDetails ? 'Hide model notes' : 'Show model notes'} aria-expanded={showDetails} onClick={() => setShowDetails((visible) => !visible)}><Info size={17} /></button></div>
          <p className="al-explanation">{activeDescription}</p>

          {experiment === 'plasma' ? <>
            <div className="al-control-block">
              <label className="al-range-control"><span><b><Zap size={15} /> Relative energy input</b><output>{Math.round(plasma.energyInput)}%</output></span><input aria-label="Energy input" type="range" min="0" max="100" step="1" value={plasma.energyInput} onChange={(event) => setEnergy(Number(event.currentTarget.value))} /><span className="al-range-ends"><small>Recombine</small><small>Ionise</small></span></label>
              <div className="al-action-row"><button type="button" className="al-action plasma-action" onClick={() => setEnergy(plasma.energyInput + 12)}><Zap size={18} /><span>Add energy</span><small>more ionisation</small></button><button type="button" className="al-action neutral-action" onClick={() => setEnergy(plasma.energyInput - 12)}><span className="al-recombine-icon">↘</span><span>Lower energy</span><small>recombination</small></button></div>
            </div>

            <div className="al-control-block field-block">
              <label className="al-range-control"><span><b><Zap size={15} /> Electric field</b><output>{Math.round(plasma.electricField)}%</output></span><input aria-label="Electric field" type="range" min="-100" max="100" step="1" value={plasma.electricField} onChange={(event) => setField(Number(event.currentTarget.value))} /><span className="al-range-ends"><small>← field</small><small>field →</small></span></label>
              <button type="button" className="al-reverse-button" aria-label="Reverse electric field" onClick={() => setField(plasma.electricField === 0 ? -48 : -plasma.electricField)}><RotateCw size={16} /> Reverse field <span>E {fieldArrow}</span></button>
              <p className="al-small-note">The arrows show electric force qE, not predicted paths. Neutral H has no charged force.</p>
            </div>

            <div className="al-ledger plasma-ledger" aria-label="Hydrogen particle and charge ledger">
              <div className="al-ledger-title"><span className="al-kicker">CONSERVED PARTICLES</span><b>Hydrogen sample</b></div>
              <div className="al-ledger-grid"><div><i className="neutral-dot" /><span>Neutral H</span><b>{plasmaLedger.neutralAtoms}</b></div><div><i className="ion-dot" /><span>Positive ions H⁺</span><b>{plasmaLedger.positiveIons}</b></div><div><i className="electron-dot" /><span>Free electrons e⁻</span><b>{plasmaLedger.freeElectrons}</b></div><div><i className="bound-dot" /><span>Bound electrons</span><b>{plasmaLedger.boundElectrons}</b></div></div>
              <div className="al-ledger-foot"><span>{plasmaLedger.nuclei} nuclei · {plasmaLedger.totalElectrons} electrons total</span><b><Check size={13} /> net charge {plasmaLedger.netChargeInElementaryCharges > 0 ? '+' : ''}{plasmaLedger.netChargeInElementaryCharges}</b></div>
              <small>Counts describe the full model sample. The 3D markers are schematic, not a literal gas of {PLASMA_NUCLEI} atoms.</small>
            </div>
          </> : <>
            <div className="al-critical-card"><span className="al-critical-orb"><Thermometer size={21} /></span><span><small>MODEL CRITICAL TEMPERATURE</small><b>{bec.criticalTemperatureNK} nK <em>· NIST-inspired preset</em></b></span><button type="button" onClick={() => setTemperature(BEC_CRITICAL_TEMPERATURE_NK)} aria-label="Set temperature to the 180 nanokelvin preset">180 nK preset</button></div>
            <div className="al-control-block bec-control-block">
              <label className="al-range-control"><span><b><Thermometer size={15} /> Trap temperature</b><output>{Math.round(bec.temperatureNK)} nK</output></span><input aria-label="Temperature" type="range" min="10" max="360" step="1" value={bec.temperatureNK} onChange={(event) => setTemperature(Number(event.currentTarget.value))} /><span className="al-range-ends"><small>Colder</small><small>Warmer</small></span></label>
              <div className="al-action-row"><button type="button" className="al-action cold-action" onClick={() => setTemperature(bec.temperatureNK - 20)}><span className="al-snowflake">✳</span><span>Cool</span><small>−20 nK</small></button><button type="button" className="al-action warm-action" onClick={() => setTemperature(bec.temperatureNK + 20)}><Thermometer size={18} /><span>Warm</span><small>+20 nK</small></button></div>
              <p className="al-small-note">A nanokelvin is one billionth of a kelvin. The control stays above 0 K.</p>
            </div>
            <div className="al-ledger bec-ledger" aria-label="Rubidium atom and model-fraction ledger">
              <div className="al-ledger-title"><span className="al-kicker">SAME RUBIDIUM ATOMS</span><b>Model components</b></div>
              <div className="al-bec-meter"><div><span>Shared quantum state</span><b>{Math.round(becFractions.condensed * 100)}%</b></div><i><span style={{ width: `${becFractions.condensed * 100}%` }} /></i><div><span>Thermal cloud</span><b>{Math.round(becFractions.thermal * 100)}%</b></div></div>
              <div className="al-ledger-foot"><span>{becCounts.total} schematic atom markers</span><b><Check size={13} /> total stays {becCounts.total}</b></div>
              <small>Condensed: {becCounts.condensed} markers · thermal: {becCounts.thermal} markers. They remain atoms and keep moving.</small>
            </div>
          </>}

          {showDetails && <div className="al-detail-note"><CircleHelp size={15} /><p>{experiment === 'plasma'
            ? 'Energy and ionisation are linked by a simple display curve, not a measured hydrogen rate. Each ionisation releases one electron; each recombination binds that same model electron. Field controls report qE force direction only.'
            : 'The ideal harmonic-trap relation is f₀ = 1 − (T/Tc)³ below Tc and zero at or above Tc. It assumes an ideal, non-interacting gas in a fixed harmonic trap. The 180 nK reference is specific to one NIST experiment, not a universal threshold.'}</p></div>}

          <div className="al-panel-actions"><button type="button" className={`al-challenge-button ${challengeOpen ? 'selected' : ''}`} onClick={toggleChallenge}><Sparkles size={16} /><span>{challengeOpen ? 'Close challenge' : 'Try a challenge'}</span><ChevronRight size={15} /></button></div>
          {challengeOpen && (experiment === 'plasma' ? <div className="al-challenge" aria-live="polite"><div className="al-challenge-title"><span>FIELD EXPLORER</span>{plasmaChallengeDone && <b><Check size={13} /> completed</b>}</div><p>Make some ions, then compare the charged forces with the field pointing both ways.</p><div className="al-challenge-steps"><span className={plasmaLedger.positiveIons > 0 ? 'done' : ''}><i>{plasmaLedger.positiveIons > 0 ? '✓' : '1'}</i>Create H⁺ and e⁻</span><span className={plasmaChallenge.has(1) ? 'done' : ''}><i>{plasmaChallenge.has(1) ? '✓' : '2'}</i>Try E →</span><span className={plasmaChallenge.has(-1) ? 'done' : ''}><i>{plasmaChallenge.has(-1) ? '✓' : '3'}</i>Reverse to E ←</span></div><p className="al-challenge-feedback">{plasmaChallengeDone ? 'Good comparison: opposite charges feel opposite forces, and neutral H has no charged force.' : 'Use the energy control, then move the field slider or reverse its direction.'}</p></div> : <div className="al-challenge" aria-live="polite"><div className="al-challenge-title"><span>COOL AND REVERSE</span>{becChallengeDone && <b><Check size={13} /> completed</b>}</div><p>Cool below the model threshold to grow the shared-state component, then warm back above it.</p><div className="al-challenge-steps"><span className={becChallenge.cooled ? 'done' : ''}><i>{becChallenge.cooled ? '✓' : '1'}</i>Cool below {bec.criticalTemperatureNK} nK</span><span className={becChallenge.rewarmed ? 'done' : ''}><i>{becChallenge.rewarmed ? '✓' : '2'}</i>Warm above threshold</span></div><p className="al-challenge-feedback">{becChallengeDone ? 'The shared-state fraction returned to zero; the same rubidium atoms remain in the trap.' : 'The challenge checks the temperature and model fraction as you change them.'}</p></div>)}
        </aside>
      </div>

      <footer className="al-footer"><p>{experiment === 'plasma' ? <><b>Plasma:</b> ionised hydrogen has positive ions and free electrons; the complete sample stays charge-neutral.</> : <><b>Bose–Einstein condensate:</b> cooling changes the population fraction; atoms do not fuse into a new substance or stop moving.</>}</p><span><kbd>Space</kbd> play / pause <kbd>R</kbd> reset</span></footer>
    </section>
  );
}

export default AdvancedLab;
