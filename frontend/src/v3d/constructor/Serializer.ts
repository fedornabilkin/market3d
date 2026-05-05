import type * as THREE from 'three';
import type { ModelNode } from './nodes/ModelNode';
import type {
  ModelTreeJSON,
  PrimitiveNodeJSON,
  GroupNodeJSON,
  ImportedMeshNodeJSON,
  NodeParams,
  PrimitiveParams,
} from './types';
import { Primitive } from './nodes/Primitive';
import { GroupNode } from './nodes/GroupNode';
import { ImportedMeshNode } from './nodes/ImportedMeshNode';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { migrateLegacyYupToZupIfNeeded as _migrateYupToZup } from './migrations/legacyYupToZup';

/**
 * Serializes/deserializes the model tree to/from JSON.
 * Handles name, color, and all geometry/transform params.
 */
export class Serializer {
  /**
   * Сериализует корень дерева с пометкой coordsConvention='zup'. Используется
   * в save-флоу — этот флаг затем читается migrateLegacyYupToZupIfNeeded
   * при следующей загрузке, чтобы не делать swap координат повторно.
   */
  toRootJSON(root: ModelNode): ModelTreeJSON {
    const json = this.toJSON(root);
    (json as ModelTreeJSON & { coordsConvention?: string }).coordsConvention = 'zup';
    return json;
  }

  toJSON(root: ModelNode): ModelTreeJSON {
    if (root instanceof ImportedMeshNode) {
      const hasBinaryRef = !!root.binaryRef;
      const json: ImportedMeshNodeJSON = {
        kind: 'imported',
        // Если бинарник в IndexedDB (binaryRef), base64 не пишем — это убирает
        // многомегабайтную строку из localStorage и устраняет UI-фриз при сохранении.
        stlBase64: hasBinaryRef ? '' : root.stlBase64,
        filename: root.filename,
      };
      if (hasBinaryRef) json.binaryRef = root.binaryRef;
      if (root.name) json.name = root.name;
      if (Object.keys(root.params).length > 0) {
        json.nodeParams = this.cloneNodeParams(root.params);
      }
      return json;
    }
    if (root instanceof Primitive) {
      const json: PrimitiveNodeJSON = {
        kind: 'primitive',
        type: root.type,
        params: { ...root.geometryParams },
      };
      if (root.name) json.name = root.name;
      if (Object.keys(root.params).length > 0) {
        json.nodeParams = this.cloneNodeParams(root.params);
      }
      return json;
    }
    if (root instanceof GroupNode) {
      const json: GroupNodeJSON = {
        kind: 'group',
        operation: root.operation,
        children: root.children.map((child) => this.toJSON(child)),
      };
      if (root.name) json.name = root.name;
      if (Object.keys(root.params).length > 0) {
        json.nodeParams = this.cloneNodeParams(root.params);
      }
      return json;
    }
    throw new Error('Unknown node type');
  }

  fromJSON(json: ModelTreeJSON | string): ModelNode {
    const data = typeof json === 'string' ? (JSON.parse(json) as ModelTreeJSON) : json;
    if (data.kind === 'primitive') {
      const prim = new Primitive(
        data.type,
        { ...data.params } as PrimitiveParams,
        data.nodeParams ? this.cloneNodeParams(data.nodeParams) : undefined
      );
      if (data.name) prim.name = data.name;
      return prim;
    }
    if (data.kind === 'group') {
      const node = new GroupNode();
      node.operation = data.operation;
      node.children = data.children.map((child) => this.fromJSON(child));
      if (data.nodeParams) node.params = this.cloneNodeParams(data.nodeParams);
      if (data.name) node.name = data.name;
      return node;
    }
    if (data.kind === 'imported') {
      // Источник бинарника: либо binaryRef (предварительно резолвленный
      // через preResolveBinaryRefs в loader-е), либо legacy base64 inline.
      const resolved = (data as { __resolvedGeometry?: THREE.BufferGeometry }).__resolvedGeometry;
      let geometry: THREE.BufferGeometry;
      if (resolved) {
        geometry = resolved;
      } else if (data.stlBase64) {
        const binary = Uint8Array.from(atob(data.stlBase64), (c) => c.charCodeAt(0));
        const loader = new STLLoader();
        geometry = loader.parse(binary.buffer);
      } else {
        throw new Error(`[Serializer] imported-нода без stlBase64 и без resolved geometry (binaryRef=${data.binaryRef ?? '?'}). Вызови preResolveBinaryRefs до fromJSON.`);
      }
      const node = new ImportedMeshNode(
        geometry,
        data.stlBase64 || '',
        data.filename,
        data.nodeParams ? this.cloneNodeParams(data.nodeParams) : undefined,
        data.binaryRef,
      );
      if (data.name) node.name = data.name;
      return node;
    }
    throw new Error('Unknown JSON node kind');
  }

  /**
   * Pre-resolve: для всех `kind:'imported'` нод с binaryRef'ом подгружает
   * бинарник из IndexedDB и парсит STL → BufferGeometry. Геометрия пишется
   * в JSON-узел как нестандартное поле `__resolvedGeometry`, которое потом
   * читает sync-ный fromJSON.
   *
   * Также мигрирует legacy base64-сохранёнки в IndexedDB: если у ноды только
   * stlBase64, бинарник переносится в IDB, в JSON ставится binaryRef и base64
   * очищается. На следующем save-е сохранёнка станет лёгкой.
   */
  static async preResolveBinaryRefs(rootJson: ModelTreeJSON): Promise<void> {
    const { BinaryStorage, base64ToArrayBuffer } = await import('./services/BinaryStorage');
    const loader = new STLLoader();

    const visit = async (node: ModelTreeJSON): Promise<void> => {
      if ((node as { kind: string }).kind === 'imported') {
        const im = node as ImportedMeshNodeJSON & { __resolvedGeometry?: THREE.BufferGeometry };
        if (im.binaryRef) {
          const buf = await BinaryStorage.get(im.binaryRef);
          if (buf) im.__resolvedGeometry = loader.parse(buf);
          // Если бинарника нет в IDB (например, удалили) — fallback на base64,
          // если он каким-то образом сохранился. Иначе fromJSON бросит понятную ошибку.
        } else if (im.stlBase64) {
          // Legacy: мигрируем в IndexedDB. Не блокирующий шаг — даже если запись
          // упадёт, узел всё равно загрузится через base64 inline.
          try {
            const id = BinaryStorage.newId();
            const buf = base64ToArrayBuffer(im.stlBase64);
            await BinaryStorage.put(id, buf);
            im.binaryRef = id;
            im.stlBase64 = ''; // на следующем save запишется только binaryRef
          } catch (e) {
            console.warn('[Serializer] migration to IndexedDB failed, keeping base64:', e);
          }
        }
      }
      if ((node as { kind: string }).kind === 'group') {
        const children = (node as { children?: ModelTreeJSON[] }).children;
        if (children) for (const c of children) await visit(c);
      }
    };

    await visit(rootJson);
  }

  /**
   * Один раз мигрирует legacy Y-up сохранёнку в Z-up: рекурсивно меняет
   * местами координаты Y↔Z в position и rotation у каждой ноды. Помечает
   * корневой объект `coordsConvention: 'zup'`, чтобы повторная загрузка не
   * мигрировала ещё раз. Мутирует JSON in-place.
   *
   * Вызывать в loadFromLocalStorage / loadFromFile ДО Serializer.fromJSON,
   * на верхнеуровневом JSON-объекте.
   */
  static migrateLegacyYupToZupIfNeeded(rootJson: ModelTreeJSON): void {
    _migrateYupToZup(rootJson);
  }

  private cloneNodeParams(p: NodeParams): NodeParams {
    const out: NodeParams = { ...p };
    if (p.position) {
      out.position = { x: p.position.x, y: p.position.y, z: p.position.z };
    }
    if (p.scale) {
      out.scale = { x: p.scale.x, y: p.scale.y, z: p.scale.z };
    }
    if (p.rotation) {
      out.rotation = {
        x: p.rotation.x,
        y: p.rotation.y,
        z: p.rotation.z,
        order: p.rotation.order,
      };
    }
    return out;
  }
}
