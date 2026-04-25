import { EntityBuilder } from './EntityBuilder';
import { RingEntity, type RingParams } from '../RingEntity';

export class RingBuilder extends EntityBuilder<RingEntity, RingParams> {
  static readonly DEFAULTS: RingParams = {
    innerRadius: 5,
    outerRadius: 10,
    segments: 32,
  };

  innerRadius(value: number): this {
    this.params.innerRadius = value;
    return this;
  }

  outerRadius(value: number): this {
    this.params.outerRadius = value;
    return this;
  }

  segments(value: number): this {
    this.params.segments = value;
    return this;
  }

  build(): RingEntity {
    return new RingEntity({ ...RingBuilder.DEFAULTS, ...this.params });
  }
}
