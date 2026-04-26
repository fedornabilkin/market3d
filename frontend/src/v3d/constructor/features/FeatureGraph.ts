import type { FeatureId, FeatureOutput, RecomputeResult, EvaluateContext } from './types';
import type { Feature } from './Feature';
import { CompositeFeature } from './CompositeFeature';
import { EvaluateVisitor } from './visitors/EvaluateVisitor';

/**
 * DAG фич: хранит features по id, поддерживает обратный индекс
 * dependents (id входа → set фич, которые на него ссылаются), и
 * выполняет recompute в порядке топологической сортировки.
 *
 * Кэширование outputs хранится в самом графе (cachedOutputs) — фичи
 * data-only.
 */
export class FeatureGraph {
  private features = new Map<FeatureId, Feature>();
  /** id → set of features that have this id in their inputs */
  private dependentsIndex = new Map<FeatureId, Set<FeatureId>>();
  private cachedOutputs = new Map<FeatureId, FeatureOutput>();

  // ─── Mutators ─────────────────────────────────────────────

  add(feature: Feature): void {
    if (this.features.has(feature.id)) {
      throw new Error(`[FeatureGraph] фича с id=${feature.id} уже есть`);
    }
    this.assertInputsExist(feature);
    if (feature instanceof CompositeFeature) {
      this.assertNoCycle(feature.id, feature.getInputs());
    }
    this.features.set(feature.id, feature);
    this.indexInputs(feature);
  }

  /** Удалить ВСЕ фичи и кэши. Используется для in-place restore из JSON. */
  clear(): void {
    this.features.clear();
    this.dependentsIndex.clear();
    this.cachedOutputs.clear();
  }

  remove(id: FeatureId): void {
    const f = this.features.get(id);
    if (!f) return;
    // Если кто-то ещё ссылается — запрещаем удаление, иначе появятся
    // повисшие inputs.
    const dependents = this.dependentsIndex.get(id);
    if (dependents && dependents.size > 0) {
      throw new Error(
        `[FeatureGraph] нельзя удалить ${id}: на неё ссылаются ${[...dependents].join(', ')}`,
      );
    }
    this.deindexInputs(f);
    this.features.delete(id);
    this.dependentsIndex.delete(id);
    this.cachedOutputs.delete(id);
  }

  get(id: FeatureId): Feature | undefined {
    return this.features.get(id);
  }

  has(id: FeatureId): boolean {
    return this.features.has(id);
  }

  size(): number {
    return this.features.size;
  }

  values(): Iterable<Feature> {
    return this.features.values();
  }

  /**
   * Обновить params фичи и пометить её dirty. Возвращает true, если что-то
   * изменилось.
   */
  updateParams<TP extends object>(id: FeatureId, patch: Partial<TP>): boolean {
    const f = this.features.get(id) as Feature<TP> | undefined;
    if (!f) throw new Error(`[FeatureGraph] нет фичи ${id}`);
    return f.setParams(patch);
  }

  /**
   * Обновить inputs композита. Проверяет существование и отсутствие циклов
   * до коммита изменений.
   */
  updateInputs(id: FeatureId, next: FeatureId[]): boolean {
    const f = this.features.get(id);
    if (!f) throw new Error(`[FeatureGraph] нет фичи ${id}`);
    if (!(f instanceof CompositeFeature)) {
      throw new Error(`[FeatureGraph] ${id} не является CompositeFeature`);
    }
    for (const inputId of next) {
      if (!this.features.has(inputId)) {
        throw new Error(`[FeatureGraph] вход ${inputId} не существует`);
      }
    }
    this.assertNoCycle(id, next);
    this.deindexInputs(f);
    const changed = f.setInputs(next);
    this.indexInputs(f);
    return changed;
  }

  // ─── DAG queries ──────────────────────────────────────────

  /**
   * Транзитивное замыкание dependents: все фичи, выходы которых нужно
   * пересчитать при изменении любой из rootIds.
   */
  collectDependents(rootIds: FeatureId[]): Set<FeatureId> {
    const visited = new Set<FeatureId>();
    const stack = [...rootIds];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const dependents = this.dependentsIndex.get(id);
      if (dependents) for (const d of dependents) stack.push(d);
    }
    return visited;
  }

  /**
   * Топосорт подмножества (обычно — affected из collectDependents).
   * Бросает на циклах (которых после assertNoCycle быть не должно, но
   * на всякий случай).
   */
  topologicalOrder(subset: Set<FeatureId>): FeatureId[] {
    const result: FeatureId[] = [];
    const tempMark = new Set<FeatureId>();
    const permMark = new Set<FeatureId>();

    const visit = (id: FeatureId): void => {
      if (permMark.has(id)) return;
      if (tempMark.has(id)) {
        throw new Error(`[FeatureGraph] цикл, обнаруженный во время топосорта: ${id}`);
      }
      tempMark.add(id);
      const f = this.features.get(id);
      if (f) {
        for (const inputId of f.getInputs()) {
          if (subset.has(inputId)) visit(inputId);
        }
      }
      tempMark.delete(id);
      permMark.add(id);
      result.push(id);
    };

    for (const id of subset) visit(id);
    return result;
  }

  // ─── Recompute ────────────────────────────────────────────

  /**
   * Главный entry-point. Считает changedIds + всех зависимых, отдаёт
   * сводку. Outputs кэшируются в this.cachedOutputs, читаются последующими
   * шагами recompute.
   */
  recompute(changedIds: FeatureId[]): RecomputeResult {
    const affected = this.collectDependents(changedIds);
    const order = this.topologicalOrder(affected);

    // ctx.resolved: туда уйдут outputs всех нужных фич (включая
    // не-affected зависимости affected'ов).
    const resolved = new Map<FeatureId, FeatureOutput>();
    for (const [id, out] of this.cachedOutputs) {
      if (!affected.has(id)) resolved.set(id, out);
    }

    const ctx: EvaluateContext = { resolved };
    const visitor = new EvaluateVisitor(ctx);

    const updated: FeatureId[] = [];
    const failed: { id: FeatureId; error: string }[] = [];

    for (const id of order) {
      const feature = this.features.get(id);
      if (!feature) continue;

      // Если хоть один input в failed — пропагируем ошибку.
      let inputFailure: string | null = null;
      for (const inputId of feature.getInputs()) {
        if (!resolved.has(inputId)) {
          inputFailure = `вход ${inputId} не разрешён (вероятно, упал ранее)`;
          break;
        }
      }
      if (inputFailure) {
        feature.error = inputFailure;
        this.cachedOutputs.delete(id);
        failed.push({ id, error: inputFailure });
        continue;
      }

      try {
        const output = feature.accept(visitor);
        feature.error = undefined;
        this.cachedOutputs.set(id, output);
        resolved.set(id, output);
        updated.push(id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        feature.error = msg;
        this.cachedOutputs.delete(id);
        failed.push({ id, error: msg });
      }
    }

    return { updated, failed };
  }

  /**
   * Re-evaluate ОДНОЙ фичи по уже-кэшированным входам. Не трогает downstream
   * (их кэши становятся «слегка stale» — это допустимо для live-mid-drag,
   * на pointer-up вызывается полный `recompute([id])` который их освежит).
   *
   * Используется FeatureDocument.updateParamsLive — high-frequency путь
   * для drag-handles: меняем transform-params одной фичи, обновляем её
   * Output, рендер реагирует через `feature-updated` event.
   *
   * Возвращает новый Output или null если фича не найдена / упала.
   */
  recomputeOne(id: FeatureId): FeatureOutput | null {
    const feature = this.features.get(id);
    if (!feature) return null;
    const ctx: EvaluateContext = { resolved: new Map(this.cachedOutputs) };
    const visitor = new EvaluateVisitor(ctx);
    try {
      const output = feature.accept(visitor);
      feature.error = undefined;
      this.cachedOutputs.set(id, output);
      return output;
    } catch (e) {
      feature.error = e instanceof Error ? e.message : String(e);
      this.cachedOutputs.delete(id);
      return null;
    }
  }

  /** Полный пересчёт всех фич (например, после загрузки документа). */
  recomputeAll(): RecomputeResult {
    return this.recompute([...this.features.keys()]);
  }

  /** Output фичи (после последнего recompute) или undefined. */
  getOutput(id: FeatureId): FeatureOutput | undefined {
    return this.cachedOutputs.get(id);
  }

  // ─── Internal: индексы и инварианты ───────────────────────

  private indexInputs(f: Feature): void {
    for (const inputId of f.getInputs()) {
      let set = this.dependentsIndex.get(inputId);
      if (!set) {
        set = new Set();
        this.dependentsIndex.set(inputId, set);
      }
      set.add(f.id);
    }
  }

  private deindexInputs(f: Feature): void {
    for (const inputId of f.getInputs()) {
      const set = this.dependentsIndex.get(inputId);
      if (set) {
        set.delete(f.id);
        if (set.size === 0) this.dependentsIndex.delete(inputId);
      }
    }
  }

  private assertInputsExist(f: Feature): void {
    for (const inputId of f.getInputs()) {
      if (!this.features.has(inputId)) {
        throw new Error(`[FeatureGraph] вход ${inputId} не существует (для ${f.id})`);
      }
    }
  }

  /**
   * Проверка: добавление inputs к featureId не создаст цикла. Делается
   * до мутации индекса. Через DFS вверх по dependents — если попадаем в
   * любой из новых inputs, значит они являются потомками featureId, цикл.
   */
  private assertNoCycle(featureId: FeatureId, newInputs: readonly FeatureId[]): void {
    const inputSet = new Set(newInputs);
    if (inputSet.has(featureId)) {
      throw new Error(`[FeatureGraph] фича ${featureId} ссылается на саму себя`);
    }
    // Все потомки featureId — это transitive dependents. Если кто-то из
    // newInputs является потомком, добавление создаст цикл.
    const descendants = this.collectDependents([featureId]);
    descendants.delete(featureId); // саму фичу не считаем
    for (const candidate of inputSet) {
      if (descendants.has(candidate)) {
        throw new Error(
          `[FeatureGraph] цикл: ${featureId} зависит от ${candidate}, но ${candidate} уже зависит от ${featureId}`,
        );
      }
    }
  }
}
