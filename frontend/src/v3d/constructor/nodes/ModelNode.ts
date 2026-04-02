import type * as THREE from 'three';
import type { CSGType, NodeParams } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { Primitive } from './Primitive';

/**
 * Abstract node of the model tree (Composite + Prototype).
 * Primitives are leaves; GroupNode holds children and applies CSG.
 */
export abstract class ModelNode {
  primitives: Primitive[] = [];
  children: ModelNode[] = [];
  operation: CSGType = 'union';
  params: NodeParams = {};
  uuidMesh: string = '';
  /** Human-readable label shown in the node tree. */
  name: string = '';

  abstract clone(): ModelNode;
  abstract getMesh(): THREE.Mesh;
  abstract getMemento(): ModelMemento;

  setUuid(uuid: string): void {
    this.uuidMesh = uuid;
  }
}
