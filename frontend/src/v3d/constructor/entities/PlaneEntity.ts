import * as THREE from 'three';
import { Entity } from './Entity';

export interface PlaneParams {
  width: number;
  height: number;
}

export class PlaneEntity extends Entity<PlaneParams> {
  readonly type = 'plane' as const;

  createGeometry(): THREE.BufferGeometry {
    const { width, height } = this.params;
    return new THREE.PlaneGeometry(width, height, 1, 1);
  }

  getHalfHeight(): number {
    return this.params.height / 2;
  }
}
