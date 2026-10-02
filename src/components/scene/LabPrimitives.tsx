import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SUCROSE_ATOMS, SUCROSE_BONDS } from '../../science/sucroseStructure';

type Vec3 = readonly [number, number, number];
export const ATOM_COLOURS = { oxygen: '#e43d39', hydrogen: '#ffffff', carbon: '#303844', nitrogen: '#3976df', sodium: '#8c58d9', potassium: '#b770ce', chloride: '#54ad58' } as const;

let sucroseGeometries: Record<'carbon' | 'oxygen' | 'hydrogen' | 'bonds', THREE.BufferGeometry> | undefined;
function localSucroseGeometries() {
  if (sucroseGeometries) return sucroseGeometries;
  const centre = SUCROSE_ATOMS.reduce((sum, atom) => sum.add(new THREE.Vector3(...atom.position)), new THREE.Vector3()).divideScalar(SUCROSE_ATOMS.length);
  const points = SUCROSE_ATOMS.map(atom => new THREE.Vector3(...atom.position).sub(centre).multiplyScalar(.027));
  const merged = (parts: THREE.BufferGeometry[]) => {
    const result = mergeGeometries(parts, false)!;
    parts.forEach(part => part.dispose());
    return result;
  };
  const atomsFor = (element: 'carbon' | 'oxygen' | 'hydrogen') => merged(SUCROSE_ATOMS.flatMap((atom, index) => {
    if (atom.element !== element) return [];
    const geometry = new THREE.SphereGeometry(element === 'hydrogen' ? .019 : element === 'oxygen' ? .029 : .027, 12, 10);
    geometry.translate(points[index].x, points[index].y, points[index].z);
    return [geometry];
  }));
  const bonds = SUCROSE_BONDS.map(([a, b]) => {
    const direction = points[b].clone().sub(points[a]);
    const middle = points[a].clone().add(points[b]).multiplyScalar(.5);
    const geometry = new THREE.CylinderGeometry(.006, .006, direction.length(), 8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    geometry.translate(middle.x, middle.y, middle.z);
    return geometry;
  });
  sucroseGeometries = { carbon: atomsFor('carbon'), oxygen: atomsFor('oxygen'), hydrogen: atomsFor('hydrogen'), bonds: merged(bonds) };
  return sucroseGeometries;
}

/** A local PubChem conformer: twelve C, twenty-two H and eleven O atoms stay bonded. */
export function LabSucroseMolecule({ position = [0, 0, 0], scale = 1 }: { position?: Vec3; scale?: number }) {
  const geometry = localSucroseGeometries();
  return <group position={[...position]} scale={scale}>
    {(['carbon', 'oxygen', 'hydrogen'] as const).map(element => <mesh key={element} geometry={geometry[element]} dispose={null}><meshPhysicalMaterial color={ATOM_COLOURS[element]} roughness={.3} clearcoat={.35} /></mesh>)}
    <mesh geometry={geometry.bonds} dispose={null}><meshStandardMaterial color="#b5c0cc" roughness={.42} /></mesh>
  </group>;
}

export function LabBond({ from, to, radius = 0.013, colour = '#d5e0ea' }: { from: Vec3; to: Vec3; radius?: number; colour?: string }) {
  const transform = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    return { middle: a.clone().add(b).multiplyScalar(.5), length: direction.length(), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()) };
  }, [from, to]);
  return <mesh position={transform.middle} quaternion={transform.rotation}><cylinderGeometry args={[radius, radius, transform.length, 10]} /><meshStandardMaterial color={colour} roughness={.32} /></mesh>;
}

export function LabWaterMolecule({ position = [0, 0, 0], scale = 1, rotation = [0, 0, 0] }: { position?: Vec3; scale?: number; rotation?: Vec3 }) {
  const bond = .15, halfAngle = 52.25 * Math.PI / 180;
  const left: Vec3 = [-Math.sin(halfAngle) * bond, Math.cos(halfAngle) * bond, 0];
  const right: Vec3 = [Math.sin(halfAngle) * bond, Math.cos(halfAngle) * bond, 0];
  return <group position={[...position]} rotation={[...rotation]} scale={scale}>
    <LabBond from={[0, 0, 0]} to={left} /><LabBond from={[0, 0, 0]} to={right} />
    <mesh><sphereGeometry args={[.092, 22, 16]} /><meshPhysicalMaterial color={ATOM_COLOURS.oxygen} roughness={.26} clearcoat={.55} /></mesh>
    {[left, right].map((p, index) => <mesh key={index} position={[...p]}><sphereGeometry args={[.055, 18, 12]} /><meshPhysicalMaterial color={ATOM_COLOURS.hydrogen} roughness={.25} clearcoat={.45} /></mesh>)}
  </group>;
}

/** Procedural glass with a real wall/base profile. Origin is the vessel centre. */
export function LabBeaker({ radius = .8, height = 2, fill, particleLens = false, graduated = true, capacityMl = 100, waterColor = '#5bbad8', position = [0, 0, 0] }: {
  radius?: number; height?: number; fill?: number; particleLens?: boolean; graduated?: boolean; capacityMl?: number; waterColor?: string; position?: Vec3;
}) {
  const bottom = -height / 2, top = height / 2, wall = .022;
  const profile = useMemo(() => [
    new THREE.Vector2(0, bottom), new THREE.Vector2(radius * .96, bottom),
    new THREE.Vector2(radius, bottom + .065), new THREE.Vector2(radius, top - .025),
    new THREE.Vector2(radius - wall, top - .025), new THREE.Vector2(radius - wall, bottom + .08),
    new THREE.Vector2(0, bottom + .08),
  ], [radius, height]);
  const level = fill === undefined ? 0 : Math.max(0, Math.min(1, fill));
  const waterHeight = Math.max(.001, level * (height - .15));
  const meniscusY = bottom + .08 + waterHeight;
  const markings = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 640;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.font = '600 29px Lexend, sans-serif'; ctx.fillStyle = '#2c5272'; ctx.strokeStyle = '#2c5272'; ctx.lineWidth = 3;
    for (let step = 1; step <= 10; step++) {
      const y = 608 - step * 57.6; ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(step % 2 === 0 ? 91 : 60, y); ctx.stroke();
      if (step % 2 === 0) ctx.fillText(String(Math.round(capacityMl * step / 10)), 106, y + 10);
    }
    ctx.font = '600 22px Lexend, sans-serif'; ctx.fillText('mL', 166, 81);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }, [capacityMl]);
  useEffect(() => () => markings?.dispose(), [markings]);
  return <group position={[...position]}>
    <mesh><latheGeometry args={[profile, 64]} /><meshPhysicalMaterial color="#e5f4fc" transparent opacity={particleLens ? .12 : .23} roughness={.1} metalness={.03} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <mesh position={[0, top - .025, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius - wall / 2, .024, 10, 64]} /><meshPhysicalMaterial color="#b1d1e2" transparent opacity={.8} roughness={.14} metalness={.18} /></mesh>
    <mesh position={[0, bottom + .04, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius * .97, .032, 10, 56]} /><meshPhysicalMaterial color="#a9c4d3" transparent opacity={.65} roughness={.2} /></mesh>
    <mesh position={[radius * .86, top - .01, 0]} rotation={[0, 0, -.35]} scale={[.38, .12, .22]}><sphereGeometry args={[1, 24, 16, 0, Math.PI, 0, Math.PI / 2]} /><meshPhysicalMaterial color="#d3e9f4" transparent opacity={.38} side={THREE.DoubleSide} roughness={.12} /></mesh>
    {level > 0 && <>
      <mesh position={[0, bottom + .08 + waterHeight / 2, 0]}><cylinderGeometry args={[radius - wall * 1.7, radius - wall * 1.7, waterHeight, 56]} /><meshPhysicalMaterial color={waterColor} transparent opacity={particleLens ? .075 : .27} roughness={.16} depthWrite={false} /></mesh>
      <mesh position={[0, meniscusY, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[radius - wall * 1.6, 56]} /><meshPhysicalMaterial color={waterColor} transparent opacity={particleLens ? .09 : .24} roughness={.14} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh position={[0, meniscusY, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius - wall * 1.9, .013, 8, 56]} /><meshBasicMaterial color="#b6e8f2" transparent opacity={.52} /></mesh>
    </>}
    {graduated && markings && <mesh position={[0, .005, radius + .007]}><planeGeometry args={[radius * .54, (height - .15) * 640 / 576]} /><meshBasicMaterial map={markings} transparent opacity={.8} side={THREE.DoubleSide} depthWrite={false} /></mesh>}
    <mesh position={[-radius * .56, 0, radius * .83]} scale={[.018, height * .38, .01]}><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={.46} depthWrite={false} /></mesh>
    <mesh position={[radius * .61, height * .07, radius * .79]} scale={[.011, height * .27, .008]}><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={.29} depthWrite={false} /></mesh>
  </group>;
}

export function LabBench({ position = [0, -1.3, 0], width = 3.8, depth = 2.8 }: { position?: Vec3; width?: number; depth?: number }) {
  return <group position={[...position]}>
    <mesh receiveShadow><boxGeometry args={[width, .1, depth]} /><meshStandardMaterial color="#edf3f8" roughness={.55} /></mesh>
    <mesh position={[0, -.075, 0]}><boxGeometry args={[width * .97, .055, depth * .97]} /><meshStandardMaterial color="#7794b1" roughness={.36} metalness={.2} /></mesh>
    <mesh position={[0, -.108, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, depth / width, 1]}><circleGeometry args={[width * .63, 48]} /><meshBasicMaterial color="#7392b0" transparent opacity={.12} depthWrite={false} /></mesh>
  </group>;
}

export function StudioLights() {
  return <><ambientLight intensity={.75} /><hemisphereLight args={['#ffffff', '#adbed0', .85]} />
    <directionalLight position={[3.5, 6, 5]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
    <directionalLight position={[-4, 2.5, 2]} intensity={.7} color="#bedef4" />
    <directionalLight position={[1, 3, -4]} intensity={1.25} color="#ffffff" />
  </>;
}
