import * as THREE from 'three';
import type { PrimitiveType, PrimitiveParams, NodeParams } from '../types';
import { ModelNode } from './ModelNode';
import { applyHoleStyle } from '../holeMaterial';
import { createEntity } from '../entities/EntityFactory';

/** Creates a fresh PhongMaterial per mesh — no shared global state. */
function createMaterial(color?: string, isHole?: boolean, flatShading?: boolean): THREE.MeshPhongMaterial {
  const mat = new THREE.MeshPhongMaterial({
    color: color ? new THREE.Color(color) : 0x00a5a4,
    shininess: 30,
    specular: 0x444444,
    flatShading: flatShading === true,
  });
  if (isHole) {
    applyHoleStyle(mat);
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
      this.params?.isHole as boolean | undefined,
      this.type === 'knurl'
    );
    const mesh = new THREE.Mesh(geometry, material);
    this.applyParamsToMesh(mesh);
    return mesh;
  }

  /**
   * Возвращает свежую Entity по текущим type + geometryParams. Логика
   * конкретных типов живёт в классах Entity (см. entities/), здесь — только
   * делегирование. Entity пересоздаётся на каждый вызов, т.к. callers
   * мутируют `geometryParams` напрямую (handle drag, form update и т.п.).
   */
  private buildEntity() {
    return createEntity(this.type, this.geometryParams as Record<string, unknown>);
  }

  /**
   * Half-height from center to the bottom face.
   * Used to convert between "bottom-on-grid" position semantics and Three.js center semantics.
   */
  getHalfHeight(): number {
    return this.buildEntity().getHalfHeight();
  }

  /**
   * Creates geometry from current geometryParams.
   * Public so ConstructorSceneService can update geometry in-place during
   * handle-drag without rebuilding the entire scene tree.
   */
  createGeometry(): THREE.BufferGeometry {
    return this.buildEntity().createGeometry();
  }

  private applyParamsToMesh(mesh: THREE.Mesh): void {
    const { position, scale, rotation } = this.params;
    if (position) {
      // Z-up: params.position.z = bottom face Z; добавляем halfHeight,
      // чтобы получить центр меша по Z.
      mesh.position.set(position.x, position.y, (position.z ?? 0) + this.getHalfHeight());
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

}
