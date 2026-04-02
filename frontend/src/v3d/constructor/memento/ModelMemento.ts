import type { ModelTreeJSON } from '../types';
import type { ModelNode } from '../nodes/ModelNode';

/**
 * Memento for the model tree state.
 * Stores serialized tree snapshot for history/undo.
 */
export class ModelMemento {
  constructor(public readonly treeState: ModelTreeJSON) {}

  /**
   * Returns the saved tree state. Caller may use Serializer.fromJSON to rebuild tree.
   */
  getState(): ModelTreeJSON {
    return this.treeState;
  }

  /**
   * Restore saved state into the given node (stub).
   */
  restore(_node: ModelNode): void {
    // Not implemented
  }
}
