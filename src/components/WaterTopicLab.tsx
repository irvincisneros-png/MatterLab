import { Component, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LabBeaker, LabBench, StudioLights } from './scene/LabPrimitives';
import { HeatingParticleView, ParticleLens } from './scene/WaterParticles';
import { DensityLiquidsScene, DensityObjectsScene } from './scene/WaterApparatus';
import { WaterCycleScene } from './scene/WaterCycleScene';
import {
  Anchor, ArrowDown, Check, ChevronRight, Cloud, CloudRain, Download, Droplets, FlaskConical, Gauge, Info, Pause,
  Play, RotateCcw, Ruler, Scale, Snowflake, Sparkles, StepForward, Thermometer, Waves,
} from 'lucide-react';
import {
  advanceHeating, advanceWaterCycle, calculateBuoyancy, calculateSolidDensity, CYCLE_WATER_MASS_KG,
  createHeatingExperiment, createWaterCycleState, displacementVolumeCm3, layoutHeatingParticles, LIQUID_REFERENCE_DENSITIES,
  measureLiquidSample, recordHeatingReading, regularVolumeCm3, restartHeating, setCycleConditions,
  setHeatingEquipment, setHeatingPower, setThermometer, simulatedBalanceReading, SOLID_REFERENCE_DENSITIES,
  surfaceTensionOutcome, thermometerTemperature, totalCycleWaterKg, waterDensityGPerMl,
  type HeatingExperiment, type HeatingStart, type HeatingVessel, type LiquidMeasurement, type LiquidSampleId, type SolidMaterialId,
  type SurfacePlacement, type WaterCycleState, type WaterTopicMode,
} from '../science/waterTopicEngine';
import { advanceModelTime, deriveMoleculePositions, PARTICLE_COUNT, SAMPLE_MASS_KG, thermalStateAtEnergy, type Phase, type PhaseFractions } from '../science/matterEngine';
import './WaterTopicLab.css';
import { watchContextLoss } from './scene/contextLoss';

export type { WaterTopicMode } from '../science/waterTopicEngine';
export type WaterTopicLabProps = { initialMode?: WaterTopicMode; onModeChange?: (mode: WaterTopicMode) => void };

type Point3 = readonly [number, number, number];
type WaterParticle = { id: number; phase: Phase; position: Point3 };
type PropertiesFocus = 'density' | 'buoyancy' | 'surface';
type ObjectForm = {
  shape: 'regular' | 'irregular';
  material: SolidMaterialId;
  dimensionsCm: [number, number, number];
  irregularVolumeCm3: number;
  tared: boolean;
  massG: number | null;
  measuredDimensions: [number, number, number] | null;
  initialLevelMl: number | null;
  submerged: boolean;
  /** Where the specimen physically is: on the bench, on the balance pan, or (irregular only) in the cylinder. */
  station: 'bench' | 'pan' | 'cylinder';
  finalLevelMl: number | null;
  result: { volumeCm3: number; densityGPerCm3: number; densityKgPerM3: number } | null;
};
type ObjectRecord = { trial: number; shape: string; material: string; massG: number; volumeCm3: number; densityGPerCm3: number; densityKgPerM3: number; referenceGPerCm3: number; referenceConditions: string };
type RecordedLiquidMeasurement = LiquidMeasurement & { massEquipment: string; volumeEquipment: string; massResolutionG: number; volumeResolutionMl: number };

const MODE_META: readonly { id: WaterTopicMode; name: string; outcome: string; icon: typeof Cloud }[] = [
  { id: 'cycle', name: 'Water cycle', outcome: '4.1.1', icon: CloudRain },
  { id: 'heating', name: 'Heating water', outcome: '4.1.2', icon: Thermometer },
  { id: 'properties', name: 'Water properties', outcome: '4.2.1', icon: Droplets },
  { id: 'density-liquids', name: 'Density of liquids', outcome: '4.2.2', icon: Scale },
  { id: 'density-objects', name: 'Density of objects', outcome: '4.2.3', icon: Ruler },
];

const POOL_LABELS = [
  ['oceanLiquidKg', 'Ocean', '#1978dd', 'liquid'],
  ['surfaceLiquidKg', 'Land and rivers', '#0da9bc', 'liquid'],
  ['groundwaterLiquidKg', 'Groundwater', '#4c79d7', 'liquid'],
  ['cloudLiquidKg', 'Cloud droplets', '#7bcce0', 'liquid'],
  ['cloudIceKg', 'Cloud ice crystals', '#98b7f3', 'solid'],
  ['atmosphericVapourKg', 'Water vapour (invisible)', '#737f99', 'gas'],
  ['snowAndGlacierIceKg', 'Snow and glacier ice', '#416ed5', 'solid'],
] as const;
const HEAT_CHART_WIDTH = 640;
const HEAT_CHART_HEIGHT = 250;
const FIXED_STEP_SECONDS = 1 / 60;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function seed(id: number, lane: number) {
  const value = Math.sin((id + 1) * 78.233 + lane * 32.53) * 43758.5453;
  return value - Math.floor(value);
}
function wrapUnit(value: number) { return ((value % 1) + 1) % 1; }
function formatMassKg(value: number) { return `${(value * 1000).toFixed(value >= 0.01 ? 0 : 1)} g`; }
function formatClock(seconds: number) {
  const total = Math.floor(Math.max(0, seconds));
  return `${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, '0')}`;
}
function formatTemp(value: number) { return `${Math.round(value * 10) / 10} °C`; }

function allocatePhases(fractions: PhaseFractions, count: number): Phase[] {
  const names = ['solid', 'liquid', 'gas'] as const;
  const amounts = names.map((phase) => {
    const exact = clamp(fractions[phase], 0, 1) * count;
    return { phase, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let placed = amounts.reduce((sum, item) => sum + item.amount, 0);
  for (const item of [...amounts].sort((a, b) => b.remainder - a.remainder)) {
    if (placed >= count) break;
    item.amount += 1;
    placed += 1;
  }
  return amounts.flatMap(({ phase, amount }) => Array.from({ length: amount }, () => phase));
}

function cycleParticlePositions(state: WaterCycleState): WaterParticle[] {
  const p = state.pools;
  const water = totalCycleWaterKg(p);
  const solid = (p.cloudIceKg + p.snowAndGlacierIceKg) / water;
  const liquid = (p.oceanLiquidKg + p.surfaceLiquidKg + p.groundwaterLiquidKg + p.cloudLiquidKg) / water;
  const gas = p.atmosphericVapourKg / water;
  const phases = allocatePhases({ solid, liquid, gas }, PARTICLE_COUNT);
  const liquidTotal = p.oceanLiquidKg + p.surfaceLiquidKg + p.groundwaterLiquidKg + p.cloudLiquidKg;
  const solidTotal = p.cloudIceKg + p.snowAndGlacierIceKg;
  return Array.from({ length: PARTICLE_COUNT }, (_, id) => {
    const phase = phases[id] ?? 'liquid';
    const u = seed(id, 0), v = seed(id, 1), w = seed(id, 2);
    if (phase === 'gas') {
      return { id, phase, position: [2.0 + u * 4.2, 1.5 + v * 2.8, (w - 0.5) * 1.2] as const };
    }
    if (phase === 'solid') {
      if (solidTotal > 0 && u < p.cloudIceKg / solidTotal) {
        return { id, phase, position: [-1.1 + u * 1.2, 2.38 + v * 0.54, (w - 0.5) * 0.72] as const };
      }
      return { id, phase, position: [-2.6 + u * 1.7, 0.4 + v * 1.7, (w - 0.5) * 0.85] as const };
    }
    const poolRoll = u * liquidTotal;
    if (poolRoll < p.cloudLiquidKg) {
      return { id, phase, position: [-1.18 + u * 1.4, 2.18 + v * 0.56, (w - 0.5) * 0.56] as const };
    }
    if (poolRoll < p.cloudLiquidKg + p.groundwaterLiquidKg) {
      return { id, phase, position: [-0.04 + u * 1.12, -1.48 + v * 0.24, 0.96 + (w - 0.5) * 0.15] as const };
    }
    if (poolRoll < p.cloudLiquidKg + p.groundwaterLiquidKg + p.surfaceLiquidKg) {
      return { id, phase, position: [-2.38 + u * 3.05, 0.12 - u * 1.03 + v * 0.055, 1.05 + (w - 0.5) * 0.15] as const };
    }
    return { id, phase, position: [1.15 + u * 4.0, -0.87 + v * 0.17, (w - 0.5) * 1.2] as const };
  });
}

function sampleWaterParticles(visualTime: number, xCenter: number, bottom: number, fillHeight: number, radius = 0.25): WaterParticle[] {
  if (fillHeight <= 0.01) return [];
  return Array.from({ length: PARTICLE_COUNT }, (_, id) => {
    const angle = seed(id, 0) * Math.PI * 2 + visualTime * (id % 2 === 0 ? 0.16 : -0.13);
    const vertical = wrapUnit(seed(id, 1) + visualTime * (id % 3 === 0 ? 0.12 : -0.1));
    return {
      id,
      phase: 'liquid' as const,
      position: [xCenter + Math.cos(angle) * radius * 0.78, bottom + 0.06 + vertical * Math.max(0.04, fillHeight - 0.12), Math.sin(angle) * radius * 0.54] as const,
    };
  });
}

function SmallInstrumentDisplay({ text, position, size, ink = '#b9f5df' }: { text: string; position: Point3; size: readonly [number, number]; ink?: string }) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
    const context = canvas.getContext('2d'); if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 54px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = ink;
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 2, 248);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  }, [ink, text]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture ? <mesh position={position}><planeGeometry args={[size[0], size[1]]} /><meshBasicMaterial map={texture} transparent toneMapped={false} /></mesh> : null;
}

const HEATING_BEAKER = { centreX: -0.28, y: -0.095, radius: 0.64, height: 1.76 } as const;
const HEATING_ICE_HALF_WIDTH = 0.42;

function HeatingApparatus({ experiment, heaterOn, showMolecules }: { experiment: HeatingExperiment; heaterOn: boolean; showMolecules: boolean }) {
  const thermal = thermalStateAtEnergy(experiment.sample.energyKJ);
  const waterHeight = thermal.fractions.liquid * 0.86;
  const iceHeight = thermal.fractions.solid * 0.92;
  const beakerFill = clamp(waterHeight / (HEATING_BEAKER.height - 0.15), 0, 0.95);
  const floorY = HEATING_BEAKER.y - HEATING_BEAKER.height / 2 + 0.08;
  // Ice is 91.7 % as dense as water, so it floats with that fraction submerged and rests on the base when there is no liquid.
  const iceBottom = thermal.fractions.liquid > 0.001 ? Math.max(floorY, floorY + waterHeight - 0.917 * iceHeight) : floorY;
  const vessel = useMemo<HeatingVessel>(() => ({
    centreX: HEATING_BEAKER.centreX, floorY, innerRadius: HEATING_BEAKER.radius - 0.03, rimY: HEATING_BEAKER.y + HEATING_BEAKER.height / 2 - 0.025,
    waterHeight, iceBottom, iceHeight, iceHalfWidth: HEATING_ICE_HALF_WIDTH,
  }), [floorY, waterHeight, iceBottom, iceHeight]);
  const particles = useMemo(() => layoutHeatingParticles(thermal.fractions, experiment.sample.modelTimeSeconds, vessel, thermal.temperatureC), [thermal.fractions, thermal.temperatureC, experiment.sample.modelTimeSeconds, vessel]);
  const hotPlateBody = useMemo(() => new RoundedBoxGeometry(2.25, 0.36, 1.48, 5, 0.12), []);
  const controlPanel = useMemo(() => new RoundedBoxGeometry(0.32, 0.2, 0.12, 3, 0.035), []);
  const iceGeometry = useMemo(() => new RoundedBoxGeometry(HEATING_ICE_HALF_WIDTH * 2, Math.max(0.06, iceHeight), HEATING_ICE_HALF_WIDTH * 2, 3, 0.07), [iceHeight]);
  const iceEdges = useMemo(() => new THREE.BoxGeometry(HEATING_ICE_HALF_WIDTH * 2, Math.max(0.06, iceHeight), HEATING_ICE_HALF_WIDTH * 2), [iceHeight]);
  useEffect(() => () => iceEdges.dispose(), [iceEdges]);
  const boiling = heaterOn && thermal.isChangingState && thermal.temperatureC >= 99.9 && waterHeight > 0.05;
  const melting = heaterOn && thermal.isChangingState && Math.abs(thermal.temperatureC) < 0.01;
  useEffect(() => () => { hotPlateBody.dispose(); controlPanel.dispose(); }, [hotPlateBody, controlPanel]);
  useEffect(() => () => iceGeometry.dispose(), [iceGeometry]);
  return <>
    <color attach="background" args={['#eaf5ff']} /><StudioLights /><pointLight position={[-2, 1, 1]} color="#ff9f57" intensity={heaterOn ? 1.5 : 0.4} />
    <LabBench position={[0, -1.44, 0]} width={3.8} depth={2.6} />
    <group position={[0, -1.332, 0]}>
      <mesh position={[0, 0.13, 0]} geometry={hotPlateBody} castShadow receiveShadow><meshStandardMaterial color="#31536f" roughness={0.36} metalness={0.16} /></mesh>
      <mesh position={[0, 0.33, 0]}><boxGeometry args={[1.75, 0.055, 1.12]} /><meshPhysicalMaterial color="#23384a" roughness={0.22} metalness={0.18} /></mesh>
      <mesh position={[0, 0.365, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.54, 0.045, 12, 56]} /><meshStandardMaterial color={heaterOn ? '#ff7646' : '#db734e'} emissive="#cc4b24" emissiveIntensity={heaterOn ? 0.86 : 0.12} roughness={0.3} metalness={0.16} /></mesh>
      <mesh position={[0, 0.365, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.34, 0.02, 8, 48]} /><meshStandardMaterial color={heaterOn ? '#ffb36d' : '#736c69'} emissive="#ea6831" emissiveIntensity={heaterOn ? 0.52 : 0.04} /></mesh>
      <mesh position={[0.69, 0.19, 0.69]}><boxGeometry args={[0.64, 0.22, 0.035]} /><meshStandardMaterial color="#132f44" roughness={0.27} /></mesh>
      <SmallInstrumentDisplay text={`${experiment.powerKW.toFixed(1)} kW`} position={[0.69, 0.2, 0.713]} size={[0.47, 0.105]} ink={heaterOn ? '#c4ffe9' : '#88caba'} />
      <mesh position={[-0.76, 0.19, 0.7]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.08, 24]} /><meshStandardMaterial color="#bbcbd5" roughness={0.3} metalness={0.45} /></mesh>
      <mesh position={[-0.74, 0.28, 0.68]}><sphereGeometry args={[0.045, 16, 12]} /><meshStandardMaterial color={heaterOn ? '#42d09b' : '#62798b'} emissive={heaterOn ? '#2ebd8a' : '#172b38'} emissiveIntensity={heaterOn ? 0.55 : 0.06} /></mesh>
      <mesh position={[-0.28, 0.46, 0]}><boxGeometry args={[0.64, 0.09, 0.6]} /><meshStandardMaterial color="#b7ccd8" roughness={0.26} metalness={0.3} /></mesh>
      <mesh position={[0.82, 0.65, -0.52]}><boxGeometry args={[0.055, 1.48, 0.055]} /><meshStandardMaterial color="#4e6d81" metalness={0.55} roughness={0.3} /></mesh>
      <mesh position={[0.5, 1.15, -0.52]}><boxGeometry args={[0.68, 0.055, 0.055]} /><meshStandardMaterial color="#658499" metalness={0.55} roughness={0.3} /></mesh>
      <mesh position={[0.5, 1.12, -0.52]}><boxGeometry args={[0.06, 0.2, 0.06]} /><meshStandardMaterial color="#658499" metalness={0.55} roughness={0.3} /></mesh>
      <mesh position={[0.18, 1.12, -0.52]}><torusGeometry args={[0.09, 0.02, 8, 20]} /><meshStandardMaterial color="#6e8c9e" metalness={0.4} roughness={0.3} /></mesh>
      {[-1, 1].flatMap((xSide) => [-1, 1].map((zSide) => <mesh key={`hotplate-foot-${xSide}-${zSide}`} position={[xSide * 0.94, -0.18, zSide * 0.56]}><boxGeometry args={[0.13, 0.09, 0.13]} /><meshStandardMaterial color="#223b4b" roughness={0.45} /></mesh>))}
    </group>
    <LabBeaker radius={HEATING_BEAKER.radius} height={HEATING_BEAKER.height} fill={beakerFill} particleLens={showMolecules} graduated capacityMl={400} waterColor="#22a9c3" position={[HEATING_BEAKER.centreX, HEATING_BEAKER.y, 0]} />
    {experiment.heater === 'immersion-heater' && <group position={[-0.66, -0.06, 0.02]}>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.042, 0.042, 1.02, 12]} /><meshStandardMaterial color="#566e7d" metalness={0.56} roughness={0.28} /></mesh>
      <mesh position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.11, 0.024, 8, 20]} /><meshStandardMaterial color={heaterOn ? '#f07a52' : '#75828a'} emissive="#d5502c" emissiveIntensity={heaterOn ? 0.55 : 0.04} /></mesh>
      <mesh position={[0, 0.96, -0.18]} rotation={[0, 0, -0.5]}><cylinderGeometry args={[0.016, 0.016, 0.52, 8]} /><meshStandardMaterial color="#3b5364" /></mesh>
    </group>}
    {experiment.heater === 'immersion-heater' && heaterOn && <pointLight position={[-0.66, -0.15, 0.02]} color="#ff8a50" intensity={0.32} distance={1.2} />}
    {iceHeight > 0.015 && <group position={[HEATING_BEAKER.centreX, iceBottom + Math.max(0.06, iceHeight) / 2, 0]}>
      <mesh geometry={iceGeometry} castShadow><meshPhysicalMaterial color="#bfe4f3" transparent opacity={showMolecules ? 0.5 : 0.92} roughness={0.28} clearcoat={0.85} clearcoatRoughness={0.25} emissive="#a9dcef" emissiveIntensity={0.12} /></mesh>
      <lineSegments><edgesGeometry args={[iceEdges]} /><lineBasicMaterial color="#6fb9dc" /></lineSegments>
      {!showMolecules && [[-0.14, 0.1], [0.12, -0.14]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0, HEATING_ICE_HALF_WIDTH + 0.004]} scale={[0.28, 0.012, 0.004]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.55} /></mesh>)}
    </group>}
    {boiling && Array.from({ length: 9 }, (_, i) => {
      const u = ((experiment.sample.modelTimeSeconds * (0.35 + (i % 3) * 0.12) + i * 0.173) % 1 + 1) % 1;
      const angle = i * 2.4;
      return <mesh key={`bubble-${i}`} position={[HEATING_BEAKER.centreX + Math.cos(angle) * 0.34 * ((i % 4) + 1) / 4, floorY + 0.06 + u * Math.max(0.02, waterHeight - 0.12), Math.sin(angle) * 0.3 * ((i % 3) + 1) / 3]}><sphereGeometry args={[0.028 + (i % 3) * 0.01, 10, 8]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={0.5} roughness={0.1} clearcoat={1} /></mesh>;
    })}
    {melting && waterHeight > 0.02 && <mesh position={[HEATING_BEAKER.centreX, floorY + waterHeight + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.61, 40]} /><meshBasicMaterial color="#e9fbff" transparent opacity={0.35} /></mesh>}
    <group position={[0.18, 0.03, 0.14]}>
      {experiment.thermometer === 'glass-thermometer' ? <>
        <mesh position={[0, 0.05, 0]}><capsuleGeometry args={[0.036, 1.38, 4, 12]} /><meshPhysicalMaterial color="#f8fcff" transparent opacity={0.62} roughness={0.13} /></mesh>
        <mesh position={[0, -0.68 + clamp((thermal.temperatureC + 20) / 140, 0, 1) * 0.42, 0.026]}><cylinderGeometry args={[0.011, 0.011, 0.03 + clamp((thermal.temperatureC + 20) / 140, 0, 1) * 0.78, 8]} /><meshBasicMaterial color="#e64d48" /></mesh>
        <mesh position={[0, -0.68, 0.024]}><sphereGeometry args={[0.05, 12, 10]} /><meshBasicMaterial color="#e64d48" /></mesh>
        {Array.from({ length: 7 }, (_, i) => <mesh key={`therm-tick-${i}`} position={[0.08, 0.52 - i * 0.16, 0.035]}><boxGeometry args={[i % 2 ? 0.065 : 0.095, 0.012, 0.008]} /><meshBasicMaterial color="#678497" /></mesh>)}
      </> : <>
        <mesh position={[0, 0.02, 0]} rotation={[0, 0, -0.03]}><cylinderGeometry args={[0.025, 0.038, 1.42, 12]} /><meshStandardMaterial color="#5c7182" metalness={0.62} roughness={0.3} /></mesh>
        <mesh position={[0, -0.71, 0]}><sphereGeometry args={[0.052, 16, 12]} /><meshStandardMaterial color="#ef5a50" emissive="#b42c25" emissiveIntensity={0.22} /></mesh>
        <mesh position={[0, 0.74, 0]} geometry={controlPanel}><meshStandardMaterial color="#263f53" roughness={0.25} /></mesh>
        <SmallInstrumentDisplay text={`${thermometerTemperature(thermal.temperatureC, experiment.thermometer).toFixed(1)}°`} position={[0, 0.74, 0.065]} size={[0.23, 0.1]} ink="#b8f5d9" />
      </>}
    </group>
    {Array.from({ length: 5 }, (_, i) => <mesh key={`power-wire-${i}`} position={[0.38 + i * 0.1, -0.86, -0.28]} rotation={[0, 0, 0.3]}><cylinderGeometry args={[0.018, 0.018, 0.18, 8]} /><meshStandardMaterial color="#324e64" /></mesh>)}
    <HeatingParticleView particles={particles} visible={showMolecules} />
  </>;
}

const PROPERTIES_SHIFT_X = -0.62;
function PropertiesScene({
  focus, volumeMl, objectKind, submergedFraction, surfacePlacement, detergent, visualTime, showMolecules,
}: {
  focus: PropertiesFocus; volumeMl: number; objectKind: 'solid' | 'hollow'; submergedFraction: number; surfacePlacement: SurfacePlacement | 'unplaced'; detergent: boolean; visualTime: number; showMolecules: boolean;
}) {
  const paperclipCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.28, 0, -0.04), new THREE.Vector3(-0.28, 0, 0.04), new THREE.Vector3(-0.2, 0, 0.09),
    new THREE.Vector3(0.2, 0, 0.09), new THREE.Vector3(0.29, 0, 0.035), new THREE.Vector3(0.29, 0, -0.055),
    new THREE.Vector3(0.22, 0, -0.11), new THREE.Vector3(-0.16, 0, -0.11), new THREE.Vector3(-0.22, 0, -0.055),
    new THREE.Vector3(-0.19, 0, -0.015), new THREE.Vector3(0.17, 0, -0.015),
  ], false, 'catmullrom', 0.055), []);
  const fill = 0.62;
  const volumeScale = clamp(Math.cbrt(volumeMl / 450), 0.54, 1.5);
  const bodyHeight = (objectKind === 'solid' ? 0.74 : 0.4) * volumeScale;
  const liquidSurfaceY = -0.9 + fill * 1.58;
  const objectY = liquidSurfaceY - bodyHeight * submergedFraction / 2;
  const clipY = surfacePlacement === 'gentle' && !detergent ? liquidSurfaceY + 0.012 : surfacePlacement === 'push-under' || detergent ? liquidSurfaceY - 0.56 : liquidSurfaceY + 0.22;
  const boatY = liquidSurfaceY + 0.02 - submergedFraction * 0.13;
  const boatSide = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.56, 0.1); shape.lineTo(0.56, 0.1); shape.lineTo(0.38, -0.12); shape.lineTo(0.2, -0.23); shape.lineTo(-0.34, -0.23); shape.lineTo(-0.48, -0.15); shape.closePath();
    return new THREE.ShapeGeometry(shape, 16);
  }, []);
  return <>
    <color attach="background" args={['#eaf5ff']} /><StudioLights /><pointLight position={[-2, 1, 1]} intensity={0.82} color="#70d8e7" />
    <LabBench position={[0, -1.11, 0]} width={4.6} depth={2.0} />
    <group position={[PROPERTIES_SHIFT_X, 0, 0]}>
    <LabBeaker radius={0.69} height={1.78} fill={fill} particleLens={showMolecules} graduated capacityMl={650} waterColor="#17a8c1" position={[0, -0.02, 0]} />
    {focus === 'buoyancy' && objectKind === 'solid' && <mesh position={[0, objectY, 0]} scale={volumeScale} geometry={new RoundedBoxGeometry(0.58, 0.68, 0.55, 4, 0.1)} castShadow><meshStandardMaterial color="#c68d50" roughness={0.58} /></mesh>}
    {focus === 'buoyancy' && objectKind === 'hollow' && <group position={[0, boatY, 0]} scale={volumeScale}>
      <mesh position={[0, -0.17, 0]} castShadow><boxGeometry args={[0.78, 0.08, 0.46]} /><meshStandardMaterial color="#bb7442" roughness={0.56} /></mesh>
      <mesh position={[0, 0, -0.26]} geometry={boatSide} castShadow><meshStandardMaterial color="#d39255" roughness={0.5} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0, 0.26]} geometry={boatSide} castShadow><meshStandardMaterial color="#e0a263" roughness={0.48} side={THREE.DoubleSide} /></mesh>
      <mesh position={[-0.41, -0.045, 0]} rotation={[Math.PI / 2, 0, -0.47]}><boxGeometry args={[0.36, 0.07, 0.055]} /><meshStandardMaterial color="#c8864d" roughness={0.48} /></mesh>
      <mesh position={[0.43, -0.045, 0]} rotation={[Math.PI / 2, 0, 0.47]}><boxGeometry args={[0.34, 0.07, 0.055]} /><meshStandardMaterial color="#bf7a48" roughness={0.5} /></mesh>
      <mesh position={[0, -0.095, 0]}><boxGeometry args={[0.56, 0.018, 0.31]} /><meshStandardMaterial color="#58b7cc" roughness={0.24} transparent opacity={0.8} /></mesh>
      <mesh position={[0, 0.083, 0]}><boxGeometry args={[0.78, 0.035, 0.05]} /><meshStandardMaterial color="#9c633d" roughness={0.45} /></mesh>
    </group>}
    {focus === 'surface' && <>
      <mesh position={[0.2, clipY, 0.03]}><tubeGeometry args={[paperclipCurve, 72, 0.012, 8, false]} /><meshStandardMaterial color="#74818c" metalness={0.7} roughness={0.22} /></mesh>
      <mesh position={[0.2, liquidSurfaceY, 0.02]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.66, 0.012, 8, 48]} /><meshPhysicalMaterial color={detergent ? '#90d7e4' : '#d7f8ff'} transparent opacity={0.92} roughness={0.12} clearcoat={1} /></mesh>
      {detergent && <group position={[0.91, liquidSurfaceY + 0.7, 0.12]}>
        <mesh position={[0, 0.18, 0]} rotation={[0, 0, 0.1]}><cylinderGeometry args={[0.042, 0.024, 0.46, 14]} /><meshPhysicalMaterial color="#b7cfda" transparent opacity={0.72} roughness={0.18} /></mesh>
        <mesh position={[0, 0.42, 0]} geometry={new RoundedBoxGeometry(0.15, 0.14, 0.13, 4, 0.05)}><meshPhysicalMaterial color="#6c99aa" roughness={0.32} /></mesh>
        <mesh position={[0, 0.05 + ((visualTime * 0.1) % 0.24), 0]}><sphereGeometry args={[0.055, 16, 12]} /><meshPhysicalMaterial color="#64d1e0" roughness={0.12} clearcoat={0.95} /></mesh>
      </group>}
    </>}
    </group>
    <ParticleLens visible={showMolecules} sample="water20C" time={visualTime} radius={0.55} anchor={[PROPERTIES_SHIFT_X + 0.34, liquidSurfaceY - 0.45, 0.62]} position={[1.5, 0.25, 0.5]} />
  </>;
}

function WaterWorld({ mode, cycle, heating, heaterOn, propertiesFocus, waterTemperatureC, buoyancy, surfacePlacement, detergent, liquidSample, liquidVolumeMl, liquidMassG, liquidBalanceTared, objectForm, objectVolumeCm3, visualTime, showMolecules, reducedMotion }: {
  mode: WaterTopicMode; cycle: WaterCycleState; heating: HeatingExperiment; heaterOn: boolean; propertiesFocus: PropertiesFocus; waterTemperatureC: number;
  buoyancy: { shape: 'solid' | 'hollow'; massKg: number; volumeMl: number };
  surfacePlacement: SurfacePlacement | 'unplaced'; detergent: boolean; liquidSample: LiquidSampleId; liquidVolumeMl: number; liquidMassG: number | null; liquidBalanceTared: boolean;
  objectForm: ObjectForm; objectVolumeCm3: number; visualTime: number; showMolecules: boolean; reducedMotion: boolean;
}) {
  const density = calculateBuoyancy(buoyancy.massKg, buoyancy.volumeMl, waterDensityGPerMl(waterTemperatureC) * 1000);
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [cycle, heating, propertiesFocus, waterTemperatureC, buoyancy, surfacePlacement, detergent, liquidSample, liquidVolumeMl, liquidMassG, objectForm, objectVolumeCm3, visualTime, showMolecules, invalidate]);
  return <>
    {mode === 'cycle' && <WaterCycleScene state={cycle} showMolecules={showMolecules} reducedMotion={reducedMotion} />}
    {mode === 'heating' && <HeatingApparatus experiment={heating} heaterOn={heaterOn} showMolecules={showMolecules} />}
    {mode === 'properties' && <PropertiesScene focus={propertiesFocus} volumeMl={buoyancy.volumeMl} objectKind={buoyancy.shape} submergedFraction={density?.submergedFraction ?? 0} surfacePlacement={surfacePlacement} detergent={detergent} visualTime={visualTime} showMolecules={showMolecules} />}
    {mode === 'density-liquids' && <DensityLiquidsScene liquidSample={liquidSample} volumeMl={liquidVolumeMl} massG={liquidMassG} tared={liquidBalanceTared} showMolecules={showMolecules && liquidVolumeMl > 0} time={visualTime} />}
    {mode === 'density-objects' && <DensityObjectsScene shape={objectForm.shape} material={objectForm.material} dimensionsCm={objectForm.dimensionsCm} volumeCm3={objectVolumeCm3} massG={objectForm.massG} tared={objectForm.tared} station={objectForm.station} measuredDimensions={objectForm.measuredDimensions} initialLevelMl={objectForm.initialLevelMl} finalLevelMl={objectForm.finalLevelMl} showMolecules={showMolecules} time={visualTime} />}
  </>;
}

type BoundaryState = { failed: boolean };
class WaterGraphicsBoundary extends Component<{ children: ReactNode; onFailure: () => void }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function supportsWaterWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

function newObjectForm(shape: ObjectForm['shape'] = 'regular', material: SolidMaterialId = 'aluminum'): ObjectForm {
  return {
    shape, material, dimensionsCm: [2, 2, 2], irregularVolumeCm3: 14,
    tared: false, massG: null, measuredDimensions: null, initialLevelMl: null,
    submerged: false, station: 'bench', finalLevelMl: null, result: null,
  };
}

/** Visible span (scene units) each apparatus must fit inside, and the point the camera looks at. */
const CAMERA_FRAME: Record<WaterTopicMode, { x: number; y: number; width: number; height: number }> = {
  cycle: { x: 0.1, y: 0.4, width: 12.2, height: 7.2 },
  heating: { x: 0, y: -0.05, width: 3.4, height: 3.3 },
  properties: { x: 0.45, y: -0.05, width: 4.9, height: 3.3 },
  'density-liquids': { x: 0.05, y: 0.0, width: 4.0, height: 3.5 },
  'density-objects': { x: 0.05, y: -0.02, width: 4.5, height: 3.4 },
};

function WaterCamera({ mode, resetId, reducedMotion }: { mode: WaterTopicMode; resetId: number; reducedMotion: boolean }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsType | null>(null);
  useEffect(() => {
    const frame = CAMERA_FRAME[mode];
    const target = new THREE.Vector3(frame.x, frame.y, 0);
    const spanWidth = frame.width;
    const spanHeight = frame.height;
    const aspect = size.width / Math.max(1, size.height);
    const halfFov = THREE.MathUtils.degToRad(36 / 2);
    const distance = Math.max(spanWidth / (2 * Math.tan(halfFov) * aspect), spanHeight / (2 * Math.tan(halfFov))) * 1.13;
    camera.position.set(target.x + distance * 0.42, target.y + distance * 0.31, target.z + distance * 0.84);
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [camera, mode, resetId, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={!reducedMotion} dampingFactor={0.085} minDistance={3.6} maxDistance={22} minPolarAngle={0.35} maxPolarAngle={2.45} />;
}

function WaterCanvasAccessibility({ description }: { description: string }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', description);
    return () => { canvas.removeAttribute('role'); canvas.removeAttribute('aria-label'); };
  }, [description, gl]);
  return null;
}

function WaterCanvas({
  mode, cycle, heating, heaterOn, propertiesFocus, waterTemperatureC, buoyancy, surfacePlacement, detergent, liquidSample, liquidVolumeMl, liquidMassG, liquidBalanceTared, objectForm, objectVolumeCm3, visualTime, showMolecules, reducedMotion, resetId, onReady, onFailure,
}: {
  mode: WaterTopicMode; cycle: WaterCycleState; heating: HeatingExperiment; heaterOn: boolean; propertiesFocus: PropertiesFocus; waterTemperatureC: number;
  buoyancy: { shape: 'solid' | 'hollow'; massKg: number; volumeMl: number };
  surfacePlacement: SurfacePlacement | 'unplaced'; detergent: boolean; liquidSample: LiquidSampleId; liquidVolumeMl: number; liquidMassG: number | null; liquidBalanceTared: boolean;
  objectForm: ObjectForm; objectVolumeCm3: number; visualTime: number; showMolecules: boolean; reducedMotion: boolean; resetId: number; onReady: () => void; onFailure: () => void;
}) {
  const sceneDescription = mode === 'cycle'
    ? 'Relief landscape showing tracked ocean water, a river and groundwater, snow and glacier ice, cloud droplets and crystals, and precipitation. Water vapour is invisible unless the particle view is on.'
    : mode === 'heating'
      ? 'Graduated glass beaker on a powered hot plate with a thermometer probe and tracked water sample.'
      : mode === 'properties'
        ? propertiesFocus === 'buoyancy'
          ? 'Beaker of water with a solid sample or an open, watertight model boat to compare displacement and buoyancy.'
          : propertiesFocus === 'surface'
            ? 'Water surface, flat paperclip, and detergent dropper for a qualitative surface-tension investigation.'
            : 'Graduated beaker and water samples for comparing density across temperature.'
        : mode === 'density-liquids'
          ? 'Graduated cylinder beside a digital balance, showing the sample meniscus and mass equipment.'
          : 'Marked ruler, digital balance, and graduated displacement cylinder for regular and irregular objects.';
  return <WaterGraphicsBoundary onFailure={onFailure}>
    <Canvas camera={{ position: [4.2, 3.2, 6.3], fov: 36, near: 0.1, far: 80 }} shadows="percentage" dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => {
      onReady();
      watchContextLoss(gl.domElement, onFailure);
    }} fallback={<span aria-hidden="true">3D view is unavailable</span>}>
      <WaterCanvasAccessibility description={sceneDescription} />
      <WaterWorld mode={mode} cycle={cycle} heating={heating} heaterOn={heaterOn} propertiesFocus={propertiesFocus} waterTemperatureC={waterTemperatureC} buoyancy={buoyancy} surfacePlacement={surfacePlacement} detergent={detergent} liquidSample={liquidSample} liquidVolumeMl={liquidVolumeMl} liquidMassG={liquidMassG} liquidBalanceTared={liquidBalanceTared} objectForm={objectForm} objectVolumeCm3={objectVolumeCm3} visualTime={visualTime} showMolecules={showMolecules} reducedMotion={reducedMotion} />
      <WaterCamera mode={mode} resetId={resetId} reducedMotion={reducedMotion} />
    </Canvas>
  </WaterGraphicsBoundary>;
}

function HeatingGraph({ experiment }: { experiment: HeatingExperiment }) {
  const thermal = thermalStateAtEnergy(experiment.sample.energyKJ);
  const points = [...experiment.readings, {
    timeSeconds: experiment.sample.modelTimeSeconds,
    temperatureC: thermal.temperatureC,
    referenceTemperatureC: thermal.temperatureC,
    phaseLabel: thermal.phaseLabel,
    trial: experiment.trial,
    solidFraction: thermal.fractions.solid,
    liquidFraction: thermal.fractions.liquid,
    vapourFraction: thermal.fractions.gas,
  }];
  const xMax = Math.max(30, ...points.map((point) => point.timeSeconds));
  const left = 52, right = 620, top = 18, bottom = 203;
  const x = (seconds: number) => left + (seconds / xMax) * (right - left);
  const y = (temperature: number) => bottom - ((temperature + 30) / 160) * (bottom - top);
  const line = points.map((point) => `${x(point.timeSeconds)},${y(point.temperatureC)}`).join(' ');
  return <svg className="wt-heating-graph" viewBox={`0 0 ${HEAT_CHART_WIDTH} ${HEAT_CHART_HEIGHT}`} role="img" aria-label="Temperature in degrees Celsius plotted against model time in seconds">
    {[0, 20, 40, 60, 80, 100, 120].map((temp) => <g key={`y-${temp}`}><line x1={left} x2={right} y1={y(temp)} y2={y(temp)} className="wt-gridline" /><text x={left - 9} y={y(temp) + 4} className="wt-axis-label" textAnchor="end">{temp}</text></g>)}
    {[0, Math.round(xMax / 3), Math.round((xMax * 2) / 3), Math.round(xMax)].map((sec, index) => <g key={`x-${index}`}><line x1={x(sec)} x2={x(sec)} y1={top} y2={bottom} className="wt-gridline vertical" /><text x={x(sec)} y={bottom + 18} className="wt-axis-label" textAnchor="middle">{sec}</text></g>)}
    <line x1={left} x2={right} y1={bottom} y2={bottom} className="wt-axis" /><line x1={left} x2={left} y1={top} y2={bottom} className="wt-axis" />
    <polyline points={line} className="wt-temperature-line" />
    {experiment.readings.map((reading, index) => <circle key={`${reading.trial}-${index}`} cx={x(reading.timeSeconds)} cy={y(reading.temperatureC)} r="4.4" className="wt-recorded-point"><title>{`Trial ${reading.trial}: ${reading.timeSeconds.toFixed(1)} s, ${reading.temperatureC} °C`}</title></circle>)}
    <circle cx={x(experiment.sample.modelTimeSeconds)} cy={y(thermal.temperatureC)} r="5.5" className="wt-live-point" />
    <text x={(left + right) / 2} y="244" className="wt-axis-title" textAnchor="middle">Model time (s)</text><text x="15" y={(top + bottom) / 2} className="wt-axis-title vertical-title" textAnchor="middle" transform={`rotate(-90 15 ${(top + bottom) / 2})`}>Temperature (°C)</text>
  </svg>;
}

function WaterFallback({ mode, cycle, heating, focus, temperatureC, liquidSample, liquidVolumeMl, objectForm, visualTime, showMolecules }: {
  mode: WaterTopicMode; cycle: WaterCycleState; heating: HeatingExperiment; focus: PropertiesFocus; temperatureC: number; liquidSample: LiquidSampleId; liquidVolumeMl: number; objectForm: ObjectForm; visualTime: number; showMolecules: boolean;
}) {
  const thermal = thermalStateAtEnergy(heating.sample.energyKJ);
  const thermometerDisplay = thermometerTemperature(thermal.temperatureC, heating.thermometer);
  const fallbackParticles = useMemo(() => mode === 'cycle' ? cycleParticlePositions(cycle) : mode === 'heating' ? deriveMoleculePositions(heating.sample) : sampleWaterParticles(visualTime, 0, -0.88, 0.58, 0.25), [mode, cycle, heating.sample, visualTime]);
  const stateName = mode === 'cycle' ? 'Earth water cycle' : mode === 'heating' ? 'Heating water' : mode === 'properties' ? 'Water properties' : mode === 'density-liquids' ? 'Density of liquids' : 'Density of objects';
  return <div className={`wt-fallback wt-fallback-${mode}`} role="group" aria-label={`2D ${stateName} model`}>
    {mode === 'cycle' && <svg className="wt-fallback-cycle" viewBox="0 0 650 300" aria-label="Mountains, cloud droplets, surface water, ocean and underground water reservoirs">
      <rect width="650" height="300" rx="24" fill="#eaf6ff" /><circle cx="520" cy="65" r={22 + cycle.sunPercent * 0.1} fill="#ffcf5c" />
      <path d="M0 238 120 112l82 87 89-125 145 164H0Z" fill="#70899d" /><path d="M165 166 291 74l87 139H165Z" fill={cycle.pools.snowAndGlacierIceKg > 0.005 ? '#f5fbff' : '#778b99'} /><path d="M0 228c130-12 216 22 319-4s207-29 331-8v84H0Z" fill="#73b98c" /><path d="M350 244c97-36 166-19 300-23v79H350Z" fill="#178ed0" />
      {cycle.pools.cloudLiquidKg > 0.001 && <g fill="#fff" opacity=".95"><circle cx="326" cy="88" r="28"/><circle cx="359" cy="77" r="39"/><circle cx="399" cy="88" r="27"/></g>}
      {cycle.pools.cloudIceKg > 0.001 && <g fill="#e4f5ff"><path d="m430 65 12 12-12 12-12-12z"/><path d="m453 86 9 9-9 9-9-9z"/></g>}
      {cycle.precipitationOn && cycle.pools.cloudLiquidKg + cycle.pools.cloudIceKg > 0.001 && <g stroke={cycle.airTemperatureC <= 0 ? '#d9f1ff' : '#12a7c2'} strokeWidth="5" strokeLinecap="round"><path d="M348 128v40m25-38v44m25-43v37"/></g>}
      {showMolecules && fallbackParticles.map((particle) => <circle key={`cycle-particle-${particle.id}`} className={`wt-fallback-dot ${particle.phase}`} cx={38 + ((particle.position[0] + 5.5) / 11) * 574} cy={250 - ((particle.position[1] + 1) / 5) * 214} r="3.4"><title>{`H₂O molecule ${particle.id + 1}, ${particle.phase}`}</title></circle>)}
      <text x="29" y="278" fill="#173e66" fontSize="15">Land</text><text x="533" y="278" fill="#fff" fontSize="15">Ocean</text>{(cycle.pools.cloudLiquidKg + cycle.pools.cloudIceKg > 0.001) && <text x="350" y="49" fill="#315d84" fontSize="14">Cloud droplets / ice</text>}
      {showMolecules && <text x="430" y="25" fill="#213f66" fontSize="13">18 model H₂O identities</text>}
    </svg>}
    {mode === 'heating' && <div className="wt-fallback-therm"><div className="wt-fallback-vessel"><div className="wt-fallback-sample" style={{ height: `${Math.max(4, Math.round(thermal.fractions.liquid * 64))}%` }} /><div className="wt-fallback-ice" style={{ height: `${Math.max(0, Math.round(thermal.fractions.solid * 30))}%` }} />{showMolecules && fallbackParticles.map((particle) => <i key={`heat-particle-${particle.id}`} className={`wt-fallback-molecule ${particle.phase}`} style={{ left: `${12 + ((particle.position[0] + 0.72) / 1.44) * 76}%`, bottom: `${8 + ((particle.position[1] + 1.04) / 2.08) * 80}%` }} />)}</div><div><b>{formatTemp(thermometerDisplay)}</b><span>{thermal.phaseLabel}</span><small>{heating.thermometer === 'digital-probe' ? 'Digital probe' : 'Glass thermometer'} · {formatClock(heating.sample.modelTimeSeconds)} model time</small></div></div>}
    {mode === 'properties' && <div className={`wt-fallback-property ${focus}`}><div className="wt-fallback-beaker"><div style={{ height: '62%' }} />{showMolecules && fallbackParticles.map((particle) => <i key={`props-particle-${particle.id}`} className={`wt-fallback-molecule ${particle.phase}`} style={{ left: `${20 + ((particle.position[0] + 0.25) / 0.5) * 60}%`, bottom: `${18 + ((particle.position[1] + 0.88) / 0.58) * 62}%` }} />)}</div><div><b>{focus === 'density' ? `${(waterDensityGPerMl(temperatureC) * 1000).toFixed(1)} kg/m³ at ${formatTemp(temperatureC)}` : focus === 'buoyancy' ? 'Object and displaced water are shown together' : 'Surface support is shown separately from sinking / floating'}</b><span>The controls, measurements and explanation remain active in this 2D view.</span></div></div>}
    {mode === 'density-liquids' && <div className="wt-fallback-property"><div className="wt-fallback-beaker"><div style={{ height: `${clamp(liquidVolumeMl / 120, 10, 82)}%` }} />{showMolecules && fallbackParticles.map((particle) => <i key={`liquid-particle-${particle.id}`} className={`wt-fallback-molecule ${particle.phase}`} style={{ left: `${20 + ((particle.position[0] + 0.25) / 0.5) * 60}%`, bottom: `${18 + ((particle.position[1] + 0.88) / 0.58) * 62}%` }} />)}</div><div><b>{LIQUID_REFERENCE_DENSITIES[liquidSample].name}</b><span>Graduated cylinder and balance data are available in the live measurement panel.</span></div></div>}
    {mode === 'density-objects' && <div className="wt-fallback-property"><div className={`wt-fallback-object ${objectForm.shape}`} /><div><b>{objectForm.shape === 'regular' ? 'Regular solid · ruler dimensions' : 'Irregular solid · displacement volume'} </b><span>Complete the scale and volume actions to calculate density. The 2D view follows the same measured sample.</span></div></div>}
    <p><b>2D model</b><span>The measurements and water ledger use the same live science model.</span></p>
  </div>;
}

export function WaterTopicLab({ initialMode = 'cycle', onModeChange }: WaterTopicLabProps): ReactElement {
  const [mode, setMode] = useState<WaterTopicMode>(initialMode);
  const [cycle, setCycle] = useState<WaterCycleState>(() => createWaterCycleState());
  const [heating, setHeating] = useState<HeatingExperiment>(() => createHeatingExperiment('ice'));
  const [heaterOn, setHeaterOn] = useState(true);
  const [propertiesFocus, setPropertiesFocus] = useState<PropertiesFocus>('density');
  const [waterTemperatureC, setWaterTemperatureC] = useState(20);
  const [buoyancy, setBuoyancy] = useState<{ shape: 'solid' | 'hollow'; massKg: number; volumeMl: number }>({ shape: 'hollow', massKg: 0.22, volumeMl: 450 });
  const [surfacePlacement, setSurfacePlacement] = useState<SurfacePlacement | 'unplaced'>('unplaced');
  const [detergent, setDetergent] = useState(false);
  const [liquidSample, setLiquidSample] = useState<LiquidSampleId>('water20C');
  const [liquidVolumeMl, setLiquidVolumeMl] = useState(50);
  const [liquidVolumeReadingMl, setLiquidVolumeReadingMl] = useState<number | null>(null);
  const [liquidMassTool, setLiquidMassTool] = useState<'balance' | 'ruler' | 'thermometer'>('balance');
  const [liquidVolumeTool, setLiquidVolumeTool] = useState<'graduated-cylinder' | 'beaker'>('graduated-cylinder');
  const [balanceTared, setBalanceTared] = useState(false);
  const [liquidLatest, setLiquidLatest] = useState<RecordedLiquidMeasurement | null>(null);
  const [liquidReadings, setLiquidReadings] = useState<RecordedLiquidMeasurement[]>([]);
  const [objectForm, setObjectForm] = useState<ObjectForm>(() => newObjectForm());
  const [objectRecords, setObjectRecords] = useState<ObjectRecord[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [visualTime, setVisualTime] = useState(0);
  const [showMolecules, setShowMolecules] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeAnswer, setChallengeAnswer] = useState<'right' | 'wrong' | null>(null);
  const [challengeBaseline, setChallengeBaseline] = useState<{ cycleCloudKg: number; heatingReadings: number; liquidReadings: number; objectRecords: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(() => !supportsWaterWebGL());
  const [canvasReady, setCanvasReady] = useState(false);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [playMessage, setPlayMessage] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  const cycleRef = useRef(cycle);
  const heatingRef = useRef(heating);

  useEffect(() => { cycleRef.current = cycle; }, [cycle]);
  useEffect(() => { heatingRef.current = heating; }, [heating]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const initializeMode = (next: WaterTopicMode) => {
    setPlaying(false); setVisualTime(0); setShowDetails(false); setShowChallenge(false); setChallengeAnswer(null); setChallengeBaseline(null);
    if (next === 'cycle') { const state = createWaterCycleState(); cycleRef.current = state; setCycle(state); }
    if (next === 'heating') { const experiment = createHeatingExperiment('ice'); heatingRef.current = experiment; setHeating(experiment); setHeaterOn(true); }
    if (next === 'properties') { setPropertiesFocus('density'); setWaterTemperatureC(20); setBuoyancy({ shape: 'hollow', massKg: 0.22, volumeMl: 450 }); setSurfacePlacement('unplaced'); setDetergent(false); }
    if (next === 'density-liquids') { setLiquidSample('water20C'); setLiquidVolumeMl(50); setLiquidVolumeReadingMl(null); setLiquidMassTool('balance'); setLiquidVolumeTool('graduated-cylinder'); setBalanceTared(false); setLiquidLatest(null); setLiquidReadings([]); }
    if (next === 'density-objects') { setObjectForm(newObjectForm()); setObjectRecords([]); }
    setMode(next);
  };
  useEffect(() => { initializeMode(initialMode); }, [initialMode]);

  const updateCycle = (update: (current: WaterCycleState) => WaterCycleState) => setCycle((current) => {
    const next = update(current); cycleRef.current = next; return next;
  });
  const updateHeating = (update: (current: HeatingExperiment) => HeatingExperiment) => setHeating((current) => {
    const next = update(current); heatingRef.current = next; return next;
  });

  const tickModel = (seconds: number) => {
    if (mode === 'cycle') {
      const next = advanceWaterCycle(cycleRef.current, seconds).state; cycleRef.current = next; setCycle(next);
    } else if (mode === 'heating') {
      const current = heatingRef.current;
      const next = heaterOn ? advanceHeating(current, seconds) : { ...current, sample: advanceModelTime(current.sample, seconds) };
      heatingRef.current = next; setHeating(next);
    } else setVisualTime((time) => time + seconds);
  };

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let lastFrame: number | null = null;
    let accumulator = 0;
    const animate = (now: number) => {
      if (lastFrame === null) lastFrame = now;
      accumulator += Math.min(0.05, (now - lastFrame) / 1000) * playbackSpeed;
      lastFrame = now;
      let steps = 0;
      let nextCycle = cycleRef.current;
      let nextHeating = heatingRef.current;
      let visualSeconds = 0;
      while (accumulator >= FIXED_STEP_SECONDS && steps < 60) {
        if (mode === 'cycle') nextCycle = advanceWaterCycle(nextCycle, FIXED_STEP_SECONDS).state;
        else if (mode === 'heating') nextHeating = heaterOn
          ? advanceHeating(nextHeating, FIXED_STEP_SECONDS)
          : { ...nextHeating, sample: advanceModelTime(nextHeating.sample, FIXED_STEP_SECONDS) };
        else visualSeconds += FIXED_STEP_SECONDS;
        accumulator -= FIXED_STEP_SECONDS; steps += 1;
      }
      if (mode === 'cycle' && steps > 0) { cycleRef.current = nextCycle; setCycle(nextCycle); }
      if (mode === 'heating' && steps > 0) { heatingRef.current = nextHeating; setHeating(nextHeating); }
      if (mode !== 'cycle' && mode !== 'heating' && visualSeconds > 0) {
        setVisualTime((time) => time + visualSeconds);
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, playbackSpeed, mode, heaterOn]);

  const selectMode = (next: WaterTopicMode) => {
    if (next === mode) return;
    initializeMode(next);
    onModeChange?.(next);
  };

  const resetCurrent = () => {
    setPlaying(false); setPlayMessage('Experiment reset.'); setVisualTime(0); setShowChallenge(false); setChallengeAnswer(null); setChallengeBaseline(null); setCameraRevision((revision) => revision + 1);
    if (mode === 'cycle') { const state = createWaterCycleState(); cycleRef.current = state; setCycle(state); }
    if (mode === 'heating') { const state = restartHeating(heatingRef.current); heatingRef.current = state; setHeating(state); setHeaterOn(true); }
    if (mode === 'properties') { setWaterTemperatureC(20); setBuoyancy({ shape: 'hollow', massKg: 0.22, volumeMl: 450 }); setSurfacePlacement('unplaced'); setDetergent(false); }
    if (mode === 'density-liquids') { setLiquidSample('water20C'); setLiquidVolumeMl(50); setLiquidVolumeReadingMl(null); setLiquidMassTool('balance'); setLiquidVolumeTool('graduated-cylinder'); setBalanceTared(false); setLiquidLatest(null); setLiquidReadings([]); }
    if (mode === 'density-objects') { setObjectForm(newObjectForm()); setObjectRecords([]); }
  };
  const advanceOneSecond = () => { setPlaying(false); tickModel(1); setPlayMessage('Advanced the model by one second.'); };
  const recoverGraphics = () => { setGraphicsFailed(false); setCanvasReady(false); setCameraRevision((revision) => revision + 1); };
  const tareLiquidBalance = () => {
    if (liquidMassTool !== 'balance') { setPlayMessage('Choose a balance to measure mass; a ruler measures length and a thermometer measures temperature.'); return; }
    setBalanceTared(true); setLiquidLatest(null); setPlayMessage('The empty sample cup is tared at 34.2 g.');
  };
  const readLiquidVolume = () => {
    if (liquidVolumeMl <= 0) { setPlayMessage('Fill the graduated cylinder above zero before reading its meniscus.'); return; }
    const resolution = liquidVolumeTool === 'graduated-cylinder' ? 1 : 10;
    const reading = Math.round(liquidVolumeMl / resolution) * resolution;
    setLiquidVolumeReadingMl(reading); setLiquidLatest(null); setPlayMessage(`${liquidVolumeTool === 'graduated-cylinder' ? 'Cylinder' : 'Beaker'} reading recorded at ${reading} mL (${resolution} mL divisions).`);
  };
  const readLiquidMass = () => {
    if (liquidMassTool !== 'balance') { setPlayMessage('A ruler or thermometer cannot measure mass. Select the electronic balance.'); return; }
    if (!balanceTared || liquidVolumeReadingMl === null || liquidVolumeReadingMl <= 0) { setPlayMessage('Tare the balance and record a non-zero cylinder reading first.'); return; }
    const reading = measureLiquidSample(liquidSample, liquidVolumeReadingMl, 34.2, liquidReadings.length + 1, liquidVolumeMl);
    setLiquidLatest(reading ? { ...reading, massEquipment: 'Electronic balance', volumeEquipment: liquidVolumeTool === 'graduated-cylinder' ? 'Graduated cylinder' : '100 mL beaker', massResolutionG: 0.1, volumeResolutionMl: liquidVolumeTool === 'graduated-cylinder' ? 1 : 10 } : null);
    setPlayMessage(reading ? `Balance reading recorded: ${reading.grossMassG.toFixed(1)} g gross.` : 'This liquid measurement has no valid volume.');
  };
  const recordLiquidMass = () => {
    if (!liquidLatest) return;
    setLiquidReadings((rows) => [...rows, { ...liquidLatest, trial: rows.length + 1 }]);
    setLiquidLatest(null); setPlayMessage('Liquid result added to the comparison table.');
  };

  const currentThermal = thermalStateAtEnergy(heating.sample.energyKJ);
  const displayedThermometerTemperature = thermometerTemperature(currentThermal.temperatureC, heating.thermometer);
  const currentWaterDensity = waterDensityGPerMl(waterTemperatureC);
  const buoyancyResult = calculateBuoyancy(buoyancy.massKg, buoyancy.volumeMl, waterDensityGPerMl(waterTemperatureC) * 1000);
  const surfaceOutcome = surfacePlacement === 'unplaced' ? null : surfaceTensionOutcome(surfacePlacement, detergent);
  const currentObjectVolume = objectForm.shape === 'regular'
    ? regularVolumeCm3(...objectForm.dimensionsCm) ?? 0
    : objectForm.irregularVolumeCm3;
  const measuredObjectVolume = objectForm.shape === 'regular'
    ? objectForm.measuredDimensions ? regularVolumeCm3(...objectForm.measuredDimensions) : null
    : objectForm.finalLevelMl !== null && objectForm.initialLevelMl !== null
      ? displacementVolumeCm3(objectForm.initialLevelMl, objectForm.finalLevelMl)
      : null;
  const objectDensityRef = SOLID_REFERENCE_DENSITIES[objectForm.material];
  const challengeDone = Boolean(showChallenge && challengeBaseline && challengeAnswer === 'right' && (
    mode === 'cycle'
      ? cycle.precipitationOn && challengeBaseline.cycleCloudKg - (cycle.pools.cloudLiquidKg + cycle.pools.cloudIceKg) >= 0.02
      : mode === 'heating'
        ? heating.readings.length - challengeBaseline.heatingReadings >= 4 && heating.readings.slice(challengeBaseline.heatingReadings).some((reading) => Math.abs(reading.referenceTemperatureC) < 0.01 || Math.abs(reading.referenceTemperatureC - 100) < 0.01)
        : mode === 'properties'
          ? propertiesFocus === 'surface' && surfacePlacement === 'gentle' && !detergent && surfaceOutcome?.supported
          : mode === 'density-liquids'
            ? liquidReadings.length - challengeBaseline.liquidReadings >= 2 && new Set(liquidReadings.slice(challengeBaseline.liquidReadings).map((reading) => reading.sample)).size >= 2
            : objectRecords.length - challengeBaseline.objectRecords >= 1
  ));

  const beginChallenge = () => {
    setShowChallenge((current) => !current); setChallengeAnswer(null);
    setChallengeBaseline({ cycleCloudKg: cycle.pools.cloudLiquidKg + cycle.pools.cloudIceKg, heatingReadings: heating.readings.length, liquidReadings: liquidReadings.length, objectRecords: objectRecords.length });
  };
  const chooseStart = (start: HeatingStart) => {
    setPlaying(false);
    setShowChallenge(false); setChallengeAnswer(null); setChallengeBaseline(null);
    const current = heatingRef.current;
    let next = createHeatingExperiment(start);
    const heater = start === 'ice' && current.heater === 'immersion-heater' ? 'hot-plate' : current.heater;
    next = setHeatingEquipment(next, heater);
    next = setThermometer(next, current.thermometer);
    next = setHeatingPower(next, current.powerKW);
    heatingRef.current = next; setHeating(next); setPlayMessage(start === 'ice' ? heater === 'hot-plate' && current.heater === 'immersion-heater' ? 'Started with ice at −20 °C; changed to a hot plate because an immersion heater is for liquid.' : 'Started with ice at −20 °C.' : 'Started with room-temperature liquid water at 22 °C.');
  };
  const setObjectFormAndClear = (patch: Partial<ObjectForm>) => setObjectForm((current) => ({
    ...current, ...patch, massG: null, measuredDimensions: null, initialLevelMl: null, submerged: false, station: 'bench', finalLevelMl: null, result: null,
  }));
  const tareObjectScale = () => { setObjectForm((current) => ({ ...current, tared: true, massG: null, result: null })); setPlayMessage('Balance tared with the empty pan.'); };
  const weighObject = () => {
    if (!objectForm.tared) { setPlayMessage('Tare the balance first.'); return; }
    const exactMass = objectDensityRef.densityGPerCm3 * currentObjectVolume;
    const mass = simulatedBalanceReading(exactMass, 0.1);
    setObjectForm((current) => ({ ...current, massG: mass, station: 'pan', result: null })); setPlayMessage(`Sample mass recorded: ${mass?.toFixed(1)} g.`);
  };
  const readObjectDimensions = () => { setObjectForm((current) => ({ ...current, measuredDimensions: [...current.dimensionsCm], station: current.station === 'pan' ? 'bench' : current.station, result: null })); setPlayMessage('Ruler readings recorded.'); };
  const readCylinderStart = () => { setObjectForm((current) => ({ ...current, initialLevelMl: 50, submerged: false, station: current.station === 'cylinder' ? 'bench' : current.station, finalLevelMl: null, result: null })); setPlayMessage('Initial meniscus recorded: 50 mL.'); };
  const submergeObject = () => { setObjectForm((current) => ({ ...current, submerged: true, station: 'cylinder', finalLevelMl: null, result: null })); setPlayMessage('Sample lowered fully below the water surface.'); };
  const readCylinderEnd = () => {
    if (!objectForm.submerged || objectForm.initialLevelMl === null) { setPlayMessage('Record the initial level and submerge the sample first.'); return; }
    const level = objectForm.initialLevelMl + currentObjectVolume;
    setObjectForm((current) => ({ ...current, finalLevelMl: level, result: null })); setPlayMessage(`Final meniscus recorded: ${level.toFixed(1)} mL.`);
  };
  const calculateObjectResult = () => {
    if (objectForm.massG === null || measuredObjectVolume === null) { setPlayMessage('Complete the mass and volume measurements first.'); return; }
    const result = calculateSolidDensity(objectForm.massG, measuredObjectVolume);
    if (!result) { setPlayMessage('Density needs a positive measured volume.'); return; }
    setObjectForm((current) => ({ ...current, result: { volumeCm3: measuredObjectVolume, densityGPerCm3: result.gPerCm3, densityKgPerM3: result.kgPerM3 } }));
    setPlayMessage(`Calculated density: ${result.gPerCm3.toFixed(2)} g/cm³.`);
  };
  const recordObjectResult = () => {
    if (!objectForm.result || objectForm.massG === null) return;
    setObjectRecords((records) => [...records, {
      trial: records.length + 1, shape: objectForm.shape === 'regular' ? 'Regular block' : 'Irregular sample', material: objectDensityRef.name,
      massG: objectForm.massG!, volumeCm3: objectForm.result!.volumeCm3, densityGPerCm3: objectForm.result!.densityGPerCm3,
      densityKgPerM3: objectForm.result!.densityKgPerM3, referenceGPerCm3: objectDensityRef.densityGPerCm3, referenceConditions: objectDensityRef.conditions,
    }]);
    setPlayMessage('Calculated result added to the comparison table.');
  };

  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input,select,textarea,button')) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); }
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); advanceOneSecond(); }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); resetCurrent(); }
  };

  const activeMeta = MODE_META.find((entry) => entry.id === mode) ?? MODE_META[0];
  const modeDescription: Record<WaterTopicMode, string> = {
    cycle: 'Follow the same water through ocean, air, clouds, land and ice.',
    heating: 'Choose equipment, heat the model sample and record temperature against model time.',
    properties: 'Investigate density, buoyancy and surface tension as separate properties.',
    'density-liquids': 'Tare a balance, measure a liquid volume and compare your result with SI references.',
    'density-objects': 'Measure mass and either regular dimensions or displaced water volume.',
  };

  const saveCsv = () => {
    if (heating.readings.length === 0) return;
    const rows = [['trial', 'model_time_s', 'thermometer_temperature_C', 'model_temperature_C', 'phase']];
    heating.readings.forEach((reading) => rows.push([`${reading.trial}`, reading.timeSeconds.toFixed(2), `${reading.temperatureC}`, `${reading.referenceTemperatureC.toFixed(2)}`, `"${reading.phaseLabel.replaceAll('"', '""')}"`]));
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `water-heating-trial-${heating.trial}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const currentLiquidMeasurement = liquidLatest;
  const currentTare = 34.2;
  const liquidReference = LIQUID_REFERENCE_DENSITIES[liquidSample];
  const cyclePools = cycle.pools;
  const canUse3d = !graphicsFailed && canvasReady;

  return <section ref={rootRef} className="water-topic-lab" data-reduced-motion={reducedMotion ? 'true' : 'false'} tabIndex={0} onKeyDown={keyboard} aria-label="Water investigations">
    <header className="wt-header">
      <div className="wt-title-lockup"><span className="wt-title-mark"><Droplets size={23} /></span><div><span className="wt-eyebrow">MATTERLAB · WATER INVESTIGATIONS</span><h1>{activeMeta.name}</h1><p>{modeDescription[mode]}</p></div></div>
      <div className="wt-water-total"><span className="wt-water-live"/><span>MODEL SAMPLE</span><b>{mode === 'cycle' ? `${totalCycleWaterKg(cyclePools).toFixed(2)} kg` : mode === 'heating' ? `${(SAMPLE_MASS_KG * 1000).toFixed(0)} g` : 'LIVE MEASUREMENTS'}</b></div>
    </header>

    <nav className="wt-mode-tabs" aria-label="Choose a water investigation">
      {MODE_META.map(({ id, name, outcome, icon: Icon }) => <button key={id} type="button" onClick={() => selectMode(id)} className={`wt-mode-tab ${mode === id ? 'active' : ''}`} aria-pressed={mode === id}>
        <Icon size={18} /><span><b>{name}</b><small>{outcome}</small></span><ChevronRight className="wt-tab-chevron" size={15} />
      </button>)}
    </nav>

    <div className="wt-workspace">
      <section className="wt-stage-card" aria-label="Interactive 3D water apparatus">
        <div className="wt-stage-heading"><div><span className="wt-section-label">LIVE MODEL</span><h2>{activeMeta.name}</h2></div><span className="wt-stage-chip">{mode === 'cycle' ? 'TRACKED WATER CYCLE' : mode === 'heating' ? 'THERMAL ENERGY MODEL' : mode === 'properties' ? 'THREE PROPERTY INVESTIGATIONS' : 'MEASUREMENT APPARATUS'}</span></div>
        <div className="wt-scene-wrap" data-graphics={canUse3d ? 'ready' : graphicsFailed ? 'fallback' : 'starting'}>
          {!graphicsFailed && <WaterCanvas key={cameraRevision} mode={mode} cycle={cycle} heating={heating} heaterOn={heaterOn} propertiesFocus={propertiesFocus} waterTemperatureC={waterTemperatureC} buoyancy={buoyancy} surfacePlacement={surfacePlacement} detergent={detergent} liquidSample={liquidSample} liquidVolumeMl={liquidVolumeMl} liquidMassG={currentLiquidMeasurement?.netMassG ?? null} liquidBalanceTared={balanceTared} objectForm={objectForm} objectVolumeCm3={currentObjectVolume} visualTime={visualTime} showMolecules={showMolecules} reducedMotion={reducedMotion} resetId={cameraRevision} onReady={() => { setCanvasReady(true); setGraphicsFailed(false); }} onFailure={() => { setGraphicsFailed(true); setCanvasReady(false); }} />}
          {graphicsFailed && <WaterFallback mode={mode} cycle={cycle} heating={heating} focus={propertiesFocus} temperatureC={waterTemperatureC} liquidSample={liquidSample} liquidVolumeMl={liquidVolumeMl} objectForm={objectForm} visualTime={visualTime} showMolecules={showMolecules} />}
          {mode === 'cycle' && !graphicsFailed && <ul className="wt-cycle-legend" aria-label="Clouds compared with water vapour">
            <li><i className="swatch cloud"/><span><b>Cloud</b> tiny liquid droplets and ice crystals. You can see it.</span></li>
            <li><i className="swatch vapour"/><span><b>Water vapour</b> a gas. Invisible; faint molecules only in particle view.</span></li>
          </ul>}
          {graphicsFailed && <button className="wt-retry-graphics" type="button" onClick={recoverGraphics}>Retry 3D view</button>}
        </div>
        <div className="wt-stage-summary">
          <div className="wt-scene-hud">
            {mode === 'cycle' && <><span className="wt-hud-number">{formatMassKg(CYCLE_WATER_MASS_KG)}</span><span><b>Tracked water</b><small>All pools conserve the same sample</small></span></>}
            {mode === 'heating' && <><span className="wt-hud-number hot">{formatTemp(displayedThermometerTemperature)}</span><span><b>{heating.thermometer === 'digital-probe' ? 'Digital probe' : 'Glass thermometer'}</b><small>{currentThermal.phaseLabel.split(' · ')[0]} · {formatClock(heating.sample.modelTimeSeconds)} model time</small></span></>}
            {mode === 'properties' && <><span className="wt-hud-number">{propertiesFocus === 'density' ? `${(currentWaterDensity * 1000).toFixed(1)}` : propertiesFocus === 'buoyancy' ? `${buoyancyResult?.behavior ?? '—'}` : surfacePlacement === 'unplaced' ? 'Ready' : surfaceOutcome?.supported ? 'Supported' : 'Sinks'}</span><span><b>{propertiesFocus === 'density' ? 'Water density · kg/m³' : propertiesFocus === 'buoyancy' ? 'Buoyancy result' : 'Surface experiment'}</b><small>{propertiesFocus === 'density' ? `Water at ${formatTemp(waterTemperatureC)}` : propertiesFocus === 'buoyancy' ? `${(buoyancy.massKg * 1000).toFixed(0)} g · ${buoyancy.volumeMl.toFixed(0)} mL outer volume` : 'Surface tension is a qualitative model'}</small></span></>}
            {mode === 'density-liquids' && <><span className="wt-hud-number">{currentLiquidMeasurement ? currentLiquidMeasurement.calculatedKgPerM3.toFixed(1) : '—'}</span><span><b>{currentLiquidMeasurement ? 'Calculated density · kg/m³' : 'Measure your sample'}</b><small>{balanceTared ? `Tare ${currentTare.toFixed(1)} g · ${liquidVolumeReadingMl ?? '—'} mL measured` : 'Tare the balance to begin weighing'}</small></span></>}
            {mode === 'density-objects' && <><span className="wt-hud-number">{objectForm.result ? objectForm.result.densityKgPerM3.toFixed(0) : '—'}</span><span><b>Calculated density · kg/m³</b><small>{objectForm.shape === 'regular' ? 'Measure dimensions with a ruler' : 'Measure displacement in a graduated cylinder'}</small></span></>}
          </div>
          <div className="wt-scene-legend"><span><i className="oxygen-dot"/> O</span><span><i className="hydrogen-dot"/> H</span><span>H₂O identity stays the same</span></div>
        </div>
        <div className="wt-stage-tools">
          <div className="wt-play-controls"><button type="button" className="wt-play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause water model' : 'Play water model'}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}<span>{playing ? 'Pause' : 'Play'}</span></button><button type="button" className="wt-tool-button" onClick={advanceOneSecond} aria-label="Advance model one second"><StepForward size={17}/><span>Step</span></button><button type="button" className="wt-tool-button" onClick={resetCurrent} aria-label="Reset this investigation"><RotateCcw size={17}/><span>Reset</span></button><button type="button" className="wt-tool-icon" onClick={() => setCameraRevision((revision) => revision + 1)} aria-label="Reset camera view" title="Reset camera"><Anchor size={17}/></button></div>
          <div className="wt-tool-right"><label className="wt-speed-control"><span>Playback factor</span><select aria-label="Playback speed" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={4}>4×</option><option value={10}>10×</option><option value={20}>20×</option></select></label><button type="button" className={`wt-molecule-toggle ${showMolecules ? 'active' : ''}`} aria-pressed={showMolecules} onClick={() => setShowMolecules((value) => !value)}><span className="wt-mini-molecule"/>{showMolecules ? 'Particles on' : 'Particles off'}</button></div>
        </div>
        <p className="wt-live-message" aria-live="polite">{playMessage || (playing ? 'The model is playing. Readings use model time and heater power.' : 'Ready to investigate. Use the controls and record your own observations.')}</p>
      </section>
      <aside className="wt-controls-card" aria-label={`${activeMeta.name} controls`}>
        <div className="wt-controls-heading"><div><span className="wt-section-label">INVESTIGATE</span><h2>{mode === 'cycle' ? 'Change the conditions' : mode === 'heating' ? 'Set up a heating trial' : mode === 'properties' ? 'Choose a property' : mode === 'density-liquids' ? 'Measure a liquid' : 'Measure an object'}</h2></div><button type="button" className="wt-info-button" aria-label={showDetails ? 'Hide model notes' : 'Show model notes'} aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}><Info size={18}/></button></div>
        <p className="wt-control-intro">{modeDescription[mode]}</p>

        {mode === 'cycle' && <div className="wt-control-section">
          <div className="wt-mini-kicker">WEATHER CONDITIONS</div>
          <label className="wt-range-control"><span><b>Sun heating</b><output>{Math.round(cycle.sunPercent)}%</output></span><input aria-label="Sun heating" type="range" min="0" max="100" step="1" value={cycle.sunPercent} onChange={(event) => { const value = Number(event.currentTarget.value); updateCycle((current) => setCycleConditions(current, { sunPercent: value })); }}/><span className="wt-range-ends"><small>Low sunlight</small><small>Strong sunlight</small></span></label>
          <label className="wt-range-control"><span><b>Air temperature</b><output>{formatTemp(cycle.airTemperatureC)}</output></span><input aria-label="Air temperature" type="range" min="-20" max="35" step="1" value={cycle.airTemperatureC} onChange={(event) => { const value = Number(event.currentTarget.value); updateCycle((current) => setCycleConditions(current, { airTemperatureC: value })); }}/><span className="wt-range-ends"><small>Colder</small><small>Warmer</small></span></label>
          <label className="wt-range-control"><span><b>Nearby air humidity</b><output>{Math.round(cycle.humidityPercent)}%</output></span><input aria-label="Nearby air humidity" type="range" min="0" max="100" step="1" value={cycle.humidityPercent} onChange={(event) => { const value = Number(event.currentTarget.value); updateCycle((current) => setCycleConditions(current, { humidityPercent: value })); }}/><span className="wt-range-ends"><small>Drier</small><small>More humid</small></span></label>
          <button type="button" className={`wt-rain-toggle ${cycle.precipitationOn ? 'on' : ''}`} aria-pressed={cycle.precipitationOn} onClick={() => updateCycle((current) => setCycleConditions(current, { precipitationOn: !current.precipitationOn }))}><CloudRain size={18}/><span>{cycle.precipitationOn ? 'Pause precipitation' : 'Start precipitation'}</span><small>{cycle.airTemperatureC <= 0 ? 'snow / ice' : 'rain'}</small></button>
          <p className="wt-hint-box"><Cloud size={15}/> Clouds contain tracked liquid droplets or ice crystals. Water vapour is a separate, invisible atmosphere pool.</p>
          <div className="wt-pool-ledger"><div className="wt-pool-heading"><b>Water reservoirs</b><span>{totalCycleWaterKg(cyclePools).toFixed(2)} kg total</span></div>{POOL_LABELS.map(([key, label, color, phase]) => <div key={key} className="wt-pool-row"><div><i style={{ backgroundColor: color }}/><span>{label}<em className={`wt-phase-tag ${phase}`}>{phase}</em></span><b>{formatMassKg(cyclePools[key])}</b></div><div className="wt-pool-track"><span style={{ width: `${clamp(cyclePools[key] / CYCLE_WATER_MASS_KG * 100, 0, 100)}%`, backgroundColor: color }}/></div></div>)}</div>
        </div>}

        {mode === 'heating' && <div className="wt-control-section">
          <div className="wt-mini-kicker">CHOOSE A STARTING SAMPLE</div>
          <div className="wt-segmented"><button type="button" className={heating.start === 'ice' ? 'selected' : ''} aria-pressed={heating.start === 'ice'} onClick={() => chooseStart('ice')}><Snowflake size={17}/><span>Ice</span><small>−20 °C</small></button><button type="button" className={heating.start === 'room-water' ? 'selected' : ''} aria-pressed={heating.start === 'room-water'} onClick={() => chooseStart('room-water')}><Droplets size={17}/><span>Room water</span><small>22 °C</small></button></div>
          <label className="wt-select-label"><span>Heating equipment</span><select aria-label="Heating equipment" value={heating.heater} onChange={(event) => { const heater = event.currentTarget.value as HeatingExperiment['heater']; updateHeating((current) => setHeatingEquipment(current, heater)); }}><option value="hot-plate">Electric hot plate · ice or liquid</option><option value="immersion-heater" disabled={heating.start === 'ice'}>Immersion heater · liquid water only</option></select></label>
          <label className="wt-select-label"><span>Thermometer</span><select aria-label="Thermometer" value={heating.thermometer} onChange={(event) => { const thermometer = event.currentTarget.value as HeatingExperiment['thermometer']; updateHeating((current) => setThermometer(current, thermometer)); }}><option value="digital-probe">Digital probe · 0.1 °C display</option><option value="glass-thermometer">Glass thermometer · 1 °C scale</option></select></label>
          <label className="wt-range-control"><span><b>Heater power</b><output>{heating.powerKW.toFixed(1)} kW</output></span><input aria-label="Heater power" type="range" min="0.1" max={heating.heater === 'hot-plate' ? 2 : 1.5} step="0.1" value={heating.powerKW} onChange={(event) => { const value = Number(event.currentTarget.value); updateHeating((current) => setHeatingPower(current, value)); }}/><span className="wt-range-ends"><small>Gentle heating</small><small>Stronger heating</small></span></label>
          <button type="button" className={`wt-heat-source ${heaterOn ? 'on' : ''}`} aria-pressed={heaterOn} onClick={() => setHeaterOn((value) => !value)}><FlaskConical size={18}/><span>{heaterOn ? 'Heater on' : 'Heater off'}</span><small>{heaterOn ? 'power enters the sample' : 'clock continues; temperature holds'}</small></button>
          <button type="button" className="wt-primary-action" onClick={() => updateHeating((current) => recordHeatingReading(current))}><Thermometer size={18}/>Record thermometer reading</button>
          <p className="wt-hint-box"><Info size={15}/>{heating.start === 'ice' && heating.heater === 'hot-plate' ? 'The hot plate is the appropriate source for an ice-start trial. ' : ''}Playback factor speeds up the view; recorded model seconds and the 0 °C / 100 °C latent-heat plateaux follow the core fixed-pressure model.</p>
          <div className="wt-energy-readout"><span>Model time</span><b>{heating.sample.modelTimeSeconds.toFixed(1)} s</b><span>Model energy</span><b>{heating.sample.energyKJ.toFixed(1)} kJ</b></div>
        </div>}

        {mode === 'properties' && <div className="wt-control-section">
          <div className="wt-property-tabs" role="group" aria-label="Choose a water property">{([{ id: 'density', label: 'Density', icon: Gauge }, { id: 'buoyancy', label: 'Buoyancy', icon: Waves }, { id: 'surface', label: 'Surface tension', icon: Droplets }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" className={propertiesFocus === id ? 'selected' : ''} aria-pressed={propertiesFocus === id} onClick={() => { setPropertiesFocus(id); setSurfacePlacement('unplaced'); setDetergent(false); }}><Icon size={16}/><span>{label}</span></button>)}</div>
          {propertiesFocus === 'density' && <>
            <label className="wt-range-control"><span><b>Water temperature</b><output>{formatTemp(waterTemperatureC)}</output></span><input aria-label="Water temperature for density" type="range" min="0" max="60" step="1" value={waterTemperatureC} onChange={(event) => setWaterTemperatureC(Number(event.currentTarget.value))}/><span className="wt-range-ends"><small>0 °C</small><small>60 °C</small></span></label>
            <div className="wt-property-reading"><span>Interpolated reference density</span><b>{(currentWaterDensity * 1000).toFixed(2)} kg/m³</b><small>{currentWaterDensity.toFixed(5)} g/mL · rounded USGS table values</small></div>
            <div className="wt-density-compare"><div><span>0 °C</span><b>{(waterDensityGPerMl(0) * 1000).toFixed(1)} kg/m³</b></div><div className="peak"><span>4 °C · highest</span><b>{(waterDensityGPerMl(4) * 1000).toFixed(1)} kg/m³</b></div><div><span>20 °C</span><b>{(waterDensityGPerMl(20) * 1000).toFixed(1)} kg/m³</b></div></div>
            <p className="wt-hint-box"><Droplets size={15}/> Pure water is densest near 4 °C. The temperature curve uses piecewise interpolation through the cited rounded reference table.</p>
          </>}
          {propertiesFocus === 'buoyancy' && <>
            <div className="wt-segmented two"><button type="button" className={buoyancy.shape === 'solid' ? 'selected' : ''} aria-pressed={buoyancy.shape === 'solid'} onClick={() => setBuoyancy((value) => ({ ...value, shape: 'solid' }))}>Solid block</button><button type="button" className={buoyancy.shape === 'hollow' ? 'selected' : ''} aria-pressed={buoyancy.shape === 'hollow'} onClick={() => setBuoyancy((value) => ({ ...value, shape: 'hollow' }))}>Hollow boat</button></div>
            <label className="wt-range-control"><span><b>{buoyancy.shape === 'hollow' ? 'Total mass incl. cargo' : 'Object mass'}</b><output>{(buoyancy.massKg * 1000).toFixed(0)} g</output></span><input aria-label="Object mass for buoyancy" type="range" min="0.05" max="0.75" step="0.01" value={buoyancy.massKg} onChange={(event) => { const massKg = Number(event.currentTarget.value); setBuoyancy((value) => ({ ...value, massKg })); }}/><span className="wt-range-ends"><small>Lighter</small><small>Heavier</small></span></label>
            <label className="wt-range-control"><span><b>Outside displaced volume</b><output>{buoyancy.volumeMl} mL</output></span><input aria-label="Outside displaced volume" type="range" min="100" max="900" step="10" value={buoyancy.volumeMl} onChange={(event) => { const volumeMl = Number(event.currentTarget.value); setBuoyancy((value) => ({ ...value, volumeMl })); }}/><span className="wt-range-ends"><small>Smaller</small><small>Larger</small></span></label>
            <div className="wt-property-reading"><span>Observed behaviour</span><b>{buoyancyResult?.behavior === 'neutral' ? 'Neutral buoyancy' : buoyancyResult?.floats ? 'Floats' : 'Sinks'}</b><span>Average object density</span><b>{buoyancyResult?.objectDensityKgM3.toFixed(0)} kg/m³</b><small>{buoyancyResult?.behavior === 'neutral' ? 'At equal density the object remains fully immersed without rising or sinking.' : buoyancyResult?.floats ? 'Displaced water balances the weight before full immersion.' : 'Object weight exceeds buoyant force at full immersion.'}</small></div>
            <div className="wt-force-compare"><span>Object weight <b>{buoyancyResult?.weightN.toFixed(2)} N</b></span><span>Maximum buoyancy <b>{buoyancyResult?.maximumBuoyantForceN.toFixed(2)} N</b></span></div>
            <p className="wt-hint-box"><Anchor size={15}/> Buoyancy depends on displaced liquid. A hollow boat’s outer volume includes trapped air; mass alone does not decide whether it sinks.</p>
          </>}
          {propertiesFocus === 'surface' && <>
            <p className="wt-experiment-prompt">Test a dense paperclip at the surface, then compare pushing it under with adding detergent.</p>
            <div className="wt-action-pair"><button type="button" className="wt-secondary-action" onClick={() => setSurfacePlacement('gentle')}><Waves size={17}/>Place gently</button><button type="button" className="wt-secondary-action" onClick={() => setSurfacePlacement('push-under')}><ArrowDown size={17}/>Push below</button></div>
            <button type="button" className={`wt-heat-source ${detergent ? 'on' : ''}`} aria-pressed={detergent} onClick={() => { setDetergent((value) => !value); setSurfacePlacement('gentle'); }}><Droplets size={18}/><span>{detergent ? 'Detergent added' : 'Add a detergent drop'}</span><small>changes the qualitative surface support</small></button>
            <div className={`wt-property-reading ${surfaceOutcome?.supported ? 'success' : ''}`}><span>Observation</span><b>{surfacePlacement === 'unplaced' ? 'Choose a placement action' : surfaceOutcome?.supported ? 'Paperclip stays at the surface' : 'Paperclip passes through and sinks'}</b><small>It is denser than water: this surface trial is distinct from buoyancy.</small></div>
            <p className="wt-hint-box"><Info size={15}/> Detergent and placement alter an illustrative surface-tension outcome; the model reports no calibrated force.</p>
          </>}
        </div>}

        {mode === 'density-liquids' && <div className="wt-control-section">
          <div className="wt-mini-kicker">SELECT THE LIQUID SAMPLE</div>
          <label className="wt-select-label"><span>Sample</span><select aria-label="Liquid sample" value={liquidSample} onChange={(event) => { setLiquidSample(event.target.value as LiquidSampleId); setLiquidLatest(null); setLiquidVolumeReadingMl(null); }}><option value="water20C">Pure water · 20 °C</option><option value="ethanol20C">Pure ethanol · 20 °C</option></select></label>
          <div className="wt-equipment-selects"><label className="wt-select-label"><span>Mass tool</span><select aria-label="Mass measuring equipment" value={liquidMassTool} onChange={(event) => { setLiquidMassTool(event.target.value as typeof liquidMassTool); setBalanceTared(false); setLiquidLatest(null); }}><option value="balance">Electronic balance · 0.1 g</option><option value="ruler">Ruler · length only</option><option value="thermometer">Thermometer · temperature only</option></select></label><label className="wt-select-label"><span>Volume tool</span><select aria-label="Volume measuring equipment" value={liquidVolumeTool} onChange={(event) => { setLiquidVolumeTool(event.target.value as typeof liquidVolumeTool); setLiquidVolumeReadingMl(null); setLiquidLatest(null); }}><option value="graduated-cylinder">Graduated cylinder · 1 mL</option><option value="beaker">100 mL beaker · coarse 10 mL</option></select></label></div>
          <label className="wt-range-control"><span><b>Sample fill setting</b><output>{liquidVolumeMl} mL</output></span><input aria-label="Liquid sample volume" type="range" min="0" max="100" step="1" value={liquidVolumeMl} onChange={(event) => { setLiquidVolumeMl(Number(event.target.value)); setLiquidVolumeReadingMl(null); setLiquidLatest(null); }}/><span className="wt-range-ends"><small>Empty</small><small>100 mL</small></span></label>
          {liquidMassTool !== 'balance' && <p className="wt-device-warning">A {liquidMassTool} cannot measure mass. Select the electronic balance to enable taring and weighing.</p>}
          <button type="button" className={`wt-secondary-action full ${balanceTared ? 'done' : ''}`} aria-pressed={balanceTared} disabled={liquidMassTool !== 'balance'} onClick={tareLiquidBalance}><Scale size={17}/>{balanceTared ? 'Balance tared · empty cup 34.2 g' : liquidMassTool === 'balance' ? 'Tare empty sample cup' : 'Select a balance to tare'}</button>
          <button type="button" className="wt-secondary-action full" disabled={liquidVolumeMl <= 0} onClick={readLiquidVolume}><Ruler size={17}/>{liquidVolumeReadingMl === null ? `Read ${liquidVolumeTool === 'graduated-cylinder' ? 'cylinder' : 'beaker'} volume` : `Volume recorded · ${liquidVolumeReadingMl} mL`}</button>
          <button type="button" className="wt-primary-action" disabled={liquidMassTool !== 'balance' || !balanceTared || liquidVolumeReadingMl === null || liquidVolumeReadingMl <= 0} onClick={readLiquidMass}><Scale size={17}/>Read sample mass</button>
          {currentLiquidMeasurement && <div className="wt-measurement-result"><span>Gross balance reading</span><b>{currentLiquidMeasurement.grossMassG.toFixed(1)} g</b><span>Net liquid mass</span><b>{currentLiquidMeasurement.netMassG.toFixed(1)} g</b><span>Calculated density</span><b>{currentLiquidMeasurement.calculatedGPerMl.toFixed(4)} g/mL</b><small>{currentLiquidMeasurement.calculatedKgPerM3.toFixed(1)} kg/m³ · reference {currentLiquidMeasurement.referenceKgPerM3.toFixed(1)} kg/m³</small><button type="button" onClick={recordLiquidMass}><Check size={16}/>Record this result</button></div>}
          <p className="wt-hint-box"><Info size={15}/> This virtual balance rounds to 0.1 g and the cylinder to whole millilitres. Both are declared teaching-equipment resolutions.</p>
          <div className="wt-reference-note"><b>Reference conditions</b><span>{liquidReference.conditions}</span><span>Balance resolution {currentLiquidMeasurement?.massResolutionG ?? 0.1} g · volume-tool division {currentLiquidMeasurement?.volumeResolutionMl ?? (liquidVolumeTool === 'graduated-cylinder' ? 1 : 10)} mL</span></div>
        </div>}

        {mode === 'density-objects' && <div className="wt-control-section">
          <div className="wt-mini-kicker">CHOOSE A VOLUME METHOD</div>
          <div className="wt-segmented two"><button type="button" className={objectForm.shape === 'regular' ? 'selected' : ''} aria-pressed={objectForm.shape === 'regular'} onClick={() => setObjectFormAndClear({ shape: 'regular' })}><Ruler size={16}/>Regular object</button><button type="button" className={objectForm.shape === 'irregular' ? 'selected' : ''} aria-pressed={objectForm.shape === 'irregular'} onClick={() => setObjectFormAndClear({ shape: 'irregular' })}><Droplets size={16}/>Irregular object</button></div>
          <label className="wt-select-label"><span>Hidden sample reference</span><select aria-label="Object sample type" value={objectForm.material} onChange={(event) => setObjectFormAndClear({ material: event.target.value as SolidMaterialId })}><option value="aluminum">Sample A · typical aluminium</option><option value="brass">Sample B · brass</option></select></label>
          {objectForm.shape === 'regular' && <>
            <div className="wt-dimension-sliders">{(['Length', 'Width', 'Height'] as const).map((name, index) => <label key={name} className="wt-range-control"><span><b>{name}</b><output>{objectForm.dimensionsCm[index]} cm</output></span><input aria-label={`${name} in centimetres`} type="range" min="1" max="5" step="0.5" value={objectForm.dimensionsCm[index]} onChange={(event) => { const dimensions = [...objectForm.dimensionsCm] as [number, number, number]; dimensions[index] = Number(event.target.value); setObjectFormAndClear({ dimensionsCm: dimensions }); }}/></label>)}</div>
            <button type="button" className="wt-secondary-action full" onClick={readObjectDimensions}><Ruler size={17}/>{objectForm.measuredDimensions ? 'Dimensions measured' : 'Measure three sides with the ruler'}</button>
          </>}
          {objectForm.shape === 'irregular' && <>
            <p className="wt-experiment-prompt">The irregular specimen has no marked volume. Determine it from the cylinder-level change.</p>
            <button type="button" className="wt-secondary-action full" onClick={readCylinderStart}><Ruler size={17}/>{objectForm.initialLevelMl === null ? 'Read initial meniscus (50 mL)' : `Initial level · ${objectForm.initialLevelMl} mL`}</button>
            <button type="button" className="wt-secondary-action full" disabled={objectForm.initialLevelMl === null} onClick={submergeObject}><Droplets size={17}/>{objectForm.submerged ? 'Sample fully submerged' : 'Lower sample into water'}</button>
            <button type="button" className="wt-secondary-action full" disabled={!objectForm.submerged} onClick={readCylinderEnd}><Ruler size={17}/>{objectForm.finalLevelMl === null ? 'Read final meniscus' : `Final level · ${objectForm.finalLevelMl.toFixed(1)} mL`}</button>
          </>}
          <button type="button" className={`wt-secondary-action full ${objectForm.tared ? 'done' : ''}`} aria-pressed={objectForm.tared} onClick={tareObjectScale}><Scale size={17}/>{objectForm.tared ? 'Balance tared' : 'Tare the balance'}</button>
          <button type="button" className="wt-primary-action" disabled={!objectForm.tared} onClick={weighObject}><Scale size={17}/>{objectForm.massG === null ? 'Weigh the sample' : `Measured mass · ${objectForm.massG.toFixed(1)} g`}</button>
          <button type="button" className="wt-primary-action calculate" disabled={objectForm.massG === null || measuredObjectVolume === null} onClick={calculateObjectResult}><Gauge size={17}/>Calculate density</button>
          {objectForm.result && <div className="wt-measurement-result"><span>Measured volume</span><b>{objectForm.result.volumeCm3.toFixed(1)} cm³</b><span>Calculated density</span><b>{objectForm.result.densityGPerCm3.toFixed(2)} g/cm³</b><b>{objectForm.result.densityKgPerM3.toFixed(0)} kg/m³</b><small>Reference · {objectDensityRef.densityGPerCm3.toFixed(objectForm.material === 'brass' ? 4 : 1)} g/cm³ · {objectDensityRef.conditions}</small><button type="button" onClick={recordObjectResult}><Check size={16}/>Record table row</button></div>}
          <p className="wt-hint-box"><Info size={15}/> 1 mL equals 1 cm³. For an irregular specimen, volume is final level − initial level; density = mass ÷ volume.</p>
        </div>}

        {showDetails && <div className="wt-model-details"><Info size={16}/><p>{mode === 'cycle' ? 'This bounded teaching cycle moves one tracked kilogram between water reservoirs. It is not a live or predictive weather model.' : mode === 'heating' ? 'The heater model uses ordinary kW power and the existing ideal pure-water energy engine near 1 atm. The playback factor controls how quickly fixed model-time steps are shown.' : mode === 'properties' ? 'Water density uses interpolated reference values; buoyancy uses displaced-liquid weight. Surface tension is shown as a separate qualitative boundary effect.' : mode === 'density-liquids' ? 'Measured mass comes from the selected 20 °C reference sample, then is rounded to the displayed balance resolution. The volume reading is student-confirmed.' : 'Mass readings use a 0.1 g virtual balance. Regular volume uses l × w × h; irregular volume uses displaced water.'}</p></div>}

        <div className="wt-optional-challenge"><button type="button" className="wt-challenge-launch" onClick={beginChallenge}><Sparkles size={17}/>{showChallenge ? 'Close optional challenge' : 'Try an optional challenge'}<ChevronRight size={16}/></button>
          {showChallenge && <div className="wt-challenge-card"><div className="wt-challenge-title"><span>QUICK CHALLENGE</span>{challengeDone && <b><Check size={14}/> explored</b>}</div>
            <p>{mode === 'cycle' ? 'What form of water must form before rain or snow returns it to the land?' : mode === 'heating' ? 'Record at least four temperatures, including one reading on a 0 °C or 100 °C phase-change plateau.' : mode === 'properties' ? 'What lets a dense paperclip rest on the water surface when it is placed gently?' : mode === 'density-liquids' ? 'Compare measured water and ethanol densities in one table.' : 'Measure and record a density for one regular or irregular sample.'}</p>
            {(mode === 'cycle' || mode === 'properties') && <div className="wt-challenge-options"><button type="button" className={challengeAnswer === 'right' ? 'picked' : ''} aria-pressed={challengeAnswer === 'right'} onClick={() => setChallengeAnswer('right')}>{mode === 'cycle' ? 'Cloud droplets or ice crystals' : 'Surface tension'}</button><button type="button" className={challengeAnswer === 'wrong' ? 'picked' : ''} aria-pressed={challengeAnswer === 'wrong'} onClick={() => setChallengeAnswer('wrong')}>{mode === 'cycle' ? 'Invisible vapour falls directly' : 'Its average density is lower'}</button></div>}
            {mode === 'cycle' && challengeAnswer === 'right' && !challengeDone && <small>Good prediction. Start precipitation and let the tracked cloud water reach the land.</small>}
            {mode === 'properties' && challengeAnswer === 'right' && !challengeDone && <small>Good prediction. Select Surface tension and place the clip gently in water.</small>}
            {mode === 'heating' && !challengeDone && <small>Use the thermometer reading button after the model reaches a plateau.</small>}
            {mode === 'density-liquids' && !challengeDone && <small>Tare, measure, then record one water sample and one ethanol sample.</small>}
            {mode === 'density-objects' && !challengeDone && <small>Complete an actual mass and volume measurement, then record the calculated result.</small>}
            {challengeAnswer === 'wrong' && <small className="wt-challenge-feedback">Try again after checking which state is visible and measurable.</small>}
          </div>}
        </div>
      </aside>
    </div>

    {mode === 'heating' && <section className="wt-results-panel" aria-label="Heating trial graph and readings">
      <div className="wt-results-heading"><div><span className="wt-section-label">YOUR INVESTIGATION</span><h2>Temperature versus model time</h2></div><div className="wt-results-actions"><span>Trial {heating.trial} · exact model-time seconds</span><button type="button" className="wt-secondary-action" disabled={heating.readings.length === 0} onClick={saveCsv}><Download size={16}/>Download CSV</button></div></div>
      <div className="wt-results-grid"><div className="wt-graph-card"><HeatingGraph experiment={heating}/><div className="wt-graph-legend"><span><i/> Recorded thermometer readings</span><span><i className="live"/> Current model reading</span></div></div>
        <div className="wt-table-card"><div className="wt-table-heading"><b>Recorded readings</b><span>{heating.readings.length} entries</span></div><div className="wt-table-scroll"><table><thead><tr><th>Trial</th><th>Time (s)</th><th>Temp (°C)</th><th>Model phase</th></tr></thead><tbody>{heating.readings.map((reading, index) => <tr key={`${reading.trial}-${index}`}><td>{reading.trial}</td><td>{reading.timeSeconds.toFixed(1)}</td><td>{reading.temperatureC.toFixed(heating.thermometer === 'digital-probe' ? 1 : 0)}</td><td>{reading.phaseLabel}</td></tr>)}{heating.readings.length === 0 && <tr><td colSpan={4} className="wt-empty-cell">Click “Record thermometer reading” to add your first data point.</td></tr>}</tbody></table></div></div>
      </div>
      <p className="wt-results-note">The graph line connects recorded readings; the small live marker shows the current model state. Actual model time is in seconds. Playback speed changes how quickly the model clock is shown, not the heater power or the recorded values.</p>
    </section>}

    {mode === 'density-liquids' && <section className="wt-results-panel" aria-label="Liquid density results table"><div className="wt-results-heading"><div><span className="wt-section-label">YOUR MEASUREMENTS</span><h2>Compare measured and SI reference density</h2></div><span>1 g/mL = 1000 kg/m³</span></div><div className="wt-table-scroll"><table><thead><tr><th>Trial</th><th>Sample</th><th>Mass tool / division</th><th>Volume tool / division</th><th>Volume</th><th>Net mass</th><th>Calculated g/mL</th><th>Calculated kg/m³</th><th>Reference kg/m³</th><th>Conditions</th></tr></thead><tbody>{liquidReadings.map((reading, index) => <tr key={`${reading.trial}-${index}`}><td>{reading.trial}</td><td>{LIQUID_REFERENCE_DENSITIES[reading.sample].name}</td><td>{reading.massEquipment} · {reading.massResolutionG} g</td><td>{reading.volumeEquipment} · {reading.volumeResolutionMl} mL</td><td>{reading.volumeMl} mL</td><td>{reading.netMassG.toFixed(1)} g</td><td>{reading.calculatedGPerMl.toFixed(4)}</td><td>{reading.calculatedKgPerM3.toFixed(1)}</td><td>{reading.referenceKgPerM3.toFixed(1)}</td><td>{reading.conditions}</td></tr>)}{liquidReadings.length === 0 && <tr><td colSpan={10} className="wt-empty-cell">Take a valid volume and balance reading, then add it to this table.</td></tr>}</tbody></table></div></section>}

    {mode === 'density-objects' && <section className="wt-results-panel" aria-label="Object density results table"><div className="wt-results-heading"><div><span className="wt-section-label">YOUR MEASUREMENTS</span><h2>Recorded object densities</h2></div><span>1 mL = 1 cm³ · density = mass ÷ volume</span></div><div className="wt-table-scroll"><table><thead><tr><th>Trial</th><th>Specimen</th><th>Method</th><th>Mass (g)</th><th>Volume (cm³)</th><th>Calculated g/cm³</th><th>Calculated kg/m³</th><th>Reference g/cm³ · kg/m³ and conditions</th></tr></thead><tbody>{objectRecords.map((record) => <tr key={record.trial}><td>{record.trial}</td><td>{record.material}</td><td>{record.shape}</td><td>{record.massG.toFixed(1)}</td><td>{record.volumeCm3.toFixed(1)}</td><td>{record.densityGPerCm3.toFixed(2)}</td><td>{record.densityKgPerM3.toFixed(0)}</td><td>{record.referenceGPerCm3} g/cm³ ({(record.referenceGPerCm3 * 1000).toFixed(1)} kg/m³) · {record.referenceConditions}</td></tr>)}{objectRecords.length === 0 && <tr><td colSpan={8} className="wt-empty-cell">Complete the mass and volume actions, calculate density, then record a comparison row.</td></tr>}</tbody></table></div></section>}

    <footer className="wt-footer"><span><kbd>Space</kbd> play / pause <kbd>N</kbd> step one second <kbd>R</kbd> reset</span><span>All densities and units are shown with declared conditions.</span></footer>
  </section>;
}

export default WaterTopicLab;
