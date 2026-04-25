import * as THREE from 'three';
import { Entity } from './Entity';
import { RoundedBoxBufferGeometry } from '../geometry/RoundedBoxBufferGeometry';

export interface BoxParams {
  width: number;
  height: number;
  depth: number;
  /** Радиус фаски. 0 — обычный BoxGeometry, >0 — RoundedBoxBufferGeometry. */
  bevelRadius?: number;
  /** Число сегментов фаски (>=1). По умолчанию 3. */
  bevelSegments?: number;
}

export class BoxEntity extends Entity<BoxParams> {
  readonly type = 'box' as const;

  createGeometry(): THREE.BufferGeometry {
    const { width, height, depth } = this.params;
    const bevelR = Number(this.params.bevelRadius) || 0;
    if (bevelR > 0) {
      const bevelSeg = Math.max(1, Math.round(Number(this.params.bevelSegments) || 3));
      return new RoundedBoxBufferGeometry(width, height, depth, bevelSeg, bevelR);
    }
    return new THREE.BoxGeometry(width, height, depth);
  }

  getHalfHeight(): number {
    return this.params.height / 2;
  }
}
