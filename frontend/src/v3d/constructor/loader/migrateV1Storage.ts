import type { ModelTreeJSON } from '../types';
import type { FeatureDocumentJSON } from '../features';
import { Serializer } from '../Serializer';
import { migrateLegacyTreeToDocument } from '../features/migration/migrateLegacyTree';

/**
 * One-time legacy → canonical converter, запускается на старте Constructor.vue
 * до loadFromLocalStorage. Цель: после релиза P2 prep flip'а избавиться от
 * legacy v1 read-path'а в рантайме — все пользовательские сцены переезжают в
 * v2 (`constructor_scene_v2_*`) при первом заходе, после чего v1-ключи
 * физически удаляются из localStorage.
 *
 * Конвертер идемпотентен: повторный вызов — no-op (v1 ключей уже нет).
 *
 * Покрывает:
 *  - старую single-scene схему `constructor_scene_v1` (без индекса) — переносит
 *    в slot 0 на старте, как делал onMounted-блок ДО P2 prep;
 *  - индексированные `constructor_scene_v1_${i}` (i = 0..SCENE_COUNT-1).
 *
 * Безопасность: если v2-ключ уже непустой (пользователь уже работал в v2
 * после релиза), v1 не перезаписывает — просто удаляется как stale.
 */

const LEGACY_SINGLE_SCENE_KEY = 'constructor_scene_v1';

export const migrateV1StorageInternals = {
  legacySingleSceneKey: LEGACY_SINGLE_SCENE_KEY,
} as const;

export interface MigrateV1Options {
  /** Сколько сцен читаем (constructor_scene_v1_0..N-1). Должно совпадать с SCENE_COUNT. */
  sceneCount: number;
}

export async function migrateAllV1ToV2(opts: MigrateV1Options): Promise<void> {
  const { sceneCount } = opts;

  // Старая single-scene схема: переносим её содержимое в slot 0 как v1, чтобы
  // дальше пройти общий цикл миграции. Если slot 0 уже занят (v1 или v2) —
  // single-scene считается stale и просто удаляется.
  const singleSceneRaw = localStorage.getItem(LEGACY_SINGLE_SCENE_KEY);
  if (singleSceneRaw !== null) {
    const slot0V1 = `constructor_scene_v1_0`;
    const slot0V2 = `constructor_scene_v2_0`;
    if (!localStorage.getItem(slot0V1) && !localStorage.getItem(slot0V2)) {
      localStorage.setItem(slot0V1, singleSceneRaw);
    }
    localStorage.removeItem(LEGACY_SINGLE_SCENE_KEY);
  }

  for (let i = 0; i < sceneCount; i++) {
    const v1Key = `constructor_scene_v1_${i}`;
    const v2Key = `constructor_scene_v2_${i}`;
    const v1Raw = localStorage.getItem(v1Key);
    if (v1Raw === null) continue;

    // Если v2 уже непустой — пользователь успел поработать после релиза,
    // его v2 авторитетен; v1 — stale, удаляем без перезаписи.
    if (localStorage.getItem(v2Key)) {
      localStorage.removeItem(v1Key);
      continue;
    }

    try {
      const legacyJson = JSON.parse(v1Raw) as ModelTreeJSON;
      Serializer.migrateLegacyYupToZupIfNeeded(legacyJson);
      await Serializer.preResolveBinaryRefs(legacyJson);
      const v2: FeatureDocumentJSON = migrateLegacyTreeToDocument(legacyJson);
      localStorage.setItem(v2Key, JSON.stringify(v2));
      localStorage.removeItem(v1Key);
    } catch (e) {
      console.warn(`[migrateV1Storage] не удалось мигрировать ${v1Key}, оставляем v1 как есть:`, e);
    }
  }
}
