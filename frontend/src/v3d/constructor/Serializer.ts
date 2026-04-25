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
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

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
      const json: ImportedMeshNodeJSON = {
        kind: 'imported',
        stlBase64: root.stlBase64,
        filename: root.filename,
      };
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
      const binary = Uint8Array.from(atob(data.stlBase64), (c) => c.charCodeAt(0));
      const loader = new STLLoader();
      const geometry = loader.parse(binary.buffer);
      const node = new ImportedMeshNode(
        geometry,
        data.stlBase64,
        data.filename,
        data.nodeParams ? this.cloneNodeParams(data.nodeParams) : undefined,
      );
      if (data.name) node.name = data.name;
      return node;
    }
    throw new Error('Unknown JSON node kind');
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
    const root = rootJson as ModelTreeJSON & { coordsConvention?: string };
    if (root.coordsConvention === 'zup') return;

    const swapYZ = (v?: { x: number; y: number; z: number }): void => {
      if (!v) return;
      const tmp = v.y;
      v.y = v.z;
      v.z = tmp;
    };

    const visit = (node: ModelTreeJSON): void => {
      const np = (node as { nodeParams?: NodeParams }).nodeParams;
      if (np) {
        swapYZ(np.position);
        swapYZ(np.rotation as { x: number; y: number; z: number } | undefined);
      }
      if ((node as { kind: string }).kind === 'group') {
        const children = (node as { children?: ModelTreeJSON[] }).children;
        if (children) for (const c of children) visit(c);
      }
    };

    visit(rootJson);
    root.coordsConvention = 'zup';
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
