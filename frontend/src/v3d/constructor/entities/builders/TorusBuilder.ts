import { EntityBuilder } from './EntityBuilder';
import { TorusEntity, type TorusParams } from '../TorusEntity';

export class TorusBuilder extends EntityBuilder<TorusEntity, TorusParams> {
  static readonly DEFAULTS: TorusParams = {
    radius: 10,
    tube: 2,
    segments: 32,
    tubularSegments: 16,
  };

  radius(value: number): this {
    this.params.radius = value;
    return this;
  }

  tube(value: number): this {
    this.params.tube = value;
    return this;
  }

  segments(value: number): this {
    this.params.segments = value;
    return this;
  }

  tubularSegments(value: number): this {
    this.params.tubularSegments = value;
    return this;
  }

  build(): TorusEntity {
    return new TorusEntity({ ...TorusBuilder.DEFAULTS, ...this.params });
  }
}
