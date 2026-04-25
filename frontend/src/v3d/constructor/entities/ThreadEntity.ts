import type * as THREE from 'three';
import { Entity } from './Entity';
import { generateThreadGeometry } from '../generators/ThreadGenerator';

export interface ThreadParams {
  outerDiameter: number;
  innerDiameter: number;
  /** Шаг резьбы — осевое расстояние за полный оборот (мм). */
  pitch: number;
  /** Количество оборотов. */
  turns: number;
  /** Профиль зуба. Пока только 'trapezoid'. */
  profile?: 'trapezoid';
  /** Сегментов на оборот (гладкость спирали). */
  segmentsPerTurn?: number;
  /** Левая резьба при true. */
  leftHand?: boolean;
}

export class ThreadEntity extends Entity<ThreadParams> {
  readonly type = 'thread' as const;

  createGeometry(): THREE.BufferGeometry {
    return generateThreadGeometry({
      outerDiameter: this.params.outerDiameter,
      innerDiameter: this.params.innerDiameter,
      pitch: this.params.pitch,
      turns: this.params.turns,
      profile: this.params.profile ?? 'trapezoid',
      segmentsPerTurn: this.params.segmentsPerTurn ?? 64,
      leftHand: this.params.leftHand === true,
    });
  }

  getHalfHeight(): number {
    return (this.params.pitch * this.params.turns) / 2;
  }
}
