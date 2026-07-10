import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { ConstructorSceneService } from '@/v3d/constructor/ConstructorSceneService';
import type { FeatureHistoryService } from './FeatureHistoryService';

export type ConstructorHistoryCoordinatorOptions = {
  history: FeatureHistoryService;
  getService: () => ConstructorSceneService | null;
  getSelection: () => { ids: readonly string[]; primaryId: string | null };
  onChanged: () => void;
  onRestored: () => void;
};

/** Coordinates graph/scene mutations with snapshots and UI notifications. */
export class ConstructorHistoryCoordinator {
  constructor(private readonly options: ConstructorHistoryCoordinatorOptions) {}

  mutateDocument<T>(mutate: (document: FeatureDocument) => T): T | null {
    const service = this.options.getService();
    if (!service) return null;
    const before = this.options.history.capture();
    let result: T | null = null;
    service.mutateFeatureDoc((document) => { result = mutate(document); });
    const selection = this.options.getSelection();
    service.setSelection(selection.ids, selection.primaryId);
    this.options.history.push(before, this.options.history.capture());
    this.options.onChanged();
    return result;
  }

  mutateScene(mutate: () => void): void {
    const before = this.options.history.capture();
    mutate();
    this.options.getService()?.syncCurrentFeatureDocToModelTree();
    this.options.history.push(before, this.options.history.capture());
    this.options.onChanged();
  }

  undo(): void {
    if (this.options.history.undo()) this.options.onRestored();
  }

  redo(): void {
    if (this.options.history.redo()) this.options.onRestored();
  }
}
