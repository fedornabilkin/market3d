/**
 * Public API for the visual 3D constructor.
 */

export { ModelApp } from './ModelApp';
export { ModelManager } from './ModelManager';
export { HistoryManager } from './HistoryManager';
export { Serializer } from './Serializer';

export { ModelNode } from './nodes/ModelNode';
export { Primitive } from './nodes/Primitive';
export { GroupNode } from './nodes/GroupNode';
export { ImportedMeshNode } from './nodes/ImportedMeshNode';

export { Command } from './commands/Command';
// CSGOperation удалён (был stub без реализации).
// SnapshotCommand (legacy ModelTreeJSON) удалён: заменён FeatureSnapshotCommand
// из features/commands/. См. plan/cad/phase-1-feature-tree.md.

export { ModelMemento } from './memento/ModelMemento';
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
