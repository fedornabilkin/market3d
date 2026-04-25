import { EntityBuilder } from './EntityBuilder';
import { SphereEntity, type SphereParams } from '../SphereEntity';

export class SphereBuilder extends EntityBuilder<SphereEntity, SphereParams> {
  static readonly DEFAULTS: SphereParams = {
    radius: 10,
    widthSegments: 32,
    heightSegments: 32,
  };

  radius(value: number): this {
    this.params.radius = value;
    return this;
  }

  widthSegments(value: number): this {
    this.params.widthSegments = value;
    return this;
  }

  heightSegments(value: number): this {
    this.params.heightSegments = value;
    return this;
  }

  build(): SphereEntity {
    return new SphereEntity({ ...SphereBuilder.DEFAULTS, ...this.params });
  }
}
