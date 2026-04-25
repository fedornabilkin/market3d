import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { TorusParams } from '../../entities/TorusEntity';

export interface TorusFeatureParams extends TorusParams {
  color?: string;
}

export class TorusFeature extends LeafFeature<TorusFeatureParams> {
  readonly type: FeatureType = 'torus';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitTorus(this); }
}
