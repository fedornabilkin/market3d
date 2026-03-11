import type { CSGType } from '../types';
import type { ModelNode } from '../nodes/ModelNode';
import { Command } from './Command';

/**
 * CSG operation as a command (execute/undo).
 */
export class CSGOperation extends Command {
  constructor(
    public readonly type: CSGType,
    public readonly target: ModelNode
  ) {
    super();
  }

  execute(): void {
    // Not implemented
  }

  undo(): void {
    // Not implemented
  }

  redo(): void {
    // Not implemented
  }
}
