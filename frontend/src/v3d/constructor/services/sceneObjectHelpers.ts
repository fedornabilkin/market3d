import * as THREE from 'three';

export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const shared = (child.userData as { sharedGeometry?: boolean }).sharedGeometry;
      if (!shared) child.geometry?.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    } else if (child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      (child.material as THREE.Material | undefined)?.dispose();
    }
  });
}

/** Normalize angle to [-PI, PI] range. */
export function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
