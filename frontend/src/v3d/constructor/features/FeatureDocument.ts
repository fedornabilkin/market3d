import type { FeatureId, FeatureDocumentJSON, FeatureOutput } from './types';
import type { Feature } from './Feature';
import { FeatureGraph } from './FeatureGraph';
import { FeatureRegistry, createDefaultRegistry } from './FeatureRegistry';
import { SerializeVisitor } from './visitors/SerializeVisitor';
import { ValidateVisitor, type ValidationIssue } from './visitors/ValidateVisitor';

export interface FeatureDocumentEvent {
  type: 'feature-added' | 'feature-removed' | 'feature-updated' | 'recompute-done';
  featureIds?: FeatureId[];
}

type Listener = (event: FeatureDocumentEvent) => void;

/**
 * Документ конструктора в новой модели: оборачивает FeatureGraph,
 * хранит список корневых фич (то что попадает в финальный рендер),
 * метаданные, и пушит события подписчикам.
 *
 * UI слой (Constructor.vue, ConstructorSceneService) подписывается через
 * subscribe() и реагирует на recompute-done — пересобирает или точечно
 * обновляет three.js-сцену.
 *
 * Vue-реактивность через event-based подход (а не reactive() поверх
 * BufferGeometry) — иначе proxy ломает кэши GPU.
 */
export class FeatureDocument {
  private batchDepth = 0;
  private batchDirty = false;
  readonly graph = new FeatureGraph();
  rootIds: FeatureId[] = [];
  metadata: { name?: string; createdAt?: string; updatedAt?: string } = {};

  private listeners = new Set<Listener>();
  private registry: FeatureRegistry;

  constructor(registry?: FeatureRegistry) {
    this.registry = registry ?? createDefaultRegistry();
  }

  // ─── Подписка ─────────────────────────────────────────────

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(event: FeatureDocumentEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  // ─── Mutators (с emit'ами) ────────────────────────────────

  addFeature(...args: Parameters<FeatureGraph['add']>): void {
    const feature = args[0];
    this.graph.add(feature);
    const id = feature.id;
    this.emit({ type: 'feature-added', featureIds: [id] });
    if (this.batchDepth > 0) { this.batchDirty = true; return; }
    const result = this.graph.recompute([id]);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  addFeatures(features: Feature[], recomputeRootIds?: FeatureId[]): void {
    if (features.length === 0) return;
    const ids = features.map((feature) => feature.id);
    for (const feature of features) this.graph.add(feature);
    this.emit({ type: 'feature-added', featureIds: ids });
    const result = this.graph.recomputeDependencies(recomputeRootIds ?? ids);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  removeFeature(id: FeatureId): void {
    this.graph.remove(id);
    this.rootIds = this.rootIds.filter((rid) => rid !== id);
    if (this.batchDepth > 0) { this.batchDirty = true; return; }
    this.emit({ type: 'feature-removed', featureIds: [id] });
  }

  updateParams<TP extends object>(id: FeatureId, patch: Partial<TP>): void {
    const changed = this.graph.updateParams<TP>(id, patch);
    if (!changed) return;
    this.emit({ type: 'feature-updated', featureIds: [id] });
    if (this.batchDepth > 0) { this.batchDirty = true; return; }
    const result = this.graph.recompute([id]);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  /**
   * Live-update API для high-frequency mid-drag путей (handle-drag в 3D).
   *
   * Отличия от `updateParams`:
   *  - Re-evaluate ТОЛЬКО эту фичу (не downstream-зависимые) — `recomputeOne`.
   *  - Эмитит `feature-updated`, НЕ эмитит `recompute-done`.
   *  - Подписчики (FeatureRenderer) делают targeted-update меша через
   *    decompose новой матрицы, БЕЗ полной пересборки сцены.
   *
   * **Контракт:** caller обязан вызвать `updateParams` (полный путь) на
   * pointer-up — это пересчитает downstream и сделает history-snapshot.
   * До этого момента downstream cached outputs «чуть stale», но live-render
   * выглядит корректно для самой dragged-фичи.
   *
   * Подходит для transform-only изменений (position/rotation/scale у Transform).
   * Для изменений геометрии (width/radius у примитива) нужен полный
   * `updateParams` — иначе downstream Boolean/Group получат stale-геометрию.
   */
  updateParamsLive<TP extends object>(id: FeatureId, patch: Partial<TP>): void {
    const changed = this.graph.updateParams<TP>(id, patch);
    if (!changed) return;
    this.graph.recomputeOne(id);
    this.emit({ type: 'feature-updated', featureIds: [id] });
  }

  updateParamsSilent<TP extends object>(id: FeatureId, patch: Partial<TP>): void {
    this.graph.updateParams<TP>(id, patch);
  }

  recomputeFrom(ids: FeatureId[]): void {
    if (ids.length === 0) return;
    const result = this.graph.recompute(ids);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  /**
   * Fast in-place restore for history snapshots that changed only existing
   * feature params/name. Structural edits still fall back to loadFromJSON().
   */
  tryRestoreMatchingGraphFromJSON(json: FeatureDocumentJSON): boolean {
    if (json.version !== 2) return false;
    if (!sameStringArray(this.rootIds, json.rootIds)) return false;
    if (this.graph.size() !== json.features.length) return false;

    const changedIds: FeatureId[] = [];
    for (const fjson of json.features) {
      const feature = this.graph.get(fjson.id);
      if (!feature) return false;
      if (feature.type !== fjson.type) return false;
      if (!sameStringArray([...feature.getInputs()], fjson.inputs ?? [])) return false;

      const nextParams = fjson.params ?? {};
      const nameChanged = (feature.name ?? undefined) !== (fjson.name ?? undefined);
      const paramsChanged = !sameJSONValue(feature.params, nextParams);
      if (!nameChanged && !paramsChanged) continue;

      feature.name = fjson.name;
      if (paramsChanged) {
        feature.params = { ...nextParams };
        feature.paramsVersion++;
      }
      changedIds.push(feature.id);
    }

    this.metadata = json.metadata ? { ...json.metadata } : {};
    if (changedIds.length === 0) return true;
    const result = this.graph.recompute(changedIds);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
    return true;
  }

  updateInputs(id: FeatureId, next: FeatureId[]): void {
    const changed = this.graph.updateInputs(id, next);
    if (!changed) return;
    this.emit({ type: 'feature-updated', featureIds: [id] });
    if (this.batchDepth > 0) { this.batchDirty = true; return; }
    const result = this.graph.recompute([id]);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  setRootIds(ids: FeatureId[]): void {
    for (const id of ids) {
      if (!this.graph.has(id)) {
        throw new Error(`[FeatureDocument] root ${id} нет в графе`);
      }
    }
    const prev = this.rootIds;
    this.rootIds = [...ids];
    if (this.batchDepth > 0) { this.batchDirty = true; return; }
    if (prev.length !== ids.length || prev.some((id, index) => id !== ids[index])) {
      this.emit({ type: 'recompute-done', featureIds: ids });
    }
  }

  batchMutate<T>(mutate: () => T): T {
    this.batchDepth++;
    try { return mutate(); }
    finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.batchDirty) {
        this.batchDirty = false;
        const result = this.graph.recomputeDependencies(this.rootIds);
        this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
      }
    }
  }

  pruneUnreachable(): FeatureId[] {
    const reachable = this.graph.collectDependencies(this.rootIds);
    const removed: FeatureId[] = [];
    const allIds = [...this.graph.values()].map((f) => f.id);
    for (const id of allIds) {
      if (reachable.has(id)) continue;
      const feature = this.graph.get(id);
      if (!feature) continue;
      const inputs = feature.getInputs();
      if (inputs.length > 0) {
        try {
          this.graph.updateInputs(id, []);
        } catch {
          // Leaf features do not support inputs.
        }
      }
    }
    for (const id of allIds.reverse()) {
      if (reachable.has(id) || !this.graph.has(id)) continue;
      try {
        this.graph.remove(id);
        removed.push(id);
      } catch {
        // If an external edge appeared, keep the feature rather than corrupting the graph.
      }
    }
    if (removed.length > 0) {
      this.emit({ type: 'feature-removed', featureIds: removed });
    }
    return removed;
  }

  // ─── Queries ──────────────────────────────────────────────

  getOutput(id: FeatureId): FeatureOutput | undefined {
    return this.graph.getOutput(id);
  }

  /** Outputs всех корней — это то, что рендерится. */
  getRootOutputs(): { id: FeatureId; output: FeatureOutput | undefined }[] {
    return this.rootIds.map((id) => ({ id, output: this.graph.getOutput(id) }));
  }

  /** Прогон ValidateVisitor по всем фичам. */
  validate(): ValidationIssue[] {
    const visitor = new ValidateVisitor();
    for (const f of this.graph.values()) f.accept(visitor);
    return visitor.issues;
  }

  // ─── Persistence ──────────────────────────────────────────

  toJSON(): FeatureDocumentJSON {
    const serializer = new SerializeVisitor();
    const reachable = this.graph.collectDependencies(this.rootIds);
    const features = [...this.graph.values()]
      .filter((f) => reachable.has(f.id))
      .map((f) => f.accept(serializer));
    return {
      version: 2,
      metadata: {
        ...this.metadata,
        updatedAt: new Date().toISOString(),
      },
      features,
      rootIds: [...this.rootIds],
    };
  }

  static fromJSON(json: FeatureDocumentJSON, registry?: FeatureRegistry): FeatureDocument {
    const doc = new FeatureDocument(registry);
    doc.loadFromJSON(json);
    return doc;
  }

  /**
   * In-place восстановление документа из JSON: чистит граф, добавляет фичи
   * в топологическом порядке, пересчитывает всё, эмитит recompute-done.
   * Подписки сохраняются — это и нужно для undo/redo через SnapshotCommand.
   */
  loadFromJSON(json: FeatureDocumentJSON): void {
    if (json.version !== 2) {
      throw new Error(`[FeatureDocument] неподдерживаемая версия: ${json.version}`);
    }
    this.graph.clear();
    this.rootIds = [];

    const sorted = sortByInputs(json.features);
    for (const fjson of sorted) {
      const feature = this.registry.create(fjson);
      this.graph.add(feature);
    }

    this.rootIds = [...json.rootIds];
    this.metadata = json.metadata ? { ...json.metadata } : {};
    this.graph.recomputeDependencies(this.rootIds);
    this.emit({
      type: 'recompute-done',
      featureIds: [...this.graph.values()].map((f) => f.id),
    });
  }
}

/**
 * Если features в JSON в произвольном порядке (так делает SerializeVisitor),
 * нужно отсортировать так, чтобы каждый input уже был добавлен ранее.
 */
function sortByInputs(features: FeatureDocumentJSON['features']): FeatureDocumentJSON['features'] {
  const byId = new Map(features.map((f) => [f.id, f]));
  const result: FeatureDocumentJSON['features'] = [];
  const visited = new Set<FeatureId>();

  const visit = (id: FeatureId): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const f = byId.get(id);
    if (!f) return;
    for (const inputId of f.inputs ?? []) visit(inputId);
    result.push(f);
  };

  for (const f of features) visit(f.id);
  return result;
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameJSONValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
