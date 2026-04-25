import { EntityBuilder } from './EntityBuilder';
import { BoxEntity, type BoxParams } from '../BoxEntity';

/**
 * Fluent-билдер куба.
 *
 * Пример:
 *   const box = new BoxBuilder()
 *     .width(20)
 *     .height(10)
 *     .depth(5)
 *     .bevel(1.5, 4)
 *     .build();
 */
export class BoxBuilder extends EntityBuilder<BoxEntity, BoxParams> {
  static readonly DEFAULTS: BoxParams = { width: 20, height: 20, depth: 20 };

  width(value: number): this {
    this.params.width = value;
    return this;
  }

  height(value: number): this {
    this.params.height = value;
    return this;
  }

  depth(value: number): this {
    this.params.depth = value;
    return this;
  }

  /** Включить фаску. `segments` — гладкость закругления (>=1). */
  bevel(radius: number, segments = 3): this {
    this.params.bevelRadius = radius;
    this.params.bevelSegments = segments;
    return this;
  }

  build(): BoxEntity {
    const merged: BoxParams = {
      ...BoxBuilder.DEFAULTS,
      ...this.params,
    };
    return new BoxEntity(merged);
  }
}
