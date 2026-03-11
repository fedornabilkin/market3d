import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import type { CSGType } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { GroupNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import { ModelMemento as ModelMementoClass } from '../memento/ModelMemento';

const DEFAULT_MATERIAL = new THREE.MeshPhongMaterial({
  color: 0xcccccc,
  shininess: 30,
  specular: 0x444444,
});

/**
 * Composite node: holds children and applies CSG operation to produce mesh.
 */
export class GroupNode extends ModelNode {
  override children: ModelNode[] = [];
  override operation: CSGType = 'union';

  override clone(): GroupNode {
    const node = new GroupNode();
    node.operation = this.operation;
    node.children = this.children.map((c) => c.clone());
    if (this.params && Object.keys(this.params).length > 0) {
      node.params = {
        position: this.params.position && { ...this.params.position },
        scale: this.params.scale && { ...this.params.scale },
        rotation: this.params.rotation && { ...this.params.rotation },
      };
    }
    return node;
  }

  getMesh(): THREE.Mesh {
    if (this.children.length === 0) {
      const empty = new THREE.Mesh(new THREE.BufferGeometry(), DEFAULT_MATERIAL.clone());
      this.applyParamsToMesh(empty);
      return empty;
    }

    const meshes = this.children.map((child) => {
      const mesh = child.getMesh();
      mesh.updateMatrixWorld(true);
      return mesh;
    });

    let result: THREE.Mesh;
    if (meshes.length === 1) {
      result = meshes[0].clone();
      result.material = DEFAULT_MATERIAL.clone();
    } else {
      const bspFirst = CSG.fromMesh(meshes[0]);
      let bsp = bspFirst;

      for (let i = 1; i < meshes.length; i++) {
        const bspNext = CSG.fromMesh(meshes[i]);
        if (this.operation === 'union') {
          bsp = bsp.union(bspNext);
        } else if (this.operation === 'subtract') {
          bsp = bsp.subtract(bspNext);
        } else {
          bsp = bsp.intersect(bspNext);
        }
      }

      result = CSG.toMesh(bsp, meshes[0].matrix);
      result.material = DEFAULT_MATERIAL.clone();
    }

    this.applyParamsToMesh(result);
    return result;
  }

  private applyParamsToMesh(mesh: THREE.Mesh): void {
    const { position, scale, rotation } = this.params;
    if (position) {
      mesh.position.set(position.x, position.y, position.z);
    }
    if (scale) {
      mesh.scale.set(scale.x, scale.y, scale.z);
    }
    if (rotation) {
      mesh.rotation.set(
        rotation.x,
        rotation.y,
        rotation.z,
        (rotation.order as THREE.Euler['order']) ?? 'XYZ'
      );
    }
  }

  getMemento(): ModelMemento {
    const treeState: GroupNodeJSON = {
      kind: 'group',
      operation: this.operation,
      children: this.children.map((c) => c.getMemento().getState()),
    };
    if (this.params && Object.keys(this.params).length > 0) {
      treeState.nodeParams = {
        position: this.params.position && { ...this.params.position },
        scale: this.params.scale && { ...this.params.scale },
        rotation: this.params.rotation && { ...this.params.rotation },
      };
    }
    return new ModelMementoClass(treeState);
  }
}
