/**
 * Strategy для генерации уникальных feature-id в одном документе.
 *
 * Зачем интерфейс, а не голая функция: тесты хотят детерминированные
 * id (e.g. `box_1`, `box_2`, ...), production — случайные/уникальные.
 * Подмена реализации без правки caller'ов.
 */
export interface FeatureIdGenerator {
  /**
   * Уникальный id с опциональным префиксом-намёком на тип.
   * Не обязан содержать префикс в реализации (можно UUID).
   */
  next(prefix?: string): string;
}

/**
 * Дефолтная реализация: `${prefix}_${seq}`. Простая, читаемая в DevTools,
 * детерминированная в рамках одной сессии.
 *
 * Не глобально уникальна — если нужно объединять документы или импортировать
 * фичи из другого документа, замените на UUID-реализацию.
 */
export class SequentialFeatureIdGenerator implements FeatureIdGenerator {
  private seq = 0;

  /** Создать с начальным значением счётчика (для resume или тестов). */
  constructor(initialSeq = 0) {
    this.seq = initialSeq;
  }

  next(prefix = 'f'): string {
    return `${prefix}_${++this.seq}`;
  }

  /** Текущее значение счётчика — для дампа/restore. */
  current(): number {
    return this.seq;
  }
}

/**
 * UUID-реализация для случаев когда нужны глобально-уникальные id.
 * Например, при merge документов.
 */
export class UuidFeatureIdGenerator implements FeatureIdGenerator {
  next(prefix?: string): string {
    const uuid = crypto.randomUUID();
    return prefix ? `${prefix}_${uuid.slice(0, 8)}` : uuid;
  }
}
