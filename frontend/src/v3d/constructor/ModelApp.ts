import type { ModelManager } from './ModelManager';
import type { HistoryManager } from './HistoryManager';
import type { Serializer } from './Serializer';
import { GroupNode } from './nodes/GroupNode';

/**
 * Main entry point for the visual 3D constructor.
 * Composes ModelManager, HistoryManager, Serializer.
 */
export class ModelApp {
  constructor(
    public modelManager: ModelManager,
    public historyManager: HistoryManager,
    public serializer: Serializer
  ) {}

  init(): void {
    const root = new GroupNode();
    root.operation = 'union';
    root.children = [];
    this.modelManager.setTree(root);
  }

  getModelManager(): ModelManager {
    return this.modelManager;
  }

  getHistoryManager(): HistoryManager {
    return this.historyManager;
  }

  getSerializer(): Serializer {
    return this.serializer;
  }
}
