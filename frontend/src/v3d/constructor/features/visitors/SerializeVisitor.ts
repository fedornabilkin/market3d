import type { FeatureJSON } from '../types';
import { FeatureVisitor } from '../FeatureVisitor';
import type { Feature } from '../Feature';

/**
 * Visitor сериализации: для большинства типов вызовет Feature.toJSON()
 * (id+type+name+params+inputs). Этот тривиальный путь — visitFeature.
 *
 * Если для какого-то типа нужна особая логика (например, ImportedMesh
 * исключает inline-geometry), визитор переопределяет соответствующий
 * visitX. На текущий момент сами Feature-классы переопределяют toJSON,
 * так что сериализатор может просто делегировать.
 */
export class SerializeVisitor extends FeatureVisitor<FeatureJSON> {
  protected visitFeature(feature: Feature): FeatureJSON {
    return feature.toJSON();
  }
}
