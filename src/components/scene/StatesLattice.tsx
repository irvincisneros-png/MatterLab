import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ICE_LATTICE_LINKS } from '../../science/matterEngine';

type Positioned = { id: number; phase: string; position: readonly [number, number, number] };

/**
 * Pale links between neighbouring molecules that are in the solid phase. They
 * join the lattice sites into six-sided rings so the ordered, open ice
 * structure reads at a glance. They follow the (vibrating) molecule centres,
 * and disappear for any molecule that has left the solid.
 */
export function LatticeLinks({ molecules, radius = 0.0075, colour = '#6fc4e4' }: { molecules: readonly Positioned[]; radius?: number; colour?: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  const geometry = useMemo(() => new THREE.CylinderGeometry(radius, radius, 1, 6), [radius]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.7, depthWrite: false }), [colour]);
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const helper = new THREE.Object3D();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    ICE_LATTICE_LINKS.forEach(([from, to], index) => {
      const first = molecules[from];
      const second = molecules[to];
      if (!first || !second || first.phase !== 'solid' || second.phase !== 'solid') {
        helper.position.set(0, 0, 0);
        helper.scale.setScalar(0);
        helper.quaternion.identity();
      } else {
        a.set(...first.position);
        b.set(...second.position);
        const direction = b.clone().sub(a);
        const length = direction.length();
        helper.position.copy(a).add(b).multiplyScalar(0.5);
        helper.quaternion.setFromUnitVectors(up, direction.normalize());
        helper.scale.set(1, length, 1);
      }
      helper.updateMatrix();
      instanced.setMatrixAt(index, helper.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [molecules, invalidate]);
  return <instancedMesh ref={mesh} args={[geometry, material, ICE_LATTICE_LINKS.length]} frustumCulled={false} />;
}
