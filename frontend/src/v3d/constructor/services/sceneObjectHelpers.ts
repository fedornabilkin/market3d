import * as THREE from 'three';
import type { ModelNode } from '../nodes/ModelNode';
import { Primitive } from '../nodes/Primitive';
import { GroupNode } from '../nodes/GroupNode';
import { ImportedMeshNode } from '../nodes/ImportedMeshNode';
import type { ModelTreeJSON } from '../types';

/**
 * Half-height offset, который Primitive/ImportedMeshNode применяют в
 * `applyParamsToMesh`: `mesh.position.z = params.position.z + halfHeight`
 * (Z-up). GroupNode сам сдвиг не делает — у него halfHeight = 0.
 *
 * Используется в drag-handlers, applyMirror, FeatureRenderer-bridge и т.д.
 */
export function getNodeHalfHeight(node: ModelNode | null | undefined): number {
  if (node instanceof Primitive) return node.getHalfHeight();
  if (node instanceof ImportedMeshNode) return node.getHalfHeight();
  return 0;
}

/**
 * Парный walk ModelTreeJSON ↔ ModelNode. Дерево JSON получено через
 * Serializer.toJSON, который проходит ModelNode-tree рекурсивно с тем же
 * порядком детей — структура идентична. Заполняет map: каждый JSON-узел
 * указывает на свой ModelNode.
 *
 * Используется в `ConstructorSceneService.rebuildSceneFromTree` для
 * render-cutover'а: после миграции featureId → JSON, эта map даёт
 * JSON → ModelNode, итого featureId → ModelNode для проброса userData.node.
 */
export function pairTrees(
  json: ModelTreeJSON,
  node: ModelNode,
  out: Map<ModelTreeJSON, ModelNode>,
): void {
  out.set(json, node);
  if (json.kind === 'group' && node instanceof GroupNode) {
    const len = Math.min(json.children.length, node.children.length);
    for (let i = 0; i < len; i++) {
      pairTrees(json.children[i], node.children[i], out);
    }
  }
}

/**
 * Парный walk двух ModelTreeJSON-деревьев одной структуры. Используется в
 * load-flip пути: один tree получен из `featureDocumentToLegacy` (с trace
 * featureId → этот tree), другой — из `Serializer.toRootJSON(ModelNode-tree)`,
 * где ModelNode-tree был построен из того же v2. Две копии структурно
 * идентичны (тот же порядок детей), но это разные объекты в памяти, и
 * нам нужна map между ними.
 */
export function pairTreesByPosition(
  a: ModelTreeJSON,
  b: ModelTreeJSON,
  out: Map<ModelTreeJSON, ModelTreeJSON>,
): void {
  out.set(a, b);
  if (a.kind === 'group' && b.kind === 'group') {
    const len = Math.min(a.children.length, b.children.length);
    for (let i = 0; i < len; i++) {
      pairTreesByPosition(a.children[i], b.children[i], out);
    }
  }
}

/**
 * Рекурсивно диспозит геометрии и материалы всех Mesh/LineSegments-детей
 * obj. Сам obj (если Group) не освобождается — caller сам решает что с ним
 * делать.
 *
 * Шаренные геометрии (`userData.sharedGeometry === true`, у ImportedMesh)
 * НЕ диспозим — иначе каждый rebuild вызывал бы перезалив многомегабайтных
 * аттрибутов на GPU.
 */
export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const shared = (child.userData as { sharedGeometry?: boolean }).sharedGeometry;
      if (!shared) child.geometry?.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    } else if (child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      (child.material as THREE.Material | undefined)?.dispose();
    }
  });
}

/** Normalize angle to [-π, π] range. */
export function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
