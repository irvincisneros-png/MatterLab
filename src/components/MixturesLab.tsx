import { Component, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Atom, Check, ChevronRight, CircleHelp, Droplets, Filter, FlaskConical, Layers3, RotateCcw, Scale, Sparkles, Waves, Wind, X } from 'lucide-react';
import { ATOM_COLOURS, LabBeaker, LabBench, LabBond, LabWaterMolecule, StudioLights } from './scene/LabPrimitives';
import { APPARATUS_DESCRIPTION, SEPARATION_FRAMES, SeparationRig, type StageFrame } from './scene/MixturesApparatus';
import { TREATMENT_FRAME, TreatmentTrain } from './scene/MixturesTreatment';
import {
  ADDED_WATER_G,
  advanceYandying,
  applySeparationTechnique,
  classifyComposition,
  classificationExplanation,
  COMPOSITION_SAMPLES,
  compositionSample,
  createIndustrialWaterState,
  createSeparationState,
  createYandyingState,
  industrialPollutantLedger,
  investigationReport,
  particlesForComposition,
  runIndustrialStage,
  setIndustrialCoagulantDose,
  SEPARATION_MATERIALS,
  SEPARATION_TECHNIQUES,
  separationExpectedMassG,
  separationMassG,
  setYandyingProperties,
  setYandyingTilt,
  yandyingMassLedger,
  type Classification,
  type DisplayParticle,
  type IndustrialStage,
  type MixturesFocus,
  type MixturesMode,
  type SeparationMaterialId,
  type SeparationMixtureId,
  type SeparationState,
  type SeparationTechnique,
  type SampleConstituent,
  type YandyingState,
} from '../science/mixturesEngine';
import './MixturesLab.css';
import { watchContextLoss } from './scene/contextLoss';
import { AdaptiveQuality } from './scene/AdaptiveQuality';

export type { MixturesFocus, MixturesMode } from '../science/mixturesEngine';

export type MixturesLabProps = {
  initialMode?: MixturesMode;
  focus?: MixturesFocus;
  onModeChange?: (mode: MixturesMode) => void;
};

type Vec3 = readonly [number, number, number];
type RenderMaterial = { id: string; colour: string; count: number; radius?: number; phase?: 'solid' | 'liquid' | 'gas'; grain?: boolean; entity?: DisplayParticle['entity']; formula?: string; motion?: number };
type SeparationTrial = { id: number; mixture: string; technique: string; property: string; movedG: number; remainingG: number; detail: string };

function unit(seed: number) {
  const value = Math.sin(seed * 78.233 + 16.17) * 43758.5453;
  return value - Math.floor(value);
}

const MODE_CHOICES: readonly { id: MixturesMode; label: string; subtitle: string }[] = [
  { id: 'classify', label: 'Classify', subtitle: 'Particles and substances' },
  { id: 'separate', label: 'Separate', subtitle: 'Choose a property' },
  { id: 'culture', label: 'Yandying', subtitle: 'Size, density and tilt' },
  { id: 'industrial', label: 'Water filtration', subtitle: 'Screen, floc, filter' },
];

const CLASSIFICATION_CHOICES: readonly { id: Classification; label: string }[] = [
  { id: 'element', label: 'Element' },
  { id: 'compound', label: 'Compound' },
  { id: 'mixture', label: 'Mixture' },
];

const MIXTURE_CHOICES: readonly { id: SeparationMixtureId; label: string }[] = [
  { id: 'iron-sand', label: 'Iron and sand' },
  { id: 'gravel-sand', label: 'Gravel and sand' },
  { id: 'sand-salt-water', label: 'Sand, salt and water' },
  { id: 'oil-water', label: 'Oil and water' },
  { id: 'iron-sand-salt', label: 'Iron, sand and salt' },
];

const INDUSTRIAL_STAGES: readonly { id: IndustrialStage; label: string; explanation: string }[] = [
  { id: 'screen', label: 'Screen', explanation: 'A screen catches most large debris and a little coarse sediment.' },
  { id: 'flocculate', label: 'Flocculate', explanation: 'A coagulant is a chemical treatment aid that helps fine suspended particles gather into larger flocs before filtering.' },
  { id: 'filter', label: 'Filter media', explanation: 'The media captures some suspended particles. Dissolved salt remains in the water.' },
];

function startSampleForFocus(focus?: MixturesFocus) {
  if (focus === 'entities') return 'oxygen';
  if (focus === 'purity') return 'salt-water';
  return 'sand-salt';
}

function supportsWebGL() {
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

class SceneErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Particle({ position, colour, radius = 0.075, entity = 'grain', formula = '', motion = 0, grainKind }: {
  position: Vec3; colour: string; radius?: number; entity?: DisplayParticle['entity']; formula?: string; motion?: number; grainKind?: 'seed' | 'chaff';
}) {
  if (entity === 'molecule' && formula === 'H₂O') {
    return <group position={[...position]} rotation={[0, motion * 0.08, 0]}><LabWaterMolecule scale={radius / 0.16} /></group>;
  }
  if (entity === 'molecule' && (formula === 'O₂' || formula === 'N₂')) {
    const separation = radius * 0.58;
    const atomRadius = radius * 0.43;
    const oxygen = formula === 'O₂';
    const atomColour = oxygen ? ATOM_COLOURS.oxygen : ATOM_COLOURS.nitrogen;
    return <group position={[...position]} rotation={[0, motion * 0.05, motion * 0.22]}>
      <mesh position={[-separation, 0, 0]}><sphereGeometry args={[atomRadius, 16, 12]} /><meshPhysicalMaterial color={atomColour} roughness={.24} clearcoat={.5} /></mesh>
      <LabBond from={[-separation, 0, 0]} to={[separation, 0, 0]} radius={radius * .1} />
      <mesh position={[separation, 0, 0]}><sphereGeometry args={[atomRadius, 16, 12]} /><meshPhysicalMaterial color={atomColour} roughness={.24} clearcoat={.5} /></mesh>
    </group>;
  }
  if (entity === 'molecule' && formula === 'CO₂') {
    const end = radius * .9;
    const oxygenRadius = radius * .45;
    const carbonRadius = radius * .42;
    return <group position={[...position]} rotation={[0, motion * .035, 0]}>
      <LabBond from={[-end, 0, 0]} to={[0, 0, 0]} radius={radius * .095} />
      <LabBond from={[0, 0, 0]} to={[end, 0, 0]} radius={radius * .095} />
      <mesh position={[-end, 0, 0]}><sphereGeometry args={[oxygenRadius, 16, 12]} /><meshPhysicalMaterial color={ATOM_COLOURS.oxygen} roughness={.25} clearcoat={.5} /></mesh>
      <mesh><sphereGeometry args={[carbonRadius, 16, 12]} /><meshPhysicalMaterial color={ATOM_COLOURS.carbon} roughness={.3} clearcoat={.35} /></mesh>
      <mesh position={[end, 0, 0]}><sphereGeometry args={[oxygenRadius, 16, 12]} /><meshPhysicalMaterial color={ATOM_COLOURS.oxygen} roughness={.25} clearcoat={.5} /></mesh>
    </group>;
  }
  if (entity === 'grain') {
    const scale: Vec3 = grainKind === 'seed' ? [1.5, .56, .67] : grainKind === 'chaff' ? [1.8, .25, .62] : [1, 1, 1];
    return <mesh position={[...position]} scale={[...scale]} rotation={[motion * .08, motion * .14, 0]}>
      <dodecahedronGeometry args={[radius, 0]} />
      <meshPhysicalMaterial color={colour} roughness={grainKind === 'chaff' ? .7 : .42} clearcoat={grainKind === 'seed' ? .3 : .08} />
    </mesh>;
  }
  return <group position={[...position]}>
    <mesh><sphereGeometry args={[radius, 18, 14]} /><meshPhysicalMaterial color={colour} roughness={.25} clearcoat={.82} /></mesh>
    {entity === 'ion' && <mesh rotation={[Math.PI / 2, .2, 0]}><torusGeometry args={[radius * 1.35, .012, 7, 28]} /><meshBasicMaterial color="#ffffff" transparent opacity={.9} /></mesh>}
  </group>;
}

function ParticleLegendMark({ entry }: { entry: SampleConstituent }) {
  if (entry.entity === 'molecule' && entry.formula === 'H₂O') return <i className="ml-legend-mark ml-legend-water" aria-hidden="true"><b className="oxygen" /><b className="hydrogen" /><b className="hydrogen" /></i>;
  if (entry.entity === 'molecule' && (entry.formula === 'O₂' || entry.formula === 'N₂')) return <i className="ml-legend-mark ml-legend-diatomic" aria-hidden="true"><b style={{ backgroundColor: entry.colour }} /><b style={{ backgroundColor: entry.colour }} /></i>;
  if (entry.entity === 'molecule' && entry.formula === 'CO₂') return <i className="ml-legend-mark ml-legend-co2" aria-hidden="true"><b className="oxygen" /><b className="carbon" /><b className="oxygen" /></i>;
  if (entry.entity === 'ion') return <i className="ml-legend-mark ml-legend-ion" style={{ '--legend-color': entry.colour } as React.CSSProperties} aria-hidden="true"><b /></i>;
  return <i className="ml-legend-mark ml-legend-single" style={{ '--legend-color': entry.colour } as React.CSSProperties} aria-hidden="true" />;
}

function sampleRenderMaterials(sampleId: string): RenderMaterial[] {
  const sample = compositionSample(sampleId);
  return sample.constituents.map((constituent, index) => ({
    id: `${constituent.substanceId}-${constituent.formula}-${index}`,
    colour: constituent.colour,
    count: constituent.count,
    radius: constituent.size,
    phase: constituent.phase,
    grain: constituent.entity === 'grain',
    entity: constituent.entity,
    formula: constituent.formula,
  }));
}

function separationRenderMaterials(state: SeparationState, modelTime: number): RenderMaterial[] {
  const materialMarker = (id: SeparationMaterialId, key: string, mass: number): RenderMaterial => {
    const material = SEPARATION_MATERIALS[id];
    const entity: DisplayParticle['entity'] = id === 'water' ? 'molecule' : id === 'dissolved-salt' ? 'ion' : material.phase === 'solid' ? 'grain' : 'atom';
    return { id: key, colour: material.colour, count: Math.max(1, Math.round(mass / 7)), grain: entity === 'grain', entity, formula: id === 'water' ? 'H₂O' : '', phase: material.phase, motion: modelTime * 0.03 };
  };
  const remaining = Object.entries(state.remainingG).flatMap(([id, mass]) => mass && mass > 0 ? [materialMarker(id as SeparationMaterialId, `${id}-remaining`, mass)] : []);
  const recovered = state.outputs.flatMap((output, outputIndex) => Object.entries(output.massesG).flatMap(([id, mass]) => mass && mass > 0 ? [materialMarker(id as SeparationMaterialId, `${id}-recovered-${outputIndex}`, mass)] : []));
  return [...remaining, ...recovered];
}

function YandyingWorld({ state }: { state: YandyingState }) {
  const bowlProfile = useMemo(() => [
    new THREE.Vector2(0, -0.22), new THREE.Vector2(.66, -.215), new THREE.Vector2(.91, -.17),
    new THREE.Vector2(1.06, -.1), new THREE.Vector2(1.15, .015), new THREE.Vector2(1.19, .055),
    new THREE.Vector2(1.16, .06), new THREE.Vector2(1.11, -.035), new THREE.Vector2(.98, -.12),
    new THREE.Vector2(.78, -.175), new THREE.Vector2(0, -.18),
  ], []);
  const ledger = yandyingMassLedger(state);
  const seedProgress = state.seedMassG > 0 ? ledger.recoveredSeedG / state.seedMassG : 0;
  const chaffProgress = state.chaffMassG > 0 ? ledger.separatedChaffG / state.chaffMassG : 0;
  // Positive Z rotation lifts +X; the small, dense seed markers sort downhill.
  const seedDownhillX = state.tiltDegrees > 0 ? -1 : state.tiltDegrees < 0 ? 1 : 0;
  return (
    <group rotation={[0, 0, (state.tiltDegrees * Math.PI) / 180]}>
      <mesh receiveShadow><latheGeometry args={[bowlProfile, 64]} /><meshStandardMaterial color="#8f7c68" roughness={0.78} metalness={0.02} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, .035, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.17, .04, 12, 64]} /><meshStandardMaterial color="#a78d72" roughness={0.7} metalness={0.02} /></mesh>
      <mesh position={[0, -.16, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.88, .022, 8, 56]} /><meshStandardMaterial color="#7a6957" roughness={.8} /></mesh>
      {Array.from({ length: 24 }, (_, index) => {
        const progress = unit(index + 28) < seedProgress;
        const side = progress ? seedDownhillX * 0.58 : 0;
        const a = unit(index + 8) * Math.PI * 2;
        const r = progress ? 0.12 + unit(index + 45) * 0.35 : 0.48 + unit(index + 12) * 0.45;
        return <Particle key={`seed-${index}`} position={[side + Math.cos(a) * r * (progress ? 0.72 : 1), -.12 + unit(index + 35) * .018, Math.sin(a) * r * 0.42]} colour={progress ? '#4a2f1d' : '#3b2416'} radius={0.032} entity="grain" grainKind="seed" />;
      })}
      {Array.from({ length: 6 }, (_, index) => {
        const separated = unit(index + 63) < chaffProgress;
        const chaffUphillX = -seedDownhillX;
        const x = separated && chaffUphillX !== 0 ? chaffUphillX * (0.55 + unit(index + 31) * 0.25) : -0.05 + (unit(index + 14) - 0.5) * 0.9;
        return <Particle key={`chaff-${index}`} position={[x, -.08 + unit(index + 44) * .025, (unit(index + 27) - 0.5) * 0.68]} colour="#d4b46e" radius={0.065 + unit(index + 19) * 0.014} entity="grain" grainKind="chaff" />;
      })}
    </group>
  );
}


const ENTITY_CARDS: readonly { id: string; name: string; kind: string; category: string; blurb: string }[] = [
  { id: 'argon', name: 'Argon, Ar', kind: 'Atoms', category: 'element', blurb: 'Argon gas is made of single atoms. The atoms are far apart and move freely in all directions, so a gas has no fixed shape or volume and spreads out to fill its whole container.' },
  { id: 'oxygen', name: 'Oxygen, O₂', kind: 'Molecules', category: 'element', blurb: 'Each oxygen particle is a molecule of two bonded oxygen atoms. The molecules are far apart and moving, so oxygen gas fills its container and can be squashed into a smaller space. One kind of atom means it is an element.' },
  { id: 'water', name: 'Water, H₂O', kind: 'Molecules', category: 'compound', blurb: 'Each water molecule has one oxygen atom bonded to two hydrogen atoms, so water is a compound. The molecules are close together but can slide past each other, so water flows and has a fixed volume.' },
  { id: 'salt-crystal', name: 'Sodium chloride, NaCl', kind: 'Ions in a lattice', category: 'compound', blurb: 'Sodium ions (Na⁺) and chloride ions (Cl⁻) sit in a regular lattice. Strong attraction between the opposite charges holds every ion in place, so the crystal is a rigid solid with a high melting point (about 800 °C).' },
  { id: 'salt-water', name: 'Salt water', kind: 'Mixture', category: 'mixture', blurb: 'Water molecules and dissolved ions are mixed together but not bonded into something new. Each keeps its own properties, so the water can be evaporated away and the salt is left behind.' },
];

const SORT_HINT = 'Not quite. Count how many different substances are in the beaker, then ask whether each particle has one kind of atom or more than one kind.';

type SortRecord = { guess: Classification; attempts: number; correct: boolean; firstTry: boolean };

type CamFrame = StageFrame & { elevation: number };

function frameFor(mode: MixturesMode, technique: SeparationTechnique): CamFrame {
  if (mode === 'separate') return { ...SEPARATION_FRAMES[technique], elevation: technique === 'filter' ? 30 : 21 };
  if (mode === 'industrial') return { ...TREATMENT_FRAME, elevation: 30 };
  if (mode === 'culture') return { cx: 0, cy: -0.12, halfW: 1.45, halfH: 0.85, elevation: 40 };
  return { cx: 0, cy: -0.02, halfW: 1.55, halfH: 1.3, elevation: 12 };
}

/** Fit the apparatus frame to the stage at any aspect ratio so nothing is clipped. */
function MixturesCamera({ mode, technique }: { mode: MixturesMode; technique: SeparationTechnique }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as unknown as { update?: () => void; target?: THREE.Vector3 } | null;
  const aspectKey = Math.round((size.width / Math.max(1, size.height)) * 12);
  useEffect(() => {
    const frame = frameFor(mode, technique);
    const aspect = size.width / Math.max(1, size.height);
    const tangent = Math.tan((camera.fov * Math.PI) / 360);
    // On narrow screens, look along the wide treatment train diagonally so its stages stay readable.
    const yaw = mode === 'industrial' && aspect < 1.2 ? 0.9 : 0;
    const halfW = frame.halfW * Math.cos(yaw) + 1.3 * Math.sin(yaw);
    const halfH = frame.halfH + (yaw ? frame.halfW * Math.sin(yaw) * 0.32 : 0);
    const distance = Math.max((halfH * 1.12) / tangent, halfW / (tangent * aspect)) * 1.08;
    const elevation = ((frame.elevation + (yaw ? 12 : 0)) * Math.PI) / 180;
    const ground = Math.cos(elevation) * distance;
    camera.position.set(frame.cx + Math.sin(yaw) * ground, frame.cy + Math.sin(elevation) * distance, Math.cos(yaw) * ground);
    controls?.target?.set(frame.cx, frame.cy, 0);
    camera.lookAt(frame.cx, frame.cy, 0);
    controls?.update?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, controls, mode, technique, aspectKey]);
  return null;
}

function MixturesWorld({ mode, sampleId, separation, yandying, industrial, modelTime, selectedTechnique }: {
  mode: MixturesMode; sampleId: string; separation: SeparationState; yandying: YandyingState; industrial: ReturnType<typeof createIndustrialWaterState>; modelTime: number; selectedTechnique: SeparationTechnique;
}) {
  const composition = compositionSample(sampleId);
  const particles = particlesForComposition(composition, modelTime);
  return <>
    <color attach="background" args={['#f1f7ff']} />
    <StudioLights />
    {mode === 'classify' && <group>
      <LabBench position={[0, -1.01, 0]} width={3.55} depth={2.65} />
      <LabBeaker radius={.78} height={1.82} fill={sampleId === 'water' ? .45 : sampleId === 'salt-water' ? .42 : 0} graduated capacityMl={100} particleLens position={[0, 0, 0]} />
      {particles.map((particle) => <Particle key={particle.id} position={particle.position} colour={particle.colour} radius={particle.radius} entity={particle.entity} formula={particle.formula} motion={modelTime} />)}
    </group>}
    {mode === 'separate' && <SeparationRig state={separation} modelTime={modelTime} technique={selectedTechnique} />}
    {mode === 'culture' && <YandyingWorld state={yandying} />}
    {mode === 'industrial' && <TreatmentTrain state={industrial} modelTime={modelTime} />}
    <OrbitControls makeDefault enablePan={mode === 'industrial'} enableDamping maxPolarAngle={Math.PI * 0.82} minDistance={2.4} maxDistance={22} />
    <MixturesCamera mode={mode} technique={selectedTechnique} />
  </>;
}

function mixtureSummary(mode: MixturesMode, sampleId: string, separation: SeparationState, culture: YandyingState, industrial: ReturnType<typeof createIndustrialWaterState>) {
  if (mode === 'classify') {
    const sample = compositionSample(sampleId);
    return `${sample.name}. ${sample.constituents.reduce((sum, entry) => sum + entry.count, 0)} schematic particle markers.`;
  }
  if (mode === 'separate') return `${MIXTURE_CHOICES.find((choice) => choice.id === separation.mixtureId)?.label}. ${separationMassG(separation).toFixed(1)} g represented in feed and recovered outputs.`;
  if (mode === 'culture') return `Unadorned dish with ${culture.seedMassG} g seed and ${culture.chaffMassG} g chaff in the model sample.`;
  const ledger = industrialPollutantLedger(industrial);
  return `Industrial filtration teaching sample. ${ledger.remainingSuspendedG.toFixed(1)} g represented suspended material remains.`;
}

function massList(masses: Readonly<Partial<Record<SeparationMaterialId, number>>>, waterLeft = true) {
  return Object.entries(masses).filter(([, mass]) => (mass ?? 0) > 0).map(([id, mass]) => `${materialName(id as SeparationMaterialId, waterLeft)} ${(mass ?? 0).toFixed(0)} g`).join(', ');
}

function materialName(id: SeparationMaterialId, waterLeft: boolean) {
  return id === 'dissolved-salt' && !waterLeft ? 'Salt crystals' : SEPARATION_MATERIALS[id].name;
}

function swatchStyle(id: SeparationMaterialId, waterLeft: boolean): React.CSSProperties {
  if (id === 'dissolved-salt' && waterLeft) return { background: `linear-gradient(135deg, ${ATOM_COLOURS.sodium} 50%, ${ATOM_COLOURS.chloride} 50%)` };
  if (id === 'dissolved-salt') return { backgroundColor: SEPARATION_MATERIALS.salt.colour };
  return { backgroundColor: SEPARATION_MATERIALS[id].colour };
}

function describeScene(mode: MixturesMode, variantLabel: string, sampleId: string, separation: SeparationState, technique: SeparationTechnique, culture: YandyingState, industrial: ReturnType<typeof createIndustrialWaterState>) {
  if (mode === 'classify') {
    const sample = compositionSample(sampleId);
    const parts = sample.constituents.map((entry) => `${entry.count} ${entry.formula} ${entry.entity}s`).join(', ');
    return `${variantLabel}. 3D beaker particle view of ${sample.name}: ${parts}. Orbit with the pointer; use the controls panel to change the sample.`;
  }
  if (mode === 'separate') {
    const waterLeft = (separation.remainingG.water ?? 0) > 0;
    const remaining = massList(separation.remainingG, waterLeft) || 'nothing';
    const outputs = separation.outputs.length > 0 ? separation.outputs.map((output) => `${output.label}: ${massList(output.massesG)}`).join('; ') : 'none yet';
    return `${variantLabel}. Apparatus: ${APPARATUS_DESCRIPTION[technique]} Sample: ${MIXTURE_CHOICES.find((choice) => choice.id === separation.mixtureId)?.label}. Remaining in the sample: ${remaining}. Recovered outputs: ${outputs}.`;
  }
  if (mode === 'culture') {
    const ledger = yandyingMassLedger(culture);
    return `${variantLabel}. Plain unpatterned shallow dish tilted ${culture.tiltDegrees} degrees with dark brown seed-like particles and tan chaff. ${ledger.recoveredSeedG.toFixed(1)} g of ${culture.seedMassG} g seed sorted and ${ledger.separatedChaffG.toFixed(1)} g of ${culture.chaffMassG} g chaff separated.`;
  }
  const ledger = industrialPollutantLedger(industrial);
  const done = industrial.stages.length > 0 ? industrial.stages.join(', then ') : 'none yet';
  return `${variantLabel}. Treatment train from left to right: inflow channel with bar screen, flocculation tank with paddle mixer and overflow weir, layered filter bed, clear water outlet. Stages run: ${done}. ${ledger.remainingSuspendedG.toFixed(1)} g suspended material remains and ${industrial.dissolvedSaltG.toFixed(1)} g dissolved salt remains.`;
}

function fallbackItems(mode: MixturesMode, sampleId: string, separation: SeparationState, yandying: YandyingState, industrial: ReturnType<typeof createIndustrialWaterState>): RenderMaterial[] {
  if (mode === 'classify') return sampleRenderMaterials(sampleId);
  if (mode === 'separate') return separationRenderMaterials(separation, 0);
  if (mode === 'culture') return [
    { id: 'seeds', colour: '#4a2f1d', count: 12, grain: true },
    { id: 'chaff', colour: '#d4b46e', count: Math.max(2, Math.round(yandying.chaffMassG / 2)), grain: true },
  ];
  return [
    { id: 'debris', colour: '#8a6a43', count: Math.max(1, Math.round(industrial.debrisG)), grain: true },
    { id: 'sediment', colour: '#a58c63', count: Math.max(1, Math.round(industrial.sedimentG)), grain: true },
  ];
}

function GraphicsError({ children, onFailure }: { children: ReactNode; onFailure: () => void }) {
  return <SceneErrorBoundary onError={onFailure}>{children}</SceneErrorBoundary>;
}

const GUIDED_STEPS: readonly SeparationTechnique[] = ['magnet', 'dissolve', 'filter', 'evaporate'];

function initialSeparation(focus: MixturesFocus | undefined) {
  return createSeparationState(focus === 'investigation' ? 'iron-sand-salt' : 'sand-salt-water');
}

function trialDetail(state: SeparationState) {
  const last = state.lastAction;
  if (!last) return '';
  const output = last.movedG > 0 ? state.outputs.at(-1) : undefined;
  if (output) return `${output.label}: ${massList(output.massesG)}`;
  if (last.technique === 'dissolve' && last.note?.startsWith('Salt dissolved')) return `Added ${ADDED_WATER_G} g water; salt now dissolved`;
  if (last.technique === 'evaporate' && last.note?.startsWith('Water left')) return 'Water left as vapour';
  return 'No material separated';
}

export function MixturesLab({ initialMode = 'classify', focus = 'entities', onModeChange }: MixturesLabProps): ReactElement {
  const [mode, setMode] = useState<MixturesMode>(initialMode);
  const [sampleId, setSampleId] = useState(() => startSampleForFocus(focus));
  const [classificationGuess, setClassificationGuess] = useState<Classification | null>(null);
  const [classificationRevealed, setClassificationRevealed] = useState(false);
  const [sorting, setSorting] = useState<Record<string, SortRecord>>({});
  const [separation, setSeparation] = useState(() => initialSeparation(focus));
  const [separationTrials, setSeparationTrials] = useState<SeparationTrial[]>([]);
  const [selectedTechnique, setSelectedTechnique] = useState<SeparationTechnique>(focus === 'investigation' ? 'magnet' : 'filter');
  const [yandying, setYandying] = useState<YandyingState>(() => createYandyingState());
  const [industrial, setIndustrial] = useState(() => createIndustrialWaterState());
  const [selectedIndustrialStage, setSelectedIndustrialStage] = useState<IndustrialStage>('screen');
  const [modelTime, setModelTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(() => !supportsWebGL());
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const guided = focus === 'investigation';
  const purity = focus === 'purity';

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(query.matches); if (query.matches) setPlaying(false); };
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    setMode(initialMode);
    setPlaying(false);
    setClassificationGuess(null);
    setClassificationRevealed(false);
    setSorting({});
    if (initialMode === 'classify') setSampleId(startSampleForFocus(focus));
    if (initialMode === 'separate') { setSeparation(initialSeparation(focus)); setSeparationTrials([]); setSelectedTechnique(focus === 'investigation' ? 'magnet' : 'filter'); }
    if (initialMode === 'culture') setYandying(createYandyingState());
    if (initialMode === 'industrial') setIndustrial(createIndustrialWaterState());
  }, [initialMode, focus]);

  useEffect(() => {
    if (!playing) return;
    const dt = 1 / 60;
    let last = performance.now();
    let accumulator = 0;
    let requestId = 0;
    const frame = (now: number) => {
      accumulator += Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const steps = Math.min(6, Math.floor(accumulator / dt));
      if (steps > 0) {
        accumulator -= steps * dt;
        setModelTime((current) => current + steps * dt);
        if (mode === 'culture') setYandying((current) => advanceYandying(current, steps * dt));
      }
      requestId = requestAnimationFrame(frame);
    };
    requestId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(requestId);
  }, [mode, playing]);

  const sample = compositionSample(sampleId);
  const classificationParticles = particlesForComposition(sample, modelTime);
  const classification = classifyComposition(sample);
  const yandyingLedger = yandyingMassLedger(yandying);
  const industrialLedger = industrialPollutantLedger(industrial);
  const summary = mixtureSummary(mode, sampleId, separation, yandying, industrial);
  const liveItems = fallbackItems(mode, sampleId, separation, yandying, industrial);

  const selectMode = (nextMode: MixturesMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setPlaying(false);
    setClassificationGuess(null);
    setClassificationRevealed(false);
    if (nextMode === 'classify') setSampleId(startSampleForFocus(focus));
    if (nextMode === 'separate') { setSeparation(initialSeparation(focus)); setSeparationTrials([]); setSelectedTechnique(guided ? 'magnet' : 'filter'); }
    if (nextMode === 'culture') setYandying(createYandyingState());
    if (nextMode === 'industrial') setIndustrial(createIndustrialWaterState());
    onModeChange?.(nextMode);
  };

  const reset = () => {
    setPlaying(false);
    setModelTime(0);
    setClassificationGuess(null);
    setClassificationRevealed(false);
    setSorting({});
    if (mode === 'classify') setSampleId(startSampleForFocus(focus));
    if (mode === 'separate') { setSeparation(createSeparationState(separation.mixtureId)); setSeparationTrials([]); }
    if (mode === 'culture') setYandying(createYandyingState());
    if (mode === 'industrial') setIndustrial(createIndustrialWaterState());
  };

  const stepOnce = () => {
    setPlaying(false);
    setModelTime((current) => current + 1);
    if (mode === 'culture') setYandying((current) => advanceYandying(current, 1));
  };

  const retryGraphics = () => {
    if (!supportsWebGL()) return;
    setGraphicsFailed(false);
    setCanvasReady(false);
    setCanvasKey((key) => key + 1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input, select, textarea, button')) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); }
    if (event.key.toLowerCase() === 'r') reset();
  };

  const submitClassification = () => setClassificationRevealed(true);
  const chooseSample = (id: string) => { setSampleId(id); setClassificationGuess(null); setClassificationRevealed(false); };
  const sortSample = (id: string, guess: Classification) => {
    const answer = classifyComposition(compositionSample(id));
    setSorting((current) => {
      const record = current[id];
      if (record?.correct) return current;
      const correct = guess === answer;
      return { ...current, [id]: { guess, attempts: (record?.attempts ?? 0) + 1, correct, firstTry: record ? record.firstTry : correct } };
    });
    setSampleId(id);
  };
  const changeMixture = (id: SeparationMixtureId) => {
    setSeparation(createSeparationState(id));
    setSeparationTrials([]);
    setSelectedTechnique(id === 'iron-sand' ? 'magnet' : id === 'gravel-sand' ? 'sieve' : 'filter');
  };
  const trialFrom = (state: SeparationState, id: number): SeparationTrial => {
    const technique = SEPARATION_TECHNIQUES.find((entry) => entry.id === state.lastAction?.technique);
    return {
      id,
      mixture: MIXTURE_CHOICES.find((choice) => choice.id === state.mixtureId)?.label ?? state.mixtureId,
      technique: technique?.name ?? state.lastAction!.technique,
      property: technique?.property ?? 'Physical property',
      movedG: state.lastAction!.movedG,
      remainingG: Object.values(state.remainingG).reduce<number>((sum, mass) => sum + (mass ?? 0), 0),
      detail: trialDetail(state),
    };
  };
  const performSeparation = () => {
    const next = applySeparationTechnique(separation, selectedTechnique);
    setSeparation(next);
    if (guided) setSeparationTrials((trials) => [...trials, trialFrom(next, trials.length + 1)]);
  };
  const recordSeparationTrial = () => {
    if (!separation.lastAction) return;
    setSeparationTrials((trials) => [...trials, trialFrom(separation, trials.length + 1)]);
  };
  const runIndustrial = () => setIndustrial((current) => runIndustrialStage(current, selectedIndustrialStage));

  const variantTitle = mode === 'classify' ? (purity ? 'Sort it: element, compound or mixture' : 'Atoms, molecules and ions')
    : mode === 'separate' ? (guided ? 'Separate iron, sand and salt' : 'Choose a separation property')
      : mode === 'culture' ? 'Tilt, shake and sort' : 'Screen, flocculate, filter';
  const eyebrow = mode === 'classify' ? (purity ? 'PURE OR IMPURE?' : 'ATOMS · MOLECULES · IONS') : mode === 'separate' ? (guided ? 'GUIDED INVESTIGATION' : 'PROPERTY-BASED SEPARATION') : mode === 'culture' ? 'SOURCE CONTEXT · YANDYING' : 'INDUSTRIAL WATER FILTRATION';
  const statusTag = mode === 'classify' ? (purity ? 'SORTING TASK' : '18 SCHEMATIC MARKERS') : mode === 'separate' ? (guided ? 'PLAN A SEQUENCE' : 'MASS TRACKED') : mode === 'culture' ? 'UNADORNED DISH' : 'TEACHING MODEL';
  const title = MODE_CHOICES.find((choice) => choice.id === mode)?.label ?? 'Classify';
  const selectedTechniqueName = SEPARATION_TECHNIQUES.find((entry) => entry.id === selectedTechnique)?.name ?? 'separation';
  const sceneSummary = mode === 'separate' ? `${summary} Selected apparatus: ${selectedTechniqueName.toLowerCase()}.` : summary;
  const latestOutputLabel = separation.outputs.at(-1)?.label ?? 'No material recovered yet';
  const waterLeft = (separation.remainingG.water ?? 0) > 0;
  const techniqueChoices = guided ? SEPARATION_TECHNIQUES.filter((entry) => GUIDED_STEPS.includes(entry.id)) : SEPARATION_TECHNIQUES.filter((entry) => entry.id !== 'dissolve');
  const report = guided ? investigationReport(separation) : null;
  const sceneLabel = describeScene(mode, variantTitle, sampleId, separation, selectedTechnique, yandying, industrial);
  const sortedCount = Object.values(sorting).filter((record) => record.correct).length;
  const firstTryCount = Object.values(sorting).filter((record) => record.correct && record.firstTry).length;
  const attemptCount = Object.values(sorting).reduce((sum, record) => sum + record.attempts, 0);
  const entityCard = ENTITY_CARDS.find((card) => card.id === sampleId);

  return (
    <section ref={rootRef} className={`mixtures-lab ml-${mode}`} data-graphics={canvasReady && !graphicsFailed ? 'ready' : graphicsFailed ? 'fallback' : 'starting'} data-reduced-motion={reducedMotion ? 'true' : 'false'} data-variant={mode === 'classify' ? (purity ? 'purity' : 'entities') : mode === 'separate' ? (guided ? 'investigation' : 'properties') : mode} data-technique={mode === 'separate' ? selectedTechnique : undefined} tabIndex={0} onKeyDown={handleKeyDown} aria-label="MatterLab mixtures playground">
      <header className="ml-header">
        <div className="ml-brand"><span className="ml-brand-mark"><Layers3 size={20} /></span><span><strong>Mixtures Lab</strong><small>Composition, properties and separation</small></span></div>
        <span className="ml-live-pill"><i /> MATTER MODELS</span>
      </header>

      <nav className="ml-mode-tabs" aria-label="Choose a mixtures investigation">
        {MODE_CHOICES.map((choice) => <button key={choice.id} type="button" className={mode === choice.id ? 'is-active' : ''} onClick={() => selectMode(choice.id)} aria-pressed={mode === choice.id}>
          {choice.id === 'classify' ? <Atom size={18} /> : choice.id === 'separate' ? <Filter size={18} /> : choice.id === 'culture' ? <Waves size={18} /> : <Droplets size={18} />}
          <span><b>{choice.label}</b><small>{choice.subtitle}</small></span>
        </button>)}
      </nav>

      <div className="ml-workspace">
        <section className="ml-scene-panel" aria-label={sceneLabel}>
          <div className="ml-scene-heading">
            <div><span className="ml-eyebrow">{eyebrow}</span><h1>{variantTitle}</h1></div>
            <span className={`ml-status-tag ${mode}`}>{statusTag}</span>
          </div>
          <div className="ml-scene-wrap">
          <div className="ml-scene-caption" aria-live="polite">{sceneSummary}</div>
          {mode === 'separate' && <div className="ml-apparatus-labels" aria-label="Separation apparatus feed and output">
            <span><b>Feed</b>{MIXTURE_CHOICES.find((choice) => choice.id === separation.mixtureId)?.label}</span>
            <span><b>Tool</b>{selectedTechniqueName}</span>
            <span><b>Output</b>{latestOutputLabel}</span>
          </div>}
            {!graphicsFailed && <GraphicsError key={canvasKey} onFailure={() => { setGraphicsFailed(true); setCanvasReady(false); }}>
              <Canvas key={canvasKey} className="ml-canvas" shadows="percentage" dpr={[1, 1.5]} camera={{ position: [0, 2.4, 7.4], fov: 34, near: 0.1, far: 60 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} fallback={<span aria-hidden="true" />} onCreated={({ gl }) => {
                gl.localClippingEnabled = true;
                setCanvasReady(true);
                setGraphicsFailed(false);
                watchContextLoss(gl.domElement, () => { setGraphicsFailed(true); setCanvasReady(false); });
              }}>
                <MixturesWorld mode={mode} sampleId={sampleId} separation={separation} yandying={yandying} industrial={industrial} modelTime={modelTime} selectedTechnique={selectedTechnique} />
              <AdaptiveQuality /></Canvas>
            </GraphicsError>}
            {graphicsFailed && <div className="ml-fallback" role="img" aria-label={`Two dimensional ${title.toLowerCase()} model. ${summary}`}>
              {mode === 'culture' ? <div className="ml-fallback-dish"><div className="ml-fallback-seed-group">{Array.from({ length: 16 }, (_, index) => <i key={`seed-${index}`} />)}</div><div className="ml-fallback-chaff-group">{Array.from({ length: 4 }, (_, index) => <i key={`chaff-${index}`} />)}</div></div>
                : mode === 'industrial' ? <div className="ml-fallback-process">{INDUSTRIAL_STAGES.map((stage, index) => <div key={stage.id} className={industrial.stages.includes(stage.id) ? 'done' : ''}><b>0{index + 1}</b><span>{stage.label}</span><i /></div>)}</div>
                  : mode === 'classify' ? <div className="ml-fallback-particles" aria-hidden="true">{classificationParticles.map((particle) => <i key={particle.id} className={`ml-dot ${particle.phase} ml-dot-${particle.entity}`} style={{ '--dot-color': particle.colour, left: `${50 + particle.position[0] / 1.1 * 34}%`, top: `${50 - particle.position[1] / 1.05 * 43}%` } as React.CSSProperties} />)}</div>
                    : <div className="ml-fallback-particles">{liveItems.flatMap((item, groupIndex) => Array.from({ length: Math.min(22, item.count) }, (_, index) => <i key={`${item.id}-${index}`} className={`ml-dot ${item.phase ?? 'solid'}`} style={{ '--dot-color': item.colour, left: `${12 + unit(groupIndex * 37 + index) * 76}%`, top: `${17 + unit(index * 19 + groupIndex + 80) * 68}%` } as React.CSSProperties} />))}</div>}
              <button type="button" className="ml-retry-graphics" onClick={retryGraphics}>Try 3D again</button>
            </div>}
            <div className="ml-scene-status" aria-live="polite">{graphicsFailed ? '2D equivalent · science controls remain active' : canvasReady ? '3D scene · orbit or zoom to inspect' : 'Preparing the scene…'}</div>
          </div>
          <div className="ml-scene-toolbar">
            <div className="ml-play-controls">
              <button type="button" className="ml-play" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause model motion' : 'Play model motion'}>{playing ? 'Pause' : 'Play'}</button>
              <button type="button" onClick={stepOnce} aria-label="Advance one model time step"><ChevronRight size={17} /> Step</button>
              <button type="button" onClick={reset} aria-label="Reset this mixtures investigation"><RotateCcw size={16} /> Reset</button>
            </div>
            <span className="ml-scene-caption-note"><Sparkles size={14} /> Representative particles · schematic scale</span>
          </div>
        </section>

        <aside className="ml-control-panel" aria-label={`${title} controls and observations`}>
          {mode === 'classify' && !purity && <>
            <div className="ml-panel-heading"><div><span className="ml-kicker">COMPARE THE PARTICLES</span><h2>Atoms · molecules · ions</h2></div><CircleHelp size={20} /></div>
            <div className="ml-entity-strip" role="group" aria-label="Compare atoms, molecules, ions and a mixture">
              {ENTITY_CARDS.map((card) => {
                const entry = compositionSample(card.id).constituents[0];
                return <button key={card.id} type="button" className={sampleId === card.id ? 'is-picked' : ''} aria-pressed={sampleId === card.id} onClick={() => chooseSample(card.id)}>
                  <ParticleLegendMark entry={entry} /><span><b>{card.name}</b><small>{card.kind}</small></span>
                </button>;
              })}
            </div>
            {entityCard && <div className="ml-entity-detail" aria-live="polite"><b>{entityCard.kind} · {entityCard.category === 'mixture' ? 'a mixture' : `an ${entityCard.category === 'element' ? 'element' : 'compound'}`}</b><p>{entityCard.blurb}</p></div>}
            <label className="ml-select-label">Sample
              <select value={sampleId} onChange={(event) => chooseSample(event.currentTarget.value)} aria-label="Choose a matter sample">
                {COMPOSITION_SAMPLES.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
              </select>
            </label>
            <p className="ml-description">{sample.description}</p>
            <div className="ml-particle-legend" aria-label="Particle identities in the sample">
              {sample.constituents.map((entry, index) => <span key={`${entry.substanceId}-${entry.formula}-${index}`}><ParticleLegendMark entry={entry} />{entry.formula} · {entry.entity}</span>)}
            </div>
            <div className="ml-question-card"><b>Optional check: what classification fits this sample?</b><div className="ml-choice-row">
              {CLASSIFICATION_CHOICES.map((choice) => <button key={choice.id} type="button" className={classificationGuess === choice.id ? 'is-picked' : ''} aria-pressed={classificationGuess === choice.id} onClick={() => { setClassificationGuess(choice.id); setClassificationRevealed(false); }}>{choice.label}</button>)}
            </div><button type="button" className="ml-primary-action" disabled={!classificationGuess} onClick={submitClassification}>Check classification <ChevronRight size={16} /></button>
            {classificationRevealed && <p className={`ml-feedback ${classificationGuess === classification ? 'correct' : 'incorrect'}`} aria-live="polite"><b>{classificationGuess === classification ? <Check size={15} /> : 'Try again'} {classificationGuess === classification ? `Correct · ${classification[0].toUpperCase()}${classification.slice(1)}` : 'Look at the different substance identities'}</b><span>{classificationExplanation(classification)}</span></p>}
            </div>
            <div className="ml-readout"><span>Displayed particles</span><b>{sample.constituents.reduce((sum, entry) => sum + entry.count, 0)} markers</b></div>
          </>}

          {mode === 'classify' && purity && <>
            <div className="ml-panel-heading"><div><span className="ml-kicker">SORTING TASK</span><h2>Pure substance or mixture?</h2></div><CircleHelp size={20} /></div>
            <p className="ml-description">Look at the particles in each sample. Pure substances (elements and compounds) contain one substance; mixtures contain two or more. Choose a name to view it, then sort it.</p>
            <div className="ml-score-tally" aria-live="polite" role="status"><span><b>{sortedCount}</b> of {COMPOSITION_SAMPLES.length} sorted</span><span><b>{firstTryCount}</b> right first time</span><span><b>{attemptCount}</b> attempts</span></div>
            <div className="ml-sort-list" role="list" aria-label="Samples to sort">
              {COMPOSITION_SAMPLES.map((entry) => {
                const record = sorting[entry.id];
                const answer = classifyComposition(entry);
                return <div role="listitem" key={entry.id} className={`ml-sort-row ${sampleId === entry.id ? 'is-viewing' : ''} ${record?.correct ? 'is-correct' : record ? 'is-wrong' : ''}`}>
                  <button type="button" className="ml-sort-name" aria-pressed={sampleId === entry.id} aria-label={`View ${entry.name} in the beaker`} onClick={() => chooseSample(entry.id)}>{entry.name}</button>
                  <div className="ml-sort-choices" role="group" aria-label={`Sort ${entry.name}`}>
                    {CLASSIFICATION_CHOICES.map((choice) => <button key={choice.id} type="button" disabled={record?.correct} className={record?.guess === choice.id ? (record.correct ? 'is-right' : 'is-miss') : ''} aria-label={`Sort ${entry.name} as ${choice.label.toLowerCase()}`} onClick={() => sortSample(entry.id, choice.id)}>{choice.label}</button>)}
                  </div>
                  {record && <p className="ml-sort-feedback" aria-live="polite">{record.correct ? <><Check size={13} /> <b>{answer[0].toUpperCase()}{answer.slice(1)}.</b> {classificationExplanation(answer)}</> : <><X size={13} /> {SORT_HINT}</>}</p>}
                </div>;
              })}
            </div>
            <div className="ml-particle-legend" aria-label="Particle identities in the viewed sample">
              {sample.constituents.map((entry, index) => <span key={`${entry.substanceId}-${entry.formula}-${index}`}><ParticleLegendMark entry={entry} />{entry.formula} · {entry.entity}</span>)}
            </div>
            <label className="ml-select-label">Viewing
              <select value={sampleId} onChange={(event) => chooseSample(event.currentTarget.value)} aria-label="Choose a matter sample">
                {COMPOSITION_SAMPLES.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
              </select>
            </label>
          </>}

          {mode === 'separate' && <>
            <div className="ml-panel-heading"><div><span className="ml-kicker">{guided ? 'MULTI-STEP CHALLENGE' : 'TRY A PROPERTY'}</span><h2>{guided ? 'Recover all three solids' : 'Choose the mixture'}</h2></div><Scale size={19} /></div>
            {!guided && <label className="ml-select-label">Starting sample
              <select aria-label="Choose a mixture to separate" value={separation.mixtureId} onChange={(event) => changeMixture(event.currentTarget.value as SeparationMixtureId)}>{MIXTURE_CHOICES.filter((choice) => choice.id !== 'iron-sand-salt').map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select>
            </label>}
            <p className="ml-description">{guided
              ? 'You have a dry mixture of 15 g iron filings, 40 g sand and 20 g salt. Plan an order of steps that recovers each solid pure. Each step uses a different physical property, and each result is recorded in your table. Water is available for the dissolve step.'
              : 'Each tool uses a measurable physical property. Recover material without changing one substance into another.'}</p>
            <div className="ml-technique-list" role="group" aria-label="Choose a separation technique">
              {techniqueChoices.map((technique) => <button key={technique.id} type="button" className={selectedTechnique === technique.id ? 'is-picked' : ''} aria-pressed={selectedTechnique === technique.id} onClick={() => setSelectedTechnique(technique.id)}><span>{technique.name}</span><small>{technique.property}</small></button>)}
            </div>
            <p className="ml-apparatus-note"><b>Apparatus.</b> {APPARATUS_DESCRIPTION[selectedTechnique]}</p>
            <button type="button" className="ml-primary-action" onClick={performSeparation}>Run {selectedTechniqueName.toLowerCase()} <ChevronRight size={16} /></button>
            <div className="ml-mass-ledger"><div className="ml-readout"><span>Mass in sample</span><b>{separationMassG(separation).toFixed(1)} g</b></div>
              {Object.entries(separation.remainingG).filter(([, mass]) => (mass ?? 0) > 0).map(([id, mass]) => <div key={`remain-${id}`} className="ml-ledger-row"><i style={swatchStyle(id as SeparationMaterialId, waterLeft)} /><span>Remaining · {materialName(id as SeparationMaterialId, waterLeft)}</span><b>{(mass ?? 0).toFixed(1)} g</b></div>)}
              {separation.outputs.map((output, index) => Object.entries(output.massesG).map(([id, mass]) => <div key={`${output.label}-${id}-${index}`} className="ml-ledger-row recovered"><i style={swatchStyle(id as SeparationMaterialId, true)} /><span>{output.label} · {SEPARATION_MATERIALS[id as SeparationMaterialId].name}</span><b>{(mass ?? 0).toFixed(1)} g</b></div>))}
              <small>Total represented mass remains {separationExpectedMassG(separation).toFixed(0)} g{separation.addedWaterG > 0 ? ` (including ${separation.addedWaterG} g of added water)` : ''}.</small>
            </div>
            <p className="ml-step-note" aria-live="polite">{separation.lastAction
              ? separation.lastAction.note ?? (separation.lastAction.movedG > 0
                ? `${separation.lastAction.label} contains ${separation.lastAction.movedG.toFixed(1)} g separated by ${SEPARATION_TECHNIQUES.find((entry) => entry.id === separation.lastAction?.technique)?.property.toLowerCase()}.`
                : `This ${SEPARATION_TECHNIQUES.find((entry) => entry.id === separation.lastAction?.technique)?.name.toLowerCase()} found no material in this sample that matched its separation property.`)
              : guided ? 'Predict first: which property could take out the iron? Then choose a step and run it.' : 'Select a technique, predict what its property will separate, then run the step and record the result.'}</p>
            {guided && report && <div className="ml-challenge-card" aria-label="Challenge progress">
              <b>Products so far</b>
              <ul>
                <li className={report.ironPure ? 'done' : ''}>{report.ironPure ? <Check size={14} /> : <i />} Iron filings <span>{report.ironG.toFixed(1)} g of 15 g</span></li>
                <li className={report.sandPure ? 'done' : ''}>{report.sandPure ? <Check size={14} /> : <i />} Sand <span>{report.sandG.toFixed(1)} g of 40 g</span></li>
                <li className={report.saltPure ? 'done' : ''}>{report.saltPure ? <Check size={14} /> : <i />} Dry salt crystals <span>{report.saltG.toFixed(1)} g of 20 g</span></li>
              </ul>
              {report.issues.length > 0 && <p className="ml-feedback incorrect" aria-live="polite">{report.issues.join(' ')} Reset and try a different order.</p>}
              {report.complete && <p className="ml-feedback correct" aria-live="polite"><b><Check size={15} /> Challenge complete</b><span>All three solids were recovered pure in {separation.steps.length} steps. Total mass is accounted for.</span></p>}
              {separation.steps.length > 0 && <p className="ml-sequence">Your sequence: {separation.steps.map((step) => SEPARATION_TECHNIQUES.find((entry) => entry.id === step)?.name).join(' → ')}</p>}
            </div>}
            {selectedTechnique === 'settle-decant' && <p className="ml-science-note"><Droplets size={15} /> Let the solid settle, then gently pour the liquid from above it. Decanting is not suctioning sediment; dissolved salt travels with the water.</p>}
            {(selectedTechnique === 'evaporate' || selectedTechnique === 'distill') && separation.mixtureId === 'oil-water' && <p className="ml-science-note"><Sparkles size={15} /> This comparison treats oil as a heavy, nonvolatile model substance so water is the component that evaporates or condenses. Real oils vary.</p>}
            {!guided && <button type="button" className="ml-secondary-action ml-record-trial" disabled={!separation.lastAction} onClick={recordSeparationTrial}>Record this trial</button>}
            {separationTrials.length > 0 && <div className="ml-trial-log"><b>Investigation records</b><div className="ml-trial-table-wrap"><table className="ml-trial-table"><thead><tr><th>Sample · method</th><th>Separated</th><th>Remaining</th></tr></thead><tbody>{separationTrials.map((trial) => <tr key={trial.id}><td>{guided ? `Step ${trial.id} · ` : ''}{trial.mixture}<small>{trial.technique} · {trial.property}</small></td><td>{trial.movedG.toFixed(1)} g<small>{trial.detail}</small></td><td>{trial.remainingG.toFixed(1)} g</td></tr>)}</tbody></table></div></div>}
            {selectedTechnique === 'filter' && <p className="ml-science-note"><Filter size={15} /> A filter retains suspended sand. Dissolved salt passes through with the water.</p>}
          </>}

          {mode === 'culture' && <>
            <div className="ml-panel-heading"><div><span className="ml-kicker">INVESTIGATE A SEPARATION</span><h2>Change the dish motion</h2></div><Waves size={19} /></div>
            <section className="ml-context-card" aria-label="Source and context: yandying">
              <h3>What is yandying?</h3>
              <p>ACARA's Year 7 teacher background describes yandying as a way of separating less dense particles from denser ones, a little like gold panning. A yandy is a shallow wooden dish similar to a koolamon. It is held in the hand, raised at one corner and gently shaken back and forth, so smaller, denser particles collect low down while larger, lighter ones stay higher up. A common use was separating sand, dirt or ash from seeds.</p>
              <p>ACARA writes that the word comes from the Yindjibarni people of the Pilbara region in Western Australia (also spelled Yindjibarndi), who used it for both the dish and the separating process.</p>
              <h3>Example: double yandying of mulga seeds</h3>
              <p>ACARA describes the Yankunytjatjara peoples of north-western South Australia relying on mulga seeds as food, using a double yandying process:</p>
              <ol>
                <li>Seeds are separated from their pods by threshing and rubbing.</li>
                <li>Yandied to separate the seeds from pod fragments.</li>
                <li>Baked in hot sand and ashes.</li>
                <li>Yandied again to remove the sand and ashes.</li>
                <li>Ground and moistened into a paste.</li>
              </ol>
              <p className="ml-context-respect"><b>Respect and consultation.</b> This is living knowledge that belongs to the communities who hold it. The dish here is a generic physical model: it has no designs and does not represent any community's yandy, and its particle values are illustrative only. Teachers are encouraged to consult local Aboriginal community members or education officers when teaching this topic.</p>
              <a href="https://www.australiancurriculum.edu.au/support-resources/background-information/science_teacher_background_information_AC9S7U06_E6" target="_blank" rel="noreferrer">Source: ACARA teacher background (Year 7, AC9S7U06)</a>
            </section>
            <p className="ml-description">Compare how repeated shaking and tilt sort seed-like particles from chaff. In this illustrative model the dark seeds are smaller and denser than the larger, lighter, tan chaff; both properties affect how readily they separate.</p>
            <label className="ml-range-label"><span>Dish tilt <b>{yandying.tiltDegrees}°</b></span><input aria-label="Dish tilt" type="range" min="-35" max="35" step="1" value={yandying.tiltDegrees} onChange={(event) => { const value = Number(event.currentTarget.value); setYandying((state) => setYandyingTilt(state, value)); }} /></label>
            <div className="ml-action-row"><button type="button" className="ml-primary-action" onClick={() => setYandying((state) => advanceYandying(state, 1))}><Wind size={16} /> Shake dish</button><button type="button" className="ml-secondary-action" onClick={() => setYandying((state) => setYandyingTilt(state, state.tiltDegrees + 5))}>Tip +5°</button></div>
            <div className="ml-mass-ledger"><div className="ml-readout"><span>Seed recovered</span><b>{yandyingLedger.recoveredSeedG.toFixed(1)} g</b></div><div className="ml-ledger-row"><i className="seed" /><span>Seed remaining</span><b>{yandyingLedger.remainingSeedG.toFixed(1)} g</b></div><div className="ml-ledger-row recovered"><i className="chaff" /><span>Chaff separated</span><b>{yandyingLedger.separatedChaffG.toFixed(1)} g</b></div><div className="ml-ledger-row"><i className="chaff" /><span>Chaff remaining</span><b>{yandyingLedger.remainingChaffG.toFixed(1)} g</b></div><small>Illustrative properties: seed {yandying.seedSizeMm} mm · {yandying.seedDensityGPerMl.toFixed(2)} g/mL; chaff {yandying.chaffSizeMm} mm · {yandying.chaffDensityGPerMl.toFixed(2)} g/mL. All {yandyingLedger.totalG} g is accounted for.</small></div>
            <div className="ml-question-card"><b>Compare the separation property</b><p className="ml-description">A sieve mainly selects a size cutoff. This dish investigation combines particle size, density, repeated shaking and tilt. Which variable would you change to compare their effects?</p></div>
            <details className="ml-source-note"><summary>Adjust illustrative particle properties</summary>
              <label className="ml-range-label"><span>Seed size <b>{yandying.seedSizeMm} mm</b></span><input aria-label="Seed size" type="range" min="1" max="12" step="1" value={yandying.seedSizeMm} onChange={(event) => { const value = Number(event.currentTarget.value); setYandying((state) => setYandyingProperties(state, { seedSizeMm: value })); }} /></label>
              <label className="ml-range-label"><span>Seed density <b>{yandying.seedDensityGPerMl.toFixed(2)} g/mL</b></span><input aria-label="Seed density" type="range" min="0.1" max="2" step="0.05" value={yandying.seedDensityGPerMl} onChange={(event) => { const value = Number(event.currentTarget.value); setYandying((state) => setYandyingProperties(state, { seedDensityGPerMl: value })); }} /></label>
              <label className="ml-range-label"><span>Chaff size <b>{yandying.chaffSizeMm} mm</b></span><input aria-label="Chaff size" type="range" min="1" max="12" step="1" value={yandying.chaffSizeMm} onChange={(event) => { const value = Number(event.currentTarget.value); setYandying((state) => setYandyingProperties(state, { chaffSizeMm: value })); }} /></label>
              <label className="ml-range-label"><span>Chaff density <b>{yandying.chaffDensityGPerMl.toFixed(2)} g/mL</b></span><input aria-label="Chaff density" type="range" min="0.1" max="2" step="0.05" value={yandying.chaffDensityGPerMl} onChange={(event) => { const value = Number(event.currentTarget.value); setYandying((state) => setYandyingProperties(state, { chaffDensityGPerMl: value })); }} /></label>
              <p>These values are illustrative controls, not measured cultural or botanical data. Alter one property at a time to compare the model sorting response.</p>
            </details>
          </>}

          {mode === 'industrial' && <>
            <div className="ml-panel-heading"><div><span className="ml-kicker">SYDNEY WATER · SIMPLIFIED</span><h2>Choose a treatment step</h2></div><FlaskConical size={19} /></div>
            <p className="ml-description">Follow large debris and suspended sediment through a teaching model of a treatment train: bar screen, flocculation tank and layered filter bed.</p>
            <div className="ml-industrial-stages" role="group" aria-label="Choose an industrial water treatment stage">
              {INDUSTRIAL_STAGES.map((stage, index) => <button key={stage.id} type="button" className={selectedIndustrialStage === stage.id ? 'is-picked' : ''} aria-pressed={selectedIndustrialStage === stage.id} onClick={() => setSelectedIndustrialStage(stage.id)}><i>{industrial.stages.includes(stage.id) ? <Check size={13} /> : `0${index + 1}`}</i><span>{stage.label}</span></button>)}
            </div>
            {selectedIndustrialStage === 'flocculate' && <label className="ml-range-label"><span>Relative coagulant dose <b>{industrial.coagulantDosePercent}%</b></span><input aria-label="Relative coagulant dose" type="range" min="0" max="100" step="5" value={industrial.coagulantDosePercent} onChange={(event) => { const value = Number(event.currentTarget.value); setIndustrial((state) => setIndustrialCoagulantDose(state, value)); }} /><small>Illustrative only · coagulant amount/chemistry is not in the pollutant mass ledger.</small></label>}
            <p className="ml-step-note">{INDUSTRIAL_STAGES.find((stage) => stage.id === selectedIndustrialStage)?.explanation}</p>
            <button type="button" className="ml-primary-action" onClick={runIndustrial}>Run {selectedIndustrialStage === 'filter' ? 'filter media' : selectedIndustrialStage === 'flocculate' ? 'flocculation' : 'screen'} <ChevronRight size={16} /></button>
            <div className="ml-mass-ledger"><div className="ml-readout"><span>Remaining suspended particles</span><b>{industrialLedger.remainingSuspendedG.toFixed(1)} g</b></div><div className="ml-ledger-row"><i className="debris" /><span>Large debris · waste</span><b>{industrial.wasteDebrisG.toFixed(1)} g</b></div><div className="ml-ledger-row"><i className="sediment" /><span>Suspended sediment · waste</span><b>{industrial.wasteSedimentG.toFixed(1)} g</b></div><div className="ml-ledger-row"><i className="salt" /><span>Dissolved salt · remains</span><b>{industrial.dissolvedSaltG.toFixed(1)} g</b></div><small>Clarity is a particle readout only; dissolved salt remains and safety is not inferred.</small></div>
            <p className="ml-science-note"><Droplets size={15} /> Flocculation gathers sediment but does not remove its mass. Filtration alone does not remove dissolved salt.</p>
            <details className="ml-source-note"><summary>Source and model limits</summary><p>This simplified sequence is based on Sydney Water's public filtration education resource. Screening and filter media physically separate particles; coagulant addition is a chemical aid that gathers fine particles before filtration. The dose control is qualitative, coagulant chemistry/mass and disinfection are omitted, and clear-looking water is not evidence of safety.</p><a href="https://www.sydneywater.com.au/education/drinking-water/water-quality-filtration.html" target="_blank" rel="noreferrer">Read Sydney Water's filtration resource</a></details>
          </>}
        </aside>
      </div>
      <footer className="ml-footer"><span>MODEL TIME {modelTime.toFixed(1)} s</span><span><kbd>Space</kbd> play / pause <kbd>R</kbd> reset</span></footer>
    </section>
  );
}
