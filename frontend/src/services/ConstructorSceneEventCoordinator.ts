import type {
  ConstructorSceneService,
  ConstructorSceneServiceOptions,
  SceneDebugInfo,
} from '@/v3d/constructor/ConstructorSceneService';
import type { FeatureHistoryService } from './FeatureHistoryService';

export type ConstructorSceneEventCoordinatorOptions = {
  history: FeatureHistoryService;
  getService: () => ConstructorSceneService | null;
  selectFeature: (featureId: string, additive: boolean) => void;
  setSelection: (featureIds: readonly string[]) => void;
  handleDebug: (info: SceneDebugInfo) => void;
  align: (mode: string) => void;
  onDocumentChanged: () => void;
};

/** Adapts scene-service events to selection, history and debug subsystems. */
export class ConstructorSceneEventCoordinator {
  constructor(private readonly handlers: ConstructorSceneEventCoordinatorOptions) {}

  createServiceOptions(): ConstructorSceneServiceOptions {
    return {
      onSelectFeatureFromScene: (featureId, { shift }) => this.handlers.selectFeature(featureId, shift),
      onDeselectAll: () => this.handlers.setSelection([]),
      onMarqueeSelectFeatures: (featureIds) => this.handlers.setSelection(featureIds),
      onDebugInfoUpdate: (info) => this.handlers.handleDebug(info),
      onNodeParamsChanged: () => undefined,
      onBeforeDrag: () => {
        try { this.handlers.history.begin(); }
        catch { this.handlers.history.cancelPending(); }
      },
      onAfterDrag: () => this.commitDrag(),
      onAlignMarkerClick: (mode) => this.handlers.align(mode),
    };
  }

  private commitDrag(): void {
    try {
      this.handlers.getService()?.commitSelectedFeatureChanges();
      if (this.handlers.history.commit()) this.handlers.onDocumentChanged();
    } catch {
      this.handlers.history.cancelPending();
    }
  }
}
