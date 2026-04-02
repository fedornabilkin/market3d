import type { ModelNode } from './nodes/ModelNode';
import type { CSGOperation } from './commands/CSGOperation';

/**
 * Manages the model tree (composite root) and list of CSG operations.
 */
export class ModelManager {
  constructor(
    public tree: ModelNode,
    public operations: CSGOperation[] = []
  ) {}

  getTree(): ModelNode {
    return this.tree;
  }

  setTree(node: ModelNode): void {
    this.tree = node;
  }

  getOperations(): CSGOperation[] {
    return this.operations;
  }

  addOperation(op: CSGOperation): void {
    this.operations.push(op);
  }

  applyOperations(): void {
    // Not implemented
  }
}
