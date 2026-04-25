import { Feature } from './Feature';
import type { FeatureId } from './types';

/**
 * Composite в Composite-pattern: фича, оперирующая выходами других фич
 * (Transform, Boolean, Group). Хранит массив id-входов; FeatureGraph
 * следит за корректностью DAG (отсутствие циклов, валидность ссылок).
 *
 * Порядок входов значим (например, в Boolean: первый — solid, последующие
 * комбинируются через operation).
 */
export abstract class CompositeFeature<TParams extends object = object> extends Feature<TParams> {
  protected _inputs: FeatureId[];

  constructor(id: FeatureId, params: TParams, inputs: FeatureId[] = []) {
    super(id, params);
    this._inputs = [...inputs];
  }

  getInputs(): readonly FeatureId[] {
    return this._inputs;
  }

  /**
   * Заменить inputs целиком. Возвращает true, если состав изменился (порядок
   * тоже значим). FeatureGraph должен быть уведомлён через updateInputs(),
   * чтобы перестроить dependents-индекс и проверить отсутствие циклов.
   */
  setInputs(next: FeatureId[]): boolean {
    if (this._inputs.length === next.length
      && this._inputs.every((v, i) => v === next[i])) {
      return false;
    }
    this._inputs = [...next];
    this.paramsVersion++;
    return true;
  }
}
