import * as THREE from 'three';
import { Entity } from './Entity';

export interface ConeParams {
  radius: number;
  height: number;
  segments?: number;
}

export class ConeEntity extends Entity<ConeParams> {
  readonly type = 'cone' as const;

  createGeometry(): THREE.BufferGeometry {
    const { radius, height, segments = 32 } = this.params;
    // Tiny top radius, not 0 — иначе CSG даёт вырожденные треугольники.
    return new THREE.CylinderGeometry(0.001, radius, height, segments);
  }

  getHalfHeight(): number {
    return this.params.height / 2;
  }
}
