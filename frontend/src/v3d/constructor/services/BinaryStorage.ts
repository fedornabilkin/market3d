/**
 * Async-хранилище двоичных blob'ов (импортированные STL и т.п.) в IndexedDB.
 *
 * Зачем: localStorage синхронный, имеет лимит ~5–10 МБ и блокирует main thread
 * при записи многомегабайтных строк. Импортированный STL может весить 20+ МБ
 * в base64 — не влезает или вызывает «страница не отвечает».
 *
 * IndexedDB:
 *  - Полностью асинхронный API (никаких UI-фризов).
 *  - Лимит на порядки больше (сотни МБ — гигабайты).
 *  - Хранит ArrayBuffer/Blob натифно — без base64.
 *
 * Контракт ID: вызывающий код задаёт стабильный id (обычно UUID/ulid). Сервис
 * сам не генерирует — id остаётся читать из feature.params.binaryRef и т.п.
 */

const DB_NAME = 'vsqr-constructor';
const DB_VERSION = 1;
const STORE_NAME = 'binaries';

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

export class BinaryStorage {
  /** Записать ArrayBuffer под ключом id. Перезаписывает существующее. */
  static async put(id: string, data: ArrayBuffer): Promise<void> {
    const store = await tx('readwrite');
    return new Promise<void>((resolve, reject) => {
      const req = store.put(data, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Получить ArrayBuffer по id, или undefined если нет. */
  static async get(id: string): Promise<ArrayBuffer | undefined> {
    const store = await tx('readonly');
    return new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const v = req.result;
        if (v === undefined || v === null) resolve(undefined);
        else if (v instanceof ArrayBuffer) resolve(v);
        else if (ArrayBuffer.isView(v)) resolve(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
        else resolve(undefined);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** Удалить запись. Идемпотентно. */
  static async delete(id: string): Promise<void> {
    const store = await tx('readwrite');
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Список всех id в хранилище. */
  static async list(): Promise<string[]> {
    const store = await tx('readonly');
    return new Promise<string[]>((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).filter((k): k is string => typeof k === 'string'));
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Сгенерировать новый стабильный id (для импорт-флоу).
   * Префикс 'stl_' помогает отличать в инспекторе IndexedDB.
   */
  static newId(prefix = 'stl_'): string {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix}${time}_${rand}`;
  }
}

/**
 * Утилита: ArrayBuffer → base64 (асинхронно через FileReader.readAsDataURL).
 * Не блокирует main thread на десятках МБ.
 */
export function arrayBufferToBase64Async(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl формат: 'data:application/octet-stream;base64,XXXX'
      const i = dataUrl.indexOf(',');
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** base64 → ArrayBuffer. Синхронно, но без многомегабайтной конкатенации. */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
