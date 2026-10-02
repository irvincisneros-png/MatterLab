import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, Line, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import { ATOM_COLOURS, LabBeaker, StudioLights } from './scene/LabPrimitives';
import { LatticeLinks } from './scene/StatesLattice';
import { AdaptiveQuality } from './scene/AdaptiveQuality';
import {
  CHAMBER,
  deriveMoleculePositions,
  liquidSurfaceIntercept,
  liquidSurfaceSegment,
  type MatterSample,
  type Phase,
  thermalStateAtEnergy,
} from '../science/matterEngine';

export type CameraPreset = 'angled' | 'front' | 'top';

const BASE_COLOUR: Record<Phase, string> = {
  solid: '#2366e8',
  liquid: '#06aabc',
  gas: '#efb317',
};

function MoleculeCloud({ sample, tiltDegrees }: { sample: MatterSample; tiltDegrees: number }) {
  const molecules = useMemo(
    () => deriveMoleculePositions(sample, tiltDegrees),
    [sample.energyKJ, sample.modelTimeSeconds, sample.seed, tiltDegrees],
  );
  const oxygenRef = useRef<THREE.InstancedMesh>(null);
  const hydrogenRef = useRef<THREE.InstancedMesh>(null);
  const bondRef = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  const oxygenGeometry = useMemo(() => new THREE.SphereGeometry(0.078, 16, 12), []);
  const hydrogenGeometry = useMemo(() => new THREE.SphereGeometry(0.043, 12, 10), []);
  const bondGeometry = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 1, 8), []);
  const oxygenMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: ATOM_COLOURS.oxygen, roughness: 0.27, metalness: 0.02, clearcoat: 0.55 }), []);
  const hydrogenMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: ATOM_COLOURS.hydrogen, roughness: 0.24, metalness: 0.01, clearcoat: 0.5 }), []);
  const bondMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9e5f4', roughness: 0.5 }), []);

  useLayoutEffect(() => {
    const oxygen = oxygenRef.current;
    const hydrogen = hydrogenRef.current;
    const bonds = bondRef.current;
    if (!oxygen || !hydrogen || !bonds) return;
    const transform = new THREE.Object3D();
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const bondQuaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);

    molecules.forEach((molecule, index) => {
      const [x, y, z] = molecule.position;
      const centre = new THREE.Vector3(x, y, z);
      const rotation = Math.sin(sample.modelTimeSeconds * 0.55 + molecule.id * 1.21) * 0.35 + (molecule.id % 2) * 0.2;
      transform.position.copy(centre);
      transform.scale.setScalar(1);
      transform.updateMatrix();
      oxygen.setMatrixAt(index, transform.matrix);

      [-0.91, 0.91].forEach((side, hydrogenIndex) => {
        const angle = rotation + side * 0.88;
        const offset = new THREE.Vector3(Math.sin(angle) * 0.112, Math.cos(angle) * 0.112, (hydrogenIndex === 0 ? -1 : 1) * 0.019);
        const hydrogenPosition = centre.clone().add(offset);
        const instanceIndex = index * 2 + hydrogenIndex;
        transform.position.copy(hydrogenPosition);
        transform.scale.setScalar(1);
        transform.updateMatrix();
        hydrogen.setMatrixAt(instanceIndex, transform.matrix);

        direction.copy(hydrogenPosition).sub(centre);
        const length = direction.length();
        origin.copy(centre).add(hydrogenPosition).multiplyScalar(0.5);
        bondQuaternion.setFromUnitVectors(up, direction.normalize());
        transform.position.copy(origin);
        transform.quaternion.copy(bondQuaternion);
        transform.scale.set(1, length, 1);
        transform.updateMatrix();
        bonds.setMatrixAt(instanceIndex, transform.matrix);
      });
    });

    oxygen.instanceMatrix.needsUpdate = true;
    hydrogen.instanceMatrix.needsUpdate = true;
    bonds.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [bondRef, invalidate, molecules, sample.modelTimeSeconds]);

  return (
    <>
      <instancedMesh ref={oxygenRef} args={[oxygenGeometry, oxygenMaterial, molecules.length]} castShadow />
      <instancedMesh ref={hydrogenRef} args={[hydrogenGeometry, hydrogenMaterial, molecules.length * 2]} castShadow />
      <instancedMesh ref={bondRef} args={[bondGeometry, bondMaterial, molecules.length * 2]} />
      <LatticeLinks molecules={molecules} />
    </>
  );
}

function liquidGeometry(fillHeight: number, tiltDegrees: number): THREE.ExtrudeGeometry {
  const halfWidth = CHAMBER.halfWidth;
  const bottom = CHAMBER.bottom;
  const tilt = (tiltDegrees * Math.PI) / 180;
  const level = liquidSurfaceIntercept(fillHeight, tiltDegrees);
  const slope = Math.tan(tilt);
  type Point2 = [number, number];
  const vertices: Point2[] = [
    [-halfWidth, bottom],
    [halfWidth, bottom],
    [halfWidth, CHAMBER.top],
    [-halfWidth, CHAMBER.top],
  ];
  const signedDistance = ([x, y]: Point2) => level - slope * x - y;
  const polygon: Point2[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const startDistance = signedDistance(start);
    const endDistance = signedDistance(end);
    const startInside = startDistance >= 0;
    const endInside = endDistance >= 0;
    if (startInside && endInside) {
      polygon.push(end);
    } else if (startInside && !endInside) {
      const proportion = startDistance / (startDistance - endDistance);
      polygon.push([start[0] + (end[0] - start[0]) * proportion, start[1] + (end[1] - start[1]) * proportion]);
    } else if (!startInside && endInside) {
      const proportion = startDistance / (startDistance - endDistance);
      polygon.push([start[0] + (end[0] - start[0]) * proportion, start[1] + (end[1] - start[1]) * proportion]);
      polygon.push(end);
    }
  }
  const shape = new THREE.Shape();
  const first = polygon[0] ?? [-halfWidth, bottom];
  shape.moveTo(first[0], first[1]);
  for (const point of polygon.slice(1)) shape.lineTo(point[0], point[1]);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.46, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.014, bevelThickness: 0.015, curveSegments: 3 });
}

function SampleChamber({
  sample,
  x,
  selected,
  particleView,
  tiltDegrees,
  interpolationSeconds,
  onSelect,
}: {
  sample: MatterSample;
  x: number;
  selected: boolean;
  particleView: boolean;
  tiltDegrees: number;
  interpolationSeconds: number;
  onSelect: (id: Phase) => void;
}) {
  const thermal = thermalStateAtEnergy(sample.energyKJ);
  const hasSolid = thermal.fractions.solid > 0.001;
  const hasLiquid = thermal.fractions.liquid > 0.001;
  const solidHeight = CHAMBER.liquidFillHeight * 1.09 * thermal.fractions.solid;
  const liquidHeight = CHAMBER.liquidFillHeight * thermal.fractions.liquid;
  const waterLevel = liquidSurfaceIntercept(liquidHeight, tiltDegrees);
  const iceBase = hasLiquid ? Math.max(CHAMBER.bottom, waterLevel - 0.917 * solidHeight) : CHAMBER.bottom;
  const iceGeometry = useMemo(() => new RoundedBoxGeometry(1.44, Math.max(0.05, solidHeight), 0.46, 4, 0.055), [solidHeight]);
  const baseGeometry = useMemo(() => new RoundedBoxGeometry(1.68, 0.09, 0.74, 5, 0.05), []);
  const renderedSample = useMemo(
    () => ({ ...sample, modelTimeSeconds: sample.modelTimeSeconds + interpolationSeconds }),
    [sample.energyKJ, sample.modelTimeSeconds, sample.seed, interpolationSeconds],
  );
  const liquid = useMemo(
    () => liquidGeometry(liquidHeight, tiltDegrees),
    [liquidHeight, tiltDegrees],
  );
  const positionX = x;
  const tilt = (tiltDegrees * Math.PI) / 180;
  // Equal vessels: the comparison is only fair when all three chambers have the same size.

  return (
    <group position={[positionX, 0.08, 0]} rotation={[0, 0, tilt]} onClick={(event) => { event.stopPropagation(); onSelect(sample.id); }}>
      <LabBeaker radius={0.74} height={2.28} particleLens={particleView} graduated capacityMl={200} waterColor="#3aa7c5" />
      <mesh position={[-0.66, 0.02, 0.64]} scale={[0.018, 0.83, 0.008]}><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.42} depthWrite={false} /></mesh>
      <mesh position={[0.65, 0.14, 0.64]} scale={[0.012, 0.56, 0.007]}><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.28} depthWrite={false} /></mesh>
      {selected && <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.7, 0.009, 8, 48]} /><meshBasicMaterial color="#f87967" transparent opacity={0.74} /></mesh>}
      <mesh position={[0, -1.17, 0]} geometry={baseGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial color={selected ? '#dcecff' : BASE_COLOUR[sample.id]} roughness={0.29} metalness={0.02} clearcoat={0.6} />
        <Edges color="#f6fbff" threshold={18} />
      </mesh>
      <mesh position={[0, 1.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.022, 10, 48]} />
        <meshStandardMaterial color="#f2f7fd" roughness={0.25} metalness={0.04} />
      </mesh>
      <mesh position={[0, -1.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.75, 0.013, 8, 48]} />
        <meshBasicMaterial color={selected ? '#f87967' : BASE_COLOUR[sample.id]} transparent opacity={0.85} />
      </mesh>
      {hasSolid && (
        <mesh position={[0, iceBase + solidHeight / 2, 0]} geometry={iceGeometry} castShadow>
          <meshPhysicalMaterial color="#acd8e9" roughness={0.25} metalness={0.02} transparent opacity={particleView ? 0.18 : 0.75} clearcoat={0.65} clearcoatRoughness={0.14} />
          <Edges color="#effaff" threshold={20} />
        </mesh>
      )}
      {hasLiquid && !particleView && (
        <mesh geometry={liquid} position={[0, 0, -0.23]}>
          <meshPhysicalMaterial color="#2d9bc4" roughness={0.16} metalness={0.04} transparent opacity={0.74} clearcoat={0.82} clearcoatRoughness={0.08} side={THREE.DoubleSide} />
        </mesh>
      )}
      {hasLiquid && particleView && (
        <SurfaceCue fillHeight={liquidHeight} tiltDegrees={tiltDegrees} />
      )}
      {particleView && <MoleculeCloud sample={renderedSample} tiltDegrees={tiltDegrees} />}
      {selected && (
        <mesh position={[0, -1.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.81, 0.86, 56]} />
          <meshBasicMaterial color="#f87967" transparent opacity={0.94} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.185, -0.1]} receiveShadow>
        <planeGeometry args={[9.2, 3.2]} />
        <shadowMaterial transparent opacity={0.1} />
      </mesh>
      {[-2.85, 0, 2.85].map((x) => <mesh key={`contact-${x}`} position={[x, -1.17, 0.12]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.02, 0.34, 1]}><circleGeometry args={[1, 48]} /><meshBasicMaterial color="#6d91ad" transparent opacity={0.095} depthWrite={false} /></mesh>)}
    </>
  );
}

/**
 * A narrow field of view viewed from far away keeps the three equal chambers
 * the same apparent size (perspective foreshortening scales with
 * depth difference / distance), so a same-size comparison is not misleading.
 */
const COMPARISON_FOV = 14;
const CHAMBER_SPAN = { width: 8.1, height: 2.9 };

function CameraController({ preset, revision, focusSample, selected }: { preset: CameraPreset; revision: number; focusSample: boolean; selected: Phase }) {
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.size);
  const controls = useRef<any>(null);

  useLayoutEffect(() => {
    const selectedX = selected === 'solid' ? -2.85 : selected === 'liquid' ? 0 : 2.85;
    const aspect = viewport.width / Math.max(1, viewport.height);
    const tangent = Math.tan((COMPARISON_FOV * Math.PI) / 360);
    const distanceFor = (width: number, height: number) => Math.max(width / (2 * tangent * aspect), height / (2 * tangent));
    const place = (direction: [number, number, number], distance: number, target: [number, number, number]) => {
      const length = Math.hypot(...direction);
      camera.position.set(target[0] + (direction[0] / length) * distance, target[1] + (direction[1] / length) * distance, target[2] + (direction[2] / length) * distance);
      controls.current?.target.set(...target);
    };
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== COMPARISON_FOV) {
      camera.fov = COMPARISON_FOV;
      camera.updateProjectionMatrix();
    }
    if (focusSample) {
      const distance = distanceFor(2.6, 3.4);
      const directions: Record<CameraPreset, [number, number, number]> = { angled: [0.3, 0.26, 1], front: [0.05, 0.12, 1], top: [0, 1, 0.08] };
      place(directions[preset], distance, [selectedX, -0.3, 0]);
    } else {
      const distance = distanceFor(CHAMBER_SPAN.width, CHAMBER_SPAN.height);
      const directions: Record<CameraPreset, [number, number, number]> = { angled: [0.22, 0.26, 1], front: [0, 0.1, 1], top: [0, 1, 0.1] };
      place(directions[preset], distance, [0, -0.3, 0]);
    }
    controls.current?.update();
  }, [camera, preset, revision, focusSample, selected, viewport.width, viewport.height]);

  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={5} maxDistance={48} minPolarAngle={0.16} maxPolarAngle={Math.PI * 0.48} rotateSpeed={0.62} zoomSpeed={0.72} />;
}

function SurfaceCue({ fillHeight, tiltDegrees }: { fillHeight: number; tiltDegrees: number }) {
  const segment = liquidSurfaceSegment(fillHeight, tiltDegrees);
  return <Line points={[[segment[0][0], segment[0][1], 0.025], [segment[1][0], segment[1][1], 0.025]]} color="#167eac" lineWidth={3} />;
}

function ContextRecovery({ onContextLost }: { onContextLost: () => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const handleLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    gl.domElement.addEventListener('webglcontextlost', handleLost);
    return () => gl.domElement.removeEventListener('webglcontextlost', handleLost);
  }, [gl, onContextLost]);
  return null;
}

export function MatterScene({
  samples,
  selected,
  particleView,
  tiltDegrees,
  interpolationSeconds,
  cameraPreset,
  cameraRevision,
  focusSample,
  reducedGraphics,
  onSelect,
  onContextLost,
}: {
  samples: readonly MatterSample[];
  selected: Phase;
  particleView: boolean;
  tiltDegrees: number;
  interpolationSeconds: number;
  cameraPreset: CameraPreset;
  cameraRevision: number;
  focusSample: boolean;
  reducedGraphics: boolean;
  onSelect: (id: Phase) => void;
  onContextLost: () => void;
}) {
  return (
    <Canvas
      className="matter-canvas"
      role="img"
      aria-label="Three interactive graduated glass beakers compare solid ice, liquid water, and invisible water vapour. The particle view shows the same tracked H₂O molecules in each phase."
      dpr={reducedGraphics ? [1, 1.2] : [1, 1.65]}
      shadows={reducedGraphics ? false : 'percentage'}
      camera={{ position: [3, 3.5, 12], fov: COMPARISON_FOV, near: 0.5, far: 160 }}
      gl={{ antialias: !reducedGraphics, alpha: true, powerPreference: reducedGraphics ? 'low-power' : 'high-performance' }}
      fallback={<span className="scene-fallback">Interactive 3D water model; a 2D view is also available.</span>}
    >
      <color attach="background" args={['#f2f7fd']} />
      <StudioLights />
      <directionalLight position={[4, 7, 6]} intensity={0.55} color="#f3f8ff" castShadow={!reducedGraphics} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 2.8, 1.5]} intensity={0.38} color="#e7f7ff" distance={12} />
      <Floor />
      {samples.map((sample, index) => (
        <SampleChamber
          key={sample.id}
          sample={sample}
          x={(index - 1) * 2.85}
          selected={sample.id === selected}
          particleView={particleView}
          tiltDegrees={tiltDegrees}
          interpolationSeconds={interpolationSeconds}
          onSelect={onSelect}
        />
      ))}
      <PerspectiveCamera makeDefault position={[3, 3.5, 12]} fov={COMPARISON_FOV} near={0.5} far={160} />
      <CameraController preset={cameraPreset} revision={cameraRevision} focusSample={focusSample} selected={selected} />
      <ContextRecovery onContextLost={onContextLost} />
    <AdaptiveQuality /></Canvas>
  );
}

export function Matter2DFallback({
  samples,
  particleView,
  selected,
  tiltDegrees,
  interpolationSeconds,
  onSelect,
  hideLabelId,
}: {
  samples: readonly MatterSample[];
  particleView: boolean;
  selected: Phase;
  tiltDegrees: number;
  interpolationSeconds: number;
  onSelect: (id: Phase) => void;
  hideLabelId?: Phase;
}) {
  return (
    <div className="fallback-board" aria-label="Two-dimensional science model">
      {samples.map((sample) => {
        const state = thermalStateAtEnergy(sample.energyKJ);
        const renderedSample = { ...sample, modelTimeSeconds: sample.modelTimeSeconds + interpolationSeconds };
        const molecules = deriveMoleculePositions(renderedSample, tiltDegrees);
        const isMystery = sample.id === hideLabelId;
        const stateName = state.isChangingState ? state.phaseLabel.replace(' · phase change', '') : state.dominantPhase === 'solid' ? 'Ice' : state.dominantPhase === 'liquid' ? 'Liquid water' : 'Water vapour';
        return (
          <button className={`fallback-chamber ${selected === sample.id ? 'is-selected' : ''}`} key={sample.id} onClick={() => onSelect(sample.id)} aria-label={`Select ${isMystery ? 'mystery' : stateName} sample`}>
            <span className="fallback-material" aria-hidden="true" style={{ transform: `rotate(${tiltDegrees}deg)` }}>
              {state.fractions.solid > 0 && <i className="fallback-ice" style={{ height: `${Math.max(3, state.fractions.solid * 50)}%`, bottom: `${Math.max(0, (state.fractions.liquid - 0.917 * state.fractions.solid) * 50)}%` }} />}
              {state.fractions.liquid > 0 && <i className="fallback-water" style={{ height: `${Math.max(3, state.fractions.liquid * 50)}%`, transform: `rotate(${-tiltDegrees}deg)` }} />}
            </span>
            {particleView && <span className="fallback-molecule-map" aria-hidden="true" style={{ transform: `rotate(${tiltDegrees}deg)` }}>{molecules.map((molecule) => <i key={molecule.id} className={`dot ${molecule.phase}`} style={{ left: `${12 + ((molecule.position[0] + 0.72) / 1.44) * 76}%`, bottom: `${8 + ((molecule.position[1] - CHAMBER.bottom) / 2.08) * 82}%` }} />)}</span>}
            <strong>{isMystery ? 'Mystery sample' : stateName}</strong>
            {!isMystery && <span>{Math.round(state.temperatureC)} °C · {state.phaseLabel}</span>}
            {!isMystery && state.fractions.gas > 0.99 && <span className="vapour-note">Water vapour is invisible.</span>}
          </button>
        );
      })}
    </div>
  );
}
