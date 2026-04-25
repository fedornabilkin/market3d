import { EntityBuilder } from './EntityBuilder';
import { ConeEntity, type ConeParams } from '../ConeEntity';

export class ConeBuilder extends EntityBuilder<ConeEntity, ConeParams> {
  static readonly DEFAULTS: ConeParams = { radius: 10, height: 20, segments: 32 };

  radius(value: number): this {
    this.params.radius = value;
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

  build(): ConeEntity {
    return new ConeEntity({ ...ConeBuilder.DEFAULTS, ...this.params });
  }
}
