import type { ModelNode } from './nodes/ModelNode';
import type {
  ModelTreeJSON,
  PrimitiveNodeJSON,
  GroupNodeJSON,
  NodeParams,
  PrimitiveParams,
} from './types';
import { Primitive } from './nodes/Primitive';
import { GroupNode } from './nodes/GroupNode';

/**
 * Serializes/deserializes model tree to/from JSON.
 */
export class Serializer {
  toJSON(root: ModelNode): ModelTreeJSON {
    if (root instanceof Primitive) {
      const json: PrimitiveNodeJSON = {
        kind: 'primitive',
        type: root.type,
        params: { ...root.geometryParams },
      };
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
      return new Primitive(
        data.type,
        { ...data.params } as PrimitiveParams,
        data.nodeParams ? this.cloneNodeParams(data.nodeParams) : undefined
      );
    }
    if (data.kind === 'group') {
      const node = new GroupNode();
      node.operation = data.operation;
      node.children = data.children.map((child) => this.fromJSON(child));
      if (data.nodeParams) {
        node.params = this.cloneNodeParams(data.nodeParams);
      }
      return node;
    }
    throw new Error('Unknown JSON node kind');
  }

  private cloneNodeParams(p: NodeParams): NodeParams {
    const out: NodeParams = {};
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
