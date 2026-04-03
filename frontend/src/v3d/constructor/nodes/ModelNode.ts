import type * as THREE from 'three';
import type { CSGType, NodeParams } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { Primitive } from './Primitive';

export type ExportProgressCallback = (done: number, total: number) => void;

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

  /**
   * Async version of getMesh that yields between heavy CSG operations,
   * allowing the browser to repaint and update a progress bar.
   */
  async getMeshAsync(
    _onProgress?: ExportProgressCallback,
    _counter?: { done: number; total: number },
  ): Promise<THREE.Mesh> {
    return this.getMesh();
  }

  /** Count total CSG operations in this subtree (for progress tracking). */
  countCSGOperations(): number {
    return 0;
  }

  setUuid(uuid: string): void {
    this.uuidMesh = uuid;
  }
}
