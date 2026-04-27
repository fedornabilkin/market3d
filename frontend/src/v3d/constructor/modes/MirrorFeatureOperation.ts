import * as THREE from 'three';
import type { FeatureDocument } from '../features/FeatureDocument';
import type { FeatureId } from '../features/types';
import { TransformFeature } from '../features/composite/TransformFeature';
import {
  ensureTransformWrapper,
  computeFeatureBboxRecursive,
} from '../features/utils/dagMutations';

export type MirrorAxis = 'x' | 'y' | 'z';

export interface MirrorFeatureOperationContext {
  /** Найти three.js-объект по featureId — для AABB-измерений в world-space. */
  findObject3DByFeatureId(featureId: FeatureId): THREE.Object3D | null;
  /** Корневая three.js-группа, fallback parent для расчёта инверсной матрицы. */
  rootGroup: THREE.Group | null;
}

/**
 * Mirror через FeatureDocument API. Параллельная реализация классической
 * `MirrorOperation` (которая мутирует ModelNode); здесь — только feature-граф,
 * без знания о ModelNode.
 *
 * Алгоритм симметричен (см. `MirrorOperation.ts`):
 *  1. Гарантируем Transform-обёртку у целевой фичи.
 *  2. Замеряем мировой центр AABB до флипа (через findObject3DByFeatureId,
 *     который читает уже отрендеренный mesh — сцена в актуальном состоянии
 *     к этому моменту).
 *  3. `scale[axis] *= -1` через `updateParams` — featureRenderer обновит
 *     mesh реактивно, через recompute-done event.
 *  4. Замеряем новый мировой центр.
 *  5. Применяем delta = centerBefore - centerAfter в parent-local через
 *     `position += delta` (translation-часть инверсной матрицы родителя
 *     обнуляется — delta это вектор-разница, не точка).
 *
 * Caller должен вызвать operation.run **после** того как featureRenderer
 * последний раз отрендерил scene с актуальным state — иначе centerBefore
 * измерится на устаревшем mesh. На практике это значит: вызывается из
 * mutation flip путей где featureDoc уже синхронизирован.
 */
export class MirrorFeatureOperation {
  constructor(private readonly ctx: MirrorFeatureOperationContext) {}

  run(doc: FeatureDocument, featureId: FeatureId, axis: MirrorAxis): boolean {
    if (!this.ctx.rootGroup) return false;

    const transformId = ensureTransformWrapper(doc, featureId);
    const transform = doc.graph.get(transformId);
    if (!(transform instanceof TransformFeature)) return false;

    const objBefore = this.ctx.findObject3DByFeatureId(transformId)
      ?? this.ctx.findObject3DByFeatureId(featureId);
    if (!objBefore) {
      // Сцена ещё не отрендерила фичу — fallback на bbox через output.
      return this._runWithoutWorldRef(doc, transformId, axis);
    }
    objBefore.updateMatrixWorld(true);
    const centerBefore = new THREE.Box3().setFromObject(objBefore).getCenter(new THREE.Vector3());

    const curScale = transform.params.scale;
    const newScale: [number, number, number] = [...curScale];
    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    newScale[axisIdx] = -newScale[axisIdx];
    doc.updateParams<{ scale: [number, number, number] }>(transformId, { scale: newScale });

    const objAfter = this.ctx.findObject3DByFeatureId(transformId)
      ?? this.ctx.findObject3DByFeatureId(featureId);
    if (!objAfter) return true;
    objAfter.updateMatrixWorld(true);
    const centerAfter = new THREE.Box3().setFromObject(objAfter).getCenter(new THREE.Vector3());

    const delta = centerBefore.clone().sub(centerAfter);
    if (delta.lengthSq() < 1e-10) return true;

    const parent = objAfter.parent ?? this.ctx.rootGroup;
    const m = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    m.elements[12] = 0;
    m.elements[13] = 0;
    m.elements[14] = 0;
    delta.applyMatrix4(m);

    const curPos = transform.params.position;
    doc.updateParams<{ position: [number, number, number] }>(transformId, {
      position: [curPos[0] + delta.x, curPos[1] + delta.y, curPos[2] + delta.z],
    });
    return true;
  }

  /**
   * Fallback-путь: world-меш не найден (например, фича ещё не отрендерилась).
   * Используем `computeFeatureBboxRecursive` — bbox в локальной системе фичи
   * без world-родителя. Подходит для root-уровневых фич, где parent — modelRootGroup.
   */
  private _runWithoutWorldRef(
    doc: FeatureDocument,
    transformId: FeatureId,
    axis: MirrorAxis,
  ): boolean {
    const transform = doc.graph.get(transformId);
    if (!(transform instanceof TransformFeature)) return false;

    const bboxBefore = computeFeatureBboxRecursive(doc, transformId);
    if (!bboxBefore) return false;
    const centerBefore = bboxBefore.getCenter(new THREE.Vector3());

    const curScale = transform.params.scale;
    const newScale: [number, number, number] = [...curScale];
    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    newScale[axisIdx] = -newScale[axisIdx];
    doc.updateParams<{ scale: [number, number, number] }>(transformId, { scale: newScale });

    const bboxAfter = computeFeatureBboxRecursive(doc, transformId);
    if (!bboxAfter) return true;
    const centerAfter = bboxAfter.getCenter(new THREE.Vector3());

    const delta = centerBefore.clone().sub(centerAfter);
    if (delta.lengthSq() < 1e-10) return true;

    const curPos = transform.params.position;
    doc.updateParams<{ position: [number, number, number] }>(transformId, {
      position: [curPos[0] + delta.x, curPos[1] + delta.y, curPos[2] + delta.z],
    });
    return true;
  }
}
