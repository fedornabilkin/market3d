import { describe, it, expect, beforeEach, vi } from 'vitest';

// Serializer тянет nodes/* (three-bvh-csg) — в node-окружении это ломается из-за
// circular CJS. В рамках теста миграции v1→v2 нам нужны только две статические
// функции: координатная миграция и preResolveBinaryRefs (no-op для сцен без
// imported-фич). Минимальный мок поверх реальных модулей даёт нужный контракт.
vi.mock('../Serializer', async () => {
  const { migrateLegacyYupToZupIfNeeded } = await import('../migrations/legacyYupToZup');
  return {
    Serializer: {
      migrateLegacyYupToZupIfNeeded: (json: unknown) =>
        migrateLegacyYupToZupIfNeeded(json as never),
      preResolveBinaryRefs: async () => {},
    },
  };
});

import type { ModelTreeJSON } from '../types';
import type { FeatureDocumentJSON } from '../features';
import { migrateAllV1ToV2 } from './migrateV1Storage';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

function makeLegacyJson(): ModelTreeJSON {
  return {
    kind: 'group',
    operation: 'union',
    children: [
      {
        kind: 'primitive',
        type: 'box',
        params: { width: 10, height: 10, depth: 10 },
        nodeParams: { position: { x: 1, y: 2, z: 3 } },
      },
    ],
  };
}

describe('migrateAllV1ToV2: indexed slots', () => {
  it('конвертирует все v1-ключи в v2 и удаляет v1', async () => {
    localStorage.setItem('constructor_scene_v1_0', JSON.stringify(makeLegacyJson()));
    localStorage.setItem('constructor_scene_v1_1', JSON.stringify(makeLegacyJson()));

    await migrateAllV1ToV2({ sceneCount: 3 });

    expect(localStorage.getItem('constructor_scene_v1_0')).toBeNull();
    expect(localStorage.getItem('constructor_scene_v1_1')).toBeNull();

    const v2_0 = JSON.parse(localStorage.getItem('constructor_scene_v2_0')!) as FeatureDocumentJSON;
    const v2_1 = JSON.parse(localStorage.getItem('constructor_scene_v2_1')!) as FeatureDocumentJSON;
    expect(v2_0.version).toBe(2);
    expect(v2_0.rootIds.length).toBeGreaterThan(0);
    expect(v2_1.version).toBe(2);
    expect(v2_1.rootIds.length).toBeGreaterThan(0);
  });

  it('идемпотентен: повторный вызов — no-op', async () => {
    localStorage.setItem('constructor_scene_v1_0', JSON.stringify(makeLegacyJson()));

    await migrateAllV1ToV2({ sceneCount: 3 });
    const firstV2 = localStorage.getItem('constructor_scene_v2_0');
    expect(firstV2).toBeTruthy();

    await migrateAllV1ToV2({ sceneCount: 3 });
    const secondV2 = localStorage.getItem('constructor_scene_v2_0');
    expect(secondV2).toBe(firstV2);
    expect(localStorage.getItem('constructor_scene_v1_0')).toBeNull();
  });

  it('не перезаписывает уже существующий v2 — удаляет stale v1', async () => {
    const existingV2: FeatureDocumentJSON = {
      version: 2,
      features: [{ id: 'b1', type: 'box', params: { width: 5, height: 5, depth: 5 } }],
      rootIds: ['b1'],
    };
    localStorage.setItem('constructor_scene_v2_0', JSON.stringify(existingV2));
    localStorage.setItem('constructor_scene_v1_0', JSON.stringify(makeLegacyJson()));

    await migrateAllV1ToV2({ sceneCount: 3 });

    expect(localStorage.getItem('constructor_scene_v1_0')).toBeNull();
    const v2 = JSON.parse(localStorage.getItem('constructor_scene_v2_0')!) as FeatureDocumentJSON;
    expect(v2.features[0].id).toBe('b1');
  });

  it('пропускает пустые v1 слоты без эффектов', async () => {
    await migrateAllV1ToV2({ sceneCount: 3 });
    expect(localStorage.getItem('constructor_scene_v2_0')).toBeNull();
    expect(localStorage.getItem('constructor_scene_v2_1')).toBeNull();
    expect(localStorage.getItem('constructor_scene_v2_2')).toBeNull();
  });
});

describe('migrateAllV1ToV2: legacy single-scene key', () => {
  it('переносит constructor_scene_v1 → constructor_scene_v2_0', async () => {
    localStorage.setItem('constructor_scene_v1', JSON.stringify(makeLegacyJson()));

    await migrateAllV1ToV2({ sceneCount: 3 });

    expect(localStorage.getItem('constructor_scene_v1')).toBeNull();
    expect(localStorage.getItem('constructor_scene_v1_0')).toBeNull();
    const v2 = JSON.parse(localStorage.getItem('constructor_scene_v2_0')!) as FeatureDocumentJSON;
    expect(v2.version).toBe(2);
  });

  it('не затирает уже занятый slot 0 (есть v1_0) — single-scene удаляется как stale', async () => {
    const existingLegacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'sphere',
      params: { radius: 7 },
    };
    localStorage.setItem('constructor_scene_v1', JSON.stringify(makeLegacyJson()));
    localStorage.setItem('constructor_scene_v1_0', JSON.stringify(existingLegacy));

    await migrateAllV1ToV2({ sceneCount: 3 });

    expect(localStorage.getItem('constructor_scene_v1')).toBeNull();
    expect(localStorage.getItem('constructor_scene_v1_0')).toBeNull();
    // slot 0 v2 пришёл от existingLegacy (sphere), не от single-scene (box).
    const v2 = JSON.parse(localStorage.getItem('constructor_scene_v2_0')!) as FeatureDocumentJSON;
    const types = v2.features.map((f) => f.type);
    expect(types).toContain('sphere');
    expect(types).not.toContain('box');
  });

  it('не затирает уже занятый slot 0 (есть v2_0) — single-scene удаляется как stale', async () => {
    const existingV2: FeatureDocumentJSON = {
      version: 2,
      features: [{ id: 'cyl1', type: 'cylinder', params: { radius: 3, height: 5 } }],
      rootIds: ['cyl1'],
    };
    localStorage.setItem('constructor_scene_v1', JSON.stringify(makeLegacyJson()));
    localStorage.setItem('constructor_scene_v2_0', JSON.stringify(existingV2));

    await migrateAllV1ToV2({ sceneCount: 3 });

    expect(localStorage.getItem('constructor_scene_v1')).toBeNull();
    const v2 = JSON.parse(localStorage.getItem('constructor_scene_v2_0')!) as FeatureDocumentJSON;
    expect(v2.features[0].id).toBe('cyl1');
  });
});

describe('migrateAllV1ToV2: error resilience', () => {
  it('оставляет повреждённый v1 в localStorage и продолжает обработку других слотов', async () => {
    localStorage.setItem('constructor_scene_v1_0', '{not valid json');
    localStorage.setItem('constructor_scene_v1_1', JSON.stringify(makeLegacyJson()));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await migrateAllV1ToV2({ sceneCount: 3 });
    warn.mockRestore();

    expect(localStorage.getItem('constructor_scene_v1_0')).toBe('{not valid json');
    expect(localStorage.getItem('constructor_scene_v1_1')).toBeNull();
    expect(localStorage.getItem('constructor_scene_v2_1')).toBeTruthy();
  });
});
