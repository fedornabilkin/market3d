import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import type { CSGType } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { GroupNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import { ModelMemento as ModelMementoClass } from '../memento/ModelMemento';

/**
 * Composite node: holds children and applies CSG operation to produce a merged mesh.
 *
 * Note: CSG (getMesh) is used for STL export only. The real-time interactive scene
 * renders each child as a separate Three.js object via buildNodeObject3D in
 * ConstructorSceneService, without applying Boolean operations.
 *
 * Per-child isHole logic:
 *   - Children with params.isHole === true are always subtracted from the result,
 *     regardless of the group's own operation.
 *   - Non-hole children are combined using the group's operation (union/subtract/intersect).
 *   - A GroupNode with params.isHole === true signals to its parent that the whole
 *     group should be treated as a void.
 */
export class GroupNode extends ModelNode {
  override children: ModelNode[] = [];
  override operation: CSGType = 'union';

  override clone(): GroupNode {
    const node = new GroupNode();
    node.operation = this.operation;
    node.name = this.name;
    node.children = this.children.map((c) => c.clone());
    if (this.params && Object.keys(this.params).length > 0) {
      node.params = {
        position: this.params.position && { ...this.params.position },
        scale: this.params.scale && { ...this.params.scale },
        rotation: this.params.rotation && { ...this.params.rotation },
        color: this.params.color,
        isHole: this.params.isHole,
      };
    }
    return node;
  }

  getMesh(): THREE.Mesh {
    const groupColor = this.params?.color as string | undefined;
    const defaultMaterial = new THREE.MeshPhongMaterial({
      color: groupColor ? new THREE.Color(groupColor) : 0x00a5a4,
      shininess: 30,
      specular: 0x444444,
    });

    if (this.children.length === 0) {
      const empty = new THREE.Mesh(new THREE.BufferGeometry(), defaultMaterial);
      this.applyParamsToMesh(empty);
      return empty;
    }

    // Separate solid children from hole children
    const solidChildren = this.children.filter((c) => !c.params?.isHole);
    const holeChildren = this.children.filter((c) => !!c.params?.isHole);

    // Build meshes with correct matrices
    const makeMesh = (child: ModelNode): THREE.Mesh => {
      const mesh = child.getMesh();
      mesh.updateMatrix();
      mesh.updateMatrixWorld(true);
      return mesh;
    };

    let result: THREE.Mesh;

    // Phase 1: combine all solid children using the group's operation
    if (solidChildren.length === 0) {
      // Only holes, nothing to subtract from — return empty
      const empty = new THREE.Mesh(new THREE.BufferGeometry(), defaultMaterial);
      this.applyParamsToMesh(empty);
      return empty;
    }

    const solidMeshes = solidChildren.map(makeMesh);

    if (solidMeshes.length === 1 && holeChildren.length === 0) {
      result = solidMeshes[0].clone();
      result.material = defaultMaterial;
      this.applyParamsToMesh(result);
      return result;
    }

    try {
      let bsp = CSG.fromMesh(solidMeshes[0]);

      // Combine remaining solids
      for (let i = 1; i < solidMeshes.length; i++) {
        const bspNext = CSG.fromMesh(solidMeshes[i]);
        if (this.operation === 'subtract') {
          bsp = bsp.subtract(bspNext);
        } else if (this.operation === 'intersect') {
          bsp = bsp.intersect(bspNext);
        } else {
          bsp = bsp.union(bspNext);
        }
      }

      // Phase 2: subtract all holes from the combined solid
      for (const holeChild of holeChildren) {
        const holeMesh = makeMesh(holeChild);
        const holeBsp = CSG.fromMesh(holeMesh);
        bsp = bsp.subtract(holeBsp);
      }

      result = CSG.toMesh(bsp, new THREE.Matrix4());
      result.material = defaultMaterial;
    } catch (e) {
      console.warn('[GroupNode] CSG operation failed, falling back to first child mesh:', e);
      result = solidMeshes[0].clone();
      result.material = defaultMaterial;
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
    if (this.name) treeState.name = this.name;
    if (this.params && Object.keys(this.params).length > 0) {
      treeState.nodeParams = {
        position: this.params.position && { ...this.params.position },
        scale: this.params.scale && { ...this.params.scale },
        rotation: this.params.rotation && { ...this.params.rotation },
        color: this.params.color,
        isHole: this.params.isHole,
      };
    }
    return new ModelMementoClass(treeState);
  }
}
