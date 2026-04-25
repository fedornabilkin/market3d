import { CompositeFeature } from '../CompositeFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';

export type BooleanOperation = 'union' | 'subtract' | 'intersect';

export interface BooleanFeatureParams {
  operation: BooleanOperation;
  color?: string;
}

/**
 * CSG-композит: первый input — solid, последующие комбинируются через
 * operation. Кроме того, если у любого входа output.isHole === true,
 * он принудительно вычитается (вне зависимости от operation), как и в
 * текущем GroupNode.getMesh.
 *
 * Реализация эвалюации — в EvaluateVisitor + features/csg/booleanCsg.ts
 * (использует three-bvh-csg).
 */
export class BooleanFeature extends CompositeFeature<BooleanFeatureParams> {
  readonly type: FeatureType = 'boolean';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitBoolean(this); }
}
