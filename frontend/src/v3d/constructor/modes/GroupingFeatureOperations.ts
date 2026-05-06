import * as THREE from 'three';
import type { FeatureDocument } from '../features/FeatureDocument';
import type { FeatureId } from '../features/types';
import { CompositeFeature } from '../features/CompositeFeature';
import type { Feature } from '../features/Feature';
import { GroupFeature } from '../features/composite/GroupFeature';
import { BooleanFeature } from '../features/composite/BooleanFeature';
import { TransformFeature, type TransformFeatureParams } from '../features/composite/TransformFeature';
import { findParent, nextP2FeatureId } from '../features/utils/dagMutations';

/**
 * Любой ли вход помечен как hole (на собственных params либо на Transform-обёртке).
 * Соответствует discriminator'у в `migrateLegacyTreeToDocument`: если merge
 * включает hole — создаём BooleanFeature(union), CSG-подсистема вычитает.
 */
function anyParticipantIsHole(doc: FeatureDocument, ids: readonly FeatureId[]): boolean {
  for (const id of ids) {
    const f: Feature | undefined = doc.graph.get(id);
    if (!f) continue;
    if ((f.params as { isHole?: boolean })?.isHole) return true;
  }
  return false;
}

/**
 * Merge/Ungroup поверх FeatureDocument. Без знания о ModelNode и THREE.js —
 * только DAG-мутации.
 *
 * Семантика совпадает с legacy `mergeSelected`/`ungroupSelected`:
 *  - Merge создаёт новую `GroupFeature` (logical container, без CSG если нет
 *    hole-детей) и кладёт в неё выбранные фичи. Удаляет их из текущих parent'ов
 *    (либо из `rootIds`, либо из `inputs` другой композитной фичи).
 *  - Ungroup извлекает inputs группы и промоутирует их в parent'а либо в
 *    `rootIds`. Сама группа удаляется через `removeFeature`.
 */
export class GroupingFeatureOperations {
  /**
   * Сгруппировать выбранные фичи в новую GroupFeature.
   * Возвращает id новой группы или null, если групировать нечего (<2 фичи).
   */
  static merge(doc: FeatureDocument, featureIds: readonly FeatureId[]): FeatureId | null {
    if (featureIds.length < 2) return null;

    // Дискриминация GroupFeature vs BooleanFeature: если среди участников
    // есть hole — CSG обязателен (BooleanFeature union), иначе logical container.
    // Симметрично с migrateLegacyTreeToDocument.
    const hasHole = anyParticipantIsHole(doc, featureIds);
    const groupId = nextP2FeatureId(hasHole ? 'boolean' : 'group');
    const groupFeature = hasHole
      ? new BooleanFeature(groupId, { operation: 'union' }, [...featureIds])
      : new GroupFeature(groupId, {}, [...featureIds]);
    const wrapperId = nextP2FeatureId('xform');
    const wrapperFeature = new TransformFeature(
      wrapperId,
      {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      [groupId],
    );

    // Запоминаем текущие места участников ДО любых мутаций (findParent
    // зависит от состояния графа, а мы будем его изменять).
    const detachPlan = featureIds.map((id) => ({
      id,
      parent: findParent(doc, id),
      rootIdx: doc.rootIds.indexOf(id),
    }));

    // 1. Detach: убираем участников из их текущих parent.inputs и rootIds.
    //    Сначала parent.inputs — иначе addFeature group'ы падёт на assertNoCycle,
    //    если кто-то из участников всё ещё в inputs другой фичи и group тоже её
    //    референсит. На самом деле порядок не критичен: addFeature ещё не вызван.
    for (const { id, parent } of detachPlan) {
      if (!parent) continue;
      const parentFeature = doc.graph.get(parent.parentId);
      if (!(parentFeature instanceof CompositeFeature)) continue;
      const next = parentFeature.getInputs().filter((iid) => iid !== id);
      doc.updateInputs(parent.parentId, next);
    }

    // 2. Detach из rootIds: убираем участников + добавляем в конец id новой группы
    //    (предварительно, чтобы только один setRootIds вызов).
    let nextRoots = [...doc.rootIds];
    for (const { id } of detachPlan) {
      nextRoots = nextRoots.filter((rid) => rid !== id);
    }

    // 3. Добавляем сам контейнер. Все его inputs уже не висят в parent'ах —
    //    добавление безопасно.
    doc.addFeature(groupFeature);
    doc.addFeature(wrapperFeature);

    // 4. Размещаем новый контейнер. Если у всех участников был общий parent
    //    (типичный кейс — все внутри root scene-group), кладём контейнер туда:
    //    это сохраняет инвариант «ровно один root» в графе.
    //    Иначе (mixed parents / orphan) — fallback на rootIds.
    const sharedParentId = (() => {
      const ids = detachPlan
        .map(({ parent }) => parent?.parentId ?? null)
        .filter((id): id is FeatureId => !!id);
      if (ids.length !== detachPlan.length) return null;
      const first = ids[0];
      return ids.every((id) => id === first) ? first : null;
    })();
    if (sharedParentId) {
      const parentFeature = doc.graph.get(sharedParentId);
      if (parentFeature instanceof CompositeFeature) {
        const next = [...parentFeature.getInputs(), wrapperId];
        doc.updateInputs(sharedParentId, next);
        return wrapperId;
      }
    }
    doc.setRootIds([...nextRoots, wrapperId]);

    return wrapperId;
  }

  /**
   * Разгруппировать composite-фичу (Group или Boolean): извлечь её inputs и
   * промоутировать в parent либо в rootIds. Сама фича удаляется.
   *
   * Принимаем оба composite-типа, так как `merge` создаёт BooleanFeature,
   * если среди участников есть hole — пользователь должен иметь возможность
   * её разгруппировать симметрично.
   *
   * Возвращает массив id'шек извлечённых детей или null если разгруппировать
   * нельзя (фича не composite, пустая, или это root scene-group где
   * разгруппировка означала бы потерять все фичи).
   */
  static ungroup(doc: FeatureDocument, groupId: FeatureId): FeatureId[] | null {
    const selected = doc.graph.get(groupId);
    const selectedInputs = selected?.getInputs() ?? [];
    const wrappedGroupId = selected instanceof TransformFeature && selectedInputs.length === 1
      ? selectedInputs[0]
      : null;
    const targetGroupId = wrappedGroupId ?? groupId;
    const group = doc.graph.get(targetGroupId);
    if (!(group instanceof CompositeFeature)) return null;
    const childIds = [...group.getInputs()];
    if (childIds.length === 0) return null;
    const promotedIds = selected instanceof TransformFeature
      ? bakeTransformIntoChildren(doc, selected, childIds)
      : childIds;

    const placementId = wrappedGroupId ? groupId : targetGroupId;
    const parent = findParent(doc, placementId);
    const rootIdx = doc.rootIds.indexOf(placementId);

    if (parent) {
      const parentFeature = doc.graph.get(parent.parentId);
      if (!(parentFeature instanceof CompositeFeature)) return null;
      const inputs = [...parentFeature.getInputs()];
      const idx = inputs.indexOf(placementId);
      const newInputs = [
        ...inputs.slice(0, idx),
        ...promotedIds,
        ...inputs.slice(idx + 1),
      ];
      doc.updateInputs(parent.parentId, newInputs);
    } else if (rootIdx !== -1) {
      const nextRoots = [
        ...doc.rootIds.slice(0, rootIdx),
        ...promotedIds,
        ...doc.rootIds.slice(rootIdx + 1),
      ];
      doc.setRootIds(nextRoots);
    } else {
      return null;
    }

    // Перед removeFeature нужно отвязать inputs группы — иначе FeatureGraph
    // оставит группу как parent для childIds и блокирует удаление.
    if (wrappedGroupId) {
      doc.updateInputs(groupId, []);
      doc.removeFeature(groupId);
    }

    doc.updateInputs(targetGroupId, []);
    doc.removeFeature(targetGroupId);

    return promotedIds;
  }
}

function bakeTransformIntoChildren(
  doc: FeatureDocument,
  wrapper: TransformFeature,
  childIds: readonly FeatureId[],
): FeatureId[] {
  return childIds.map((childId) => {
    const child = doc.graph.get(childId);
    if (child instanceof TransformFeature) {
      doc.updateParams<TransformFeatureParams>(
        childId,
        composeTransformParams(wrapper.params, child.params),
      );
      return childId;
    }

    const wrapperId = nextP2FeatureId('xform');
    doc.addFeature(new TransformFeature(
      wrapperId,
      { ...wrapper.params },
      [childId],
    ));
    return wrapperId;
  });
}

function composeTransformParams(
  parent: TransformFeatureParams,
  child: TransformFeatureParams,
): TransformFeatureParams {
  const matrix = toMatrix(parent).multiply(toMatrix(child));
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion);
  return {
    ...child,
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z],
    scale: [scale.x, scale.y, scale.z],
  };
}

function toMatrix(params: TransformFeatureParams): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...params.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...params.rotation)),
    new THREE.Vector3(...params.scale),
  );
}
