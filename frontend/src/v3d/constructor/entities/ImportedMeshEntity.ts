import type * as THREE from 'three';
import { Entity } from './Entity';

export interface ImportedMeshParams {
  /** Готовая BufferGeometry (обычно из STLLoader.parse()). */
  geometry: THREE.BufferGeometry;
  /** Base64 исходного STL — для сериализации/персистентности. */
  stlBase64: string;
  /** Имя файла, с которым меш был импортирован. */
  filename: string;
}

/**
 * Импортированный STL — единственная сущность без собственной параметрической
 * геометрии. Геометрия строится один раз при парсинге файла и далее шарится
 * между всеми mesh-инстансами (в рантайме не мутируется).
 */
export class ImportedMeshEntity extends Entity<ImportedMeshParams> {
  readonly type = 'imported' as const;

  createGeometry(): THREE.BufferGeometry {
    // Шарим один BufferGeometry — clone делает только экспортёр.
    return this.params.geometry;
  }

  getHalfHeight(): number {
    if (!this.params.geometry.boundingBox) {
      this.params.geometry.computeBoundingBox();
    }
    const bb = this.params.geometry.boundingBox!;
    return (bb.max.y - bb.min.y) / 2;
  }

  /** Прямой доступ к закодированному исходнику — нужен сериализатору. */
  getStlBase64(): string {
    return this.params.stlBase64;
  }

  /** Имя файла — нужно для подписи в NodeTree. */
  getFilename(): string {
    return this.params.filename;
  }
}
