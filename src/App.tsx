import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Atom,
  Beaker,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Droplets,
  Expand,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Waves,
  Volume2,
  X,
} from 'lucide-react';
import {
  addThermalEnergy,
  advanceModelTime,
  createInitialSamples,
  ENERGY_LIMITS_KJ,
  formatTemperature,
  PARTICLE_COUNT,
  thermalStateAtEnergy,
  type MatterSample,
  type Phase,
} from './science/matterEngine';
import { OUTCOMES, OUTCOME_IDS, OUTCOME_SHORT_TITLES, readOutcomeFromHash, routeForOutcome, TOPIC_GROUPS, type OutcomeId, type OutcomeTopic } from './content/outcomes';
import type { TransitionId } from './science/transitionEngine';
import type { CameraPreset } from './components/MatterScene';

import type { AdvancedExperiment } from './components/AdvancedLab';

import type { WaterTopicMode } from './science/waterTopicEngine';

import type { SolutionsMode } from './science/solutionsEngine';
import type { MixturesFocus, MixturesMode } from './components/MixturesLab';
import { LabLoading } from './components/LabLoading';

// Each lab (and Three.js) loads on demand so the syllabus menu opens quickly on classroom devices.
const MatterScene = lazy(() => import('./components/MatterScene').then((m) => ({ default: m.MatterScene })));
const Matter2DFallback = lazy(() => import('./components/MatterScene').then((m) => ({ default: m.Matter2DFallback })));
const ChangeLab = lazy(() => import('./components/ChangeLab').then((m) => ({ default: m.ChangeLab })));
const AdvancedLab = lazy(() => import('./components/AdvancedLab').then((m) => ({ default: m.AdvancedLab })));
const WaterTopicLab = lazy(() => import('./components/WaterTopicLab').then((m) => ({ default: m.WaterTopicLab })));
const SolutionsLab = lazy(() => import('./components/SolutionsLab').then((m) => ({ default: m.SolutionsLab })));
const MixturesLab = lazy(() => import('./components/MixturesLab').then((m) => ({ default: m.MixturesLab })));
const PollutionLab = lazy(() => import('./components/PollutionLab').then((m) => ({ default: m.PollutionLab })));
import { SyllabusMenu } from './components/SyllabusMenu';

const SAMPLE_ORDER: readonly Phase[] = ['solid', 'liquid', 'gas'];
type PlaygroundSection = 'home' | 'states' | 'change' | 'beyond' | 'water' | 'solutions' | 'mixtures' | 'pollution';
type CoreMode = 'compare' | 'challenges';
type MatterLabRoute = {
  section: PlaygroundSection;
  outcome: OutcomeId;
  transition: TransitionId;
  experiment: AdvancedExperiment;
  waterMode: WaterTopicMode;
  solutionsMode: SolutionsMode;
  mixturesMode: MixturesMode;
  mixturesFocus: MixturesFocus;
};
const TRANSITION_IDS: readonly TransitionId[] = ['melting', 'freezing', 'vaporisation', 'condensation', 'sublimation', 'deposition'];

const WATER_MODE_OUTCOME: Readonly<Record<WaterTopicMode, OutcomeId>> = {
  cycle: '4.1.1', heating: '4.1.2', properties: '4.2.1', 'density-liquids': '4.2.2', 'density-objects': '4.2.3',
};
const SOLUTIONS_MODE_OUTCOME: Readonly<Record<SolutionsMode, OutcomeId>> = {
  dissolving: '4.3.1', investigation: '4.3.2', temperature: '4.3.3', particles: '4.3.4', comparison: '4.3.5',
};
const MIXTURES_MODE_OUTCOME: Readonly<Record<MixturesMode, OutcomeId>> = {
  classify: '4.4.1', separate: '4.4.3', culture: '4.4.5', industrial: '4.4.6',
};
const MIXTURE_FOCUS: Readonly<Partial<Record<OutcomeId, MixturesFocus>>> = {
  '4.4.1': 'entities', '4.4.2': 'purity', '4.4.3': 'properties', '4.4.4': 'investigation', '4.4.5': 'investigation', '4.4.6': 'investigation',
};

function routeForDirectOutcome(outcome: OutcomeId): MatterLabRoute {
  const neutral = { outcome, transition: 'melting' as TransitionId, experiment: 'plasma' as AdvancedExperiment };
  if (outcome === '4.1.3') return { ...neutral, section: 'change', waterMode: 'cycle', solutionsMode: 'dissolving', mixturesMode: 'classify', mixturesFocus: 'entities' };
  if (outcome === '4.1.4') return { ...neutral, section: 'states', waterMode: 'cycle', solutionsMode: 'dissolving', mixturesMode: 'classify', mixturesFocus: 'entities' };
  const group = OUTCOMES[outcome].topic;
  if (group === 'water') {
    const mode = (Object.entries(WATER_MODE_OUTCOME).find(([, id]) => id === outcome)?.[0] ?? 'cycle') as WaterTopicMode;
    return { ...neutral, section: 'water', waterMode: mode, solutionsMode: 'dissolving', mixturesMode: 'classify', mixturesFocus: 'entities' };
  }
  if (group === 'solutions') {
    const mode = (Object.entries(SOLUTIONS_MODE_OUTCOME).find(([, id]) => id === outcome)?.[0] ?? 'dissolving') as SolutionsMode;
    return { ...neutral, section: 'solutions', waterMode: 'cycle', solutionsMode: mode, mixturesMode: 'classify', mixturesFocus: 'entities' };
  }
  if (group === 'mixtures') {
    const mode: MixturesMode = outcome === '4.4.5' ? 'culture' : outcome === '4.4.6' ? 'industrial' : outcome === '4.4.3' || outcome === '4.4.4' ? 'separate' : 'classify';
    return { ...neutral, section: 'mixtures', waterMode: 'cycle', solutionsMode: 'dissolving', mixturesMode: mode, mixturesFocus: MIXTURE_FOCUS[outcome] ?? 'entities' };
  }
  return { ...neutral, section: 'pollution', waterMode: 'cycle', solutionsMode: 'dissolving', mixturesMode: 'classify', mixturesFocus: 'entities' };
}

function readMatterLabRoute(hash: string): MatterLabRoute {
  if (!hash || hash === '#' || hash === '#/') {
    return { ...routeForDirectOutcome('4.1.1'), section: 'home' };
  }
  const outcome = readOutcomeFromHash(hash);
  if (outcome) return routeForDirectOutcome(outcome);

  const transition = hash.match(/^#?\/changes\/([a-z-]+)(?:\/|$)/)?.[1];
  if (TRANSITION_IDS.includes(transition as TransitionId)) {
    return { ...routeForDirectOutcome('4.1.3'), transition: transition as TransitionId };
  }
  const experiment = hash.match(/^#?\/advanced\/(plasma|bec)(?:\/|$)/)?.[1];
  if (experiment === 'plasma' || experiment === 'bec') {
    return { ...routeForDirectOutcome('4.1.4'), section: 'beyond', experiment };
  }
  return { ...routeForDirectOutcome('4.1.1'), section: 'home' };
}

const SHORT_NAME: Record<Phase, string> = { solid: 'Ice', liquid: 'Liquid water', gas: 'Water vapour' };
const STATE_HINT: Record<Phase, string> = {
  solid: 'Keeps its own shape. Molecules vibrate around fixed neighbours.',
  liquid: 'Flows to fit the chamber. Molecules stay close and continually rearrange.',
  gas: 'Water vapour is invisible. Its widely spaced molecules move through the whole chamber.',
};
const ATTRACT: Record<Phase, { level: string; note: string; segments: number }> = {
  solid: { level: 'Stronger relative attraction', note: 'Molecules stay close in an ordered arrangement.', segments: 3 },
  liquid: { level: 'Intermediate relative attraction', note: 'Molecules stay close but move past neighbours.', segments: 2 },
  gas: { level: 'Weaker relative attraction', note: 'Molecules are widely separated in this model.', segments: 1 },
};

function arrangementHint(fractions: Readonly<Record<Phase, number>>): string {
  const solid = fractions.solid > 0.02;
  const liquid = fractions.liquid > 0.02;
  const gas = fractions.gas > 0.02;
  if (solid && liquid && gas) return 'Ice lattice, close liquid and widely spaced vapour';
  if (solid && liquid) return 'Ordered ice and close, mobile liquid molecules';
  if (liquid && gas) return 'Close liquid molecules and widely spaced vapour';
  if (solid) return 'Close together in a repeating arrangement';
  if (liquid) return 'Close together, without a fixed pattern';
  return 'Widely spaced throughout the enlarged chamber';
}

function movementHint(fractions: Readonly<Record<Phase, number>>): string {
  const solid = fractions.solid > 0.02;
  const liquid = fractions.liquid > 0.02;
  const gas = fractions.gas > 0.02;
  if (solid && liquid && !gas) return 'Solid molecules vibrate; liquid molecules exchange neighbours';
  if (liquid && gas) return 'Liquid rearranges; vapour travels through available space';
  if (solid) return 'Small vibrations around neighbouring positions';
  if (liquid) return 'Continuous neighbour exchange and rearrangement';
  return 'Fast travel through the available chamber';
}

function labelForPhase(phase: Phase): string {
  return phase === 'gas' ? 'Gas' : phase[0].toUpperCase() + phase.slice(1);
}

function sampleStartForOutcome(outcome: OutcomeId): Phase {
  return outcome === '4.1.3' ? 'solid' : 'liquid';
}

function readMotionPreference(): boolean {
  return typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let webglAvailabilityCache: boolean | undefined;

function supportsWebGL(): boolean {
  if (webglAvailabilityCache !== undefined) return webglAvailabilityCache;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') as WebGL2RenderingContext | null
      ?? canvas.getContext('webgl') as WebGLRenderingContext | null;
    webglAvailabilityCache = context !== null;
    if (context) context.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglAvailabilityCache = false;
  }
  return webglAvailabilityCache;
}

type ErrorBoundaryProps = { children: ReactNode; onError: () => void };
type ErrorBoundaryState = { failed: boolean };

class SceneErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default function App() {
  const initialRoute = readMatterLabRoute(window.location.hash);
  const initialOutcome = initialRoute.outcome;
  const [webglAvailable] = useState(supportsWebGL);
  const [section, setSection] = useState<PlaygroundSection>(initialRoute.section);
  const [outcome, setOutcome] = useState<OutcomeId>(initialOutcome);
  const [transitionId, setTransitionId] = useState<TransitionId>(initialRoute.transition);
  const [experimentId, setExperimentId] = useState<AdvancedExperiment>(initialRoute.experiment);
  const [waterMode, setWaterMode] = useState<WaterTopicMode>(initialRoute.waterMode);
  const [solutionsMode, setSolutionsMode] = useState<SolutionsMode>(initialRoute.solutionsMode);
  const [mixturesMode, setMixturesMode] = useState<MixturesMode>(initialRoute.mixturesMode);
  const [mixturesFocus, setMixturesFocus] = useState<MixturesFocus>(initialRoute.mixturesFocus);
  const [mode, setMode] = useState<CoreMode>('compare');
  const [samples, setSamples] = useState<MatterSample[]>(() => createInitialSamples());
  const [selected, setSelected] = useState<Phase>(() => sampleStartForOutcome(initialOutcome));
  const [playing, setPlaying] = useState(readMotionPreference);
  const [speed, setSpeed] = useState(1);
  const [particleView, setParticleView] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showAttraction, setShowAttraction] = useState(initialOutcome === '4.1.4');
  const [tiltDegrees, setTiltDegrees] = useState(0);
  const energyStep = 20;
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('angled');
  const [cameraRevision, setCameraRevision] = useState(0);
  const [reducedGraphics, setReducedGraphics] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [focusSample, setFocusSample] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [display2D, setDisplay2D] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(() => !webglAvailable);
  const [fullScreen, setFullScreen] = useState(false);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeAnswer, setChallengeAnswer] = useState<Phase | null>(null);
  const [challengeFeedback, setChallengeFeedback] = useState('');
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [tiltObserved, setTiltObserved] = useState(false);
  const [animationRemainder, setAnimationRemainder] = useState(0);
  const animationRef = useRef<number | null>(null);
  const animationRemainderRef = useRef(0);
  const stageRef = useRef<HTMLElement>(null);
  const guideCloseRef = useRef<HTMLButtonElement>(null);
  const guideRef = useRef<HTMLElement>(null);
  const hotkeyHandlerRef = useRef<(event: globalThis.KeyboardEvent) => void>(() => {});
  const handleSceneFailure = useCallback(() => setSceneFailed(true), []);
  const handleTransitionChange = useCallback((id: TransitionId) => {
    setTransitionId(id);
    const target = `#/changes/${id}`;
    if (window.location.hash !== target) window.location.hash = target;
  }, []);
  const handleAdvancedExperimentChange = useCallback((id: AdvancedExperiment) => {
    setExperimentId(id);
    const target = `#/advanced/${id}`;
    if (window.location.hash !== target) window.location.hash = target;
  }, []);
  const handleWaterModeChange = useCallback((nextMode: WaterTopicMode) => {
    setWaterMode(nextMode);
    const target = routeForOutcome(WATER_MODE_OUTCOME[nextMode]);
    if (window.location.hash !== target) window.location.hash = target;
  }, []);
  const handleSolutionsModeChange = useCallback((nextMode: SolutionsMode) => {
    setSolutionsMode(nextMode);
    const target = routeForOutcome(SOLUTIONS_MODE_OUTCOME[nextMode]);
    if (window.location.hash !== target) window.location.hash = target;
  }, []);
  const handleMixturesModeChange = useCallback((nextMode: MixturesMode) => {
    setMixturesMode(nextMode);
    const nextOutcome = MIXTURES_MODE_OUTCOME[nextMode];
    const nextFocus = MIXTURE_FOCUS[nextOutcome] ?? 'entities';
    setMixturesFocus(nextFocus);
    const target = routeForOutcome(nextOutcome);
    if (window.location.hash !== target) window.location.hash = target;
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const nextRoute = readMatterLabRoute(window.location.hash);
      setSection(nextRoute.section);
      setOutcome(nextRoute.outcome);
      setTransitionId(nextRoute.transition);
      setExperimentId(nextRoute.experiment);
      setWaterMode(nextRoute.waterMode);
      setSolutionsMode(nextRoute.solutionsMode);
      setMixturesMode(nextRoute.mixturesMode);
      setMixturesFocus(nextRoute.mixturesFocus);
      setMode('compare');
      setSelected(sampleStartForOutcome(nextRoute.outcome));
      setParticleView(nextRoute.section === 'states');
      setShowAttraction(nextRoute.section === 'states' && nextRoute.outcome === '4.1.4');
      setPlaying(false);
      setChallengeComplete(false);
      setChallengeAnswer(null);
      setChallengeFeedback('');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    if (!playing || section !== 'states') return;
    let last = performance.now();
    const fixedStep = 1 / 60;
    let accumulator = animationRemainderRef.current;
    const frame = (now: number) => {
      accumulator += Math.min(0.2, (now - last) / 1000) * speed;
      last = now;
      const steps = Math.floor(accumulator / fixedStep);
      accumulator -= steps * fixedStep;
      animationRemainderRef.current = accumulator;
      setAnimationRemainder(accumulator);
      if (steps > 0) {
        setSamples((current) => current.map((sample) => {
          let advanced = sample;
          for (let index = 0; index < steps; index += 1) advanced = advanceModelTime(advanced, fixedStep);
          return advanced;
        }));
      }
      animationRef.current = requestAnimationFrame(frame);
    };
    animationRef.current = requestAnimationFrame(frame);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [playing, speed, section]);

  useEffect(() => {
    const handleFullScreen = () => {
      setFullScreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) setPresentationMode(false);
    };
    document.addEventListener('fullscreenchange', handleFullScreen);
    return () => document.removeEventListener('fullscreenchange', handleFullScreen);
  }, []);

  useEffect(() => {
    if (section === 'home') {
      document.title = 'MatterLab · Year 7 Term 4 Syllabus';
      return;
    }
    const topic = section === 'states' || section === 'change' || section === 'beyond' ? 'matter' : section;
    const label = TOPIC_GROUPS.find((group) => group.id === topic)?.label ?? 'MatterLab';
    const detail = section === 'states' ? 'States of matter'
      : section === 'change' ? `Change Station · ${transitionId}`
        : section === 'beyond' ? `Beyond Three · ${experimentId === 'bec' ? 'Bose–Einstein condensate' : 'Plasma'}`
          : OUTCOMES[outcome].wording;
    document.title = `MatterLab · ${label} — ${detail}`;
  }, [section, transitionId, experimentId, outcome]);

  useEffect(() => {
    if (!showHelp) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    guideCloseRef.current?.focus();
    const trapFocusAndClose = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowHelp(false);
      }
      if (event.key !== 'Tab' || !guideRef.current) return;
      const controls = Array.from(guideRef.current.querySelectorAll<HTMLElement>('button,a[href],[tabindex]:not([tabindex="-1"])'));
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trapFocusAndClose);
    return () => {
      document.removeEventListener('keydown', trapFocusAndClose);
      previouslyFocused?.focus();
    };
  }, [showHelp]);

  const selectedSample = samples.find((sample) => sample.id === selected) ?? samples[0];
  const selectedThermal = thermalStateAtEnergy(selectedSample.energyKJ);
  const solidSample = samples.find((sample) => sample.id === 'solid') ?? samples[0];
  const solidThermal = thermalStateAtEnergy(solidSample.energyKJ);
  const mysterySample = samples.find((sample) => sample.id === 'liquid') ?? samples[1];
  const mysteryPhase = thermalStateAtEnergy(mysterySample.energyKJ).dominantPhase;

  const chooseMode = (nextMode: CoreMode) => {
    setMode(nextMode);
    if (nextMode === 'compare' && outcome !== '4.1.1') {
      window.location.hash = routeForOutcome('4.1.4');
    } else if (nextMode === 'challenges') {
      setSamples(createInitialSamples());
      animationRemainderRef.current = 0;
      setAnimationRemainder(0);
      setSelected(challengeIndex === 2 || challengeIndex === 1 ? 'solid' : 'liquid');
      if (focusSample) setCameraRevision((value) => value + 1);
      setTiltDegrees(0);
      setPlaying(false);
      setParticleView(true);
      setShowAttraction(challengeIndex === 1);
      setChallengeAnswer(null);
      setChallengeFeedback('');
      setChallengeComplete(false);
      setTiltObserved(false);
    }
  };

  const updateSampleEnergy = (id: Phase, delta: number) => {
    setSamples((current) => current.map((sample) => sample.id === id ? addThermalEnergy(sample, delta) : sample));
    if (challengeIndex === 2 && mode === 'challenges' && id === 'solid') {
      const target = samples.find((sample) => sample.id === id);
      if (target) {
        const next = thermalStateAtEnergy(target.energyKJ + delta);
        if (next.fractions.solid < 0.001 && next.fractions.liquid >= 0.99) {
          setChallengeComplete(true);
          setChallengeFeedback('Challenge complete. The sample is liquid water after all ice has melted; its molecules are still H₂O.');
        } else if (delta < 0) {
          setChallengeComplete(false);
          setChallengeFeedback('Cooling moves the sample away from the liquid-water target. Add energy and watch the 0 °C plateau.');
        } else if (next.temperatureC === 0 && next.fractions.solid > 0) {
          setChallengeComplete(false);
          setChallengeFeedback('The model is on its melting plateau: added energy changes the solid/liquid fractions while temperature stays at 0 °C.');
        } else {
          setChallengeComplete(false);
          setChallengeFeedback('Keep heating the ice sample, then check that the solid fraction reaches zero.');
        }
      }
    }
  };

  const changeTilt = (value: number) => setTiltDegrees(Math.max(-35, Math.min(35, Math.round(value / 5) * 5)));
  const chooseSample = (id: Phase) => {
    setSelected(id);
    if (focusSample) setCameraRevision((value) => value + 1);
  };

  const stepOnce = () => {
    setPlaying(false);
    setSamples((current) => current.map((sample) => advanceModelTime(sample, 0.08)));
  };

  const resetExperiment = () => {
    setSamples(createInitialSamples());
    animationRemainderRef.current = 0;
    setAnimationRemainder(0);
    setSelected(mode === 'challenges' && challengeIndex > 0 ? 'solid' : 'liquid');
    setTiltDegrees(0);
    setPlaying(false);
    setChallengeAnswer(null);
    setChallengeFeedback('Experiment reset to the comparison conditions.');
    setChallengeComplete(false);
    setTiltObserved(false);
    if (focusSample) setCameraRevision((value) => value + 1);
  };

  const resetView = () => {
    setFocusSample(false);
    setCameraPreset('angled');
    setCameraRevision((value) => value + 1);
  };

  const startChallenge = (index: number) => {
    setChallengeIndex(index);
    setSamples(createInitialSamples());
    animationRemainderRef.current = 0;
    setAnimationRemainder(0);
    setSelected(index === 2 ? 'solid' : index === 1 ? 'solid' : 'liquid');
    if (focusSample) setCameraRevision((value) => value + 1);
    setTiltDegrees(0);
    setPlaying(false);
    setParticleView(true);
    setShowAttraction(index === 1);
    setChallengeAnswer(null);
    setChallengeFeedback('');
    setChallengeComplete(false);
    setTiltObserved(false);
  };

  const selectChallengeAnswer = (answer: Phase) => {
    setChallengeAnswer(answer);
    if (challengeIndex === 0) {
      if (answer === mysteryPhase) {
        setChallengeComplete(true);
        setChallengeFeedback(`Correct. The model shows ${PARTICLE_COUNT} molecules staying close while rearranging; the liquid sample takes the chamber’s shape.`);
      } else {
        setChallengeComplete(false);
        setChallengeFeedback('Look for molecules that stay close but change neighbours, and a sample that takes the shape of its chamber.');
      }
    } else if (challengeIndex === 1) {
      if (answer === 'solid') {
        setChallengeFeedback('Prediction recorded: the solid should keep its shape. Apply the tilt and compare the three samples.');
      } else {
        setChallengeFeedback('Prediction recorded. Apply the tilt and compare the chamber that changes shape. You can revise your prediction.');
      }
      setChallengeComplete(false);
    }
  };

  const applyChallengeTilt = () => {
    setTiltDegrees(20);
    setTiltObserved(true);
    if (challengeAnswer === 'solid') {
      setChallengeComplete(true);
      setChallengeFeedback('Prediction confirmed by the model: the solid retains its shape as the liquid surface stays level and vapour fills its larger chamber.');
    } else {
      setChallengeComplete(false);
      setChallengeFeedback('Compare the particle arrangement after tilting, then revise your prediction. The solid arrangement stays together.');
    }
  };

  const toggleFullScreen = async () => {
    try {
      if (presentationMode && !document.fullscreenElement) {
        setPresentationMode(false);
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setPresentationMode(false);
      } else {
        setPresentationMode(true);
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setPresentationMode(true);
      setChallengeFeedback('Full-screen display is unavailable. Presentation layout is active and the controls remain available.');
    }
  };

  const handleKeyboard = (event: globalThis.KeyboardEvent) => {
    if (section !== 'states') return;
    const target = event.target;
    if (target instanceof Element && (target.matches('input,textarea,select,[contenteditable="true"]') || target.closest('button,a,[role="button"],summary'))) return;
    if (event.code === 'Space' && event.repeat) return;
    if (event.code === 'Space') {
      event.preventDefault();
      setPlaying((value) => !value);
    } else if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      stepOnce();
    } else if (event.key === 'ArrowLeft') changeTilt(tiltDegrees - 5);
    else if (event.key === 'ArrowRight') changeTilt(tiltDegrees + 5);
    else if (event.key === 'ArrowUp') {
      const index = Math.max(0, SAMPLE_ORDER.indexOf(selected) - 1);
      chooseSample(SAMPLE_ORDER[index]);
    } else if (event.key === 'ArrowDown') {
      const index = Math.min(SAMPLE_ORDER.length - 1, SAMPLE_ORDER.indexOf(selected) + 1);
      chooseSample(SAMPLE_ORDER[index]);
    }
  };

  hotkeyHandlerRef.current = handleKeyboard;
  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => hotkeyHandlerRef.current(event);
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const focusLabel = mode === 'compare' ? 'Compare' : 'Challenges';
  const currentSelectedTemp = formatTemperature(selectedThermal.temperatureC);
  const selectedPhase = selectedThermal.dominantPhase;
  const selectedTitle = selectedThermal.isChangingState ? 'Two phases are present' : SHORT_NAME[selectedPhase];
  const selectedHint = selectedThermal.isChangingState
    ? `Both phases are present. Energy changes their proportions while temperature stays near ${currentSelectedTemp}.`
    : STATE_HINT[selectedPhase];
  const hideMysteryLabels = mode === 'challenges' && challengeIndex === 0;
  const attractionCues = useMemo(() => SAMPLE_ORDER.map((phase) => ({ phase, ...ATTRACT[phase] })), []);
  const sectionTitle = section === 'home' ? 'Term 4 syllabus' : section === 'states' ? 'States of matter' : section === 'change' ? 'Change Station' : section === 'beyond' ? 'Beyond the familiar three' : TOPIC_GROUPS.find((group) => group.id === section)?.label ?? 'MatterLab';
  const activeTopic: OutcomeTopic | null = section === 'home' ? null : section === 'states' || section === 'change' || section === 'beyond' ? 'matter' : section;
  const guideTitle = activeTopic === null ? 'Syllabus & Menu' : activeTopic === 'matter' ? section === 'change' ? 'Change Station' : section === 'beyond' ? 'Optional atomic examples' : 'Matter' : TOPIC_GROUPS.find((group) => group.id === activeTopic)?.label ?? 'MatterLab';
  const topicOutcomes = activeTopic === null ? [] : OUTCOME_IDS.filter((id) => OUTCOMES[id].topic === activeTopic);
  const outcomeIndex = OUTCOME_IDS.indexOf(outcome);
  const previousOutcome = outcomeIndex > 0 ? OUTCOME_IDS[outcomeIndex - 1] : null;
  const nextOutcome = outcomeIndex >= 0 && outcomeIndex < OUTCOME_IDS.length - 1 ? OUTCOME_IDS[outcomeIndex + 1] : null;
  const sectionIntro = section === 'states'
    ? 'Compare water’s particle motion in solid, liquid and gas states.'
    : section === 'change'
      ? 'Heat, cool and follow water through six real changes of state.'
    : section === 'beyond' ? 'Optional experiments with ionised gas and ultracold atoms. Water molecules stay in the first playground.'
      : section === 'home' ? 'All nineteen supplied Term 4 outcomes are arranged in their syllabus sections.'
        : OUTCOMES[outcome].focus;

  return (
    <div className={`app-shell ${presentationMode ? 'presentation-mode' : ''}`}>
      <a className="skip-link" href="#lab-main">Skip to simulation</a>
      <header className="topbar play-topbar">
        <a className="brand" href="#/" aria-label="MatterLab syllabus menu"><span className="brand-mark"><Atom size={24} strokeWidth={1.8} /></span><span>Matter<span>Lab</span><small>SCIENCE PLAYGROUNDS</small></span></a>
        {section !== 'home' && <nav className="playground-nav" aria-label="Year 7 Term 4 topics">
          {TOPIC_GROUPS.map((group) => {
            const GroupIcon = group.id === 'water' ? Droplets : group.id === 'matter' ? Atom : group.id === 'solutions' ? Beaker : group.id === 'mixtures' ? Layers3 : Waves;
            const count = topicOutcomes.length && group.id === activeTopic ? topicOutcomes.length : OUTCOME_IDS.filter((id) => OUTCOMES[id].topic === group.id).length;
            return <a key={group.id} className={activeTopic === group.id ? 'active' : ''} href={routeForOutcome(group.firstOutcome)} aria-current={activeTopic === group.id ? 'page' : undefined}><GroupIcon size={16} /><span>{group.label}</span><i>{count}</i></a>;
          })}
        </nav>}
        <div className="topbar-actions">
          <a className="icon-button syllabus-menu-link" href="#/" aria-current={section === 'home' ? 'page' : undefined} aria-label="Open syllabus and lesson menu"><BookOpen size={17} /><span>Menu</span></a>
          {section !== 'home' && <button className="icon-button help-button" onClick={() => setShowHelp(true)} aria-label="Open model notes and learning outcomes"><CircleHelp size={18} /><span>Guide</span></button>}
          {section !== 'home' && <button className="icon-button" onClick={toggleFullScreen} aria-label={fullScreen || presentationMode ? 'Exit presentation mode' : 'Enter presentation mode'}><Expand size={17} /><span>{fullScreen || presentationMode ? 'Exit' : 'Present'}</span></button>}
        </div>
      </header>

      {activeTopic === 'matter' && <nav className="matter-subnav" aria-label="Matter playgrounds">
        <a href={routeForOutcome('4.1.4')} aria-current={section === 'states' ? 'page' : undefined}><Atom size={15} />States</a>
        <a href={routeForOutcome('4.1.3')} aria-current={section === 'change' ? 'page' : undefined}><Waves size={15} />Change Station</a>
        <a href="#/advanced/plasma" aria-current={section === 'beyond' && experimentId === 'plasma' ? 'page' : undefined}><Sparkles size={15} />Plasma</a>
        <a href="#/advanced/bec" aria-current={section === 'beyond' && experimentId === 'bec' ? 'page' : undefined}><Atom size={15} />Bose–Einstein</a>
        <span>Optional atomic examples</span>
      </nav>}

      <main id="lab-main" ref={stageRef} className="main-shell playground-main">
        <Suspense fallback={<LabLoading />}>
        {section === 'home' && <SyllabusMenu />}
        {section === 'states' && <section className="page-heading playground-hero">
          <div>
            <p className="eyebrow"><span>MATTER PLAYGROUND</span><span className="hero-dot" /> YEAR 7 SCIENCE</p>
            <h1>{sectionTitle}</h1>
            <p className="page-intro">{sectionIntro}</p>
          </div>
        </section>}

        {section === 'states' && <>
        <section className="lab-layout" aria-label="Interactive states of matter model">
          <section className="scene-card" aria-label="Three-dimensional comparison scene">
            <div className="scene-card-head">
              <div className="scene-activity"><span className="stage-kicker">SAME WATER · DIFFERENT CONDITIONS</span><b>Water in three states</b><span className="scene-activity-detail">18 H₂O models in each · schematic scale</span></div>
              <div className="scene-quick-controls">
                <button className={`toolbar-toggle ${particleView ? 'is-on' : ''}`} onClick={() => setParticleView((value) => !value)} aria-pressed={particleView} title="Show the H₂O particle model"><Atom size={15} />{particleView ? 'Particles on' : 'Particle view'}</button>
                <button className={`toolbar-toggle compact-toggle ${showLabels ? 'is-on' : ''}`} onClick={() => setShowLabels((value) => !value)} aria-pressed={showLabels} title="Show or hide chamber labels">{showLabels ? <Eye size={15} /> : <EyeOff size={15} />}<span>Labels</span></button>
                <button className={`toolbar-toggle compact-toggle ${showAttraction ? 'is-on' : ''}`} onClick={() => setShowAttraction((value) => !value)} aria-pressed={showAttraction} title="Show qualitative attraction explanation"><Sparkles size={14} /><span>Attraction</span></button>
                <button className={`toolbar-toggle compact-toggle ${reducedGraphics ? 'is-on' : ''}`} onClick={() => setReducedGraphics((value) => !value)} aria-pressed={reducedGraphics} aria-label="Reduced graphics" title="Use simpler 3D graphics on slower devices"><Gauge size={14} /><span>Simple 3D</span></button>
              </div>
            </div>

            <div className="sample-selector" role="group" aria-label="Select a water sample">
              {samples.map((sample) => {
                const thermal = thermalStateAtEnergy(sample.energyKJ);
                const mystery = mode === 'challenges' && challengeIndex === 0 && sample.id === 'liquid';
                return (
                  <button key={sample.id} className={`sample-select ${selected === sample.id ? 'is-selected' : ''}`} onClick={() => chooseSample(sample.id)} aria-pressed={selected === sample.id}>
                    <span className={`sample-state-dot ${sample.id}`} />
                    <span className="sample-select-copy"><b>{mystery ? 'Mystery sample' : thermal.isChangingState || thermal.dominantPhase !== sample.id ? `Sample ${String.fromCharCode(65 + SAMPLE_ORDER.indexOf(sample.id))}` : labelForPhase(sample.id)}</b><small>{mystery ? 'State and temperature hidden' : thermal.phaseLabel}</small></span>
                    <strong>{mystery ? '—' : formatTemperature(thermal.temperatureC)}</strong>
                  </button>
                );
              })}
            </div>

            <div className={`canvas-wrap ${display2D || sceneFailed ? 'show-2d' : ''}`}>
              <div className="scene-glow" aria-hidden="true" />
              {showLabels && <div className="scene-labels-overlay" aria-label="Chamber labels">
                {samples.map((sample) => {
                  const thermal = thermalStateAtEnergy(sample.energyKJ);
                  const mystery = hideMysteryLabels && sample.id === 'liquid';
                  const phaseText = thermal.isChangingState
                    ? thermal.phaseLabel.replace(' · phase change', '')
                    : thermal.dominantPhase === 'solid' ? 'Ice'
                      : thermal.dominantPhase === 'liquid' ? 'Liquid water'
                        : 'Water vapour · invisible';
                  return <span key={sample.id} className="scene-label"><i className={sample.id} />{mystery ? 'Mystery sample' : phaseText}</span>;
                })}
              </div>}
              {display2D || sceneFailed ? (
                <Matter2DFallback samples={samples} particleView={particleView} selected={selected} tiltDegrees={tiltDegrees} interpolationSeconds={animationRemainder} onSelect={chooseSample} hideLabelId={hideMysteryLabels ? 'liquid' : undefined} />
              ) : (
                <SceneErrorBoundary key={cameraRevision} onError={handleSceneFailure}>
                  <MatterScene
                    samples={samples}
                    selected={selected}
                    particleView={particleView}
                    tiltDegrees={tiltDegrees}
                    interpolationSeconds={animationRemainder}
                    cameraPreset={cameraPreset}
                    cameraRevision={cameraRevision}
                    focusSample={focusSample}
                    reducedGraphics={reducedGraphics}
                    onSelect={chooseSample}
                    onContextLost={handleSceneFailure}
                  />
                </SceneErrorBoundary>
              )}
              <div className="view-switch" role="group" aria-label="Choose a science visualization">
                <button className={!display2D && !sceneFailed ? 'active' : ''} onClick={() => { setDisplay2D(false); setSceneFailed(!webglAvailable); if (webglAvailable) setCameraRevision((value) => value + 1); }} aria-pressed={!display2D && !sceneFailed}><span className="view-cube" />3D</button>
                <button className={display2D || sceneFailed ? 'active' : ''} onClick={() => { setDisplay2D(true); setSceneFailed(false); }} aria-pressed={display2D || sceneFailed}><span className="view-map" />2D</button>
              </div>
              <div className="scene-status" aria-live="polite">{sceneFailed ? '3D graphics unavailable · 2D science model active' : `${tiltDegrees > 0 ? 'Tilted' : tiltDegrees < 0 ? 'Tilted' : 'Level'} · ${particleView ? 'H₂O molecules' : 'everyday view'}`}</div>
            </div>

            <div className="stage-controls">
              <div className="motion-control-group">
                <div className="transport-controls">
                  <button className="transport-button primary-transport" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause molecule motion' : 'Play molecule motion'}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}<span>{playing ? 'Pause' : 'Play'}</span></button>
                  <button className="transport-button" onClick={stepOnce} aria-label="Advance one model time step"><SkipForward size={15} /><span>Step</span></button>
                  <label className="speed-control"><span>Speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Playback speed"><option value={0.5}>½×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
                </div>
                <span className="motion-hint">Pause, then step to see solid vibration.</span>
              </div>
              <div className="camera-tools">
                <div className="camera-presets" role="group" aria-label="Camera angle presets">
                  <button className={cameraPreset === 'front' ? 'active' : ''} onClick={() => setCameraPreset('front')} title="Front view">Front</button>
                  <button className={cameraPreset === 'angled' ? 'active' : ''} onClick={() => setCameraPreset('angled')} title="Angled view">Angle</button>
                  <button className={cameraPreset === 'top' ? 'active' : ''} onClick={() => setCameraPreset('top')} title="Top view">Top</button>
                  <button className={focusSample ? 'active focus-camera' : 'focus-camera'} onClick={() => { setFocusSample((value) => !value); setCameraRevision((value) => value + 1); }} title={focusSample ? 'Show all three chambers' : 'Focus the selected chamber'}>{focusSample ? 'All' : 'Focus'}</button>
                  <button className="camera-reset" onClick={resetView} aria-label="Reset camera view" title="Reset camera only"><RotateCcw size={13} /></button>
                </div>
                <span className="orbit-hint"><MousePointer2 size={12} />Drag to orbit · scroll to zoom</span>
              </div>
            </div>

            <div className="tilt-row">
              <div className="tilt-title"><span className="tilt-icon"><ArrowDown size={15} /></span><span><b>Tip the chambers</b><small>Compare how shape responds to gravity</small></span></div>
              <div className="tilt-slider-wrap">
                <button className="nudge-button" onClick={() => changeTilt(tiltDegrees - 5)} aria-label="Tilt five degrees left"><ArrowLeft size={15} /></button>
                <input type="range" min="-35" max="35" step="5" value={tiltDegrees} onChange={(event) => changeTilt(Number(event.target.value))} aria-label="Chamber tilt angle" />
                <button className="nudge-button" onClick={() => changeTilt(tiltDegrees + 5)} aria-label="Tilt five degrees right"><ArrowRight size={15} /></button>
                <output>{tiltDegrees > 0 ? '+' : ''}{tiltDegrees}°</output>
                <button className="level-button" onClick={() => setTiltDegrees(0)}>Level</button>
              </div>
              <span className="tilt-limit">±35°</span>
            </div>
          </section>

          <aside className="inspector-card" aria-label={`${focusLabel} controls and explanation`}>
            <div className="inspector-tabs" role="tablist" aria-label="Lesson mode">
              {(['compare', 'challenges'] as const).map((entry) => (
                <button key={entry} role="tab" aria-selected={mode === entry} className={mode === entry ? 'selected' : ''} onClick={() => chooseMode(entry)}>{entry === 'compare' ? 'Explore' : 'Try a challenge'}{entry === 'challenges' && <span className="challenge-tab-dot">3</span>}</button>
              ))}
            </div>

            {mode === 'compare' && (
              <div className="inspector-content compare-content" role="tabpanel">
                <div className="panel-overline"><span className="state-key" />SELECTED SAMPLE <span>{outcome}</span></div>
                <h2>{selectedTitle}</h2>
                <p className="panel-lead">{selectedHint}</p>
                <div className="sample-reading"><div><span>Model temperature</span><strong>{currentSelectedTemp}</strong></div><div><span>Water particles</span><strong>{PARTICLE_COUNT} <small>H₂O</small></strong></div></div>
                <div className="compare-divider" />
                <div className="look-for-title"><span>LOOK FOR</span><span>IN THE PARTICLE VIEW</span></div>
                <ul className="look-for-list">
                  <li><i className="check-mark"><Check size={11} /></i><span><b>Arrangement</b>{arrangementHint(selectedThermal.fractions)}</span></li>
                  <li><i className="motion-mark"><span /></i><span><b>Movement</b>{movementHint(selectedThermal.fractions)}</span></li>
                </ul>
                {showAttraction && <div className="attraction-panel">
                  <div className="attraction-heading"><Sparkles size={15} /><span>Relative attraction <small>qualitative comparison · not a force measurement</small></span></div>
                  <div className="attraction-list">{attractionCues.map((item) => <div key={item.phase} className={`attraction-item ${selectedThermal.fractions[item.phase] > 0.001 ? 'is-selected' : ''}`}><span>{labelForPhase(item.phase)}</span><div className="attraction-segments">{[0, 1, 2].map((segment) => <i key={segment} className={segment < item.segments ? item.phase : ''} />)}</div><b>{item.level.replace(' relative attraction', '')}</b></div>)}</div>
                  <p className="attraction-note">{selectedThermal.isChangingState ? 'Two phase arrangements coexist during a change of state.' : ATTRACT[selectedPhase].note} Attraction is qualitative. Phase changes rearrange molecules; they do not break H₂O molecules.</p>
                </div>}
                <div className="teacher-cue"><span className="cue-icon"><Volume2 size={14} /></span><p><b>Try this with a class</b><br />Switch on particles, pause, then single step. Ask: “Are particles in a solid actually still?”</p></div>
              </div>
            )}

            {mode === 'challenges' && (
              <div className="inspector-content challenges-content" role="tabpanel">
                <div className="panel-overline"><span className="state-key challenge-key" />THINK · TEST · EXPLAIN <span>OPTIONAL</span></div>
                <h2>Try a challenge</h2>
                <p className="panel-lead">Each task checks a prediction against particle behaviour or the thermal model.</p>
                <div className="challenge-picker" role="group" aria-label="Choose a science challenge">
                  {[0, 1, 2].map((index) => <button key={index} className={challengeIndex === index ? 'active' : ''} onClick={() => startChallenge(index)}><span>0{index + 1}</span>{['Find the mystery state', 'Predict the tilt', 'Melt the ice'][index]}{challengeComplete && challengeIndex === index && <Check size={13} />}</button>)}
                </div>
                <div className="challenge-card">
                  <div className="challenge-card-top"><span>TASK 0{challengeIndex + 1}</span>{challengeComplete && <span className="success-chip"><Check size={11} /> VERIFIED</span>}</div>
                  {challengeIndex === 0 && <>
                    <h3>Which state is hidden?</h3>
                    <p>Its molecules stay close together but change neighbours. The sample takes the shape of its chamber. Identify the state.</p>
                    <div className="answer-grid">{SAMPLE_ORDER.map((phase) => <button key={phase} className={challengeAnswer === phase ? 'picked' : ''} onClick={() => selectChallengeAnswer(phase)}>{labelForPhase(phase)}</button>)}</div>
                  </>}
                  {challengeIndex === 1 && <>
                    <h3>Predict before you tilt</h3>
                    <p>Which sample should keep its own shape when all three chambers tip by 20°?</p>
                    <div className="answer-grid">{SAMPLE_ORDER.map((phase) => <button key={phase} className={challengeAnswer === phase ? 'picked' : ''} onClick={() => selectChallengeAnswer(phase)}>{labelForPhase(phase)}</button>)}</div>
                    <button className="observe-button" onClick={applyChallengeTilt}><ArrowRight size={14} />Apply 20° tilt and observe</button>
                    {tiltObserved && <span className="observation-chip"><Check size={12} />Three-state comparison tilted</span>}
                  </>}
                  {challengeIndex === 2 && <>
                    <h3>Turn ice into liquid water</h3>
                    <p>Heat the solid sample until no ice remains. Use its temperature and phase fractions to check your result.</p>
                    <div className="challenge-energy-readout"><span>Ice remaining</span><b>{Math.round(solidThermal.fractions.solid * 100)}%</b><span>Temperature</span><b>{formatTemperature(solidThermal.temperatureC)}</b></div>
                    <div className="challenge-energy-actions"><button disabled={solidSample.energyKJ <= ENERGY_LIMITS_KJ.minimum + 1e-9} onClick={() => updateSampleEnergy('solid', -energyStep)} aria-label={`Cool solid by ${energyStep} kilojoules`}>−{energyStep} kJ</button><button disabled={solidSample.energyKJ >= ENERGY_LIMITS_KJ.maximum - 1e-9} onClick={() => updateSampleEnergy('solid', energyStep)} aria-label={`Heat solid by ${energyStep} kilojoules`}>+{energyStep} kJ heat</button></div>
                  <p className="challenge-mini-hint">Heating step: {energyStep} kJ · use particle movement and the water-phase readout as evidence.</p>
                  </>}
                </div>
                {challengeFeedback && <div className={`challenge-feedback ${challengeComplete ? 'complete' : ''}`} role="status">{challengeComplete ? <Check size={15} /> : <Sparkles size={14} />}<span>{challengeFeedback}</span></div>}
                <button className="restart-challenge" onClick={() => startChallenge(challengeIndex)}><RotateCcw size={13} />Restart this challenge</button>
                <p className="no-leaderboard"><span>NO TIMER</span> Take time to explain the evidence you used.</p>
              </div>
            )}

            <footer className="inspector-footer"><span><span className="footer-live" />MODEL RUNNING LOCALLY</span><button onClick={resetExperiment}><RotateCcw size={13} />Reset experiment</button></footer>
          </aside>
        </section>

        </>}

        {section === 'water' && <WaterTopicLab initialMode={waterMode} onModeChange={handleWaterModeChange} />}
        {section === 'change' && <ChangeLab initialTransition={transitionId} onTransitionChange={handleTransitionChange} />}
        {section === 'beyond' && <AdvancedLab initialExperiment={experimentId} onExperimentChange={handleAdvancedExperimentChange} />}
        {section === 'solutions' && <SolutionsLab initialMode={solutionsMode} onModeChange={handleSolutionsModeChange} />}
        {section === 'mixtures' && <MixturesLab initialMode={mixturesMode} focus={mixturesFocus} onModeChange={handleMixturesModeChange} />}
        {section === 'pollution' && <PollutionLab />}

        {section !== 'home' && section !== 'beyond' && <nav className="lesson-sequence" aria-label="Sequential syllabus navigation">
          {previousOutcome ? <a className="lesson-sequence-link previous" href={routeForOutcome(previousOutcome)}><span>PREVIOUS · {previousOutcome}</span><b>{OUTCOME_SHORT_TITLES[previousOutcome]}</b></a> : <span className="lesson-sequence-edge" />}
          <a className="lesson-sequence-menu" href="#/"><BookOpen size={16} /><span>Syllabus menu</span></a>
          {nextOutcome ? <a className="lesson-sequence-link next" href={routeForOutcome(nextOutcome)}><span>NEXT · {nextOutcome}</span><b>{OUTCOME_SHORT_TITLES[nextOutcome]}</b><ArrowRight size={16} /></a> : <span className="lesson-sequence-edge" />}
        </nav>}
        {section === 'beyond' && <nav className="lesson-sequence lesson-sequence-optional" aria-label="Return to the syllabus menu"><span>OPTIONAL ATOMIC EXAMPLES · NOT NUMBERED SYLLABUS OUTCOMES</span><a className="lesson-sequence-menu" href="#/"><BookOpen size={16} /><span>Syllabus menu</span></a></nav>}
        </Suspense>
      </main>

      {showHelp && <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHelp(false); }}>
        <aside ref={guideRef} className="guide-drawer" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <div className="guide-head"><div><span>MATTERLAB · PLAYGROUND GUIDE</span><h2 id="guide-title">{guideTitle}</h2></div><button ref={guideCloseRef} className="icon-button" aria-label="Close guide" onClick={() => setShowHelp(false)}><X size={18} /></button></div>
          {section === 'states' && <>
            <p className="guide-intro">A quick comparison of water molecules in ice, liquid water and invisible water vapour.</p>
            <section className="guide-section"><h3>Matter lesson shortcuts</h3>{(['4.1.3', '4.1.4'] as const).map((id) => <div className="outcome-copy" key={id}><span><b>{id}</b><a href={routeForOutcome(id)} onClick={() => setShowHelp(false)}>Open this mode <ChevronDown size={13} /></a></span><p>{OUTCOMES[id].wording}</p><small>{OUTCOMES[id].focus}</small></div>)}</section>
            <section className="guide-section"><h3>What the model assumes</h3><ul className="guide-bullets"><li>Pure water at fixed pressure near 1 atm; melting and boiling plateaux are idealised.</li><li>Each chamber contains the same 200 g water sample and the same 18 illustrative H₂O molecules.</li><li>Ice occupies about 9% more volume than the same mass of liquid water at the melt point.</li><li>Particle movement is simplified. Attraction cues are qualitative, not calibrated force measurements.</li><li>Water vapour is invisible. The gas chamber is shown larger to communicate its representative volume.</li></ul></section>
            <section className="guide-section source-section"><h3>Science background</h3><a href="https://www.usgs.gov/water-science-school/science/water-density" target="_blank" rel="noreferrer">USGS · Water density and ice <ChevronDown size={13} /></a><a href="https://www.usgs.gov/water-science-school/properties-water" target="_blank" rel="noreferrer">USGS · Properties of water <ChevronDown size={13} /></a><a href="https://www.acs.org/middleschoolchemistry/lessonplans/chapter1.html" target="_blank" rel="noreferrer">ACS · Properties of matter and particles <ChevronDown size={13} /></a><a href="https://www.acs.org/content/dam/acsorg/msc/downloads/chapter-2/lesson-5/ch2-l5-teacher-background.pdf" target="_blank" rel="noreferrer">ACS · Energy and changes of state <ChevronDown size={13} /></a></section>
          </>}
          {section === 'change' && <>
            <p className="guide-intro">Choose one direction, predict what changes, then use heat, cool or surface conditions to test the cause. Keep the same H₂O sample in view.</p>
            <section className="guide-section"><h3>How the six transitions are modelled</h3><ul className="guide-bullets"><li>Melting, freezing and boiling follow the fixed-pressure pure-water energy model and ideal latent-heat plateaux.</li><li>Evaporation, condensation, sublimation and deposition transfer mass between reservoirs through an explicitly qualitative surface-rate model.</li><li>Surface-transfer speed is accelerated for interaction; it is not a calibrated prediction. Heat/surface temperature and humidity affect the direction and rate.</li><li>The solid, liquid and vapour ledger conserves 200 g and the 18 H₂O identities.</li></ul></section>
            <section className="guide-section source-section"><h3>Science background</h3><a href="https://www.usgs.gov/water-science-school/science/evaporation-and-water-cycle" target="_blank" rel="noreferrer">USGS · Evaporation <ChevronDown size={13} /></a><a href="https://www.usgs.gov/water-science-school/science/sublimation-and-water-cycle?page=1" target="_blank" rel="noreferrer">USGS · Sublimation and deposition <ChevronDown size={13} /></a><a href="https://www.acs.org/content/dam/acsorg/msc/downloads/chapter-2/lesson-5/ch2-l5-teacher-background.pdf" target="_blank" rel="noreferrer">ACS · Energy and changes of state <ChevronDown size={13} /></a></section>
          </>}
          {section === 'beyond' && <>
            <p className="guide-intro">These are two optional atomic-gas examples, not the only possible states of matter and not extra phases of the water model.</p>
            <section className="guide-section"><h3>What the experiments show</h3><ul className="guide-bullets"><li>Plasma: an illustrative hydrogen sample ionises; nuclei and total electrons are conserved, net charge remains zero, and field force directions follow charge.</li><li>Bose–Einstein condensate: a bounded rubidium-87 model uses an explicitly illustrative condensate fraction and never cools to 0 K.</li><li>Markers, paths and glow are schematic. Counts and labels carry the model; trajectories are not calibrated plasma dynamics or a full quantum simulation.</li></ul></section>
            <section className="guide-section source-section"><h3>Science background</h3><a href="https://www.energy.gov/science/doe-explainsplasma" target="_blank" rel="noreferrer">US DOE · Plasma <ChevronDown size={13} /></a><a href="https://www.nist.gov/publications/observation-bose-einstein-condensation-dilute-atomic-vapor-below-200-nanokelvins-0" target="_blank" rel="noreferrer">NIST · Rubidium-87 condensate observation <ChevronDown size={13} /></a><a href="https://www.nist.gov/programs-projects/spinor-condensates-and-ultracold-collisions" target="_blank" rel="noreferrer">NIST · Ultracold atoms <ChevronDown size={13} /></a></section>
          </>}
          <section className="guide-section outcome-directory" aria-label="All Year 7 Term 4 learning outcomes">
            <h3>Open a lesson</h3>
            <p className="guide-intro">Every supplied Term 4 outcome opens its working model or investigation. Choose a topic, then launch a lesson directly.</p>
            {TOPIC_GROUPS.map((group) => {
              const ids = OUTCOME_IDS.filter((id) => OUTCOMES[id].topic === group.id);
              return <details className="outcome-topic-list" key={group.id} open={group.id === activeTopic}>
                <summary>{group.label}<span>{ids.length} lessons</span></summary>
                <div>{ids.map((id) => <article className="outcome-launch-row" key={id}>
                  <a href={routeForOutcome(id)} onClick={() => setShowHelp(false)}><b>{id}</b><span>{OUTCOMES[id].focus}</span><ChevronDown size={14} /></a>
                  <details><summary>Exact supplied wording</summary><p>{OUTCOMES[id].wording}</p></details>
                </article>)}</div>
              </details>;
            })}
          </section>
          <div className="guide-bottom">No accounts or saved student data. Reloading restores the initial comparison.</div>
        </aside>
      </div>}

      <div className="assistive-live" aria-live="polite" aria-atomic="true">{challengeFeedback}</div>
    </div>
  );
}
