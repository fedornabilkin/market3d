import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { ConeParams } from '../../entities/ConeEntity';

export interface ConeFeatureParams extends ConeParams {
  color?: string;
}

export class ConeFeature extends LeafFeature<ConeFeatureParams> {
  readonly type: FeatureType = 'cone';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitCone(this); }
}
