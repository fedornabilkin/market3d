import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import type { CSGType } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { GroupNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import type { ExportProgressCallback } from './ModelNode';
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
      return GroupNode.normalizeForCSG(mesh);
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

  override countCSGOperations(): number {
    let count = 0;
    for (const child of this.children) {
      count += child.countCSGOperations();
    }
    const solidCount = this.children.filter((c) => !c.params?.isHole).length;
    const holeCount = this.children.filter((c) => !!c.params?.isHole).length;
    if (solidCount > 1 || holeCount > 0) {
      count += Math.max(0, solidCount - 1) + holeCount;
    }
    return count;
  }

  /**
   * Async version that yields between CSG operations so the UI can repaint.
   * Uses a shared counter object to track progress across the recursive tree.
   */
  override async getMeshAsync(
    onProgress?: ExportProgressCallback,
    _counter?: { done: number; total: number },
  ): Promise<THREE.Mesh> {
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

    const solidChildren = this.children.filter((c) => !c.params?.isHole);
    const holeChildren = this.children.filter((c) => !!c.params?.isHole);

    const makeMeshAsync = async (child: ModelNode): Promise<THREE.Mesh> => {
      const mesh = await child.getMeshAsync(onProgress, _counter);
      mesh.updateMatrix();
      mesh.updateMatrixWorld(true);
      return GroupNode.normalizeForCSG(mesh);
    };

    let result: THREE.Mesh;

    if (solidChildren.length === 0) {
      const empty = new THREE.Mesh(new THREE.BufferGeometry(), defaultMaterial);
      this.applyParamsToMesh(empty);
      return empty;
    }

    const solidMeshes: THREE.Mesh[] = [];
    for (const child of solidChildren) {
      solidMeshes.push(await makeMeshAsync(child));
    }

    if (solidMeshes.length === 1 && holeChildren.length === 0) {
      result = solidMeshes[0].clone();
      result.material = defaultMaterial;
      this.applyParamsToMesh(result);
      return result;
    }

    try {
      let bsp = CSG.fromMesh(solidMeshes[0]);

      for (let i = 1; i < solidMeshes.length; i++) {
        // Yield to let browser repaint
        await new Promise((r) => setTimeout(r, 0));
        const bspNext = CSG.fromMesh(solidMeshes[i]);
        if (this.operation === 'subtract') {
          bsp = bsp.subtract(bspNext);
        } else if (this.operation === 'intersect') {
          bsp = bsp.intersect(bspNext);
        } else {
          bsp = bsp.union(bspNext);
        }
        if (_counter && onProgress) {
          _counter.done++;
          onProgress(_counter.done, _counter.total);
        }
      }

      for (const holeChild of holeChildren) {
        await new Promise((r) => setTimeout(r, 0));
        const holeMesh = await makeMeshAsync(holeChild);
        const holeBsp = CSG.fromMesh(holeMesh);
        bsp = bsp.subtract(holeBsp);
        if (_counter && onProgress) {
          _counter.done++;
          onProgress(_counter.done, _counter.total);
        }
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

  /**
   * Bakes a mesh's matrix into its geometry so it can be safely consumed by CSG.
   * If the matrix has a negative determinant (mirror via negative scale), the
   * triangle winding is reversed and normals are recomputed — otherwise CSG
   * would treat the BSP as inside-out and a hole would subtract everything
   * outside its volume instead of inside it.
   */
  private static normalizeForCSG(mesh: THREE.Mesh): THREE.Mesh {
    const det = mesh.matrix.determinant();
    if (det >= 0) return mesh;

    // mesh.geometry may be either BufferGeometry (Primitive children) or
    // legacy Geometry (GroupNode children, since CSG.toMesh returns Geometry).
    // Both must be handled.
    const src = mesh.geometry as THREE.BufferGeometry | THREE.Geometry;
    const isBuffer = (src as THREE.BufferGeometry).isBufferGeometry === true;

    let fixedGeom: THREE.BufferGeometry | THREE.Geometry;

    if (isBuffer) {
      const geom = (src as THREE.BufferGeometry).clone();
      geom.applyMatrix4(mesh.matrix);

      const idx = geom.getIndex();
      if (idx) {
        const arr = idx.array as { [k: number]: number; length: number };
        for (let i = 0; i < arr.length; i += 3) {
          const t = arr[i];
          arr[i] = arr[i + 2];
          arr[i + 2] = t;
        }
        idx.needsUpdate = true;
      } else {
        const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (pos) {
          const a = pos.array as Float32Array;
          for (let i = 0; i < a.length; i += 9) {
            for (let j = 0; j < 3; j++) {
              const t = a[i + j];
              a[i + j] = a[i + 6 + j];
              a[i + 6 + j] = t;
            }
          }
          pos.needsUpdate = true;
        }
      }
      geom.computeVertexNormals();
      fixedGeom = geom;
    } else {
      const geom = (src as THREE.Geometry).clone();
      geom.applyMatrix4(mesh.matrix);
      for (const f of geom.faces) {
        const tA = f.a;
        f.a = f.c;
        f.c = tA;
        if (f.vertexNormals && f.vertexNormals.length === 3) {
          const tN = f.vertexNormals[0];
          f.vertexNormals[0] = f.vertexNormals[2];
          f.vertexNormals[2] = tN;
        }
      }
      // Swap UVs to match the new winding so face attributes stay aligned.
      const fvuvs = geom.faceVertexUvs && geom.faceVertexUvs[0];
      if (fvuvs) {
        for (const tri of fvuvs) {
          if (tri && tri.length === 3) {
            const tU = tri[0];
            tri[0] = tri[2];
            tri[2] = tU;
          }
        }
      }
      geom.computeFaceNormals();
      geom.computeVertexNormals();
      geom.elementsNeedUpdate = true;
      geom.normalsNeedUpdate = true;
      geom.verticesNeedUpdate = true;
      fixedGeom = geom;
    }

    const fixed = new THREE.Mesh(fixedGeom as THREE.BufferGeometry, mesh.material);
    fixed.matrixAutoUpdate = false;
    fixed.matrix.identity();
    fixed.updateMatrixWorld(true);
    return fixed;
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
