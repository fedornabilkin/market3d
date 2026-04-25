import type * as THREE from 'three';
import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';

/**
 * Параметры для ImportedMeshFeature.
 *
 * Бинарный STL хранится отдельно в IndexedDB (binaryRef — ключ).
 * Геометрия резолвится лениво на первой эвалюации (BinaryStorage будет
 * добавлен в Шаге 1.9). До этого — для unit-тестов и временной
 * совместимости — допускается inline geometry/stlBase64.
 */
export interface ImportedMeshFeatureParams {
  /** Имя исходного файла (для отображения и suggestion'а имени фичи). */
  filename: string;
  /** Ключ в IndexedDB (BinaryStorage). Заполняется при импорте. */
  binaryRef?: string;
  /** Inline-геометрия (для unit-тестов и legacy-миграции). */
  geometry?: THREE.BufferGeometry;
  /** Inline base64 (для legacy-миграции; в новых документах не используется). */
  stlBase64?: string;
  color?: string;
}

export class ImportedMeshFeature extends LeafFeature<ImportedMeshFeatureParams> {
  readonly type: FeatureType = 'imported';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitImportedMesh(this); }

  /**
   * Сериализация: исключаем поле geometry (сырой BufferGeometry не
   * сериализуем) и stlBase64 (в новом формате уезжает в IndexedDB).
   */
  override toJSON() {
    const json = super.toJSON();
    const params = json.params as Record<string, unknown>;
    delete params.geometry;
    delete params.stlBase64;
    return json;
  }
}
