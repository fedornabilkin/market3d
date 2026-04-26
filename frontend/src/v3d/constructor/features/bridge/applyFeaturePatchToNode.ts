import type { ModelNode } from '../../nodes/ModelNode';
import type { FeatureType } from '../types';
import type { CSGType, PrimitiveParams } from '../../types';

/**
 * Duck-typing для ModelNode-подклассов. instanceof не используем, чтобы не
 * импортировать nodes/GroupNode (он тянет three-bvh-csg с circular CJS,
 * ломающим vitest). Фрагменты типов узлов:
 *  - Primitive  : has geometryParams + type
 *  - Imported   : has filename + geometry
 *  - GroupNode  : наследует children/operation/params от ModelNode без своих
 *                 уникальных полей → определяем по отрицанию.
 */
type PrimitiveLike = ModelNode & { geometryParams: PrimitiveParams; type: string };
type ImportedLike = ModelNode & { filename: string };
type GroupLike = ModelNode & { children: ModelNode[]; operation: CSGType };

function isPrimitiveNode(node: ModelNode): node is PrimitiveLike {
  return 'geometryParams' in node && 'type' in node;
}
function isImportedNode(node: ModelNode): node is ImportedLike {
  return 'filename' in node && 'geometry' in node;
}
function isGroupNode(node: ModelNode): node is GroupLike {
  // GroupNode не добавляет своих полей — определяем по отсутствию признаков
  // других подклассов.
  return !isPrimitiveNode(node) && !isImportedNode(node);
}

/**
 * Bridge: маппит patch от FeatureParamsForm.vue (формат FeatureDocument
 * v2 — например `{ position: [x, y, z] }` или `{ width: 25 }`) обратно
 * в мутации legacy ModelNode-tree (source-of-truth до полного flip'а на
 * featureDoc).
 *
 * Возвращает true, если что-то поменялось — caller тогда оборачивает
 * в withHistory и пересобирает сцену.
 *
 * Стратегия по типу фичи:
 *  - Primitive features (box/sphere/.../knurl): width/height/depth/...
 *    идут в `node.geometryParams`. `color` идёт в `node.params.color`.
 *  - TransformFeature: position/rotation/scale (3-tuples) → node.params.{position,rotation,scale}
 *    как объекты {x,y,z}. isHole / color → node.params.{isHole,color}.
 *  - BooleanFeature: operation → node.operation. color → node.params.color.
 *  - GroupFeature: color/isHole → node.params.
 *  - ImportedMeshFeature: filename → node.filename. color → node.params.color.
 *
 * Переименования thread/knurl полей: form работает в v2-семантике
 * (`profile`, `pattern`, `angle`), legacy ждёт `threadProfile`/`knurlPattern`/
 * `knurlAngle`. Маппим обратно.
 */
export function applyFeaturePatchToNode(
  node: ModelNode,
  featureType: FeatureType,
  patch: Record<string, unknown>,
): boolean {
  let changed = false;

  // Primitive-features → node.geometryParams + node.params.color
  if (isLeafPrimitiveType(featureType) && isPrimitiveNode(node)) {
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'color') {
        if (assignNodeParam(node, 'color', val)) changed = true;
        continue;
      }
      // thread/knurl renames: v2 → legacy
      const legacyKey = renameToLegacy(featureType, key);
      const target = node.geometryParams as Record<string, unknown>;
      if (target[legacyKey] !== val) {
        if (val === undefined) delete target[legacyKey];
        else target[legacyKey] = val;
        changed = true;
      }
    }
    return changed;
  }

  if (featureType === 'imported' && isImportedNode(node)) {
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'color') {
        if (assignNodeParam(node, 'color', val)) changed = true;
      } else if (key === 'filename' && typeof val === 'string') {
        if (node.filename !== val) {
          node.filename = val;
          changed = true;
        }
      }
      // binaryRef/stlBase64/geometry — не меняем через форму.
    }
    return changed;
  }

  if (featureType === 'transform') {
    // Transform применяется к ModelNode напрямую через node.params.
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'position' || key === 'rotation' || key === 'scale') {
        if (Array.isArray(val) && val.length === 3) {
          const [x, y, z] = val as [number, number, number];
          const cur = (node.params as Record<string, unknown>)[key] as
            | { x: number; y: number; z: number } | undefined;
          if (!cur || cur.x !== x || cur.y !== y || cur.z !== z) {
            (node.params as Record<string, unknown>)[key] = { x, y, z };
            changed = true;
          }
        }
      } else if (key === 'isHole' || key === 'color') {
        if (assignNodeParam(node, key, val)) changed = true;
      }
    }
    return changed;
  }

  if (featureType === 'boolean' && isGroupNode(node)) {
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'operation' && typeof val === 'string') {
        const op = val as CSGType;
        if (node.operation !== op) {
          node.operation = op;
          changed = true;
        }
      } else if (key === 'color') {
        if (assignNodeParam(node, 'color', val)) changed = true;
      }
    }
    return changed;
  }

  if (featureType === 'group' && isGroupNode(node)) {
    for (const [key, val] of Object.entries(patch)) {
      if (key === 'color' || key === 'isHole') {
        if (assignNodeParam(node, key, val)) changed = true;
      }
    }
    return changed;
  }

  console.warn(`[applyFeaturePatchToNode] нет обработчика для type=${featureType}; patch проигнорирован`, patch);
  return false;
}

function isLeafPrimitiveType(type: FeatureType): boolean {
  return type === 'box' || type === 'sphere' || type === 'cylinder'
    || type === 'cone' || type === 'torus' || type === 'ring'
    || type === 'plane' || type === 'thread' || type === 'knurl';
}

function renameToLegacy(type: FeatureType, key: string): string {
  if (type === 'thread' && key === 'profile') return 'threadProfile';
  if (type === 'knurl' && key === 'pattern') return 'knurlPattern';
  if (type === 'knurl' && key === 'angle') return 'knurlAngle';
  return key;
}

function assignNodeParam(node: ModelNode, key: string, val: unknown): boolean {
  const params = node.params as Record<string, unknown>;
  // undefined / '' / null трактуем как «удалить».
  if (val === undefined || val === null || val === '') {
    if (key in params) {
      delete params[key];
      return true;
    }
    return false;
  }
  if (params[key] !== val) {
    params[key] = val;
    return true;
  }
  return false;
}
