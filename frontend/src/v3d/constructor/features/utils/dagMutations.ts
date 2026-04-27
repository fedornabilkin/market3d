import * as THREE from 'three';
import type { FeatureDocument } from '../FeatureDocument';
import type { FeatureId, FeatureJSON } from '../types';
import { CompositeFeature } from '../CompositeFeature';
import { TransformFeature, type TransformFeatureParams } from '../composite/TransformFeature';
import { SerializeVisitor } from '../visitors/SerializeVisitor';
import { createDefaultRegistry, type FeatureRegistry } from '../FeatureRegistry';

let p2Seq = 0;
/**
 * Генератор feature-id для фич, создаваемых утилитами P2-prep
 * (Transform-обёртки, mirror-compensation, chamfer-feature-group).
 *
 * Префикс `p2_` не пересекается с `m_<type>_<seq>` миграции и с
 * `<type>_<seq>` legacy-FeatureFactory'я — это упрощает диагностику.
 */
export function nextP2FeatureId(prefix: string): string {
  return `p2_${prefix}_${++p2Seq}`;
}

/**
 * DAG-утилиты поверх FeatureDocument. Все мутации идут через публичный API
 * документа (`addFeature`, `removeFeature`, `updateInputs`, `setRootIds`),
 * чтобы не пропускать события подписчикам и не ломать кэш recompute.
 *
 * Используются в Phase-2-prep flip'ах: mirror, alignment, merge/ungroup,
 * chamfer.
 */

/**
 * Найти родителя `childId` — фичу, у которой `childId` присутствует в inputs.
 * Возвращает null, если родителя нет (фича в rootIds или disconnected).
 *
 * В DAG у фичи может быть несколько родителей (она может фигурировать в
 * inputs нескольких composite'ов одновременно), но в текущей модели
 * операции (mirror/chamfer/etc.) предполагают единственного владельца —
 * метод возвращает первого попавшегося.
 */
export function findParent(doc: FeatureDocument, childId: FeatureId): {
  parentId: FeatureId;
  index: number;
} | null {
  for (const f of doc.graph.values()) {
    if (!(f instanceof CompositeFeature)) continue;
    const inputs = f.getInputs();
    const idx = inputs.indexOf(childId);
    if (idx !== -1) return { parentId: f.id, index: idx };
  }
  return null;
}

/**
 * Заменить `oldId` на `newId` в первом найденном parent.inputs или (если
 * `oldId` — root) в `rootIds`. После замены `oldId` остаётся в графе:
 * caller сам решает, удалять её через `removeFeature` или нет.
 *
 * Возвращает место замены: `{ kind: 'parent', parentId }` либо
 * `{ kind: 'root', index }`. Бросает, если `oldId` нигде не найдена.
 */
export function replaceFeatureInParent(
  doc: FeatureDocument,
  oldId: FeatureId,
  newId: FeatureId,
):
  | { kind: 'parent'; parentId: FeatureId }
  | { kind: 'root'; index: number } {
  const parent = findParent(doc, oldId);
  if (parent) {
    const parentFeature = doc.graph.get(parent.parentId);
    if (!parentFeature || !(parentFeature instanceof CompositeFeature)) {
      throw new Error(`[replaceFeatureInParent] parent ${parent.parentId} не CompositeFeature`);
    }
    const next = [...parentFeature.getInputs()];
    next[parent.index] = newId;
    doc.updateInputs(parent.parentId, next);
    return { kind: 'parent', parentId: parent.parentId };
  }
  const rootIdx = doc.rootIds.indexOf(oldId);
  if (rootIdx !== -1) {
    const nextRoots = [...doc.rootIds];
    nextRoots[rootIdx] = newId;
    doc.setRootIds(nextRoots);
    return { kind: 'root', index: rootIdx };
  }
  throw new Error(`[replaceFeatureInParent] фича ${oldId} нигде не найдена`);
}

/**
 * Гарантирует, что у фичи `featureId` есть Transform-обёртка. Если фича
 * сама уже Transform — возвращает её id. Иначе создаёт новый Transform с
 * identity-параметрами, переподключает parent.inputs / rootIds на него,
 * возвращает id обёртки.
 *
 * Идемпотентно: повторный вызов на уже обёрнутой фиче просто вернёт
 * существующую обёртку.
 */
export function ensureTransformWrapper(
  doc: FeatureDocument,
  featureId: FeatureId,
): FeatureId {
  const f = doc.graph.get(featureId);
  if (!f) throw new Error(`[ensureTransformWrapper] нет фичи ${featureId}`);
  if (f instanceof TransformFeature) return featureId;

  // Запоминаем место (parent или root) ДО добавления wrapper'а — иначе
  // wrapper сам станет parent для featureId, и replaceFeatureInParent
  // попытается подставить wrapperId в его собственные inputs (цикл).
  const parentBefore = findParent(doc, featureId);
  if (parentBefore) {
    const parentFeature = doc.graph.get(parentBefore.parentId);
    if (parentFeature instanceof TransformFeature) {
      return parentBefore.parentId;
    }
  }
  const rootIdx = doc.rootIds.indexOf(featureId);

  const wrapperId = nextP2FeatureId('xform');
  const wrapper = new TransformFeature(
    wrapperId,
    {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    [featureId],
  );
  doc.addFeature(wrapper);

  if (parentBefore) {
    const parentFeature = doc.graph.get(parentBefore.parentId);
    if (!parentFeature || !(parentFeature instanceof CompositeFeature)) {
      throw new Error(`[ensureTransformWrapper] parent ${parentBefore.parentId} не CompositeFeature`);
    }
    const next = [...parentFeature.getInputs()];
    next[parentBefore.index] = wrapperId;
    doc.updateInputs(parentBefore.parentId, next);
  } else if (rootIdx !== -1) {
    const nextRoots = [...doc.rootIds];
    nextRoots[rootIdx] = wrapperId;
    doc.setRootIds(nextRoots);
  }
  return wrapperId;
}

/**
 * World-space AABB фичи: использует кэшированный output из FeatureGraph
 * (геометрия + transform), баковый Z-сдвиг bottomAnchorOffsetZ
 * применяется снаружи.
 *
 * Возвращает null, если у фичи нет рассчитанного output'а или output без
 * geometry (например, GroupFeature → CompositeOutput).
 */
export function computeFeatureBbox(
  doc: FeatureDocument,
  id: FeatureId,
): THREE.Box3 | null {
  const out = doc.graph.getOutput(id);
  if (!out || out.kind !== 'leaf') return null;
  if (!out.geometry.boundingBox) out.geometry.computeBoundingBox();
  const bbox = out.geometry.boundingBox;
  if (!bbox) return null;
  const m = out.transform.clone();
  if (out.bottomAnchorOffsetZ) {
    m.premultiply(new THREE.Matrix4().makeTranslation(0, 0, out.bottomAnchorOffsetZ));
  }
  return bbox.clone().applyMatrix4(m);
}

/**
 * Транзитивный AABB корневой фичи: для leaf — `computeFeatureBbox(id)`,
 * для composite (group) — объединение AABB всех листьев в её поддереве с
 * учётом transform контейнера.
 *
 * Используется alignment'ом и mirror'ом, где целью может быть merge-группа.
 */
export function computeFeatureBboxRecursive(
  doc: FeatureDocument,
  id: FeatureId,
): THREE.Box3 | null {
  const out = doc.graph.getOutput(id);
  if (!out) return null;
  if (out.kind === 'leaf') return computeFeatureBbox(doc, id);

  const result = new THREE.Box3();
  let any = false;
  const containerM = out.transform.clone();
  const stack: { output: typeof out; matrix: THREE.Matrix4 }[] = [
    { output: out, matrix: containerM },
  ];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const child of cur.output.children) {
      const childM = cur.matrix.clone().multiply(child.transform);
      if (child.kind === 'leaf') {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const bb = child.geometry.boundingBox;
        if (!bb) continue;
        const m = childM.clone();
        if (child.bottomAnchorOffsetZ) {
          m.premultiply(new THREE.Matrix4().makeTranslation(0, 0, child.bottomAnchorOffsetZ));
        }
        const box = bb.clone().applyMatrix4(m);
        result.union(box);
        any = true;
      } else {
        stack.push({ output: child, matrix: childM });
      }
    }
  }
  return any ? result : null;
}

/**
 * Прочитать текущий patch (position/rotation/scale) у TransformFeature.
 * Используется alignment'ом для накопления дельт.
 */
export function getTransformParams(
  doc: FeatureDocument,
  transformId: FeatureId,
): TransformFeatureParams {
  const f = doc.graph.get(transformId);
  if (!f || !(f instanceof TransformFeature)) {
    throw new Error(`[getTransformParams] ${transformId} не TransformFeature`);
  }
  return f.params;
}

/**
 * Глубоко клонирует фичу `featureId` вместе со всеми транзитивными
 * dependencies (через её inputs). Используется в `duplicateSelected`.
 *
 * Стратегия:
 *  1. Собираем sub-DAG: featureId + транзитивно все её inputs.
 *  2. Сериализуем каждую фичу через SerializeVisitor.
 *  3. Перегенерируем id (oldId → newId), пересобираем inputs.
 *  4. Десериализуем через FeatureRegistry, добавляем в граф.
 *
 * Возвращает `{ rootId: newRootId, addedIds: [...] }`. Caller сам
 * подключает rootId в parent/rootIds. Граф не модифицируется кроме
 * `addFeature` для каждой клонированной фичи.
 */
export function cloneFeatureSubgraph(
  doc: FeatureDocument,
  featureId: FeatureId,
  registry?: FeatureRegistry,
): { rootId: FeatureId; addedIds: FeatureId[] } {
  const reg = registry ?? createDefaultRegistry();
  const root = doc.graph.get(featureId);
  if (!root) throw new Error(`[cloneFeatureSubgraph] нет фичи ${featureId}`);

  // 1. Сбор sub-DAG в топосорте (deps первыми).
  const visited = new Set<FeatureId>();
  const order: FeatureId[] = [];
  const visit = (id: FeatureId): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const f = doc.graph.get(id);
    if (!f) return;
    for (const input of f.getInputs()) visit(input);
    order.push(id);
  };
  visit(featureId);

  // 2. Сериализация + id-remap.
  const idMap = new Map<FeatureId, FeatureId>();
  const serializer = new SerializeVisitor();
  const newJsonByOldId = new Map<FeatureId, FeatureJSON>();
  for (const oldId of order) {
    const f = doc.graph.get(oldId)!;
    const json = f.accept(serializer);
    const newId = nextP2FeatureId(`dup_${f.type}`);
    idMap.set(oldId, newId);
    json.id = newId;
    if (json.inputs) {
      json.inputs = json.inputs.map((iid) => idMap.get(iid) ?? iid);
    }
    newJsonByOldId.set(oldId, json);
  }

  // 3. Десериализация и добавление в граф (порядок: deps first).
  const addedIds: FeatureId[] = [];
  for (const oldId of order) {
    const json = newJsonByOldId.get(oldId)!;
    const newFeature = reg.create(json);
    doc.addFeature(newFeature);
    addedIds.push(newFeature.id);
  }

  return { rootId: idMap.get(featureId)!, addedIds };
}
