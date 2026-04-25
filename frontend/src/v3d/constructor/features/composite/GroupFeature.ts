import { CompositeFeature } from '../CompositeFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';

export interface GroupFeatureParams {
  color?: string;
  isHole?: boolean;
}

/**
 * Логический контейнер без CSG. Эвалюация возвращает CompositeOutput —
 * рендер-слой видит детей независимо и кладёт их в THREE.Group с
 * userData.selectAsUnit, чтобы клик по любому ребёнку выделял всю группу.
 *
 * Используется для merge-операции в стиле TinkerCAD: дети просто двигаются
 * вместе, без булеана.
 */
export class GroupFeature extends CompositeFeature<GroupFeatureParams> {
  readonly type: FeatureType = 'group';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitGroup(this); }
}
