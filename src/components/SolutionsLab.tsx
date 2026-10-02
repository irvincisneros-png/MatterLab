import { Component, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Beaker, Check, CircleHelp, Droplets, FlaskConical, Gauge, Info, Pause, Play, RotateCcw, RotateCw, Sparkles, StepForward, Thermometer, Waves } from 'lucide-react';
import { LabBeaker, LabBench, StudioLights } from './scene/LabPrimitives';
import { buildDishModel, buildDynamicModel, buildSolidModel, FLOOR_Y, ParticleLayer, planSolid, type SolidPlan } from './scene/SolutionsParticles';
import {
  addSolute,
  advanceSolutions,
  beginNewSolubilityTrial,
  beginSupersaturationChallenge,
  clearSolubilityTrials,
  createSolutionsState,
  hasExcessSolute,
  isAtEquilibrium,
  isExactSolubilityMeasurement,
  loadComparisonPreset,
  prepareParticleModelSolution,
  massLedgerAt,
  prepareHotClearSucrose,
  recordSolubilityTrial,
  relativeConcentrationLabel,
  seedSupersaturatedSolution,
  setParticleSize,
  setSolutionTemperature,
  setSolutionsMode,
  setSolute,
  setStirring,
  solubilityCapacityG,
  SOLUTES,
  SOLUTE_ADD_STEP_G,
  SOLVENT_MASS_G,
  SOLUTION_TEMPERATURE_RANGE_C,
  supersaturationChallengeComplete,
  type ComparisonPreset,
  type SolutionsMode,
  type SolutionsState,
  type SoluteId,
  type SolubilityTrial,
} from '../science/solutionsEngine';
import './SolutionsLab.css';
import { watchContextLoss } from './scene/contextLoss';

export type { SolutionsMode } from '../science/solutionsEngine';

export type SolutionsLabProps = {
  initialMode?: SolutionsMode;
  onModeChange?: (mode: SolutionsMode) => void;
};


const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function AspectFitCamera({ x, y, z }: { x: number; y: number; z: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const fit = clamp(1.48 / aspect, 1, 1.18);
    camera.position.set(x * fit, y * fit, z * fit);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, x, y, z]);
  return null;
}

const MODE_OPTIONS: readonly { id: SolutionsMode; label: string; short: string; icon: typeof Beaker }[] = [
  { id: 'dissolving', label: 'Dissolving', short: 'Rate & solubility', icon: Droplets },
  { id: 'investigation', label: 'Investigation', short: 'Measure & graph', icon: FlaskConical },
  { id: 'temperature', label: 'Temperature', short: 'Compare curves', icon: Thermometer },
  { id: 'particles', label: 'Particles', short: 'Model the solution', icon: Waves },
  { id: 'comparison', label: 'Compare', short: 'Concentration states', icon: Gauge },
];

const SEED = (id: number, lane: number) => {
  const value = Math.sin((id + 1) * 78.233 + lane * 32.53) * 43758.5453;
  return value - Math.floor(value);
};

function WeighingDish({ soluteId }: { soluteId: SoluteId }) {
  const dish = useMemo(() => buildDishModel(soluteId), [soluteId]);
  return <group position={[-1.2, -1.027, 0.35]} rotation={[0.03, 0, -0.05]}>
    <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.25, 0.2, 0.045, 36]} /><meshPhysicalMaterial color="#b9d8e9" transparent opacity={0.94} roughness={0.38} /></mesh>
    <mesh position={[0, 0.027, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.24, 0.015, 8, 36]} /><meshStandardMaterial color="#7fa8c4" metalness={0.18} roughness={0.35} /></mesh>
    <ParticleLayer model={dish.model} cationKind={dish.cationKind} />
    <group position={[-0.05, 0.12, 0.08]} rotation={[0, 0, Math.PI / 2]}><mesh><cylinderGeometry args={[0.026, 0.032, 0.27, 12]} /><meshStandardMaterial color="#7996ad" metalness={0.35} roughness={0.28} /></mesh><mesh position={[0, 0.15, 0]}><sphereGeometry args={[0.043, 12, 10]} /><meshStandardMaterial color="#d7e8f1" metalness={0.25} roughness={0.25} /></mesh></group>
  </group>;
}

/** The rod only turns while stirring; its tip stays above any crystals resting on the floor. */
function StirringRod({ state, tipY }: { state: SolutionsState; tipY: number }) {
  const angle = state.stirring ? state.modelTimeSeconds * 1.75 : 0;
  const x = state.stirring ? Math.cos(angle) * 0.28 : 0.28;
  const z = state.stirring ? Math.sin(angle) * 0.28 : 0;
  const bottom = Math.min(-0.3, Math.max(-0.88, tipY + 0.07));
  const top = 1.02;
  const length = top - bottom;
  return <group position={[x, 0, z]} rotation={[0.09 * Math.sin(angle), 0, 0.11 + 0.08 * Math.cos(angle)]}>
    <mesh position={[0, (top + bottom) / 2, 0]}><cylinderGeometry args={[0.028, 0.028, length, 14]} /><meshPhysicalMaterial color="#d7f0f8" transparent opacity={0.86} roughness={0.1} metalness={0.03} clearcoat={1} /></mesh>
    <mesh position={[0.012, (top + bottom) / 2 + 0.01, 0]}><cylinderGeometry args={[0.006, 0.006, length - 0.18, 8]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.85} /></mesh>
    <mesh position={[0, top + 0.01, 0]}><sphereGeometry args={[0.044, 14, 10]} /><meshPhysicalMaterial color="#f7fdff" transparent opacity={0.86} roughness={0.1} clearcoat={1} /></mesh>
    <mesh position={[0, bottom, 0]}><sphereGeometry args={[0.03, 12, 8]} /><meshPhysicalMaterial color="#b9e1ec" transparent opacity={0.76} roughness={0.18} clearcoat={.8} /></mesh>
  </group>;
}

function StirFlow({ state, visible }: { state: SolutionsState; visible: boolean }) {
  const curves = useMemo(() => [0, Math.PI].map((offset) => {
    const points = Array.from({ length: 49 }, (_, index) => {
      const t = index / 48;
      const angle = t * Math.PI * 3 + offset + state.modelTimeSeconds * 1.65;
      return new THREE.Vector3(Math.cos(angle) * 0.55, -0.86 + t * 0.62, Math.sin(angle) * 0.55);
    });
    return new THREE.CatmullRomCurve3(points);
  }), [state.modelTimeSeconds]);
  if (!visible || !state.stirring) return null;
  return <group>{curves.map((curve, index) => <mesh key={index}><tubeGeometry args={[curve, 64, 0.008, 6, false]} /><meshBasicMaterial color={index ? '#72b7e6' : '#4cc4d0'} transparent opacity={0.26} depthWrite={false} /></mesh>)}</group>;
}

function SolutionsWorld({ state, particleView }: { state: SolutionsState; particleView: boolean }) {
  const plan = planSolid(state, particleView);
  const solid = useMemo(() => buildSolidModel(plan), [plan.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dynamic = buildDynamicModel(state, plan, particleView);
  return (
    <>
      <StudioLights />
      <LabBench position={[0, -1.1, 0]} width={3.9} depth={2.8} />
      <LabBeaker radius={0.8} height={2} fill={0.4} particleLens={particleView} graduated capacityMl={250} waterColor="#57b8df" />
      <WeighingDish soluteId={state.soluteId} />
      <StirringRod state={state} tipY={plan.kind === 'none' ? FLOOR_Y : plan.topY} />
      <StirFlow state={state} visible={particleView} />
      <ParticleLayer model={solid} cationKind={plan.cationKind} />
      <ParticleLayer model={dynamic} cationKind={plan.cationKind} />
      <AspectFitCamera x={2.55} y={1.72} z={3.86} />
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.1} maxDistance={8.6} maxPolarAngle={Math.PI * 0.84} />
    </>
  );
}

function ErrorBoundary({ children, onFailure }: { children: ReactNode; onFailure: () => void }) {
  return <BoundaryImpl onFailure={onFailure}>{children}</BoundaryImpl>;
}

type BoundaryState = { failed: boolean };
class BoundaryImpl extends Component<{ children: ReactNode; onFailure: () => void }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error('SolutionsLab 3D renderer failed:', error);
    this.props.onFailure();
  }
  render() { return this.state.failed ? null : this.props.children; }
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

function TwoDimensionalBeaker({ state, plan, particleView }: { state: SolutionsState; plan: SolidPlan; particleView: boolean }) {
  const ledger = massLedgerAt(state);
  const capacity = solubilityCapacityG(state.soluteId, state.temperatureC);
  const kind = SOLUTES[state.soluteId].kind;
  const dissolvedUnits = particleView ? Math.min(24, Math.ceil(ledger.dissolvedG / 2.5)) : 0;
  const cationClass = state.soluteId === 'potassium-chloride' ? 'potassium' : 'sodium';
  const spot = (id: number, lane: number) => ({ left: `${16 + SEED(id, lane) * 68}%`, top: `${46 + SEED(id, lane + 1) * 40}%` });
  const blocks = plan.kind === 'ionic' || plan.kind === 'molecular' ? plan.crystals.slice(0, 6).map((crystal) => {
    const cells = Math.min(crystal.share, plan.kind === 'ionic' ? 25 : 6);
    return { columns: Math.max(1, Math.min(5, Math.ceil(Math.sqrt(cells)))), share: cells, cell: plan.kind === 'ionic' ? 8 : 15 };
  }) : [];
  return (
    <div className={`slab-fallback ${particleView ? 'particles' : ''}`} role="img" aria-label={`2D beaker: ${SOLUTES[state.soluteId].name}. ${ledger.dissolvedG.toFixed(1)} grams dissolved and ${ledger.undissolvedG.toFixed(1)} grams undissolved in ${state.solventMassG} grams water at ${Math.round(state.temperatureC)} degrees Celsius. Capacity ${capacity.toFixed(1)} grams per 100 grams water.`}>
      <div className="slab-fallback-vessel"><i className="slab-fallback-water" style={{ height: '58%' }} />
        {particleView && Array.from({ length: 12 }, (_, id) => <span key={`water-${id}`} className="slab-fallback-water-molecule" style={{ left: `${24 + SEED(id, 21) * 52}%`, top: `${41 + SEED(id, 22) * 41}%` }}><i className="oxygen" /><i className="hydrogen first" /><i className="hydrogen second" /></span>)}
        {kind === 'ionic' && Array.from({ length: dissolvedUnits }, (_, id) => <span key={`ions-${id}`}>
          <i className={`slab-fallback-particle ${cationClass} dissolved`} style={spot(id, 30)} />
          <i className="slab-fallback-particle chloride dissolved" style={spot(id, 34)} />
        </span>)}
        {kind === 'molecular' && Array.from({ length: dissolvedUnits }, (_, id) => <span key={`sucrose-${id}`} className="slab-fallback-sucrose dissolved" style={spot(id, 38)}><i className="carbon" /><i className="oxygen first" /><i className="oxygen second" /><i className="hydrogen" /></span>)}
        <div className="slab-fallback-crystals" data-solid={plan.kind}>
          {blocks.map((block, index) => <div key={index} className={`slab-fallback-crystal ${plan.kind}`} style={{ gridTemplateColumns: `repeat(${block.columns}, ${block.cell}px)` }} aria-hidden="true">
            {Array.from({ length: block.share }, (_, cell) => plan.kind === 'ionic'
              ? <i key={cell} className={`slab-fallback-particle solid ${((cell % block.columns) + Math.floor(cell / block.columns)) % 2 === 0 ? cationClass : 'chloride'}`} />
              : <span key={cell} className="slab-fallback-sucrose solid"><i className="carbon" /><i className="oxygen first" /><i className="oxygen second" /></span>)}
          </div>)}
          {plan.kind === 'sand' && <div className="slab-fallback-crystal sand" style={{ gridTemplateColumns: 'repeat(10, 8px)' }} aria-hidden="true">{Array.from({ length: Math.min(40, plan.sand?.count ?? 0) }, (_, cell) => <i key={cell} className="slab-fallback-particle solid sand" />)}</div>}
        </div>
      </div>
      <div className="slab-fallback-scoop"><i />5 g weighed sample · outside solution</div>
      <p><b>2D solution view</b><span>Water molecules stay H₂O; solute mass remains in the solution or as solid.</span></p>
    </div>
  );
}

const GRAPH_COLORS: Record<SoluteId, string> = { salt: '#2465dc', sugar: '#e4a337', 'potassium-chloride': '#10a6b5', sand: '#74869e' };

function SolubilityGraph({ selected, trials, title = 'Solubility curves' }: { selected: SoluteId; trials: readonly SolubilityTrial[]; title?: string }) {
  const left = 38;
  const top = 12;
  const width = 300;
  const height = 128;
  const maximum = 520;
  const xAt = (temperature: number) => left + temperature / 100 * width;
  const yAt = (capacity: number) => top + height - capacity / maximum * height;
  const chartSolutes: readonly SoluteId[] = selected === 'sand' ? ['salt', 'sugar', 'potassium-chloride'] : [selected, ...(['salt', 'sugar', 'potassium-chloride'] as const).filter((id) => id !== selected)];
  return (
    <figure className="slab-graph-figure">
      <figcaption><span>{title}</span><small>g solute / 100 g water</small></figcaption>
      <svg className="slab-graph" viewBox="0 0 370 174" role="img" aria-label="Solubility in grams per 100 grams water versus temperature in degrees Celsius. The sucrose curve rises far more steeply than the sodium chloride curve.">
        {[0, 100, 200, 300, 400, 500].map((tick) => <g key={tick}><line x1={left} x2={left + width} y1={yAt(tick)} y2={yAt(tick)} className="graph-grid" /><text x={left - 8} y={yAt(tick) + 4} className="graph-axis" textAnchor="end">{tick}</text></g>)}
        {[0, 20, 40, 60, 80, 100].map((tick) => <g key={tick}><line x1={xAt(tick)} x2={xAt(tick)} y1={top} y2={top + height} className="graph-grid vertical" /><text x={xAt(tick)} y={top + height + 17} className="graph-axis" textAnchor="middle">{tick}</text></g>)}
        <line x1={left} x2={left} y1={top} y2={top + height} className="graph-axes" /><line x1={left} x2={left + width} y1={top + height} y2={top + height} className="graph-axes" />
        {chartSolutes.map((id) => {
          const definition = SOLUTES[id];
          const path = definition.curve.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(point.temperatureC)} ${yAt(point.capacityG)}`).join(' ');
          return <g key={id} className={id === selected ? 'selected-curve' : ''}><path d={path} stroke={GRAPH_COLORS[id]} className="graph-curve" /><text x={xAt(98) - 3} y={yAt(definition.curve[definition.curve.length - 1].capacityG) - 5} className="curve-label" fill={GRAPH_COLORS[id]} textAnchor="end">{id === 'salt' ? 'NaCl' : id === 'sugar' ? 'sucrose' : 'KCl'}</text></g>;
        })}
        {trials.map((trial) => trial.measurementG !== null && <circle key={trial.id} cx={xAt(trial.temperatureC)} cy={yAt(trial.measurementG)} r="4.5" className={`trial-point ${trial.soluteId}`} aria-label={`Measured ${trial.measurementG.toFixed(1)} grams at ${trial.temperatureC} degrees`} />)}
        <text x={left + width / 2} y="170" className="graph-axis-title" textAnchor="middle">Temperature (°C)</text>
      </svg>
      <div className="slab-graph-legend"><span><i className="ref-dot" />Approximate ACS classroom curve</span><span><i className="trial-dot" />Your exact equilibrium readings</span></div>
      <small className="slab-graph-basis-note">Rounded teaching points are shown as g/100 g water; ACS tables them per 100 mL water.</small>
    </figure>
  );
}

function statusText(state: SolutionsState) {
  if (state.addedG <= 0) return 'Add a measured amount of solute to begin.';
  if (state.metastable) return 'Supersaturated and metastable: no crystals are present yet.';
  if (!isAtEquilibrium(state)) return 'Still dissolving or crystallising. Wait for equilibrium before measuring solubility.';
  if (isExactSolubilityMeasurement(state)) return 'Equilibrium with excess solid: this is an exact model solubility reading.';
  return 'All added solute has dissolved. This is only a lower bound, not a measured solubility.';
}

function statusClass(state: SolutionsState) {
  if (state.metastable) return 'supersaturated';
  if (isExactSolubilityMeasurement(state)) return 'measured';
  if (!isAtEquilibrium(state)) return 'waiting';
  return 'lower-bound';
}

function SolubilityTrialTable({ trials }: { trials: readonly SolubilityTrial[] }) {
  return <div className="slab-table-scroll"><table className="slab-trial-table"><caption>Recorded solubility trials</caption><thead><tr><th scope="col">Trial</th><th scope="col">Solute</th><th scope="col">Temp.</th><th scope="col">Added</th><th scope="col">Reading</th></tr></thead><tbody>
    {trials.length === 0 ? <tr><td colSpan={5}>No trials recorded yet.</td></tr> : trials.map((trial) => <tr key={trial.id}><th scope="row">{trial.id}</th><td>{SOLUTES[trial.soluteId].formula}</td><td>{trial.temperatureC}°C</td><td>{trial.addedG.toFixed(1)} g</td><td>{trial.measurementG === null ? `≥ ${trial.lowerBoundG.toFixed(1)} g · ${trial.status.replaceAll('-', ' ')}` : `${trial.measurementG.toFixed(1)} g · exact`}</td></tr>)}
  </tbody></table></div>;
}

function vocabContent(state: SolutionsState) {
  const kind = SOLUTES[state.soluteId].kind;
  return kind === 'ionic'
    ? 'Solute: the sodium chloride crystal. Solvent: water. Solution: water with dispersed Na⁺ and Cl⁻ ions. Dissolving separates ions; it does not create or destroy them.'
    : kind === 'molecular'
      ? 'Solute: sucrose crystals. Solvent: water. Solution: water with whole sucrose molecules dispersed through it. Dissolving separates molecules, not their covalent bonds.'
      : 'Solute: sand grains. Solvent: water. Sand is effectively insoluble at this model scale, so separate grains remain instead of forming a uniform solution.';
}

export function SolutionsLab({ initialMode = 'dissolving', onModeChange }: SolutionsLabProps): ReactElement {
  const [state, setState] = useState<SolutionsState>(() => prepareParticleModelSolution(createSolutionsState(initialMode, initialMode === 'comparison' ? 'sugar' : 'salt')));
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(() => !canUseWebGL());
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [particleView, setParticleView] = useState(initialMode === 'dissolving' || initialMode === 'particles');
  const [showDetails, setShowDetails] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const initialValue = useRef(initialMode);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (initialValue.current === initialMode) return;
    initialValue.current = initialMode;
    setPlaying(false);
    setState((current) => prepareParticleModelSolution(setSolutionsMode(current, initialMode)));
    setParticleView(initialMode === 'dissolving' || initialMode === 'particles');
  }, [initialMode]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let accumulator = 0;
    let frameId = 0;
    const fixedStep = 1 / 60;
    const frame = (now: number) => {
      accumulator += Math.min(0.12, (now - last) / 1000) * (reducedMotion ? 0.3 : 1);
      last = now;
      const steps = Math.floor(accumulator / fixedStep);
      accumulator -= steps * fixedStep;
      if (steps > 0) setState((current) => {
        let next = current;
        for (let index = 0; index < steps; index += 1) next = advanceSolutions(next, fixedStep);
        return next;
      });
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [playing, reducedMotion]);

  const solidPlan = planSolid(state, particleView);
  const ledger = massLedgerAt(state);
  const capacity = solubilityCapacityG(state.soluteId, state.temperatureC);
  const classification = relativeConcentrationLabel(state);
  const challengeComplete = supersaturationChallengeComplete(state);

  const selectMode = (mode: SolutionsMode) => {
    if (state.mode === mode) return;
    setPlaying(false);
    setState((current) => prepareParticleModelSolution(setSolutionsMode(current, mode)));
    if (mode === 'dissolving' || mode === 'particles') setParticleView(true);
    onModeChange?.(mode);
  };
  const resetSample = () => {
    setPlaying(false);
    setState((current) => ({ ...createSolutionsState(current.mode, current.soluteId), trials: current.trials, nextTrialId: current.nextTrialId }));
  };
  const step = () => {
    setPlaying(false);
    setState((current) => advanceSolutions(current, 1));
  };
  const changeSolute = (id: SoluteId) => setState((current) => prepareParticleModelSolution(setSolute(current, id)));
  const toggleStirring = () => {
    const willStart = !state.stirring;
    setState((current) => setStirring(current, !current.stirring));
    if (willStart) setPlaying(true);
  };
  const loadPreset = (preset: ComparisonPreset) => setState((current) => loadComparisonPreset(current, preset));
  const startChallenge = () => setState((current) => current.challengeActive
    ? { ...current, challengeActive: false, challengeCooled: false, challengeSeeded: false }
    : beginSupersaturationChallenge(current));

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input, select, textarea, button')) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); }
    if (event.key.toLowerCase() === 'r') resetSample();
  };

  const retryGraphics = () => {
    if (!canUseWebGL()) return;
    setGraphicsFailed(false);
    setCanvasReady(false);
    setCanvasKey((key) => key + 1);
  };
  const resetCamera = () => { setCanvasReady(false); setCanvasKey((key) => key + 1); };
  const activeMode = MODE_OPTIONS.find((item) => item.id === state.mode) ?? MODE_OPTIONS[0];
  const relationLabel = classification === 'less-than-reference' ? 'Less concentrated than Sample B'
    : classification === 'more-than-reference' ? 'More concentrated than Sample B'
      : classification === 'same-as-reference' ? 'Same concentration as Sample B'
        : 'Choose a matched Sample B';
  const stateCondition = state.metastable ? 'Supersaturated · metastable'
    : ledger.dissolvedG >= capacity - 0.01 && capacity > 0
      ? hasExcessSolute(state) ? 'Saturated · excess solid' : 'At saturation'
      : capacity <= 0 && ledger.dissolvedG === 0 ? 'No measurable dissolving' : 'Below saturation';
  const activeComparisonPreset: ComparisonPreset | null = state.mode !== 'comparison' || state.soluteId !== 'sugar' || state.temperatureC !== 20
    ? null
    : state.addedG === 40 && state.dissolvedG === 40 ? 'dilute'
      : state.addedG === 150 && state.dissolvedG === 150 ? 'concentrated'
        : state.addedG > capacity && Math.abs(state.dissolvedG - capacity) < 0.01 ? 'saturated' : null;

  return (
    <section ref={rootRef} className={`solutions-lab sl-${state.mode}`} tabIndex={0} onKeyDown={handleKeyDown} aria-label="MatterLab Solutions laboratory">
      <header className="slab-header">
        <div className="slab-brand"><span className="slab-brand-mark"><Beaker size={21} /></span><span><strong>Solutions</strong><small>What dissolves, how much, and why</small></span></div>
        <div className="slab-header-chip"><i /> 100 g water · {Math.round(state.temperatureC)} °C</div>
      </header>

      <nav className="slab-mode-tabs" aria-label="Choose a solutions experience">
        {MODE_OPTIONS.map(({ id, label, short, icon: Icon }) => <button type="button" key={id} className={state.mode === id ? 'selected' : ''} aria-pressed={state.mode === id} onClick={() => selectMode(id)}><Icon size={17} /><span><b>{label}</b><small>{short}</small></span></button>)}
      </nav>

      <div className="slab-workspace">
        <section className="slab-scene-panel" aria-label={`3D solution beaker: ${SOLUTES[state.soluteId].name}. ${ledger.dissolvedG.toFixed(1)} g dissolved and ${ledger.undissolvedG.toFixed(1)} g undissolved in ${state.solventMassG} g water at ${Math.round(state.temperatureC)} °C${state.stirring ? '; the glass stirring rod is moving' : ''}.`}>
          <div className="slab-scene-head"><div><span className="slab-kicker">{state.mode === 'investigation' ? 'MEASURE THE SOLUTION' : state.mode === 'comparison' ? 'CONCENTRATION & CAPACITY' : 'A SOLUTION, CLOSE UP'}</span><h1>{state.mode === 'investigation' ? 'Solubility investigation' : state.mode === 'temperature' ? 'Temperature changes capacity' : state.mode === 'particles' ? 'The particle model' : state.mode === 'comparison' ? 'Dilute to supersaturated' : 'Dissolving in water'}</h1></div><span className="slab-condition-chip">{SOLUTES[state.soluteId].formula}</span></div>
      <div className="slab-canvas-wrap" data-graphics={canvasReady && !graphicsFailed ? 'ready' : graphicsFailed ? 'fallback' : 'starting'} data-particles={particleView ? 'on' : 'off'} data-stirring={state.stirring ? 'on' : 'off'} data-rod-angle={state.stirring ? (state.modelTimeSeconds * 1.75).toFixed(2) : '0'} data-model-time={state.modelTimeSeconds.toFixed(3)}>
            {!graphicsFailed && <ErrorBoundary key={canvasKey} onFailure={() => { setGraphicsFailed(true); setCanvasReady(false); }}>
              <Canvas key={canvasKey} className="slab-canvas" camera={{ position: [3.1, 2.1, 4.7], fov: 36 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => {
                setCanvasReady(true);
                setGraphicsFailed(false);
                watchContextLoss(gl.domElement, () => { setGraphicsFailed(true); setCanvasReady(false); });
              }} fallback={null}><SolutionsWorld state={state} particleView={particleView} /></Canvas>
            </ErrorBoundary>}
            {graphicsFailed && <><TwoDimensionalBeaker state={state} plan={solidPlan} particleView={particleView} /><button className="slab-retry" type="button" onClick={retryGraphics}>Try 3D again</button></>}
            <div className="slab-scene-readout"><b>{ledger.dissolvedG.toFixed(1)} g</b><i /> <span>dissolved</span><small>{ledger.undissolvedG.toFixed(1)} g solid</small></div>
            <div className="slab-scene-notes">
              <div className="slab-stage-sample-tag"><i />Next 5 g of {state.soluteId === 'sand' ? 'sand' : SOLUTES[state.soluteId].formula} · on the watch glass</div>
              <div className="slab-scene-caption"><i /> {state.mode === 'particles' || particleView ? 'Water stays H₂O · solute particles keep their identities' : 'Stirring and grain size change rate, not capacity'}</div>
            </div>
          </div>
          <div className="slab-transport">
            <div className="slab-play-tools"><button type="button" className="slab-play" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause model' : 'Play model'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{playing ? 'Pause' : 'Play'}</button><button type="button" className="slab-tool" aria-label="Advance model one second" onClick={step}><StepForward size={17} />Step</button><button type="button" className="slab-tool" aria-label="Reset solution sample" onClick={resetSample}><RotateCcw size={16} />Reset</button></div>
            <button type="button" className={`slab-view-toggle ${particleView ? 'selected' : ''}`} aria-pressed={particleView} onClick={() => setParticleView((value) => !value)}><Waves size={15} />{particleView ? 'Particles on' : 'Particles off'}</button>
            <button type="button" className="slab-view-reset" aria-label="Reset camera view" onClick={resetCamera}><RotateCw size={15} />View</button>
          </div>
          <div className="slab-apparatus-note"><span><b>{SOLVENT_MASS_G} g water</b> stays fixed</span><span>Capacity at {Math.round(state.temperatureC)} °C: <b>{capacity.toFixed(1)} g / 100 g water</b></span><small>250 mL graduations are illustrative; mixing volume change is omitted.</small></div>
        </section>

        <aside className="slab-control-panel" aria-label="Solubility experiment controls and mass ledger">
          <div className="slab-panel-title"><div><span className="slab-kicker">{activeMode.label.toUpperCase()}</span><h2>{state.mode === 'investigation' ? 'Make a fair measurement' : state.mode === 'temperature' ? 'Change one condition' : state.mode === 'particles' ? 'Follow the particles' : state.mode === 'comparison' ? 'Compare solution states' : 'Change the sample'}</h2></div><button type="button" className="slab-info" aria-label={showDetails ? 'Hide model notes' : 'Show model notes'} aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}><Info size={17} /></button></div>
          <p className="slab-lead">{state.mode === 'investigation' ? 'Measure additions into the same amount of water. An exact reading needs equilibrium and excess solid.' : state.mode === 'temperature' ? 'Capacity depends on the material. Temperature can affect salt, sugar and potassium chloride differently.' : state.mode === 'particles' ? 'Dissolving spreads solute particles through water. Ionic crystals and molecular crystals do not dissolve into the same kind of particles.' : state.mode === 'comparison' ? 'Dilute and concentrated are relative descriptions. Saturation depends on the solute and temperature.' : 'Add a weighed solute sample, then compare what dissolves with what stays as solid.'}</p>

          <label className="slab-select-label"><span>Choose a solute</span><select aria-label="Solute" value={state.soluteId} onChange={(event) => changeSolute(event.currentTarget.value as SoluteId)}>{Object.values(SOLUTES).map((solute) => <option key={solute.id} value={solute.id}>{solute.name} · {solute.formula}</option>)}</select></label>

          {state.mode === 'dissolving' && <div className="slab-glossary" aria-label="Solution vocabulary"><p><b>Solute</b> {SOLUTES[state.soluteId].name} · <b>solvent</b> water · dispersed particles form a <b>solution</b>.</p><span>{SOLUTES[state.soluteId].kind === 'insoluble' ? 'Sand is effectively insoluble at this model scale.' : `This material is soluble in water; solubility at ${Math.round(state.temperatureC)} °C is about ${capacity.toFixed(1)} g per 100 g water.`}</span></div>}

          <div className="slab-condition-card">
            <div className="slab-capacity-line"><span><b><Thermometer size={15} /> Temperature</b><output>{Math.round(state.temperatureC)} °C</output></span><span className="slab-capacity-badge">Limit {capacity.toFixed(1)} g</span></div>
            <input aria-label="Solution temperature" type="range" min={SOLUTION_TEMPERATURE_RANGE_C.minimum} max={SOLUTION_TEMPERATURE_RANGE_C.maximum} step="1" value={state.temperatureC} onChange={(event) => { const temperatureC = Number(event.currentTarget.value); setState((current) => setSolutionTemperature(current, temperatureC)); }} />
            <span className="slab-range-ends"><small>Cold</small><small>Hot</small></span>
            <div className="slab-stir-row"><button type="button" className={state.stirring ? 'is-on' : ''} aria-label={state.stirring ? 'Stop stirring' : 'Start stirring'} aria-pressed={state.stirring} onClick={toggleStirring}><Waves size={16} />{state.stirring ? 'Stop stirring' : 'Start stirring'}</button><div className="slab-grain-toggle" role="group" aria-label="Choose crystal size"><button type="button" className={state.particleSize === 'coarse' ? 'active' : ''} aria-pressed={state.particleSize === 'coarse'} onClick={() => setState((current) => setParticleSize(current, 'coarse'))}>Coarse</button><button type="button" className={state.particleSize === 'fine' ? 'active' : ''} aria-pressed={state.particleSize === 'fine'} onClick={() => setState((current) => setParticleSize(current, 'fine'))}>Fine</button></div></div>
            <small className="slab-rate-note">Stirring and finer grains change the accelerated dissolving rate, not the solubility limit.</small>
          </div>

          <div className="slab-add-row"><div><span>Measured solute added</span><b>{ledger.addedG.toFixed(1)} <small>g</small></b></div><button type="button" onClick={() => setState((current) => addSolute(current, SOLUTE_ADD_STEP_G))}>Add 5 g</button><button type="button" className="large-add" onClick={() => setState((current) => addSolute(current, 25))}>Add 25 g</button></div>

          <div className={`slab-status ${statusClass(state)}`} aria-live="polite"><span className="slab-status-dot" /><p>{statusText(state)}</p><b>{stateCondition}</b></div>
          <div className="slab-mass-ledger" aria-label="Conserved solute mass ledger">
            <div className="slab-ledger-heading"><span className="slab-kicker">SOLUTE MASS LEDGER</span><b>{ledger.addedG.toFixed(1)} g in</b></div>
            <div className="slab-mass-bar"><span className="dissolved" style={{ width: `${ledger.addedG > 0 ? ledger.dissolvedG / ledger.addedG * 100 : 0}%` }} /><span className="solid" style={{ width: `${ledger.addedG > 0 ? ledger.undissolvedG / ledger.addedG * 100 : 0}%` }} /></div>
            <div className="slab-ledger-parts"><span><i className="dissolved-dot" />Dissolved <b>{ledger.dissolvedG.toFixed(1)} g</b></span><span><i className="solid-dot" />Undissolved <b>{ledger.undissolvedG.toFixed(1)} g</b></span></div>
            <small>Added = dissolved + undissolved. The {SOLVENT_MASS_G} g solvent mass does not change.</small>
          </div>

          {state.mode === 'investigation' && <section className="slab-investigation" aria-label="Solubility investigation results">
            <div className="slab-section-head"><div><span className="slab-kicker">RUN YOUR TRIAL</span><b>Record an equilibrium reading</b></div><button type="button" className="slab-record" disabled={state.addedG <= 0} onClick={() => setState((current) => recordSolubilityTrial(current))}>Record trial</button></div>
            <p className="slab-experiment-plan">Keep water volume and temperature fixed. Add a weighed solute until excess remains, then wait for equilibrium.</p>
            <div className="slab-investigation-buttons"><button type="button" onClick={() => setState((current) => beginNewSolubilityTrial(current))}>New trial</button><button type="button" onClick={() => setState((current) => clearSolubilityTrials(current))}>Clear table</button></div>
            <SolubilityTrialTable trials={state.trials} />
            <SolubilityGraph selected={state.soluteId} trials={state.trials} title="Reference curve + measurements" />
          </section>}

          {state.mode === 'temperature' && <section className="slab-temperature-panel"><div className="slab-section-head"><div><span className="slab-kicker">TEMPERATURE COMPARISON</span><b>Same solvent amount · different curves</b></div></div><SolubilityGraph selected={state.soluteId} trials={[]} /><p className="slab-experiment-plan">The published classroom table shows sucrose capacity rising much more steeply than sodium chloride. These curves describe capacity, not dissolving speed.</p></section>}

          {state.mode === 'particles' && <section className="slab-particle-panel"><div className="slab-section-head"><div><span className="slab-kicker">PARTICLE THEORY</span><b>{SOLUTES[state.soluteId].kind === 'ionic' ? 'Ions separate' : SOLUTES[state.soluteId].kind === 'molecular' ? 'Whole molecules spread out' : 'Solid grains remain separate'}</b></div></div><p>{vocabContent(state)}</p><div className="slab-particle-key"><span><i className="water-key" />Water molecule · H₂O</span>{SOLUTES[state.soluteId].kind === 'ionic' ? <><span><i className={state.soluteId === 'salt' ? 'sodium-key' : 'potassium-key'} />{SOLUTES[state.soluteId].cation} ion</span><span><i className="chloride-key" />{SOLUTES[state.soluteId].anion} ion</span></> : <span><i className="solute-key" />{SOLUTES[state.soluteId].name} particles</span>}</div><small>Dots and molecules are schematic markers, not a literal count of all particles.</small></section>}

          {state.mode === 'comparison' && <section className="slab-comparison-panel"><div className="slab-section-head"><div><span className="slab-kicker">MATCHED CONCENTRATION COMPARISON</span><b>{relationLabel}</b></div></div><div className="slab-preset-grid">{(['dilute', 'concentrated', 'saturated'] as const).map((preset) => <button type="button" key={preset} className={activeComparisonPreset === preset ? 'active' : ''} onClick={() => loadPreset(preset)}><b>{preset[0].toUpperCase() + preset.slice(1)}</b><small>{preset === 'dilute' ? 'A 40 g vs B 150 g' : preset === 'concentrated' ? 'A 150 g vs B 40 g' : 'A at capacity vs B 40 g'}</small></button>)}</div>
            <div className="slab-comparison-readings"><div><span>Sample A · current</span><b>{ledger.dissolvedG.toFixed(1)} g / {state.solventMassG} g water</b><small>{stateCondition}</small></div><div><span>Sample B · reference</span><b>{state.comparisonReference ? `${state.comparisonReference.dissolvedG.toFixed(1)} g / ${state.comparisonReference.solventMassG} g water` : 'No matched reference yet'}</b><small>{state.comparisonReference ? `Same ${SOLUTES[state.soluteId].formula} · ${state.comparisonReference.temperatureC} °C` : 'Choose a comparison above'}</small></div></div>
            <p className="slab-experiment-plan">Dilute and concentrated are relative: compare dissolved grams for the same solute, temperature and water mass. Saturation is shown separately against the capacity curve.</p><button type="button" className="slab-hot-setup" onClick={() => setState((current) => prepareHotClearSucrose(current))}><Thermometer size={16} />Prepare hot, fully dissolved sucrose</button>
            <div className="slab-challenge-launch"><div><b>Metastable supersaturation</b><small>Cool a hot clear solution without crystals, then add a seed.</small></div><button type="button" onClick={startChallenge}><Sparkles size={15} />{state.challengeActive ? 'Restart' : 'Try challenge'}</button></div>
            {state.challengeActive && <div className="slab-challenge" aria-live="polite"><div className="slab-challenge-steps"><span className={state.challengeCooled ? 'complete' : ''}><i>{state.challengeCooled ? '✓' : '1'}</i>Cool until metastable</span><span className={state.challengeSeeded ? 'complete' : ''}><i>{state.challengeSeeded ? '✓' : '2'}</i>Add a seed crystal</span></div>{state.metastable && <p>There are no crystals in the beaker yet. A clear solution can remain supersaturated until a seed starts crystal growth.</p>}<button type="button" disabled={!state.metastable} onClick={() => setState((current) => seedSupersaturatedSolution(current))}>Add 0.2 g seed crystal</button><b className={challengeComplete ? 'challenge-success' : ''}>{challengeComplete ? <><Check size={14} />Crystals grew; solute mass is conserved.</> : 'The challenge checks the solution state as you change it.'}</b></div>}
          </section>}

          {showDetails && <div className="slab-detail-note"><CircleHelp size={15} /><p>{state.soluteId === 'salt' ? 'The NaCl particle view shows separated sodium and chloride ions. The 3D marker count is schematic; the engine conserves the formula-unit inventory and its mass.' : state.soluteId === 'sugar' ? 'Sucrose dissolves as intact molecules. Its covalent bonds remain inside each molecule.' : 'These numeric capacity points are the ACS classroom reference curve. The accelerated animation rate is separately illustrative.'} A lower-bound observation is not a solubility measurement.</p></div>}
        </aside>
      </div>
      <footer className="slab-footer"><p><b>{SOLUTES[state.soluteId].name}:</b> {SOLUTES[state.soluteId].description}</p><span><kbd>Space</kbd> play / pause <kbd>R</kbd> reset</span></footer>
    </section>
  );
}

export default SolutionsLab;
