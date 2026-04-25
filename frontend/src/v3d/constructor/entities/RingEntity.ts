import * as THREE from 'three';
import { Entity } from './Entity';

export interface RingParams {
  innerRadius: number;
  outerRadius: number;
  segments?: number;
}

export class RingEntity extends Entity<RingParams> {
  readonly type = 'ring' as const;

  createGeometry(): THREE.BufferGeometry {
    const { innerRadius, outerRadius, segments = 32 } = this.params;
    return new THREE.RingGeometry(innerRadius, outerRadius, segments);
  }

  getHalfHeight(): number {
    return this.params.outerRadius;
  }
}
