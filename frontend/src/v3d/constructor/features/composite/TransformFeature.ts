import { CompositeFeature } from '../CompositeFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';

export interface TransformFeatureParams {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  /** Переопределить isHole у входа. */
  isHole?: boolean;
  /** Переопределить color у входа. */
  color?: string;
}

/**
 * Применяет position/rotation/scale к одному входу. Используется как
 * «обёртка» над примитивом или композитом, чтобы развязать «чистую»
 * геометрию (без позиции) от её положения в сцене.
 *
 * inputs[0] — единственный вход.
 */
export class TransformFeature extends CompositeFeature<TransformFeatureParams> {
  readonly type: FeatureType = 'transform';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitTransform(this); }
}
