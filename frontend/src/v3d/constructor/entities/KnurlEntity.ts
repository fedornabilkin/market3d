import type * as THREE from 'three';
import { Entity } from './Entity';
import { generateKnurlGeometry } from '../generators/KnurlGenerator';
import type { KnurlSettings } from '../generators/KnurlGenerator';

export interface KnurlParams {
  outerDiameter: number;
  innerDiameter: number;
  height: number;
  notchCount: number;
  pattern: KnurlSettings['pattern'];
  /** Угол наклона для диагональных/ромб. паттернов (град, 0..60). */
  angle?: number;
  /** Угловое разрешение на одну насечку. */
  segmentsPerNotch?: number;
  /** Вертикальное разрешение. */
  heightSegments?: number;
}

export class KnurlEntity extends Entity<KnurlParams> {
  readonly type = 'knurl' as const;

  createGeometry(): THREE.BufferGeometry {
    return generateKnurlGeometry({
      outerDiameter: this.params.outerDiameter,
      innerDiameter: this.params.innerDiameter,
      height: this.params.height,
      notchCount: this.params.notchCount,
      pattern: this.params.pattern,
      angle: this.params.angle ?? 30,
      segmentsPerNotch: this.params.segmentsPerNotch ?? 6,
      heightSegments: this.params.heightSegments ?? 24,
    });
  }

  getHalfHeight(): number {
    return this.params.height / 2;
  }
}
