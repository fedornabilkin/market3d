// Core types
export type {
  FeatureId, FeatureType, FeatureJSON, FeatureDocumentJSON,
  FeatureOutput, LeafOutput, CompositeOutput,
  EvaluateContext, RecomputeResult,
} from './types';

// Composite-pattern базы
export { Feature } from './Feature';
export { LeafFeature } from './LeafFeature';
export { CompositeFeature } from './CompositeFeature';

// Visitor-pattern базы и штатные посетители
export { FeatureVisitor } from './FeatureVisitor';
export { EvaluateVisitor } from './visitors/EvaluateVisitor';
export { SerializeVisitor } from './visitors/SerializeVisitor';
export { ValidateVisitor, type ValidationIssue } from './visitors/ValidateVisitor';

// Граф, документ, реестр
export { FeatureGraph } from './FeatureGraph';
export { FeatureDocument, type FeatureDocumentEvent } from './FeatureDocument';
export { FeatureRegistry, createDefaultRegistry } from './FeatureRegistry';

// Конкрет-фичи: примитивы
export { BoxFeature, type BoxFeatureParams } from './primitives/BoxFeature';
export { SphereFeature, type SphereFeatureParams } from './primitives/SphereFeature';
export { CylinderFeature, type CylinderFeatureParams } from './primitives/CylinderFeature';
export { ConeFeature, type ConeFeatureParams } from './primitives/ConeFeature';
export { TorusFeature, type TorusFeatureParams } from './primitives/TorusFeature';
export { RingFeature, type RingFeatureParams } from './primitives/RingFeature';
export { PlaneFeature, type PlaneFeatureParams } from './primitives/PlaneFeature';
export { ThreadFeature, type ThreadFeatureParams } from './primitives/ThreadFeature';
export { KnurlFeature, type KnurlFeatureParams } from './primitives/KnurlFeature';
export {
  ImportedMeshFeature,
  type ImportedMeshFeatureParams,
} from './primitives/ImportedMeshFeature';

// Конкрет-фичи: composite
export { TransformFeature, type TransformFeatureParams } from './composite/TransformFeature';
export {
  BooleanFeature,
  type BooleanFeatureParams,
  type BooleanOperation,
} from './composite/BooleanFeature';
export { GroupFeature, type GroupFeatureParams } from './composite/GroupFeature';

// CSG утилита (для legacy GroupNode и расширений)
export { booleanCsg, type BooleanInput } from './csg/booleanCsg';

// Рендер-слой: связь FeatureDocument ↔ three.js сцена
export { FeatureRenderer } from './rendering/FeatureRenderer';

// Undo/redo поверх FeatureDocument
export {
  FeatureSnapshotCommand,
  captureSnapshot,
} from './commands/FeatureSnapshotCommand';

// Миграция legacy ModelTreeJSON v1 → FeatureDocumentJSON v2
export { migrateLegacyTreeToDocument } from './migration/migrateLegacyTree';

// Обратная конвертация v2 → v1 (для cutover-стадии: рендер пока через legacy)
export { featureDocumentToLegacy } from './migration/featureDocumentToLegacy';

// Универсальный загрузчик: legacy v1 / новый v2 → FeatureDocument
export { loadFeatureDocument } from './loader/loadFeatureDocument';
