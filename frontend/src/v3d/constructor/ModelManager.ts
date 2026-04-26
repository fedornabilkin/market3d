import type { ModelNode } from './nodes/ModelNode';

/**
 * Owns the legacy ModelNode-tree (Phase 1 in-memory source-of-truth).
 */
export class ModelManager {
  constructor(public tree: ModelNode) {}

  getTree(): ModelNode {
    return this.tree;
  }

  setTree(node: ModelNode): void {
    this.tree = node;
  }
}
