import type { Entity } from '../Entity';

/**
 * Базовый билдер сущности.
 *
 * Предназначен для fluent-конфигурации параметров и последующей сборки
 * готового Entity-объекта. Наследники реализуют `build()` и добавляют свои
 * typed-сеттеры (например, `.width(20)`).
 *
 * Generic-параметры:
 *  - TEntity: конкретный класс Entity, который вернёт `build()`.
 *  - TParams: форма параметров, которые билдер умеет собирать.
 */
export abstract class EntityBuilder<
  TEntity extends Entity<object>,
  TParams extends object,
> {
  protected params: Partial<TParams> = {};

  /** Добавить/перезаписать набор параметров целиком (полезно при десериализации). */
  withParams(params: Partial<TParams>): this {
    this.params = { ...this.params, ...params };
    return this;
  }

  /** Собрать готовую сущность. Если каких-то обязательных полей нет —
   *  наследник должен подставить дефолты. */
  abstract build(): TEntity;
}
