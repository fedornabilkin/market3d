import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { PlaneParams } from '../../entities/PlaneEntity';

export interface PlaneFeatureParams extends PlaneParams {
  color?: string;
}

export class PlaneFeature extends LeafFeature<PlaneFeatureParams> {
  readonly type: FeatureType = 'plane';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitPlane(this); }
}
