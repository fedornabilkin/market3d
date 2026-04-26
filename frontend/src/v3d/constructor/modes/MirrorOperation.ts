import * as THREE from 'three';
import type { ModelNode } from '../nodes/ModelNode';

export type MirrorAxis = 'x' | 'y' | 'z';

export interface MirrorOperationContext {
  /** Найти three.js-объект, соответствующий node, в текущей сцене. */
  findObject3DByNode(node: ModelNode): THREE.Object3D | null;
  /** Полная пересборка сцены — нужна между before/after снапшотами. */
  rebuildSceneFromTree(): void;
  /** Корневая three.js-группа, fallback parent для расчёта инверсной матрицы. */
  rootGroup: THREE.Group | null;
}

/**
 * Зеркалирование ноды по оси с компенсацией визуального центра.
 *
 * Простая версия `node.params.scale[axis] *= -1` отражает ноду вокруг её
 * **origin'а** (params.position). Для группы, чей origin не совпадает с
 * центром визуального bbox'а, объект уезжает с прежнего места.
 *
 * Алгоритм:
 *  1. Сохранить мировой центр AABB до флипа.
 *  2. `scale[axis] *= -1` + rebuild.
 *  3. Сохранить мировой центр AABB после флипа.
 *  4. Перенести разницу в `params.position` (в системе координат родителя:
 *     translation-часть инверсной матрицы родителя обнуляем, т.к. delta —
 *     вектор-разница, не точка).
 *  5. Ещё один rebuild.
 *
 * Возвращает `true` если флип произошёл, `false` если node/object3D не
 * найдены.
 */
export function applyMirror(
  node: ModelNode,
  axis: MirrorAxis,
  ctx: MirrorOperationContext,
): boolean {
  if (!ctx.rootGroup) return false;

  const objBefore = ctx.findObject3DByNode(node);
  if (!objBefore) return false;
  objBefore.updateMatrixWorld(true);
  const centerBefore = new THREE.Box3().setFromObject(objBefore).getCenter(new THREE.Vector3());

  node.params = node.params || {};
  node.params.scale = node.params.scale || { x: 1, y: 1, z: 1 };
  node.params.scale[axis] *= -1;

  ctx.rebuildSceneFromTree();

  const objAfter = ctx.findObject3DByNode(node);
  if (!objAfter) return true; // флип произошёл, компенсация невозможна
  objAfter.updateMatrixWorld(true);
  const centerAfter = new THREE.Box3().setFromObject(objAfter).getCenter(new THREE.Vector3());

  const delta = centerBefore.clone().sub(centerAfter);
  if (delta.lengthSq() < 1e-10) return true;

  // World-space delta → parent-local. Для вектора-разницы (не точки)
  // translation-часть инверсной матрицы родителя обнуляется.
  const parent = objAfter.parent ?? ctx.rootGroup;
  const m = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  m.elements[12] = 0;
  m.elements[13] = 0;
  m.elements[14] = 0;
  delta.applyMatrix4(m);

  node.params.position = node.params.position || { x: 0, y: 0, z: 0 };
  node.params.position.x += delta.x;
  node.params.position.y += delta.y;
  node.params.position.z += delta.z;

  ctx.rebuildSceneFromTree();
  return true;
}
