import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { CylinderParams } from '../../entities/CylinderEntity';

export interface CylinderFeatureParams extends CylinderParams {
  color?: string;
}

export class CylinderFeature extends LeafFeature<CylinderFeatureParams> {
  readonly type: FeatureType = 'cylinder';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitCylinder(this); }
}
