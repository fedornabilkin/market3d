import type { Command } from './commands/Command';

/**
 * Manages command stack and mementos for undo/redo.
 */
export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  push(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo(): void {
    if (!this.canUndo()) return;
    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
  }

  redo(): void {
    if (!this.canRedo()) return;
    const command = this.redoStack.pop()!;
    command.redo();
    this.undoStack.push(command);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
