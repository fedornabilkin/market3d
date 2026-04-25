import type * as THREE from 'three';
import type { PrimitiveType } from '../types';

/** Дискриминирующий тег сущности. Покрывает все примитивы + импорт. */
export type EntityKind = PrimitiveType | 'imported';

/**
 * Абстрактная сущность конструктора. Каждый тип (Box, Sphere, Cylinder, …,
 * ImportedMesh) реализует свою геометрию и полувысоту — вместо одного
 * big-switch `Primitive`-классa.
 *
 * Сущности stateful: параметры хранятся в самой инстанции. Это позволяет
 * использовать их как самостоятельные объекты (не только как часть ModelNode).
 *
 * Позиция: `params.position.y = 0` означает «нижняя грань на сетке». Визуальный
 * центр three.js-меша считается как `position.y + getHalfHeight()`.
 */
export abstract class Entity<TParams extends object = object> {
  abstract readonly type: EntityKind;

  protected readonly params: TParams;

  constructor(params: TParams) {
    this.params = params;
  }

  /** Возвращает копию параметров (чтобы нельзя было мутировать внутренности). */
  getParams(): TParams {
    return { ...this.params };
  }

  /** Создаёт свежую BufferGeometry по текущим параметрам. */
  abstract createGeometry(): THREE.BufferGeometry;

  /**
   * Полувысота — от центра до нижней грани, нужна для перевода семантики
   * «позиция = низ на сетке» в центровую позицию three.js-меша.
   */
  abstract getHalfHeight(): number;
}
