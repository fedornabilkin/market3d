import type { ModelTreeJSON } from '../types';
import { Command } from './Command';

/**
 * Snapshot-based undo/redo command.
 *
 * Records before/after JSON snapshots of the model tree.
 * execute() is intentionally a no-op: the mutation already happened before this
 * command is pushed to HistoryManager (HistoryManager.push calls execute).
 * undo() restores the "before" snapshot; redo() re-applies the "after" snapshot.
 */
export class SnapshotCommand extends Command {
  constructor(
    private readonly beforeJSON: ModelTreeJSON,
    private readonly afterJSON: ModelTreeJSON,
    private readonly onRestore: (json: ModelTreeJSON) => void
  ) {
    super();
  }

  /** No-op: mutation already applied before push. */
  execute(): void {}

  undo(): void {
    this.onRestore(this.beforeJSON);
  }

  redo(): void {
    this.onRestore(this.afterJSON);
  }
}
