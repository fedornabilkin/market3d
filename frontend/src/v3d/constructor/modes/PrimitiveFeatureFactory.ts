import type { FeatureJSON, FeatureType, FeatureId } from '../features/types';
import type { Feature } from '../features/Feature';
import { createDefaultRegistry, type FeatureRegistry } from '../features/FeatureRegistry';
import { nextP2FeatureId } from '../features/utils/dagMutations';

export type PrimitiveFeatureType =
  | 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'ring' | 'plane';

/**
 * Дефолтные геометрические параметры для каждого типа примитива. Совпадают
 * с legacy `FeatureFactory.DEFAULT_PRIMITIVE_PARAMS` (Constructor.vue
 * `getDefaultParamsForType`); владелец источника параметров — этот файл,
 * остальные читают.
 */
const DEFAULT_PARAMS: Record<PrimitiveFeatureType, Record<string, unknown>> = {
  box: { width: 20, height: 20, depth: 20 },
  sphere: { radius: 10, widthSegments: 32, heightSegments: 32 },
  cylinder: { radiusTop: 10, radiusBottom: 10, height: 20, segments: 32 },
  cone: { radius: 10, height: 20, segments: 32 },
  torus: { radius: 10, tube: 2, segments: 32 },
  plane: { width: 20, height: 20 },
  ring: { innerRadius: 5, outerRadius: 10, segments: 32 },
};

/**
 * **Factory** для создания примитивных Feature'ей с дефолтными параметрами.
 * Используется в Constructor.vue.addPrimitiveOfType (UI «добавить примитив»)
 * и других call-site'ах, которым нужен примитив «из ничего».
 *
 * Открыто для расширения: caller может передать `paramsOverride`. Pattern:
 * Factory Method — метод `create(type)` инкапсулирует логику id-генерации
 * + dispatch на конкретный конструктор через FeatureRegistry.
 */
export class PrimitiveFeatureFactory {
  private readonly registry: FeatureRegistry;

  constructor(registry?: FeatureRegistry) {
    this.registry = registry ?? createDefaultRegistry();
  }

  create(
    type: PrimitiveFeatureType,
    paramsOverride?: Record<string, unknown>,
  ): { feature: Feature; id: FeatureId } {
    const id = nextP2FeatureId(type);
    const params = { ...DEFAULT_PARAMS[type], ...(paramsOverride ?? {}) };
    const json: FeatureJSON = {
      id,
      type: type as FeatureType,
      params,
    };
    return { feature: this.registry.create(json), id };
  }
}
