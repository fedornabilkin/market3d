import { nextTick, ref } from 'vue';
import type { ConstructorSceneService } from '@/v3d/constructor/ConstructorSceneService';
import type { FeatureDocumentJSON } from '@/v3d/constructor/features/types';
import { loadFeatureDocument } from '@/v3d/constructor/features/loader/loadFeatureDocument';
import { migrateAllV1ToV2 } from '@/v3d/constructor/loader/migrateV1Storage';
import type { ScenePersistenceService } from '@/services/ScenePersistenceService';
import type { FeatureHistoryService } from '@/services/FeatureHistoryService';

type LoadingState = { start(): void; finish(): void };

export type ConstructorScenesOptions = {
  sceneCount: number;
  persistence: ScenePersistenceService;
  history: FeatureHistoryService;
  loading: LoadingState;
  getService: () => ConstructorSceneService | null;
  flushCurrentScene: () => void;
  onLoaded: () => void;
};

/** Scene slot switching, initial migration and FeatureDocument loading. */
export function useConstructorScenes(options: ConstructorScenesOptions) {
  const activeIndex = ref(0);

  async function loadDocument(json: FeatureDocumentJSON): Promise<boolean> {
    const service = options.getService();
    if (!service) return false;
    const document = await loadFeatureDocument(json);
    service.loadFromV2JSON(document.toJSON());
    options.onLoaded();
    return true;
  }

  async function loadActiveSlot(): Promise<boolean> {
    const saved = options.persistence.load(activeIndex.value);
    return saved ? loadDocument(saved) : false;
  }

  async function switchTo(index: number): Promise<void> {
    const nextIndex = Math.min(Math.max(index, 0), options.sceneCount - 1);
    if (nextIndex === activeIndex.value) return;
    options.loading.start();
    await nextTick();
    try {
      options.flushCurrentScene();
      activeIndex.value = nextIndex;
      options.history.clear();
      if (await loadActiveSlot()) return;
      options.getService()?.loadFromV2JSON(emptyScene());
      options.onLoaded();
    } catch (error) {
      console.warn('[ConstructorScenes] switch failed:', error);
    } finally {
      options.loading.finish();
    }
  }

  async function initialize(): Promise<void> {
    options.loading.start();
    try {
      await migrateAllV1ToV2({ sceneCount: options.sceneCount });
      await loadActiveSlot();
    } catch (error) {
      console.warn('[ConstructorScenes] initial load failed:', error);
    } finally {
      options.loading.finish();
    }
  }

  return { activeIndex, loadDocument, loadActiveSlot, switchTo, initialize };
}

function emptyScene(): FeatureDocumentJSON {
  return {
    version: 2,
    features: [{ id: 'root', type: 'group', params: {}, inputs: [], name: 'Scene' }],
    rootIds: ['root'],
  };
}
