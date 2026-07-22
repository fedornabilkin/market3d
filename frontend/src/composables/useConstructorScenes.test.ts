import { describe, expect, it, vi } from 'vitest';
import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureDocumentJSON } from '@/v3d/constructor/features/types';
import type { ConstructorSceneService } from '@/v3d/constructor/ConstructorSceneService';
import type { ScenePersistenceService } from '@/services/ScenePersistenceService';
import type { FeatureHistoryService } from '@/services/FeatureHistoryService';
import { useConstructorScenes } from './useConstructorScenes';

vi.mock('@/v3d/constructor/features/loader/loadFeatureDocument', () => ({
  loadFeatureDocument: vi.fn(async (json: FeatureDocumentJSON) => ({
    json,
    pruneUnreachable: () => [],
  })),
}));

function scene(id: string): FeatureDocumentJSON {
  return {
    version: 2,
    features: [{ id, type: 'group', params: {}, inputs: [], name: id }],
    rootIds: [id],
  };
}

describe('useConstructorScenes', () => {
  it('reuses evaluated documents and skips loading feedback for warm switches', async () => {
    const pruneSceneZero = vi.fn();
    let current = {
      json: scene('scene-0'),
      pruneUnreachable: pruneSceneZero,
    } as unknown as FeatureDocument;
    const sceneOne = scene('scene-1');
    const load = vi.fn((index: number) => index === 1 ? sceneOne : null);
    const replaceFeatureDocument = vi.fn((document: FeatureDocument) => {
      current = document;
    });
    const loading = { start: vi.fn(), finish: vi.fn() };

    const scenes = useConstructorScenes({
      sceneCount: 3,
      persistence: { load } as unknown as ScenePersistenceService,
      history: { clear: vi.fn() } as unknown as FeatureHistoryService,
      loading,
      getService: () => ({
        getFeatureDocument: () => current,
        replaceFeatureDocument,
      }) as unknown as ConstructorSceneService,
      flushCurrentScene: vi.fn(),
      onLoaded: vi.fn(),
    });

    await scenes.switchTo(1);
    const cachedSceneOne = current;
    await scenes.switchTo(0);
    await scenes.switchTo(1);

    expect(current).toBe(cachedSceneOne);
    expect(load).toHaveBeenCalledTimes(1);
    expect(replaceFeatureDocument).toHaveBeenCalledTimes(3);
    expect(loading.start).toHaveBeenCalledTimes(1);
    expect(loading.finish).toHaveBeenCalledTimes(1);
    expect(pruneSceneZero).toHaveBeenCalledTimes(2);
  });

  it('prunes the active graph before flushing it during a switch', async () => {
    const calls: string[] = [];
    const current = {
      pruneUnreachable: vi.fn(() => {
        calls.push('prune');
        return [];
      }),
    } as unknown as FeatureDocument;
    const flushCurrentScene = vi.fn(() => calls.push('flush'));

    const scenes = useConstructorScenes({
      sceneCount: 2,
      persistence: { load: vi.fn(() => null) } as unknown as ScenePersistenceService,
      history: { clear: vi.fn() } as unknown as FeatureHistoryService,
      loading: { start: vi.fn(), finish: vi.fn() },
      getService: () => ({
        getFeatureDocument: () => current,
        replaceFeatureDocument: vi.fn(),
      }) as unknown as ConstructorSceneService,
      flushCurrentScene,
      onLoaded: vi.fn(),
    });

    await scenes.switchTo(1);

    expect(calls).toEqual(['prune', 'flush']);
  });
});
