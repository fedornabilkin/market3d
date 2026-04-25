import * as THREE from 'three';
import { Entity } from './Entity';

export interface TorusParams {
  radius: number;
  tube: number;
  /** Число сегментов вдоль главного круга. По умолчанию 32. */
  segments?: number;
  /** Число сегментов поперечного сечения тора. По умолчанию 16. */
  tubularSegments?: number;
}

export class TorusEntity extends Entity<TorusParams> {
  readonly type = 'torus' as const;

  createGeometry(): THREE.BufferGeometry {
    const { radius, tube, segments = 32, tubularSegments = 16 } = this.params;
    return new THREE.TorusGeometry(radius, tube, tubularSegments, segments);
  }

  getHalfHeight(): number {
    return this.params.tube;
  }
}
