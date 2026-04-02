import * as THREE from 'three';
import type { PrimitiveType, PrimitiveParams, NodeParams } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { PrimitiveNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import { ModelMemento as ModelMementoClass } from '../memento/ModelMemento';

/** Creates a fresh PhongMaterial per mesh — no shared global state. */
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
 * Leaf node of the composite (single primitive geometry).
 *
 * Position convention: params.position.y = 0 means the BOTTOM FACE of the primitive
 * sits on the grid (y = 0). getMesh() applies a halfHeight offset internally so the
 * Three.js mesh center is at (position.y + halfHeight). This keeps CSG consistent with
 * the visual scene — both use the same world positions.
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
    const cloned = new Primitive(
      this.type,
      { ...this.geometryParams },
      this.params && Object.keys(this.params).length > 0
        ? {
            position: this.params.position && { ...this.params.position },
            scale: this.params.scale && { ...this.params.scale },
            rotation: this.params.rotation && { ...this.params.rotation },
            isHole: this.params.isHole,
            color: this.params.color,
          }
        : undefined
    );
    cloned.name = this.name;
    return cloned;
  }

  getMesh(): THREE.Mesh {
    const geometry = this.createGeometry();
    const material = createMaterial(
      this.params?.color as string | undefined,
      this.params?.isHole as boolean | undefined
    );
    const mesh = new THREE.Mesh(geometry, material);
    this.applyParamsToMesh(mesh);
    return mesh;
  }

  /**
   * Half-height from center to the bottom face.
   * Used to convert between "bottom-on-grid" position semantics and Three.js center semantics.
   */
  getHalfHeight(): number {
    const g = this.geometryParams;
    const h = g.height ?? 1;
    const r = g.radius ?? 0.5;
    switch (this.type) {
      case 'box':
      case 'cylinder':
      case 'cone':
      case 'plane':
        return h / 2;
      case 'sphere':
        return r;
      case 'torus':
        return g.tube ?? 0.2;
      case 'ring':
        return g.outerRadius ?? r;
      default:
        return h / 2;
    }
  }

  /**
   * Creates geometry from current geometryParams.
   * Public so ConstructorSceneService can update geometry in-place during
   * handle-drag without rebuilding the entire scene tree.
   */
  createGeometry(): THREE.BufferGeometry {
    const p = this.geometryParams;
    const w = p.width ?? 1;
    const h = p.height ?? 1;
    const d = p.depth ?? 1;
    const r = p.radius ?? 0.5;
    const seg = p.segments ?? 32;
    const wSeg = p.widthSegments ?? 16;
    const hSeg = p.heightSegments ?? 16;

    // Three.js 0.118 uses *BufferGeometry variants for BufferGeometry subclasses
    switch (this.type) {
      case 'box':
        return new THREE.BoxBufferGeometry(w, h, d);
      case 'sphere':
        return new THREE.SphereBufferGeometry(r, wSeg, hSeg);
      case 'cylinder': {
        const rTop = p.radiusTop ?? r;
        const rBottom = p.radiusBottom ?? r;
        return new THREE.CylinderBufferGeometry(rTop, rBottom, h, seg);
      }
      case 'cone':
        // Use tiny non-zero top radius to avoid degenerate triangles that break CSG
        return new THREE.CylinderBufferGeometry(0.001, r, h, seg);
      case 'torus': {
        const tube = p.tube ?? 0.2;
        return new THREE.TorusBufferGeometry(r, tube, 16, seg);
      }
      case 'plane':
        return new THREE.PlaneBufferGeometry(w, h, 1, 1);
      case 'ring': {
        const inner = p.innerRadius ?? r * 0.5;
        const outer = p.outerRadius ?? r;
        return new THREE.RingBufferGeometry(inner, outer, seg);
      }
      default:
        return new THREE.BoxBufferGeometry(1, 1, 1);
    }
  }

  private applyParamsToMesh(mesh: THREE.Mesh): void {
    const { position, scale, rotation } = this.params;
    if (position) {
      // params.position.y = bottom face Y; add halfHeight to get Three.js center Y
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
        (rotation.order as THREE.Euler['order']) ?? 'XYZ'
      );
    }
  }

  getMemento(): ModelMemento {
    const treeState: PrimitiveNodeJSON = {
      kind: 'primitive',
      type: this.type,
      params: { ...this.geometryParams },
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
