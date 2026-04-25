import * as THREE from 'three';
import { Entity } from './Entity';
import { RoundedCylinderBufferGeometry } from '../geometry/RoundedCylinderBufferGeometry';

export interface CylinderParams {
  radiusTop: number;
  radiusBottom: number;
  height: number;
  segments?: number;
  /** Радиус фаски верхних/нижних рёбер. 0 — без закругления. */
  bevelRadius?: number;
  bevelSegments?: number;
}

export class CylinderEntity extends Entity<CylinderParams> {
  readonly type = 'cylinder' as const;

  createGeometry(): THREE.BufferGeometry {
    const { radiusTop, radiusBottom, height, segments = 32 } = this.params;
    const bevelR = Number(this.params.bevelRadius) || 0;
    if (bevelR > 0) {
      const bevelSeg = Math.max(1, Math.round(Number(this.params.bevelSegments) || 3));
      return new RoundedCylinderBufferGeometry(
        radiusTop, radiusBottom, height, segments, bevelR, bevelSeg,
      );
    }
    return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  }

  getHalfHeight(): number {
    return this.params.height / 2;
  }
}
