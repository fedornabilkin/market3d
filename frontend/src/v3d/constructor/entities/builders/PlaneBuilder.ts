import { EntityBuilder } from './EntityBuilder';
import { PlaneEntity, type PlaneParams } from '../PlaneEntity';

export class PlaneBuilder extends EntityBuilder<PlaneEntity, PlaneParams> {
  static readonly DEFAULTS: PlaneParams = { width: 20, height: 20 };

  width(value: number): this {
    this.params.width = value;
    return this;
  }

  height(value: number): this {
    this.params.height = value;
    return this;
  }

  build(): PlaneEntity {
    return new PlaneEntity({ ...PlaneBuilder.DEFAULTS, ...this.params });
  }
}
