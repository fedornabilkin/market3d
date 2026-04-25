import * as THREE from 'three';
import { Entity } from './Entity';

export interface SphereParams {
  radius: number;
  widthSegments?: number;
  heightSegments?: number;
}

export class SphereEntity extends Entity<SphereParams> {
  readonly type = 'sphere' as const;

  createGeometry(): THREE.BufferGeometry {
    const { radius, widthSegments = 16, heightSegments = 16 } = this.params;
    return new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  }

  getHalfHeight(): number {
    return this.params.radius;
  }
}
