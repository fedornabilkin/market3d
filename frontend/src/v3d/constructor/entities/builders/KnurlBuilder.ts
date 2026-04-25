import { EntityBuilder } from './EntityBuilder';
import { KnurlEntity, type KnurlParams } from '../KnurlEntity';

export class KnurlBuilder extends EntityBuilder<KnurlEntity, KnurlParams> {
  static readonly DEFAULTS: KnurlParams = {
    outerDiameter: 10,
    innerDiameter: 9,
    height: 10,
    notchCount: 16,
    pattern: 'straight',
    angle: 30,
    segmentsPerNotch: 6,
    heightSegments: 24,
  };

  outerDiameter(value: number): this {
    this.params.outerDiameter = value;
    return this;
  }

  innerDiameter(value: number): this {
    this.params.innerDiameter = value;
    return this;
  }

  height(value: number): this {
    this.params.height = value;
    return this;
  }

  notchCount(value: number): this {
    this.params.notchCount = value;
    return this;
  }

  pattern(value: KnurlParams['pattern']): this {
    this.params.pattern = value;
    return this;
  }

  angle(value: number): this {
    this.params.angle = value;
    return this;
  }

  segmentsPerNotch(value: number): this {
    this.params.segmentsPerNotch = value;
    return this;
  }

  heightSegments(value: number): this {
    this.params.heightSegments = value;
    return this;
  }

  build(): KnurlEntity {
    return new KnurlEntity({ ...KnurlBuilder.DEFAULTS, ...this.params });
  }
}
