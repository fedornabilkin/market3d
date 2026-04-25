import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { RingParams } from '../../entities/RingEntity';

export interface RingFeatureParams extends RingParams {
  color?: string;
}

export class RingFeature extends LeafFeature<RingFeatureParams> {
  readonly type: FeatureType = 'ring';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitRing(this); }
}
