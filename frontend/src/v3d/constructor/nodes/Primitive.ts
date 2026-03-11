import * as THREE from 'three';
import type { PrimitiveType, PrimitiveParams, NodeParams } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { PrimitiveNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import { ModelMemento as ModelMementoClass } from '../memento/ModelMemento';

const DEFAULT_MATERIAL = new THREE.MeshPhongMaterial({
  color: 0xcccccc,
  shininess: 30,
  specular: 0x444444,
});

/**
 * Leaf node of the composite (single primitive geometry).
 */
export class Primitive extends ModelNode {
  /** Geometry params (width, height, radius, segments, ...). */
  geometryParams: PrimitiveParams;

  constructor(
    public type: PrimitiveType,
    geometryParams: PrimitiveParams,
    nodeParams?: NodeParams
  ) {
    super();
    this.geometryParams = geometryParams;
    if (nodeParams) this.params = nodeParams;
  }

  clone(): Primitive {
    return new Primitive(
      this.type,
      { ...this.geometryParams },
      this.params && Object.keys(this.params).length > 0
        ? {
            position: this.params.position && { ...this.params.position },
            scale: this.params.scale && { ...this.params.scale },
            rotation: this.params.rotation && { ...this.params.rotation },
          }
        : undefined
    );
  }

  getMesh(): THREE.Mesh {
    const geometry = this.createGeometry();
    const mesh = new THREE.Mesh(geometry, DEFAULT_MATERIAL.clone());
    this.applyParamsToMesh(mesh);
    return mesh;
  }

  private createGeometry(): THREE.BufferGeometry {
    const p = this.geometryParams;
    const w = p.width ?? 1;
    const h = p.height ?? 1;
    const d = p.depth ?? 1;
    const r = p.radius ?? 0.5;
    const seg = p.segments ?? 32;
    const wSeg = p.widthSegments ?? 16;
    const hSeg = p.heightSegments ?? 16;

    switch (this.type) {
      case 'box':
        return new THREE.BoxGeometry(w, h, d);
      case 'sphere':
        return new THREE.SphereGeometry(r, wSeg, hSeg);
      case 'cylinder': {
        const rTop = p.radiusTop ?? r;
        const rBottom = p.radiusBottom ?? r;
        return new THREE.CylinderGeometry(rTop, rBottom, h, seg);
      }
      case 'cone':
        return new THREE.CylinderGeometry(0, r, h, seg);
      case 'torus': {
        const tube = (p as { tube?: number }).tube ?? 0.2;
        return new THREE.TorusGeometry(r, tube, 16, seg);
      }
      case 'plane':
        return new THREE.PlaneGeometry(w, h, 1, 1);
      case 'ring': {
        const inner = (p as { innerRadius?: number }).innerRadius ?? r * 0.5;
        const outer = (p as { outerRadius?: number }).outerRadius ?? r;
        return new THREE.RingGeometry(inner, outer, seg);
      }
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
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
      mesh.rotation.set(rotation.x, rotation.y, rotation.z, (rotation.order as THREE.Euler['order']) ?? 'XYZ');
    }
  }

  getMemento(): ModelMemento {
    const treeState: PrimitiveNodeJSON = {
      kind: 'primitive',
      type: this.type,
      params: { ...this.geometryParams },
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
