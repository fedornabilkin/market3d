import * as THREE from 'three';
import type { FeatureDocument } from '../features/FeatureDocument';
import type { FeatureId } from '../features/types';
import { TransformFeature } from '../features/composite/TransformFeature';
import { ensureTransformWrapper } from '../features/utils/dagMutations';

export type AlignMode =
  | 'minX' | 'centerX' | 'maxX'
  | 'minY' | 'centerY' | 'maxY'
  | 'minZ' | 'centerZ' | 'maxZ';

export interface AlignmentFeatureOperationContext {
  /** World-space AABB фичи через рендер. Возвращает null если меш ещё не отрендерен. */
  computeBboxByFeatureId(featureId: FeatureId): THREE.Box3 | null;
}

/**
 * Alignment по выделенным фичам через FeatureDocument API. Параллельная
 * реализация `alignNodes` из Constructor.vue, но без ModelNode/THREE.js
 * raycasting — bbox получаем через context (фактически из рендера).
 *
 * Алгоритм:
 *  1. Замеряем bbox у каждой фичи (anchor — первая в списке).
 *  2. Считаем target value по mode (minX/maxX/centerX/minY/...).
 *  3. Для каждой не-anchor фичи: ensureTransformWrapper, потом updateParams
 *     с компенсирующим position-сдвигом. delta = target - current — в
 *     world-space, но при условии что parent transforms identity (для
 *     root-уровневых фич) это эквивалентно local. Для вложенных фич
 *     применяется текущая семантика: world-space delta идёт прямо в
 *     parent-local position транзитивно (так же делал legacy applyMirror).
 */
export class AlignmentFeatureOperation {
  constructor(private readonly ctx: AlignmentFeatureOperationContext) {}

  static computeAxisValue(box: THREE.Box3, mode: AlignMode): number {
    switch (mode) {
      case 'minX':    return box.min.x;
      case 'maxX':    return box.max.x;
      case 'centerX': return (box.min.x + box.max.x) / 2;
      case 'minY':    return box.min.y;
      case 'maxY':    return box.max.y;
      case 'centerY': return (box.min.y + box.max.y) / 2;
      case 'minZ':    return box.min.z;
      case 'maxZ':    return box.max.z;
      case 'centerZ': return (box.min.z + box.max.z) / 2;
    }
  }

  static axisOf(mode: AlignMode): 'x' | 'y' | 'z' {
    if (mode === 'minX' || mode === 'maxX' || mode === 'centerX') return 'x';
    if (mode === 'minY' || mode === 'maxY' || mode === 'centerY') return 'y';
    return 'z';
  }

  run(doc: FeatureDocument, featureIds: readonly FeatureId[], mode: AlignMode): boolean {
    if (featureIds.length < 2) return false;

    const entries: { id: FeatureId; box: THREE.Box3 }[] = [];
    for (const id of featureIds) {
      const box = this.ctx.computeBboxByFeatureId(id);
      if (box) entries.push({ id, box });
    }
    if (entries.length < 2) return false;

    const target = AlignmentFeatureOperation.computeAxisValue(entries[0].box, mode);
    const axis = AlignmentFeatureOperation.axisOf(mode);
    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

    for (let i = 1; i < entries.length; i++) {
      const { id, box } = entries[i];
      const current = AlignmentFeatureOperation.computeAxisValue(box, mode);
      const delta = target - current;
      if (Math.abs(delta) < 1e-9) continue;

      const transformId = ensureTransformWrapper(doc, id);
      const transform = doc.graph.get(transformId);
      if (!(transform instanceof TransformFeature)) continue;
      const cur = transform.params.position;
      const next: [number, number, number] = [cur[0], cur[1], cur[2]];
      next[axisIdx] += delta;
      doc.updateParams<{ position: [number, number, number] }>(transformId, { position: next });
    }
    return true;
  }
}
