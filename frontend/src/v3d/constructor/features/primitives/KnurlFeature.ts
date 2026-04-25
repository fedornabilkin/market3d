import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { KnurlParams } from '../../entities/KnurlEntity';

export interface KnurlFeatureParams extends KnurlParams {
  color?: string;
}

export class KnurlFeature extends LeafFeature<KnurlFeatureParams> {
  readonly type: FeatureType = 'knurl';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitKnurl(this); }
}
