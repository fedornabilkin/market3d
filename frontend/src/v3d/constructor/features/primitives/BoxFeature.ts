import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { BoxParams } from '../../entities/BoxEntity';

export interface BoxFeatureParams extends BoxParams {
  /** Цвет и hole флаг живут в Transform/Boolean, но для удобства можно задать на самой фиче. */
  color?: string;
}

export class BoxFeature extends LeafFeature<BoxFeatureParams> {
  readonly type: FeatureType = 'box';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitBox(this); }
}
