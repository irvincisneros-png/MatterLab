import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Billboard } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ATOM_COLOURS, LabBond } from './LabPrimitives';
import { SceneLabel } from './WaterLabels';
import { lensMoleculeLayout, type HeatingParticle, type LiquidSampleId } from '../../science/waterTopicEngine';

type Vec3 = readonly [number, number, number];
export type MoleculeKind = 'water' | 'ethanol';
type Element = 'oxygen' | 'hydrogen' | 'carbon';
type MoleculeSpec = { atoms: readonly { element: Element; at: Vec3 }[]; bonds: readonly (readonly [number, number])[] };

const RADIUS: Record<Element, number> = { oxygen: 0.092, hydrogen: 0.055, carbon: 0.088 };

/** H₂O: O–H 0.15 (scene units), H–O–H 104.5°, as in LabWaterMolecule. */
const WATER_SPEC: MoleculeSpec = (() => {
  const half = (52.25 * Math.PI) / 180, bond = 0.15;
  return {
    atoms: [
      { element: 'oxygen', at: [0, -0.03, 0] },
      { element: 'hydrogen', at: [-Math.sin(half) * bond, Math.cos(half) * bond - 0.03, 0] },
      { element: 'hydrogen', at: [Math.sin(half) * bond, Math.cos(half) * bond - 0.03, 0] },
    ],
    bonds: [[0, 1], [0, 2]],
  };
})();

/** CH₃–CH₂–OH drawn with approximate bond lengths and tetrahedral angles (1 Å = 0.1 scene unit). */
const ETHANOL_SPEC: MoleculeSpec = (() => {
  const raw: { element: Element; at: Vec3 }[] = [
    { element: 'carbon', at: [0, 0, 0] }, { element: 'carbon', at: [1.52, 0, 0] }, { element: 'oxygen', at: [2.0, 1.35, 0] },
    { element: 'hydrogen', at: [2.95, 1.55, 0] },
    { element: 'hydrogen', at: [-0.36, -0.51, 0.89] }, { element: 'hydrogen', at: [-0.36, -0.51, -0.89] }, { element: 'hydrogen', at: [-0.36, 1.03, 0] },
    { element: 'hydrogen', at: [1.88, -0.51, 0.89] }, { element: 'hydrogen', at: [1.88, -0.51, -0.89] },
  ];
  const centre = [0, 1, 2].map((axis) => raw.reduce((sum, atom) => sum + atom.at[axis], 0) / raw.length);
  return {
    atoms: raw.map((atom) => ({ element: atom.element, at: [(atom.at[0] - centre[0]) * 0.1, (atom.at[1] - centre[1]) * 0.1, (atom.at[2] - centre[2]) * 0.1] as const })),
    bonds: [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]],
  };
})();

type Kit = Partial<Record<Element | 'bonds', THREE.BufferGeometry>>;
const kits = new Map<MoleculeKind, Kit>();
function kitFor(kind: MoleculeKind): Kit {
  const cached = kits.get(kind);
  if (cached) return cached;
  const spec = kind === 'water' ? WATER_SPEC : ETHANOL_SPEC;
  const kit: Kit = {};
  for (const element of ['oxygen', 'hydrogen', 'carbon'] as const) {
    const parts = spec.atoms.filter((atom) => atom.element === element).map((atom) => {
      const sphere = new THREE.SphereGeometry(RADIUS[element], 14, 10);
      sphere.translate(...atom.at);
      return sphere;
    });
    if (parts.length) { kit[element] = mergeGeometries(parts, false)!; parts.forEach((part) => part.dispose()); }
  }
  const bondParts = spec.bonds.map(([a, b]) => {
    const from = new THREE.Vector3(...spec.atoms[a].at), to = new THREE.Vector3(...spec.atoms[b].at);
    const direction = to.clone().sub(from);
    const cylinder = new THREE.CylinderGeometry(0.012, 0.012, direction.length(), 6);
    cylinder.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
    const middle = from.add(to).multiplyScalar(0.5);
    cylinder.translate(middle.x, middle.y, middle.z);
    return cylinder;
  });
  kit.bonds = mergeGeometries(bondParts, false)!; bondParts.forEach((part) => part.dispose());
  kits.set(kind, kit);
  return kit;
}

export type MoleculePlacement = { position: Vec3; spin?: number; scale?: number };
type MeshRef = { current: THREE.InstancedMesh | null };

/**
 * Instanced molecules (one InstancedMesh per element + bonds). Water: red O, white H. Ethanol: dark C, red O, white H.
 * `opacity` < 1 makes a faint set (used for water vapour).
 */
export function MoleculeSet({ kind = 'water', items, scale = 1, opacity = 1, visible = true }: { kind?: MoleculeKind; items: readonly MoleculePlacement[]; scale?: number; opacity?: number; visible?: boolean }) {
  const { invalidate } = useThree();
  const kit = useMemo(() => kitFor(kind), [kind]);
  const materials = useMemo(() => {
    const transparent = opacity < 1;
    const make = (colour: string, roughness: number) => new THREE.MeshPhysicalMaterial({ color: colour, roughness, clearcoat: 0.45, transparent, opacity, depthWrite: !transparent });
    return {
      oxygen: make(ATOM_COLOURS.oxygen, 0.28), hydrogen: make(ATOM_COLOURS.hydrogen, 0.24), carbon: make(ATOM_COLOURS.carbon, 0.35),
      bonds: new THREE.MeshStandardMaterial({ color: '#8fa7b8', roughness: 0.45, transparent, opacity, depthWrite: !transparent }),
    };
  }, [opacity]);
  useLayoutEffect(() => () => { Object.values(materials).forEach((material) => material.dispose()); }, [materials]);
  const refs = useMemo<Record<Element | 'bonds', MeshRef>>(() => ({ oxygen: { current: null }, hydrogen: { current: null }, carbon: { current: null }, bonds: { current: null } }), []);
  useLayoutEffect(() => {
    const object = new THREE.Object3D();
    const euler = new THREE.Euler();
    items.forEach((item, index) => {
      const spin = item.spin ?? 0;
      euler.set(spin * 0.8, spin, spin * 0.45);
      object.position.set(...item.position);
      object.quaternion.setFromEuler(euler);
      object.scale.setScalar((item.scale ?? 1) * scale);
      object.updateMatrix();
      for (const mesh of Object.values(refs)) mesh.current?.setMatrixAt(index, object.matrix);
    });
    for (const mesh of Object.values(refs)) if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    invalidate();
  });
  const count = items.length;
  if (count === 0) return null;
  return <group visible={visible}>
    {(['oxygen', 'hydrogen', 'carbon', 'bonds'] as const).map((part) => kit[part] ? <instancedMesh key={`${kind}-${part}-${count}`} ref={refs[part]} args={[kit[part], materials[part], count]} frustumCulled={false} /> : null)}
  </group>;
}

/** Shared radial-gradient texture for lens backing. */
function useLensTexture() {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d'); if (!context) return null;
    const gradient = context.createRadialGradient(64, 56, 6, 64, 64, 64);
    gradient.addColorStop(0, '#2a6fa0'); gradient.addColorStop(0.7, '#164a78'); gradient.addColorStop(1, '#0d3157');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  }, []);
  useLayoutEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

const SAMPLE_WORDS: Record<LiquidSampleId, { name: string; kind: MoleculeKind }> = {
  water20C: { name: 'water', kind: 'water' },
  ethanol20C: { name: 'ethanol', kind: 'ethanol' },
};

/**
 * A clearly framed magnifier ("zoom lens") attached to a vessel by a leader line. It shows representative
 * molecules in a fixed lens volume: close-packed, touching, constantly jostling. Molecule count follows real
 * number density (ethanol: fewer, larger molecules per mL than water). Labelled "not to scale".
 */
export function ParticleLens({ sample = 'water20C', anchor, position, time = 0, radius = 0.52, caption, visible = true, children }: {
  sample?: LiquidSampleId; anchor: Vec3; position: Vec3; time?: number; radius?: number; caption?: string; visible?: boolean; children?: ReactNode;
}) {
  const backing = useLensTexture();
  const { name, kind } = SAMPLE_WORDS[sample];
  const layout = useMemo(() => lensMoleculeLayout(sample, [radius * 0.74, radius * 0.74, radius * 0.38]), [radius, sample]);
  const items = layout.map((molecule, index) => ({
    position: [
      molecule.x + 0.016 * Math.sin(time * 2.1 + index * 1.7),
      molecule.y + 0.016 * Math.cos(time * 1.9 + index * 2.3),
      molecule.z + 0.012 * Math.sin(time * 1.6 + index),
    ] as const,
    spin: molecule.spin + time * 0.8 * (index % 2 ? 1 : -1),
  }));
  const dir = new THREE.Vector3(...position).sub(new THREE.Vector3(...anchor)).normalize();
  const edge: Vec3 = [position[0] - dir.x * radius, position[1] - dir.y * radius, position[2] - dir.z * radius];
  return <group visible={visible}>
    <mesh position={anchor}><sphereGeometry args={[0.035, 12, 8]} /><meshBasicMaterial color="#35d0e0" /></mesh>
    <LabBond from={anchor} to={edge} radius={0.008} colour="#35b9d6" />
    <Billboard position={position}>
      <mesh renderOrder={5}><circleGeometry args={[radius, 48]} /><meshBasicMaterial map={backing ?? undefined} color={backing ? '#ffffff' : '#164a78'} /></mesh>
      <mesh renderOrder={6}><torusGeometry args={[radius, 0.028, 10, 56]} /><meshStandardMaterial color="#e9fbff" metalness={0.35} roughness={0.25} emissive="#35d0e0" emissiveIntensity={0.35} /></mesh>
      <group position={[0, 0, 0.14]}><MoleculeSet kind={kind} items={items} scale={1} /></group>
      {children}
      <SceneLabel position={[0, -radius - 0.06, 0.05]} tone="light" title={caption ?? `Zoom: ${name}`} subtitle="molecules, not to scale" />
    </Billboard>
  </group>;
}

/** Heating-vessel particle view: ordered ice lattice, close-packed liquid, faint sparse vapour. */
export function HeatingParticleView({ particles, visible }: { particles: readonly HeatingParticle[]; visible: boolean }) {
  const solid = particles.filter((particle) => particle.phase === 'solid');
  const liquid = particles.filter((particle) => particle.phase === 'liquid');
  const gas = particles.filter((particle) => particle.phase === 'gas');
  const place = (set: readonly HeatingParticle[]): MoleculePlacement[] => set.map((particle) => ({ position: particle.position, spin: particle.spin }));
  return <group visible={visible}>
    <MoleculeSet items={place(solid)} scale={0.95} />
    <MoleculeSet items={place(liquid)} scale={0.95} />
    <MoleculeSet items={place(gas)} scale={0.95} opacity={0.5} />
  </group>;
}
