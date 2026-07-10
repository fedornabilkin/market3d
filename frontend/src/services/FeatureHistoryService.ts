import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureDocumentJSON } from '@/v3d/constructor/features/types';
import { FeatureSnapshotCommand } from '@/v3d/constructor/features/commands/FeatureSnapshotCommand';
import type { HistoryManager } from '@/v3d/constructor/HistoryManager';

/** Owns FeatureDocument snapshots and the undo/redo command stack. */
export class FeatureHistoryService {
  private pendingSnapshot: FeatureDocumentJSON | null = null;

  constructor(
    private readonly manager: HistoryManager,
    private readonly getDocument: () => FeatureDocument | null,
  ) {}

  capture(): FeatureDocumentJSON | null {
    return this.getDocument()?.toJSON() ?? null;
  }

  push(before: FeatureDocumentJSON | null, after: FeatureDocumentJSON | null): boolean {
    const document = this.getDocument();
    if (!document || !before || !after) return false;
    this.manager.push(new FeatureSnapshotCommand(before, after, document));
    return true;
  }

  begin(): void {
    this.pendingSnapshot = this.capture();
  }

  commit(): boolean {
    const before = this.pendingSnapshot;
    this.pendingSnapshot = null;
    return this.push(before, this.capture());
  }

  cancelPending(): void { this.pendingSnapshot = null; }

  undo(): boolean {
    if (!this.manager.canUndo()) return false;
    this.manager.undo();
    return true;
  }

  redo(): boolean {
    if (!this.manager.canRedo()) return false;
    this.manager.redo();
    return true;
  }

  clear(): void { this.manager.clear(); }
  canUndo(): boolean { return this.manager.canUndo(); }
  canRedo(): boolean { return this.manager.canRedo(); }
}
