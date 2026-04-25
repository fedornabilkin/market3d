import { EntityBuilder } from './EntityBuilder';
import { CylinderEntity, type CylinderParams } from '../CylinderEntity';

export class CylinderBuilder extends EntityBuilder<CylinderEntity, CylinderParams> {
  static readonly DEFAULTS: CylinderParams = {
    radiusTop: 10,
    radiusBottom: 10,
    height: 20,
    segments: 32,
  };

  radiusTop(value: number): this {
    this.params.radiusTop = value;
    return this;
  }

  radiusBottom(value: number): this {
    this.params.radiusBottom = value;
    return this;
  }

  /** Задать верхний и нижний радиусы одной цифрой (обычный цилиндр). */
  radius(value: number): this {
    this.params.radiusTop = value;
    this.params.radiusBottom = value;
    return this;
  }

  height(value: number): this {
    this.params.height = value;
    return this;
  }

  segments(value: number): this {
    this.params.segments = value;
    return this;
  }

  bevel(radius: number, segments = 3): this {
    this.params.bevelRadius = radius;
    this.params.bevelSegments = segments;
    return this;
  }

  build(): CylinderEntity {
    return new CylinderEntity({ ...CylinderBuilder.DEFAULTS, ...this.params });
  }
}
