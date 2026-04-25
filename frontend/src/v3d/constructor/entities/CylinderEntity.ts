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
    let geo: THREE.BufferGeometry;
    if (bevelR > 0) {
      const bevelSeg = Math.max(1, Math.round(Number(this.params.bevelSegments) || 3));
      geo = new RoundedCylinderBufferGeometry(
        radiusTop, radiusBottom, height, segments, bevelR, bevelSeg,
      );
    } else {
      geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
    }
    // three.js CylinderGeometry строится вдоль Y. В Z-up сцене ось примитива
    // должна быть Z — поворачиваем геометрию один раз, halfHeight остаётся
    // равной height/2 (она вдоль оси цилиндра).
    geo.rotateX(Math.PI / 2);
    return geo;
  }

  getHalfHeight(): number {
    return this.params.height / 2;
  }
}
