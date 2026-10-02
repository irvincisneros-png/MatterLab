import { Component, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Check, CircleHelp, Droplets, Filter, Gauge, Info, Pause, Play, RotateCcw, RotateCw, Sparkles, StepForward, Waves } from 'lucide-react';
import { PollutionWorld } from './scene/PollutionScene';
import {
  addPollutant,
  advancePollution,
  applyPollutionMethod,
  beginMatchedPollutionTrial,
  beginPollutionChallenge,
  clarityIndexPercent,
  clearPollutionTrials,
  createPollutionState,
  describePollutionScene,
  pollutionChallengeComplete,
  pollutionOutputs,
  pollutionMassCheck,
  POLLUTANTS,
  POLLUTION_METHODS,
  recordPollutionTrial,
  remainingPollutantG,
  remainingTotalPollutantG,
  resetPollutionState,
  saltRemainingG,
  selectPollutionMethod,
  setPollutionHypothesis,
  type PollutionMethodId,
  type PollutionState,
  type PollutantId,
} from '../science/pollutionEngine';
import './PollutionLab.css';
import { watchContextLoss } from './scene/contextLoss';
import { AdaptiveQuality } from './scene/AdaptiveQuality';

type WaterMarker = { id: string; kind: PollutantId | 'sodium-ion' | 'chloride-ion'; position: readonly [number, number, number] };

const SEEDED = (id: number, lane: number) => {
  const value = Math.sin((id + 1) * 78.233 + lane * 32.53) * 43758.5453;
  return value - Math.floor(value);
};

function waterMarkers(state: PollutionState, particleView: boolean): WaterMarker[] {
  const markers: WaterMarker[] = [];
  const sediment = state.pollutants.sediment;
  const sedimentCount = Math.min(28, Math.ceil(sediment.suspendedG / 1.4));
  for (let id = 0; id < sedimentCount; id += 1) {
    const angle = id * 2.399;
    const radius = 0.25 + SEEDED(id, 1) * 0.96;
    const y = -0.63 + SEEDED(id, 2) * 0.4;
    markers.push({ id: `sediment-${id}`, kind: 'sediment', position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius] });
  }
  const litterCount = Math.min(10, Math.ceil((state.pollutants.litter.surfaceG + state.pollutants.litter.suspendedG) / 1.2));
  for (let id = 0; id < litterCount; id += 1) {
    const angle = id * 2.399;
    const radius = 0.22 + SEEDED(id, 3) * 0.9;
    markers.push({ id: `litter-${id}`, kind: 'litter', position: [Math.cos(angle) * radius, -0.105 + Math.sin(state.modelTimeSeconds * 0.5 + id) * 0.009, Math.sin(angle) * radius] });
  }
  if (particleView) {
    const ionPairs = Math.min(14, Math.ceil(state.pollutants.salt.dissolvedG / 1.5));
    for (let id = 0; id < ionPairs; id += 1) {
      const angle = id * 2.399;
      const radius = 0.28 + SEEDED(id, 6) * 0.72;
      const y = -0.5 + SEEDED(id, 7) * 0.5;
      markers.push({ id: `sodium-${id}`, kind: 'sodium-ion', position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius] });
      markers.push({ id: `chloride-${id}`, kind: 'chloride-ion', position: [Math.cos(angle + 0.7) * radius, y + 0.04, Math.sin(angle + 0.7) * radius] });
    }
  }
  return markers;
}

function ErrorBoundary({ children, onFailure }: { children: ReactNode; onFailure: () => void }) {
  return <BoundaryImpl onFailure={onFailure}>{children}</BoundaryImpl>;
}

type BoundaryState = { failed: boolean };
class BoundaryImpl extends Component<{ children: ReactNode; onFailure: () => void }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
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

function PollutionFallback({ state, markers, particleView }: { state: PollutionState; markers: WaterMarker[]; particleView: boolean }) {
  const remaining = remainingTotalPollutantG(state);
  const outputs = pollutionOutputs(state);
  return (
    <div className="plab-fallback" role="img" aria-label={`2D water body. ${describePollutionScene(state, particleView)}`}>
      <div className="plab-fallback-water"><i className="plab-fallback-oil" style={{ width: `${Math.min(68, state.pollutants.oil.surfaceG * 9)}%`, opacity: state.pollutants.oil.surfaceG ? 1 : 0 }} />
        {markers.map((marker) => <i key={marker.id} className={`plab-fallback-dot ${marker.kind}`} style={{ left: `${50 + marker.position[0] * 31}%`, top: `${49 - marker.position[1] * 36}%` }} />)}
      </div>
      <ul className="plab-fallback-outputs" aria-hidden="true">
        <li className="body"><b>Water body</b><span>{remaining.toFixed(1)} g left</span></li>
        <li className="water"><b>Recovered water</b><span>{outputs.recoveredWater.ml.toFixed(0)} mL</span></li>
        <li className="material"><b>Recovered material</b><span>{outputs.recoveredMaterial.totalG.toFixed(1)} g</span></li>
        <li className="waste"><b>Waste</b><span>{outputs.waste.pollutantG.toFixed(1)} g</span></li>
      </ul>
      <p><b>2D water body view</b><span>Controls and conserved ledgers stay live. Clear-looking water is not a safety test.</span></p>
      {!particleView && <small className="plab-fallback-salt">Dissolved salt: {saltRemainingG(state)} g</small>}
    </div>
  );
}

const METHOD_NAMES: Record<PollutionMethodId, string> = { skim: 'Oil skimmer', screen: 'Litter screen', decant: 'Settling and decanting', filter: 'Filter funnel', distill: 'Distillation still' };

/** Labels for the four places pollution can end up, pinned to the 3D objects by the scene. */
function PollutionTags({ state, overlayRef }: { state: PollutionState; overlayRef: React.RefObject<HTMLDivElement | null> }) {
  const outputs = pollutionOutputs(state);
  const salty = outputs.recoveredWater.dissolvedSaltG > 0;
  const hidden = { transform: 'translate(-999px, -999px)' };
  return <div className="plab-tags" ref={overlayRef} aria-hidden="true">
    <div className="plab-tag body" data-tag="body" style={hidden}><b>Water body</b><span>{outputs.body.totalG.toFixed(1)} g pollutant left</span><small>{state.waterBodyMl.toFixed(0)} mL of water</small></div>
    <div className="plab-tag rig" data-tag="rig" style={hidden}><b>{METHOD_NAMES[state.selectedMethod]}</b><span>treatment apparatus</span></div>
    <div className="plab-tag water" data-tag="water" style={hidden}><b>Recovered water</b><span>{outputs.recoveredWater.ml.toFixed(0)} mL</span>{outputs.recoveredWater.ml > 0 && <small>{salty ? 'still holds dissolved salt' : 'untested: not safe to drink'}</small>}</div>
    <div className="plab-tag material" data-tag="material" style={hidden}><b>Recovered material</b><span>{outputs.recoveredMaterial.totalG.toFixed(1)} g</span></div>
    <div className="plab-tag waste" data-tag="waste" style={hidden}><b>Waste</b><span>{outputs.waste.pollutantG.toFixed(1)} g · {outputs.waste.waterMl.toFixed(0)} mL</span></div>
  </div>;
}

/** Phone-width summary of the four destinations; the in-scene chips would overlap at this size. */
function PollutionOutputStrip({ state }: { state: PollutionState }) {
  const outputs = pollutionOutputs(state);
  const salty = outputs.recoveredWater.dissolvedSaltG > 0;
  return <ul className="plab-output-strip" aria-label="Where the pollution is now">
    <li className="body"><b>Water body</b><span>{outputs.body.totalG.toFixed(1)} g left</span></li>
    <li className="water"><b>Recovered water</b><span>{outputs.recoveredWater.ml.toFixed(0)} mL{outputs.recoveredWater.ml > 0 ? (salty ? ' · salty' : ' · untested') : ''}</span></li>
    <li className="material"><b>Recovered material</b><span>{outputs.recoveredMaterial.totalG.toFixed(1)} g</span></li>
    <li className="waste"><b>Waste</b><span>{outputs.waste.pollutantG.toFixed(1)} g</span></li>
  </ul>;
}

function PollutantLedger({ state }: { state: PollutionState }) {
  const labels: Record<PollutantId, string> = { oil: 'Heavy oil film', litter: 'Litter', sediment: 'Sediment', salt: 'Dissolved salt' };
  const classes: Record<PollutantId, string> = { oil: 'oil', litter: 'litter', sediment: 'sediment', salt: 'salt' };
  return <div className="plab-pollutant-ledger" aria-label="Conserved pollutant mass ledger">
    <div className="plab-ledger-heading"><span className="plab-kicker">POLLUTANT LEDGER</span><b>{remainingTotalPollutantG(state).toFixed(1)} g remains</b></div>
    {(['oil', 'litter', 'sediment', 'salt'] as const).map((id) => {
      const entry = state.pollutants[id];
      const check = pollutionMassCheck(state, id);
      return <div className={`plab-ledger-row ${id}`} key={id}><div className="plab-ledger-label"><i className={classes[id]} /><span>{labels[id]}</span><b>{remainingPollutantG(entry).toFixed(1)} g in body</b></div><small>input {check.inputG.toFixed(1)} g · recovered water {check.recoveredWaterG.toFixed(1)} g · recovered material {check.recoveredG.toFixed(1)} g · waste {check.wasteG.toFixed(1)} g</small></div>;
    })}
    <div className="plab-water-ledger"><span>Water body <b>{state.waterBodyMl.toFixed(0)} mL</b></span><span>Recovered <b>{state.recoveredWaterMl.toFixed(0)} mL</b></span><span>Waste water <b>{state.wasteWaterMl.toFixed(0)} mL</b></span></div>
    <small className="plab-conservation-note">For each pollutant: input = body + recovered water + recovered material + waste.</small>
  </div>;
}

function PollutionTrialTable({ state }: { state: PollutionState }) {
  return <div className="plab-table-scroll"><table className="plab-trial-table"><caption>Controlled treatment trials</caption><thead><tr><th scope="col">Trial</th><th scope="col">Initial load</th><th scope="col">Treatment and plan</th><th scope="col">In body</th><th scope="col">In recovered water</th><th scope="col">Waste</th><th scope="col">Clarity</th><th scope="col">Water recovered</th></tr></thead><tbody>
    {state.trials.length === 0 ? <tr><td colSpan={8}>No trial results recorded yet.</td></tr> : state.trials.map((trial) => <tr key={trial.id}><th scope="row">{trial.id}</th><td>{Object.values(trial.input).reduce((sum, grams) => sum + grams, 0).toFixed(1)} g{trial.matchedInitialSample ? ' · matched' : ''}</td><td><span>{trial.treatments.map((method) => POLLUTION_METHODS[method].label).join(' → ')}</span><small>{trial.hypothesis ? `Prediction: ${trial.hypothesis} · ` : 'No prediction · '}{trial.elapsedModelSeconds.toFixed(1)} s model</small></td><td>{trial.remainingG.toFixed(1)} g</td><td>{trial.pollutantInRecoveredWaterG.toFixed(1)} g pollutant</td><td>{trial.wastePollutantG.toFixed(1)} g pollutant</td><td>{trial.clarityPercent}%</td><td>{trial.recoveredWaterMl.toFixed(1)} mL</td></tr>)}
  </tbody></table></div>;
}

function PollutionChart({ state }: { state: PollutionState }) {
  const largestInput = Math.max(0, ...state.trials.map((trial) => Object.values(trial.input).reduce((sum, grams) => sum + grams, 0)));
  const maxMass = Math.max(60, Math.ceil(largestInput / 20) * 20);
  const ticks = Array.from({ length: Math.floor(maxMass / 20) + 1 }, (_, index) => index * 20);
  const visibleTrials = state.trials.slice(-6);
  return <figure className="plab-chart-figure"><figcaption><span>Where the pollutant mass went</span><small>g after each treatment</small></figcaption><svg viewBox="0 0 360 150" role="img" aria-label="Stacked bars compare pollutant mass left in the body, transferred into recovered water, captured as recovered material, and moved to waste.">
    {ticks.map((tick) => <g key={tick}><line x1="39" x2="348" y1={122 - tick / maxMass * 100} y2={122 - tick / maxMass * 100} className="plab-grid" /><text x="32" y={126 - tick / maxMass * 100} textAnchor="end" className="plab-axis">{tick}</text></g>)}
    {visibleTrials.map((trial, index) => {
      const segments = [
        { value: trial.remainingG, color: '#2489b5' },
        { value: trial.pollutantInRecoveredWaterG, color: '#36adb1' },
        { value: trial.recoveredPollutantG, color: '#e8ad37' },
        { value: trial.wastePollutantG, color: '#e36d62' },
      ];
      let stacked = 0;
      const x = 54 + index * 46;
      return <g key={trial.id}>{segments.map((segment, segmentIndex) => {
        const height = segment.value / maxMass * 100;
        const y = 122 - (stacked + segment.value) / maxMass * 100;
        stacked += segment.value;
        return <rect key={segmentIndex} x={x} y={y} width="25" height={height} fill={segment.color} className="plab-chart-segment" />;
      })}<text x={x + 12} y="139" textAnchor="middle" className="plab-axis">{trial.id}</text></g>;
    })}
    <line x1="39" x2="348" y1="122" y2="122" className="plab-axis-line" />
    <text x="12" y="14" className="plab-axis-title">g</text>
  </svg><div className="plab-chart-legend"><span><i className="body-mass" />In body</span><span><i className="recovered-water-mass" />In recovered water</span><span><i className="recovered-material-mass" />Recovered material</span><span><i className="waste-mass" />Waste</span></div></figure>;
}

function methodSummary(method: PollutionMethodId) {
  const descriptions: Record<PollutionMethodId, string> = {
    skim: 'Floating heavy oil moves to a recovery tank; dissolved salt and sediment are not skimmed.',
    screen: 'Solid litter is caught; dissolved salt passes through the openings.',
    decant: 'After settling, the upper water is recovered while bed sludge stays behind. Dissolved salt follows the water pour, so the output may still be polluted.',
    filter: 'Suspended sediment is trapped; dissolved salt and the oil film stay in the sample.',
    distill: 'The model evaporates and condenses 90% of the water; modeled heavy oil and other nonvolatile pollutants go to waste.',
  };
  return descriptions[method];
}

export function PollutionLab(): ReactElement {
  const [state, setState] = useState<PollutionState>(() => createPollutionState());
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(() => !canUseWebGL());
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [particleView, setParticleView] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

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
        for (let index = 0; index < steps; index += 1) next = advancePollution(next, fixedStep);
        return next;
      });
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [playing, reducedMotion]);

  const markers = useMemo(() => waterMarkers(state, particleView), [state, particleView]);
  const clarity = clarityIndexPercent(state);
  const salt = saltRemainingG(state);
  const challengeDone = pollutionChallengeComplete(state);
  const method = state.selectedMethod;
  const recordEnabled = state.treatments.length > 0 && (Object.keys(state.pollutants) as PollutantId[]).some((id) => state.pollutants[id].inputG > 0);

  const reset = () => { setPlaying(false); setState((current) => resetPollutionState(current)); };
  const applySelected = () => setState((current) => applyPollutionMethod(current));
  const step = () => { setPlaying(false); setState((current) => advancePollution(current, 1)); };
  const startChallenge = () => { setPlaying(false); setState((current) => current.challengeActive ? { ...current, challengeActive: false, challengeFiltered: false, challengeDistilled: false } : beginPollutionChallenge(current)); };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input, select, textarea, button')) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); }
    if (event.key.toLowerCase() === 'r') reset();
  };
  const retryGraphics = () => { if (!canUseWebGL()) return; setGraphicsFailed(false); setCanvasReady(false); setCanvasKey((key) => key + 1); };
  const resetCamera = () => { setCanvasReady(false); setCanvasKey((key) => key + 1); };

  return (
    <section ref={rootRef} className="pollution-lab" tabIndex={0} onKeyDown={handleKeyDown} aria-label="MatterLab water pollution investigation">
      <header className="plab-header"><div className="plab-brand"><span className="plab-brand-icon"><Droplets size={21} /></span><span><strong>Water pollution</strong><small>Model the changes · test the treatments</small></span></div><span className="plab-water-stamp"><i /> 1,000 mL WATER BODY</span></header>
      <div className="plab-workspace">
        <section className="plab-scene-panel" aria-label="Water body and treatment bench">
          <div className="plab-scene-head"><div><span className="plab-kicker">POLLUTANTS ENTER THE WATER</span><h1>What stays in the water?</h1></div><span className="plab-clarity"><Gauge size={15} /> clarity <b>{clarity}%</b></span></div>
          <div className="plab-canvas-wrap" data-graphics={canvasReady && !graphicsFailed ? 'ready' : graphicsFailed ? 'fallback' : 'starting'}>
            {!graphicsFailed && <ErrorBoundary key={canvasKey} onFailure={() => { setGraphicsFailed(true); setCanvasReady(false); }}><Canvas key={canvasKey} className="plab-canvas" camera={{ position: [3.4, 6, 12], fov: 24, near: 0.1, far: 160 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { setCanvasReady(true); setGraphicsFailed(false); watchContextLoss(gl.domElement, () => { setGraphicsFailed(true); setCanvasReady(false); }); }} fallback={null}><PollutionWorld state={state} particleView={particleView} viewRevision={canvasKey} overlay={overlayRef} /><AdaptiveQuality /></Canvas></ErrorBoundary>}
            {!graphicsFailed && <PollutionTags state={state} overlayRef={overlayRef} />}
            {graphicsFailed && <><PollutionFallback state={state} markers={markers} particleView={particleView} /><button className="plab-retry" type="button" onClick={retryGraphics}>Try 3D again</button></>}
            <div className="plab-scene-hud"><b>{remainingTotalPollutantG(state).toFixed(1)} g</b><i /> <span>pollutant mass remains</span><small>{salt.toFixed(1)} g dissolved salt</small></div>
            <div className="plab-scene-key"><span><i className="oil" />Oil</span><span><i className="litter" />Litter</span><span><i className="sediment" />Sediment</span>{particleView && <><span><i className="na" />Na⁺</span><span><i className="cl" />Cl⁻</span></>}</div>
          </div>
          <PollutionOutputStrip state={state} /><div className="plab-transport"><div className="plab-play-tools"><button type="button" className="plab-play" aria-label={playing ? 'Pause model' : 'Play model'} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{playing ? 'Pause' : 'Play'}</button><button type="button" className="plab-tool" aria-label="Advance model one second" onClick={step}><StepForward size={17} />Step</button><button type="button" className="plab-tool" aria-label="Reset water body" onClick={reset}><RotateCcw size={16} />Reset</button></div><button type="button" className={`plab-toggle ${particleView ? 'selected' : ''}`} aria-pressed={particleView} onClick={() => setParticleView((value) => !value)}><Waves size={15} />{particleView ? 'Particle view on' : 'Particle view'}</button><button type="button" className="plab-view-reset" aria-label="Reset camera view" onClick={resetCamera}><RotateCw size={15} />View</button></div>
          <div className="plab-clarity-note"><b>Appearance is not a safety test.</b><span>Salt is dissolved and invisible; clear-looking water can still contain contaminants.</span></div>
        </section>

        <aside className="plab-control-panel" aria-label="Pollution inputs, treatment plan and result controls">
          <div className="plab-panel-title"><div><span className="plab-kicker">MODEL AN INPUT</span><h2>Add pollution to the water</h2></div><button type="button" className="plab-info" aria-label={showDetails ? 'Hide model notes' : 'Show model notes'} aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}><Info size={17} /></button></div>
          <p className="plab-lead">Different materials enter different parts of a water body. Add each one, then see which treatment can reach it.</p>
          <div className="plab-input-grid">{POLLUTANTS.map((pollutant) => <button type="button" key={pollutant.id} className={`plab-input ${pollutant.id}`} aria-label={`Add ${pollutant.addG} grams ${pollutant.label}`} onClick={() => setState((current) => addPollutant(current, pollutant.id, pollutant.addG))}><i /><span><b>+{pollutant.addG} g {pollutant.label}</b><small>{pollutant.location}</small></span></button>)}</div>
          <div className="plab-process-block"><div className="plab-subhead"><div><span className="plab-kicker">PLAN A FAIR TRIAL</span><b>Choose one treatment variable</b></div><button type="button" className="plab-matched" onClick={() => { setPlaying(false); setState((current) => beginMatchedPollutionTrial(current)); }}>Load matched sample</button></div><p className="plab-plan-note">Each matched feed uses 1,000 mL water, 6 g oil, 8 g litter, 32 g sediment and 12 g salt. When comparing decanting, hold the model settling time constant; the accelerated model clock is recorded.</p><label className="plab-hypothesis"><span>Prediction (optional)</span><input aria-label="Trial hypothesis" maxLength={180} placeholder="What do you predict this treatment will remove?" value={state.hypothesis} onChange={(event) => { const hypothesis = event.currentTarget.value; setState((current) => setPollutionHypothesis(current, hypothesis)); }} /></label>
            <label className="plab-method-select"><span>Planned treatment</span><select aria-label="Planned treatment" value={method} onChange={(event) => { const selected = event.currentTarget.value as PollutionMethodId; setState((current) => selectPollutionMethod(current, selected)); }}>{Object.entries(POLLUTION_METHODS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><p className="plab-method-description">{methodSummary(method)}</p>
            <button type="button" className="plab-apply" onClick={applySelected}><Filter size={16} />Apply {POLLUTION_METHODS[method].label}</button>
            <div className="plab-treatment-chips">{state.treatments.length > 0 ? state.treatments.map((applied, index) => <span key={`${applied}-${index}`}><Check size={12} />{POLLUTION_METHODS[applied].label}</span>) : <small>Apply a treatment to begin a trial.</small>}</div>
            <div className="plab-record-row"><button type="button" className="plab-record" disabled={!recordEnabled} onClick={() => setState((current) => recordPollutionTrial(current))}>Record results</button><button type="button" className="plab-record-clear" onClick={() => setState((current) => clearPollutionTrials(current))}>Clear results</button></div>
          </div>

          <div className="plab-readouts"><div><span><Gauge size={14} />Visual clarity index</span><b>{clarity}%</b><small>Only suspended sediment changes this qualitative reading.</small></div><div><span><Droplets size={14} />Dissolved salt remains</span><b>{salt.toFixed(1)} g</b><small>Ordinary filtering does not remove it.</small></div></div>
          <PollutantLedger state={state} />
          <div className="plab-challenge-launch"><div><span className="plab-kicker">QUICK CHALLENGE</span><b>Can a clear sample still contain salt?</b><small>Filter the matched mix, inspect the salt, then distil and recover water.</small></div><button type="button" onClick={startChallenge}><Sparkles size={15} />{state.challengeActive ? 'Restart' : 'Try it'}</button></div>
          {state.challengeActive && <div className="plab-challenge" aria-live="polite"><div className="plab-challenge-step"><span className={state.challengeFiltered ? 'complete' : ''}><i>{state.challengeFiltered ? '✓' : '1'}</i>Filter · {salt.toFixed(1)} g salt still present</span><span className={state.challengeDistilled ? 'complete' : ''}><i>{state.challengeDistilled ? '✓' : '2'}</i>Distil · recover water</span></div><b className={challengeDone ? 'success' : ''}>{challengeDone ? <><Check size={14} />Salt moved to waste; water recovery is recorded.</> : 'The challenge checks the treatment results as they happen.'}</b></div>}
          {showDetails && <div className="plab-detail"><CircleHelp size={15} /><p>Simple screening and filtration retain solids by size. Oil floats as a surface film in this model, sediment settles, and salt remains dissolved. Distillation is simplified as separating water from nonvolatile pollutants; real water may contain hazards the model does not include.</p></div>}
        </aside>
      </div>

      <section className="plab-results" aria-label="Recorded pollution treatment results"><div className="plab-results-head"><div><span className="plab-kicker">YOUR INVESTIGATION</span><h2>Compare the treatment trials</h2></div><span>Same starting mix supports a fair comparison</span></div><PollutionTrialTable state={state} />{state.trials.length > 0 && <PollutionChart state={state} />}</section>
      <footer className="plab-footer"><p><b>Model limit:</b> this sample and its clarity index do not establish that water is safe to drink.</p><span><kbd>Space</kbd> play / pause <kbd>R</kbd> reset</span></footer>
    </section>
  );
}

export default PollutionLab;
