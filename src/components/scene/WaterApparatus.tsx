import { useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LabBeaker, LabBench, StudioLights } from './LabPrimitives';
import { ParticleLens } from './WaterParticles';
import { SceneLabel } from './WaterLabels';
import type { LiquidSampleId, SolidMaterialId } from '../../science/waterTopicEngine';

type Vec3 = readonly [number, number, number];
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** Scene units per centimetre of object. 1 cm³ then equals 0.17³ = 0.0049 unit³, close to the 100 mL cylinder (0.0050 unit³ per mL). */
export const CM = 0.17;
/** Bench surface for apparatus that sits on `LabBench` at y = -1.1 (bench slab is 0.1 thick). */
export const BENCH_TOP = -1.05;
export const PAN_TOP = 0.31;
export const PAN_Z = -0.17;
const CYLINDER_RADIUS = 0.33;
const CYLINDER_HEIGHT = 1.62;

export const MATERIAL_LOOK: Record<SolidMaterialId, { colour: string; metalness: number; roughness: number }> = {
  aluminum: { colour: '#a9b8c1', metalness: 0.3, roughness: 0.4 },
  brass: { colour: '#c79a4a', metalness: 0.45, roughness: 0.36 },
};

function useCanvasTexture(draw: (context: CanvasRenderingContext2D, width: number, height: number) => void, width: number, height: number, deps: readonly unknown[]) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) return null;
    draw(context, width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Digital balance: base, sloped LCD that faces the viewer, and a pan whose top surface is PAN_TOP above the bench. */
export function WaterBalance({ position, text, children }: { position: Vec3; text: string; children?: ReactNode }) {
  const body = useMemo(() => new RoundedBoxGeometry(1.5, 0.2, 1.1, 4, 0.06), []);
  const housing = useMemo(() => new RoundedBoxGeometry(1.2, 0.3, 0.22, 4, 0.05), []);
  const lcd = useCanvasTexture((context, width, height) => {
    context.fillStyle = '#0a2231'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#12394f'; context.fillRect(8, 8, width - 16, height - 16);
    context.font = '700 112px ui-monospace, Menlo, Consolas, monospace';
    context.textAlign = 'right'; context.textBaseline = 'middle'; context.fillStyle = '#8bffd9';
    context.shadowColor = '#37e8b4'; context.shadowBlur = 14;
    context.fillText(text, width - 120, height / 2 + 6, width - 150);
    context.font = '700 54px ui-monospace, Menlo, Consolas, monospace'; context.textAlign = 'left';
    context.fillText('g', width - 104, height / 2 + 24);
  }, 512, 160, [text]);
  return <group position={position}>
    <mesh geometry={body} position={[0, 0.1, 0]} castShadow receiveShadow><meshStandardMaterial color="#45677e" roughness={0.38} metalness={0.2} /></mesh>
    <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.38, 0.012, 0.98]} /><meshStandardMaterial color="#2f4c60" roughness={0.4} /></mesh>
    <group position={[0, 0.3, 0.42]} rotation={[-0.52, 0, 0]}>
      <mesh geometry={housing} castShadow><meshStandardMaterial color="#35566c" roughness={0.32} metalness={0.2} /></mesh>
      <mesh position={[0, 0, 0.113]}><planeGeometry args={[1.02, 0.25]} /><meshBasicMaterial color="#071a26" /></mesh>
      <mesh position={[0, 0, 0.115]}><planeGeometry args={[0.96, 0.2]} />{lcd ? <meshBasicMaterial map={lcd} toneMapped={false} /> : <meshBasicMaterial color="#12394f" />}</mesh>
    </group>
    {[-0.5, -0.26, 0.26, 0.5].map((x, index) => <mesh key={x} position={[x, 0.212, 0.2]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.045, 0.045, 0.02, 18]} /><meshStandardMaterial color={index === 0 ? '#4ac1a2' : '#b4c6d0'} metalness={0.25} roughness={0.4} /></mesh>)}
    <mesh position={[0, 0.24, PAN_Z]}><cylinderGeometry args={[0.1, 0.12, 0.08, 20]} /><meshStandardMaterial color="#8da2b0" metalness={0.5} roughness={0.3} /></mesh>
    <mesh position={[0, 0.295, PAN_Z]} castShadow receiveShadow><cylinderGeometry args={[0.48, 0.48, 0.03, 48]} /><meshStandardMaterial color="#d3dee6" metalness={0.45} roughness={0.28} /></mesh>
    {[[-0.62, -0.4], [0.62, -0.4], [-0.62, 0.4], [0.62, 0.4]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.012, z]}><cylinderGeometry args={[0.06, 0.07, 0.025, 16]} /><meshStandardMaterial color="#223c4e" roughness={0.5} /></mesh>)}
    <group position={[0, PAN_TOP, PAN_Z]}>{children}</group>
  </group>;
}

/** A 10 cm ruler, scale printed on the face; the printed edge (mm ticks, cm numbers) faces -z toward the object it measures. */
export function WaterRuler({ position, lengthCm = 10, spanCm }: { position: Vec3; lengthCm?: number; spanCm?: number }) {
  const length = lengthCm * CM;
  const face = useCanvasTexture((context, width, height) => {
    context.fillStyle = '#f0c75e'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#e4b845'; context.fillRect(0, height - 14, width, 14);
    context.strokeStyle = '#3d3a2c'; context.fillStyle = '#3d3a2c';
    const margin = 6, usable = width - margin * 2;
    for (let mm = 0; mm <= lengthCm * 10; mm += 1) {
      const x = margin + (mm / (lengthCm * 10)) * usable;
      const size = mm % 10 === 0 ? 50 : mm % 5 === 0 ? 34 : 20;
      context.lineWidth = mm % 10 === 0 ? 3.2 : 1.8;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, size); context.stroke();
    }
    context.font = '700 40px Lexend, system-ui, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'alphabetic';
    for (let cm = 0; cm <= lengthCm; cm += 1) {
      const x = margin + (cm / lengthCm) * usable;
      context.fillText(String(cm), clamp(x, 18, width - 18), 104);
    }
    context.font = '600 30px Lexend, system-ui, sans-serif'; context.textAlign = 'right'; context.fillText('cm', width - 12, 140);
  }, 1024, 160, [lengthCm]);
  const depth = 0.27;
  return <group position={position}>
    <mesh castShadow><boxGeometry args={[length + 0.04, 0.026, depth]} /><meshStandardMaterial color="#e6bd59" roughness={0.45} /></mesh>
    <mesh position={[0, 0.0145, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[length + 0.04, depth]} />{face ? <meshBasicMaterial map={face} toneMapped={false} /> : <meshBasicMaterial color="#f0c75e" />}</mesh>
    {spanCm !== undefined && <mesh position={[(spanCm * CM) / 2 - length / 2, 0.0155, -depth / 2 + 0.022]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[spanCm * CM, 0.032]} /><meshBasicMaterial color="#2b74ca" transparent opacity={0.9} /></mesh>}
  </group>;
}

/** Faceted irregular rock whose volume is rescaled to exactly `volumeUnits` (cubic scene units) so it matches displacement. */
export function useRockGeometry(volumeUnits: number) {
  const geometry = useMemo(() => {
    const base = new THREE.IcosahedronGeometry(1, 2);
    const positions = base.attributes.position;
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 1) {
      point.fromBufferAttribute(positions, i).normalize();
      const bump = 1 + 0.16 * Math.sin(point.x * 4.1 + point.y * 2.3) * Math.cos(point.z * 3.7 - point.x * 1.9) + 0.09 * Math.sin(point.y * 7.3 + point.z * 5.1);
      positions.setXYZ(i, point.x * bump * 1.12, point.y * bump * 0.82, point.z * bump * 0.98);
    }
    base.computeVertexNormals();
    // Signed volume of the closed triangle soup, then rescale uniformly to the requested volume.
    const flat = base.index ? base.toNonIndexed() : base;
    const p = flat.attributes.position;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let volume = 0;
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      volume += a.dot(b.clone().cross(c)) / 6;
    }
    if (flat !== base) base.dispose();
    flat.scale(...Array<number>(3).fill(Math.cbrt(volumeUnits / Math.abs(volume))) as [number, number, number]);
    flat.computeVertexNormals();
    flat.computeBoundingBox();
    return flat;
  }, [volumeUnits]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Retort stand, ring clamp sized to the cylinder, and the cylinder itself. Origin of the group is the bench contact point. */
export function CylinderOnStand({ position, fill, capacityMl, colour, children }: { position: Vec3; fill: number; capacityMl: number; colour: string; children?: ReactNode }) {
  const ringRadius = CYLINDER_RADIUS + 0.035;
  const clampY = CYLINDER_HEIGHT * 0.66;
  return <group position={position}>
    <LabBeaker radius={CYLINDER_RADIUS} height={CYLINDER_HEIGHT} fill={fill} particleLens={false} graduated capacityMl={capacityMl} waterColor={colour} position={[0, CYLINDER_HEIGHT / 2, 0]} />
    <mesh position={[0, 0.022, -0.66]} castShadow><boxGeometry args={[0.62, 0.044, 0.44]} /><meshStandardMaterial color="#324b5c" metalness={0.35} roughness={0.4} /></mesh>
    <mesh position={[0, 0.66, -0.66]}><cylinderGeometry args={[0.022, 0.022, 1.28, 14]} /><meshStandardMaterial color="#6b8798" metalness={0.55} roughness={0.28} /></mesh>
    <mesh position={[0, clampY, -0.66]}><boxGeometry args={[0.1, 0.07, 0.1]} /><meshStandardMaterial color="#365166" metalness={0.4} roughness={0.35} /></mesh>
    <mesh position={[0, clampY, -0.49]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.34, 10]} /><meshStandardMaterial color="#6b8798" metalness={0.55} roughness={0.28} /></mesh>
    <mesh position={[0, clampY, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[ringRadius, 0.013, 8, 48]} /><meshStandardMaterial color="#6b8798" metalness={0.5} roughness={0.3} /></mesh>
    {children}
  </group>;
}

function SolidBlock({ dims, material, position }: { dims: [number, number, number]; material: SolidMaterialId; position: Vec3 }) {
  const geometry = useMemo(() => new RoundedBoxGeometry(dims[0] * CM, dims[2] * CM, dims[1] * CM, 3, 0.018), [dims]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const look = MATERIAL_LOOK[material];
  return <mesh geometry={geometry} position={position} castShadow receiveShadow><meshStandardMaterial color={look.colour} metalness={look.metalness} roughness={look.roughness} /></mesh>;
}

export type ObjectStation = 'bench' | 'pan' | 'cylinder';

/**
 * 4.2.3 apparatus. Regular blocks sit on the bench (ruler laid along the front edge with an attached
 * reading) or on the balance pan after weighing. Irregular samples sit on the pan, the bench, or
 * submerged on the floor of the displacement cylinder, where the raised meniscus is visible.
 */
export function DensityObjectsScene({ shape, material, dimensionsCm, volumeCm3, massG, tared, station, measuredDimensions, initialLevelMl, finalLevelMl, showMolecules, time }: {
  shape: 'regular' | 'irregular'; material: SolidMaterialId; dimensionsCm: [number, number, number]; volumeCm3: number; massG: number | null; tared: boolean;
  station: ObjectStation; measuredDimensions: [number, number, number] | null; initialLevelMl: number | null; finalLevelMl: number | null; showMolecules: boolean; time: number;
}) {
  const look = MATERIAL_LOOK[material];
  const balanceX = -1.32, benchSpotX = -0.12, benchSpotZ = 0.02, cylinderX = 1.38;
  const onPan = station === 'pan';
  const inCylinder = shape === 'irregular' && station === 'cylinder';
  const rockGeometry = useRockGeometry(Math.max(0.1, volumeCm3) * CM ** 3);
  const rockBox = rockGeometry.boundingBox!;
  const displayText = onPan && massG !== null ? massG.toFixed(1) : tared ? '0.0' : '----';
  const level = (initialLevelMl ?? 50) + (inCylinder ? Math.max(0, volumeCm3) : 0);
  const cylinderFloor = 0.08;
  const [length, , height] = dimensionsCm;
  const width = dimensionsCm[1];
  const blockHeightUnits = height * CM;
  const regularPlace: Vec3 = onPan
    ? [balanceX, BENCH_TOP + PAN_TOP + blockHeightUnits / 2, PAN_Z]
    : [benchSpotX, BENCH_TOP + blockHeightUnits / 2, benchSpotZ];
  const blockLeft = regularPlace[0] - (length * CM) / 2;
  const blockFront = regularPlace[2] + (width * CM) / 2;
  const measuring = shape === 'regular' && measuredDimensions !== null && !onPan;
  const rulerY = BENCH_TOP + 0.014;
  const rulerCentreX = measuring ? blockLeft - 0.015 + (10 * CM) / 2 + 0.02 : 0.2;
  const rulerZ = measuring ? blockFront + 0.16 : -0.7;
  const rockAt = (surface: number, x: number, z: number): Vec3 => [x, surface - rockBox.min.y, z];
  const rockRotation: Vec3 = [0.1, 0.5, 0];
  return <>
    <color attach="background" args={['#edf6ff']} /><StudioLights />
    <LabBench position={[0, -1.1, 0]} width={4.5} depth={1.95} />

    <WaterBalance position={[balanceX, BENCH_TOP, 0]} text={displayText}>
      {shape === 'irregular' && onPan && <mesh geometry={rockGeometry} position={rockAt(0, 0, 0)} rotation={rockRotation} castShadow><meshStandardMaterial color={look.colour} metalness={look.metalness * 0.6} roughness={0.62} flatShading /></mesh>}
      {shape === 'regular' && onPan && <SolidBlock dims={dimensionsCm} material={material} position={[0, blockHeightUnits / 2, 0]} />}
    </WaterBalance>

    {shape === 'regular' && !onPan && <SolidBlock dims={dimensionsCm} material={material} position={regularPlace} />}
    {shape === 'irregular' && station === 'bench' && <mesh geometry={rockGeometry} position={rockAt(BENCH_TOP, benchSpotX, benchSpotZ)} rotation={rockRotation} castShadow><meshStandardMaterial color={look.colour} metalness={look.metalness * 0.6} roughness={0.62} flatShading /></mesh>}

    {shape === 'regular' && <>
      <WaterRuler position={[rulerCentreX, rulerY, rulerZ]} spanCm={measuring ? length : undefined} />
      {measuring && measuredDimensions && <SceneLabel tone="blue" pointer="up" position={[blockLeft + length * CM, rulerY, rulerZ + 0.1]} title="Ruler readings" subtitle={`${measuredDimensions[0]} × ${measuredDimensions[1]} × ${measuredDimensions[2]} cm`} />}
    </>}

    <CylinderOnStand position={[cylinderX, BENCH_TOP, 0]} fill={level / 100} capacityMl={100} colour="#20aac2">
      {inCylinder && <mesh geometry={rockGeometry} position={rockAt(cylinderFloor, 0, 0)} rotation={rockRotation} castShadow><meshStandardMaterial color={look.colour} metalness={look.metalness * 0.6} roughness={0.62} flatShading /></mesh>}
      {shape === 'irregular' && initialLevelMl !== null && <>
        {finalLevelMl !== null && inCylinder && <mesh position={[0, cylinderFloor + (initialLevelMl / 100) * (CYLINDER_HEIGHT - 0.15), 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[CYLINDER_RADIUS - 0.012, 0.007, 6, 40]} /><meshBasicMaterial color="#e8a53c" /></mesh>}
        <SceneLabel tone="blue" pointer="right" position={[-CYLINDER_RADIUS - 0.03, cylinderFloor + (level / 100) * (CYLINDER_HEIGHT - 0.15), 0.1]}
          title={finalLevelMl !== null && inCylinder ? `Final ${finalLevelMl.toFixed(1)} mL` : `Initial ${initialLevelMl} mL`}
          subtitle={finalLevelMl !== null && inCylinder ? `Initial ${initialLevelMl} mL, rise ${(finalLevelMl - initialLevelMl).toFixed(1)} mL` : 'Read the bottom of the meniscus'} />
      </>}
    </CylinderOnStand>

    <ParticleLens visible={showMolecules} sample="water20C" time={time} radius={0.5} anchor={[cylinderX - 0.2, BENCH_TOP + cylinderFloor + 0.3, CYLINDER_RADIUS + 0.01]} position={[-0.2, 0.98, 0.4]} />
  </>;
}

/** 4.2.2 apparatus: sample cup on the balance and a graduated cylinder on a proportionate stand, with a liquid zoom lens. */
export function DensityLiquidsScene({ liquidSample, volumeMl, massG, tared, showMolecules, time }: {
  liquidSample: LiquidSampleId; volumeMl: number; massG: number | null; tared: boolean; showMolecules: boolean; time: number;
}) {
  const colour = liquidSample === 'water20C' ? '#16aabe' : '#a98adc';
  const balanceX = -1.0, cylinderX = 1.12;
  const displayText = massG !== null ? massG.toFixed(1) : tared ? '0.0' : '34.2';
  const cupHeight = 0.5;
  return <>
    <color attach="background" args={['#eaf5ff']} /><StudioLights />
    <LabBench position={[0, -1.1, 0]} width={4.2} depth={1.95} />
    <WaterBalance position={[balanceX, BENCH_TOP, 0]} text={displayText}>
      <LabBeaker radius={0.27} height={cupHeight} fill={massG !== null ? clamp(volumeMl / 120, 0.1, 0.86) : 0} particleLens={false} graduated={false} capacityMl={120} waterColor={colour} position={[0, cupHeight / 2, 0]} />
    </WaterBalance>
    <CylinderOnStand position={[cylinderX, BENCH_TOP, 0]} fill={clamp(volumeMl / 120, 0, 1)} capacityMl={120} colour={colour} />
    <ParticleLens visible={showMolecules} sample={liquidSample} time={time} radius={0.52} anchor={[cylinderX - 0.2, BENCH_TOP + 0.5, CYLINDER_RADIUS + 0.01]} position={[0.15, 0.98, 0.4]} />
  </>;
}
