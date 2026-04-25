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
    // TorusGeometry лежит в XY плоскости (отверстие смотрит по +Z) — это
    // уже Z-up-ориентация, дополнительной ротации не нужно. Но в текущем
    // Y-up режиме оно лежало «лежа на боку», а теперь в Z-up — оно лежит
    // правильно горизонтально, как кольцо на столе.
    return new THREE.TorusGeometry(radius, tube, tubularSegments, segments);
  }

  getHalfHeight(): number {
    return this.params.tube;
  }
}
