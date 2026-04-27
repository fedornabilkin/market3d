import type { ModelNode } from '../nodes/ModelNode';
import type { ModelTreeJSON } from '../types';
import type { FeatureDocumentJSON, FeatureId } from '../features/types';

/**
 * Двунаправленные карты `featureId ↔ ModelNode`. Один класс, одна
 * ответственность (SRP) — изолирует mapping-логику от ConstructorSceneService,
 * который иначе превратился бы в god-object.
 *
 * Используется UI'ем (Feature Tree панель, FeatureParamsForm) и legacy
 * mutation paths (drag/handle/mirror), которым нужно переходить между
 * двумя представлениями (FeatureDocument и ModelNode-tree) пока flip
 * не закрыт.
 *
 * После полного flip'а (selection через FeatureId везде) этот класс
 * удалится — останется только FeatureDocument.
 */
export class NodeFeatureMapping {
  private nodeByFeatureId = new Map<FeatureId, ModelNode>();
  /** Корневая (rootmost) feature-id для ModelNode — обычно Transform-обёртка. */
  private featureIdByNode = new Map<ModelNode, FeatureId>();

  clear(): void {
    this.nodeByFeatureId.clear();
    this.featureIdByNode.clear();
  }

  /**
   * Заполнить карту по trace, полученному из migrateLegacyTreeToDocument
   * (forward direction): featureId → ModelTreeJSON, плюс параллельный walk
   * jsonToNode из ModelNode-tree.
   *
   * `featureIdByNode` получает «верхнюю» фичу цепочки (Transform-обёртка над
   * примитивом, если она есть): мы итерируем `v2.features` в порядке их
   * добавления, и каждая последующая запись для того же ModelNode
   * перезаписывает предыдущую. Поскольку Transform добавляется ПОСЛЕ inner
   * фичи (см. migrateLegacyTreeToDocument), финальное значение — Transform.
   */
  setFromForwardTrace(
    v2: FeatureDocumentJSON,
    trace: ReadonlyMap<FeatureId, ModelTreeJSON>,
    jsonToNode: ReadonlyMap<ModelTreeJSON, ModelNode>,
  ): void {
    this.clear();
    for (const [featureId, sourceJson] of trace) {
      const node = jsonToNode.get(sourceJson);
      if (node) this.nodeByFeatureId.set(featureId, node);
    }
    for (const f of v2.features) {
      const node = this.nodeByFeatureId.get(f.id);
      if (node) this.featureIdByNode.set(node, f.id);
    }
  }

  /**
   * Заполнить карту по trace, полученному из featureDocumentToLegacy
   * (inverse direction): featureId → ModelTreeJSON, плюс walk jsonToNode
   * из построенного ModelNode-tree.
   *
   * Семантика идентична forward — для нескольких фич, указывающих в один
   * ModelTreeJSON (Transform + inner), последняя в порядке итерации
   * `v2.features` побеждает в `featureIdByNode`.
   */
  setFromInverseTrace(
    v2: FeatureDocumentJSON,
    trace: ReadonlyMap<FeatureId, ModelTreeJSON>,
    jsonToNode: ReadonlyMap<ModelTreeJSON, ModelNode>,
  ): void {
    this.setFromForwardTrace(v2, trace, jsonToNode);
  }

  getNode(featureId: FeatureId): ModelNode | undefined {
    return this.nodeByFeatureId.get(featureId);
  }

  getFeatureId(node: ModelNode): FeatureId | undefined {
    return this.featureIdByNode.get(node);
  }

  /** Все feature-id, у которых есть соответствующий ModelNode. */
  featureIds(): IterableIterator<FeatureId> {
    return this.nodeByFeatureId.keys();
  }
}
