import * as THREE from 'three';
import type { NodeParams } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { ImportedMeshNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import { ModelMemento as ModelMementoClass } from '../memento/ModelMemento';
import { applyHoleStyle } from '../holeMaterial';
import { ImportedMeshEntity } from '../entities/ImportedMeshEntity';
import { ImportedMeshBuilder } from '../entities/builders/ImportedMeshBuilder';

function createMaterial(color?: string, isHole?: boolean): THREE.MeshPhongMaterial {
  const mat = new THREE.MeshPhongMaterial({
    color: color ? new THREE.Color(color) : 0x00a5a4,
    shininess: 30,
    specular: 0x444444,
  });
  if (isHole) {
    applyHoleStyle(mat);
  }
  return mat;
}

/**
 * Node that wraps an imported mesh geometry (e.g. from STL).
 *
 * Внутри делегирует геометрию/halfHeight в `ImportedMeshEntity`; публичные
 * поля `stlBase64` и `filename` оставлены как getter-ы, чтобы не ломать
 * Serializer и прочие места, которые их читают.
 */
export class ImportedMeshNode extends ModelNode {
  private readonly entity: ImportedMeshEntity;

  constructor(
    geometry: THREE.BufferGeometry,
    stlBase64: string,
    filename: string,
    nodeParams?: NodeParams,
  ) {
    super();
    this.entity = new ImportedMeshBuilder()
      .geometry(geometry)
      .stlBase64(stlBase64)
      .filename(filename)
      .build();
    this.name = filename.replace(/\.stl$/i, '');
    if (nodeParams) this.params = nodeParams;
  }

  /** Base64 исходного STL. Сохраняем публичным для совместимости с сериализатором. */
  get stlBase64(): string {
    return this.entity.getStlBase64();
  }

  /** Имя STL-файла — используется как label в дереве. */
  get filename(): string {
    return this.entity.getFilename();
  }

  getGeometry(): THREE.BufferGeometry {
    return this.entity.createGeometry();
  }

  clone(): ImportedMeshNode {
    const cloned = new ImportedMeshNode(
      this.entity.createGeometry().clone(),
      this.entity.getStlBase64(),
      this.entity.getFilename(),
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
    // Геометрия шарится между всеми Mesh (в рантайме не мутируется); clone
    // делает только ModelExporter при финальном CSG.
    const mesh = new THREE.Mesh(this.entity.createGeometry(), material);
    mesh.userData.sharedGeometry = true;
    this.applyParamsToMesh(mesh);
    return mesh;
  }

  /** Bounding-box based half-height for Y-offset convention. */
  getHalfHeight(): number {
    return this.entity.getHalfHeight();
  }

  private applyParamsToMesh(mesh: THREE.Mesh): void {
    const { position, scale, rotation } = this.params;
    if (position) {
      // Z-up: params.position.z — нижняя грань; halfHeight по Z поднимает центр.
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
        (rotation.order as THREE.Euler['order']) ?? 'XYZ',
      );
    }
  }

  getMemento(): ModelMemento {
    const treeState: ImportedMeshNodeJSON = {
      kind: 'imported',
      stlBase64: this.entity.getStlBase64(),
      filename: this.entity.getFilename(),
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
