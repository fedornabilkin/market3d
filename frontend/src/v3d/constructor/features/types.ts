import type * as THREE from 'three';

/** Стабильный идентификатор фичи в графе. */
export type FeatureId = string;

/** Дискриминатор типа фичи. Используется для (de)сериализации и dispatch. */
export type FeatureType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'ring'
  | 'plane'
  | 'thread'
  | 'knurl'
  | 'imported'
  | 'transform'
  | 'boolean'
  | 'group';

/**
 * Результат evaluate для одиночной (леaf) фичи: одна BufferGeometry плюс
 * локальный transform. transform применяется рендер-слоем при создании Mesh.
 */
export interface LeafOutput {
  kind: 'leaf';
  geometry: THREE.BufferGeometry;
  transform: THREE.Matrix4;
  isHole: boolean;
  color?: string;
  name?: string;
  /** Флаг: геометрия шарится между билдами, диспозить нельзя (например, ImportedMesh). */
  sharedGeometry?: boolean;
}

/**
 * Результат evaluate для контейнерной фичи (GroupFeature): набор детских
 * outputs плюс общий transform контейнера. Render-слой обходит детей
 * независимо (THREE.Group), сохраняя возможность раздельного выбора
 * подобъектов через `selectAsUnit` маркер на верхнем уровне.
 */
export interface CompositeOutput {
  kind: 'composite';
  children: FeatureOutput[];
  transform: THREE.Matrix4;
  isHole: boolean;
  color?: string;
  name?: string;
}

export type FeatureOutput = LeafOutput | CompositeOutput;

/**
 * Контекст эвалюации: уже посчитанные outputs других фич, доступные по id.
 * Заполняется FeatureGraph в порядке топологической сортировки.
 */
export interface EvaluateContext {
  resolved: Map<FeatureId, FeatureOutput>;
}

/** Сериализованный вид фичи. type — дискриминатор для FeatureRegistry. */
export interface FeatureJSON {
  id: FeatureId;
  type: FeatureType;
  name?: string;
  params: Record<string, unknown>;
  inputs?: FeatureId[];
}

/** Сериализованный документ — граф фич + корни. */
export interface FeatureDocumentJSON {
  version: 2;
  metadata?: {
    name?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  features: FeatureJSON[];
  rootIds: FeatureId[];
}

/** Результат FeatureGraph.recompute: что обновилось / упало с ошибкой. */
export interface RecomputeResult {
  updated: FeatureId[];
  failed: { id: FeatureId; error: string }[];
}
