import type { FeatureId, FeatureDocumentJSON, FeatureOutput } from './types';
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
    this.graph.add(...args);
    const id = args[0].id;
    this.emit({ type: 'feature-added', featureIds: [id] });
    const result = this.graph.recompute([id]);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  removeFeature(id: FeatureId): void {
    this.graph.remove(id);
    this.rootIds = this.rootIds.filter((rid) => rid !== id);
    this.emit({ type: 'feature-removed', featureIds: [id] });
  }

  updateParams<TP extends object>(id: FeatureId, patch: Partial<TP>): void {
    const changed = this.graph.updateParams<TP>(id, patch);
    if (!changed) return;
    this.emit({ type: 'feature-updated', featureIds: [id] });
    const result = this.graph.recompute([id]);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  updateInputs(id: FeatureId, next: FeatureId[]): void {
    const changed = this.graph.updateInputs(id, next);
    if (!changed) return;
    this.emit({ type: 'feature-updated', featureIds: [id] });
    const result = this.graph.recompute([id]);
    this.emit({ type: 'recompute-done', featureIds: [...result.updated] });
  }

  setRootIds(ids: FeatureId[]): void {
    for (const id of ids) {
      if (!this.graph.has(id)) {
        throw new Error(`[FeatureDocument] root ${id} нет в графе`);
      }
    }
    this.rootIds = [...ids];
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
    const features = [...this.graph.values()].map((f) => f.accept(serializer));
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
    this.graph.recomputeAll();
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
