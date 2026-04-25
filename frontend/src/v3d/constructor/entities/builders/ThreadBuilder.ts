import { EntityBuilder } from './EntityBuilder';
import { ThreadEntity, type ThreadParams } from '../ThreadEntity';

export class ThreadBuilder extends EntityBuilder<ThreadEntity, ThreadParams> {
  static readonly DEFAULTS: ThreadParams = {
    outerDiameter: 10,
    innerDiameter: 8,
    pitch: 2,
    turns: 5,
    profile: 'trapezoid',
    segmentsPerTurn: 64,
    leftHand: false,
  };

  outerDiameter(value: number): this {
    this.params.outerDiameter = value;
    return this;
  }

  innerDiameter(value: number): this {
    this.params.innerDiameter = value;
    return this;
  }

  pitch(value: number): this {
    this.params.pitch = value;
    return this;
  }

  turns(value: number): this {
    this.params.turns = value;
    return this;
  }

  segmentsPerTurn(value: number): this {
    this.params.segmentsPerTurn = value;
    return this;
  }

  leftHand(value = true): this {
    this.params.leftHand = value;
    return this;
  }

  build(): ThreadEntity {
    return new ThreadEntity({ ...ThreadBuilder.DEFAULTS, ...this.params });
  }
}
