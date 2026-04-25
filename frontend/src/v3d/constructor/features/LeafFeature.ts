import { Feature } from './Feature';
import type { FeatureId } from './types';

/**
 * Leaf в Composite-pattern: фича без входных зависимостей. Самостоятельно
 * порождает геометрию (примитивы, импорт STL).
 */
export abstract class LeafFeature<TParams extends object = object> extends Feature<TParams> {
  /** Leaf по определению не имеет входов. */
  getInputs(): readonly FeatureId[] {
    return EMPTY_INPUTS;
  }
}

const EMPTY_INPUTS: readonly FeatureId[] = Object.freeze([]);
