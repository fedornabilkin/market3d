import * as THREE from 'three';
import type { NodeParams } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { ImportedMeshNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import { ModelMemento as ModelMementoClass } from '../memento/ModelMemento';

function createMaterial(color?: string, isHole?: boolean): THREE.MeshPhongMaterial {
  const mat = new THREE.MeshPhongMaterial({
    color: color ? new THREE.Color(color) : 0xcccccc,
    shininess: 30,
    specular: 0x444444,
  });
  if (isHole) {
    mat.transparent = true;
    mat.opacity = 0.35;
  }
  return mat;
}

/**
 * Node that wraps an imported mesh geometry (e.g. from STL).
 * Stores the raw geometry data as base64 for serialization.
 */
export class ImportedMeshNode extends ModelNode {
  /** The live BufferGeometry. */
  private geometry: THREE.BufferGeometry;
  /** Base64-encoded STL binary for serialization/persistence. */
  stlBase64: string;
  /** Original filename for display. */
  filename: string;

  constructor(
    geometry: THREE.BufferGeometry,
    stlBase64: string,
    filename: string,
    nodeParams?: NodeParams,
  ) {
    super();
    this.geometry = geometry;
    this.stlBase64 = stlBase64;
    this.filename = filename;
    this.name = filename.replace(/\.stl$/i, '');
    if (nodeParams) this.params = nodeParams;
  }

  getGeometry(): THREE.BufferGeometry {
    return this.geometry;
  }

  clone(): ImportedMeshNode {
    const cloned = new ImportedMeshNode(
      this.geometry.clone(),
      this.stlBase64,
      this.filename,
      this.params && Object.keys(this.params).length > 0
        ? {
            position: this.params.position && { ...this.params.position },
            scale: this.params.scale && { ...this.params.scale },
            rotation: this.params.rotation && { ...this.params.rotation },
            isHole: this.params.isHole,
            color: this.params.color,
          }
        : undefined,
    );
    cloned.name = this.name;
    return cloned;
  }

  getMesh(): THREE.Mesh {
    const material = createMaterial(
      this.params?.color as string | undefined,
      this.params?.isHole as boolean | undefined,
    );
    const mesh = new THREE.Mesh(this.geometry.clone(), material);
    this.applyParamsToMesh(mesh);
    return mesh;
  }

  /** Bounding-box based half-height for Y-offset convention. */
  getHalfHeight(): number {
    if (!this.geometry.boundingBox) this.geometry.computeBoundingBox();
    const bb = this.geometry.boundingBox!;
    return (bb.max.y - bb.min.y) / 2;
  }

  private applyParamsToMesh(mesh: THREE.Mesh): void {
    const { position, scale, rotation } = this.params;
    if (position) {
      mesh.position.set(position.x, (position.y ?? 0) + this.getHalfHeight(), position.z);
    }
    if (scale) {
      mesh.scale.set(scale.x, scale.y, scale.z);
    }
    if (rotation) {
      mesh.rotation.set(
        rotation.x,
        rotation.y,
        rotation.z,
        (rotation.order as THREE.Euler['order']) ?? 'XYZ',
      );
    }
  }

  getMemento(): ModelMemento {
    const treeState: ImportedMeshNodeJSON = {
      kind: 'imported',
      stlBase64: this.stlBase64,
      filename: this.filename,
    };
    if (this.name) treeState.name = this.name;
    if (this.params && Object.keys(this.params).length > 0) {
      treeState.nodeParams = {
        position: this.params.position && { ...this.params.position },
        scale: this.params.scale && { ...this.params.scale },
        rotation: this.params.rotation && { ...this.params.rotation },
        isHole: this.params.isHole,
        color: this.params.color,
      };
    }
    return new ModelMementoClass(treeState);
  }
}
