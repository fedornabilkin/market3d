import type * as THREE from 'three';
import { FeatureDocument } from '../FeatureDocument';
import type { FeatureDocumentJSON } from '../types';

/**
 * Универсальный загрузчик: принимает FeatureDocumentJSON v2 и восстанавливает
 * FeatureDocument с резолвом binaryRef'ов импортированных мешей.
 *
 * Legacy v1 (ModelTreeJSON) как входной формат больше не поддерживается:
 * пользовательские v1-сцены в localStorage один раз мигрируются на старте
 * `Constructor.vue` через `loader/migrateV1Storage.migrateAllV1ToV2`, после
 * чего v1-ключи удаляются. Файлы .json с диска тоже сводятся к v2 в caller-е
 * (`loadSceneFromFile` в Constructor.vue) до вызова этого loader-а.
 *
 * Алгоритм:
 *  1. Парсим (если строка).
 *  2. Валидируем что это v2.
 *  3. Резолвим бинарники импортированных мешей (binaryRef → IndexedDB → STL → BufferGeometry).
 *  4. FeatureDocument.fromJSON.
 *
 * Async: BinaryStorage и STLLoader подгружаются ленивыми импортами, чтобы
 * не тянуть STLLoader в bundle при сценах без импортов.
 */
export async function loadFeatureDocument(
  rawJson: FeatureDocumentJSON | string,
): Promise<FeatureDocument> {
  const parsed: unknown = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

  if (!isFeatureDocumentJSON(parsed)) {
    throw new Error('[loadFeatureDocument] ожидается FeatureDocumentJSON v2');
  }

  await resolveImportedGeometries(parsed);
  return FeatureDocument.fromJSON(parsed);
}

function isFeatureDocumentJSON(x: unknown): x is FeatureDocumentJSON {
  return !!x
    && typeof x === 'object'
    && (x as { version?: unknown }).version === 2
    && Array.isArray((x as { features?: unknown }).features)
    && Array.isArray((x as { rootIds?: unknown }).rootIds);
}

/**
 * Для каждой imported-фичи с binaryRef или stlBase64 подгружает бинарник
 * и парсит в BufferGeometry, кладёт в params.geometry. EvaluateVisitor
 * требует именно поле geometry — без него visitImportedMesh бросит ошибку.
 *
 * Если для фичи уже установлен geometry (например, из теста), не трогает.
 */
async function resolveImportedGeometries(json: FeatureDocumentJSON): Promise<void> {
  const importedFeatures = json.features.filter((f) => f.type === 'imported');
  if (importedFeatures.length === 0) return;

  const [{ BinaryStorage, base64ToArrayBuffer }, { STLLoader }] = await Promise.all([
    import('../../services/BinaryStorage'),
    import('three/examples/jsm/loaders/STLLoader'),
  ]);
  const loader = new STLLoader();

  for (const f of importedFeatures) {
    const params = f.params as Record<string, unknown>;
    if (params.geometry) continue;

    if (typeof params.binaryRef === 'string') {
      const buf = await BinaryStorage.get(params.binaryRef);
      if (buf) {
        params.geometry = loader.parse(buf) as THREE.BufferGeometry;
        continue;
      }
      // binaryRef есть, но в IDB пусто (удалили или другая база) — пробуем
      // legacy base64-fallback ниже.
    }

    if (typeof params.stlBase64 === 'string' && params.stlBase64.length > 0) {
      const buf = base64ToArrayBuffer(params.stlBase64);
      params.geometry = loader.parse(buf) as THREE.BufferGeometry;
    }
  }
}
