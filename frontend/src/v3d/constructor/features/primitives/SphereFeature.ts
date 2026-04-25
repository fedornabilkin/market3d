import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { SphereParams } from '../../entities/SphereEntity';

export interface SphereFeatureParams extends SphereParams {
  color?: string;
}

export class SphereFeature extends LeafFeature<SphereFeatureParams> {
  readonly type: FeatureType = 'sphere';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitSphere(this); }
}
