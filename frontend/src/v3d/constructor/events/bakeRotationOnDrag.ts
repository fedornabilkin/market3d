import * as THREE from 'three';
import type { FeatureDocument } from '../features/FeatureDocument';
import type { FeatureId } from '../features/types';
import { TransformFeature } from '../features/composite/TransformFeature';
import { BoxFeature } from '../features/primitives/BoxFeature';
import { bakeRotation } from '../primitiveTransforms';

export interface BakeRotationHost {
  selectedObject3D: THREE.Object3D | null;
  /** Перевыставляет target гизмо после изменения размеров. */
  updateGizmoTarget(): void;
  /** Hook для уведомления Constructor.vue (для history snapshot). */
  options: { onNodeParamsChanged?: () => void };
}

/**
 * После завершения rotation-drag'а: если результат выровнен по 90°, печёт
 * вращение в геометрические размеры BoxFeature (swap width↔height/depth) и
 * сбрасывает Transform.rotation в 0.
 *
 * Использует `bakeRotation()` из `primitiveTransforms` (чистая функция).
 *
 * Поддерживается только Box (Cylinder/Cone имеют осевую симметрию вокруг Z —
 * 90°-bake не имеет смысла). Для group/boolean/non-box leaf — no-op.
 */
export function bakeRotationIntoDimensions(
  featureId: FeatureId,
  doc: FeatureDocument,
  host: BakeRotationHost,
): void {
  const transform = doc.graph.get(featureId);
  if (!(transform instanceof TransformFeature)) return;

  const inner = transform.getInputs()[0];
  if (!inner) return;
  const innerFeature = doc.graph.get(inner);
  if (!(innerFeature instanceof BoxFeature)) return;

  const tp = transform.params;
  const transformView = {
    position: { x: tp.position[0], y: tp.position[1], z: tp.position[2] },
    scale: { x: tp.scale[0], y: tp.scale[1], z: tp.scale[2] },
    rotation: { x: tp.rotation[0], y: tp.rotation[1], z: tp.rotation[2] },
  };
  const boxParams = innerFeature.params;
  const geomView = {
    width: boxParams.width,
    height: boxParams.height,
    depth: boxParams.depth,
  };

  const result = bakeRotation('box', { ...geomView }, transformView);
  if (!result.baked) return;

  // Mutate inner BoxFeature.params (width/height/depth) и Transform.params
  // (position/scale/rotation) через featureDoc API → автоматический recompute.
  doc.updateParams(inner, {
    width: result.geom.width,
    height: result.geom.height,
    depth: result.geom.depth,
  });
  doc.updateParams(featureId, {
    position: [result.transform.position.x, result.transform.position.y, result.transform.position.z],
    scale: [result.transform.scale.x, result.transform.scale.y, result.transform.scale.z],
    rotation: [0, 0, 0],
  });

  host.updateGizmoTarget();
  host.options.onNodeParamsChanged?.();
}
