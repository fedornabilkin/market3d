import type { FeatureId, FeatureType, FeatureJSON } from './types';
import type { FeatureVisitor } from './FeatureVisitor';

/**
 * Базовый узел в Composite: общий интерфейс для всех типов фич.
 *
 * Composite-pattern роли:
 *  - Component: Feature (этот класс)
 *  - Leaf:      LeafFeature
 *  - Composite: CompositeFeature
 *
 * Visitor-pattern: каждая конкретная фича реализует accept(visitor),
 * который маршрутизирует вызов в соответствующий visitor.visitX(this).
 * Все операции над деревом (evaluate, serialize, validate, debug-dump)
 * реализуются как FeatureVisitor — так Feature-классы остаются
 * data-only и не растут под каждую новую операцию.
 */
export abstract class Feature<TParams extends object = object> {
  abstract readonly type: FeatureType;

  readonly id: FeatureId;
  /** Имя в дереве; если undefined — UI берёт дефолтное по типу. */
  name?: string;
  params: TParams;

  /**
   * Версия параметров: инкрементируется при каждой мутации params/inputs.
   * Используется планировщиком recompute для отметки dirty-фич.
   */
  paramsVersion = 0;

  /** Текст ошибки последней эвалюации, если она упала. Иначе undefined. */
  error?: string;

  constructor(id: FeatureId, params: TParams) {
    this.id = id;
    this.params = params;
  }

  /** Возвращает массив id-входов. Для Leaf пуст; для Composite — фактические зависимости. */
  abstract getInputs(): readonly FeatureId[];

  /** Visitor dispatch. Каждый конкретный класс реализует через v.visitX(this). */
  abstract accept<R>(visitor: FeatureVisitor<R>): R;

  /**
   * Обновить параметры. Возвращает true, если хоть одно поле поменялось.
   * Контракт: вызывающий ОБЯЗАН после true вызвать FeatureGraph.touch(id),
   * иначе recompute не подхватит изменение. (FeatureGraph оборачивает это
   * автоматом через graph.updateParams.)
   */
  setParams(patch: Partial<TParams>): boolean {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof TParams)[]) {
      const next = (patch as TParams)[k];
      if (this.params[k] !== next) {
        this.params[k] = next as TParams[keyof TParams];
        changed = true;
      }
    }
    if (changed) this.paramsVersion++;
    return changed;
  }

  /** Сериализация в FeatureJSON. Базовая реализация — наследник может расширять. */
  toJSON(): FeatureJSON {
    const json: FeatureJSON = {
      id: this.id,
      type: this.type,
      params: { ...(this.params as Record<string, unknown>) },
    };
    if (this.name) json.name = this.name;
    const inputs = this.getInputs();
    if (inputs.length > 0) json.inputs = [...inputs];
    return json;
  }
}
