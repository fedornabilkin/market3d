/**
 * Public API for the visual 3D constructor.
 */

export { HistoryManager } from './HistoryManager';

export { Command } from './commands/Command';
// CSGOperation удалён (был stub без реализации).
// SnapshotCommand (legacy ModelTreeJSON) удалён: заменён FeatureSnapshotCommand
// из features/commands/. См. plan/cad/phase-1-feature-tree.md.
// ModelMemento удалён (P2-prep cleanup): был неиспользуемый Memento-pattern,
// история теперь идёт через FeatureSnapshotCommand на FeatureDocumentJSON v2.

export { ModificationGizmo } from './modes/ModificationGizmo';
export { ConstructorSceneService } from './ConstructorSceneService';
// GridService — внутренняя деталь GridMode, наружу не экспортируется.

export type {
  CSGType,
  PrimitiveType,
  NodeParams,
  PrimitiveParams,
  ModelTreeJSON,
  PrimitiveNodeJSON,
  GroupNodeJSON,
  ImportedMeshNodeJSON,
} from './types';
