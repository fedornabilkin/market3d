import * as THREE from 'three';
import type { ModelNode } from '../nodes/ModelNode';
import { Primitive } from '../nodes/Primitive';
import { bakeRotation } from '../primitiveTransforms';

export interface BakeRotationHost {
  selectedObject3D: THREE.Object3D | null;
  /**
   * Перестраивает геометрию примитива in-place (после смены geometryParams).
   * Передан как колбэк, чтобы не тащить сюда зависимости edge-lines / addEdgeLines.
   */
  updatePrimitiveGeometryInPlace(prim: Primitive, mesh: THREE.Mesh): void;
  /** Перевыставляет target гизмо после изменения размеров. */
  updateGizmoTarget(): void;
  /** Hook для уведомления Constructor.vue о мутации (для history). */
  options: { onNodeParamsChanged?: (node: ModelNode) => void };
}

/**
 * После завершения rotation-drag'а: если результат выровнен по 90°, печёт
 * вращение в геометрические размеры (swap width/height/depth для box) и
 * сбрасывает rotation в 0.
 *
 * Использует `bakeRotation()` из `primitiveTransforms` (чистая функция).
 * Этот же метод применяет результат к ноду, 3D-объекту и гизмо.
 *
 * Для группового узла или не-выровненного rotation — no-op.
 *
 * Извлечено из `ConstructorSceneService.bakeRotationIntoDimensions`.
 */
export function bakeRotationIntoDimensions(
  node: ModelNode,
  host: BakeRotationHost,
): void {
  const rot = node.params?.rotation;
  if (!rot) return;

  if (!(node instanceof Primitive)) {
    // Группы держат своё вращение — handles адаптируются. Не печём.
    return;
  }

  const transform = {
    position: node.params!.position || { x: 0, y: 0, z: 0 },
    scale: node.params!.scale || { x: 1, y: 1, z: 1 },
    rotation: { ...rot },
  };
  const result = bakeRotation(node.type, { ...node.geometryParams }, transform);
  if (!result.baked) return;

  node.geometryParams.width = result.geom.width;
  node.geometryParams.height = result.geom.height;
  node.geometryParams.depth = result.geom.depth;
  node.params!.position = result.transform.position;
  node.params!.scale = result.transform.scale;
  rot.x = 0; rot.y = 0; rot.z = 0;

  const obj = host.selectedObject3D;
  if (obj) {
    obj.rotation.set(0, 0, 0);
    obj.scale.set(result.transform.scale.x, result.transform.scale.y, result.transform.scale.z);
    host.updatePrimitiveGeometryInPlace(node, obj as THREE.Mesh);
  }

  host.updateGizmoTarget();
  host.options.onNodeParamsChanged?.(node);
}
