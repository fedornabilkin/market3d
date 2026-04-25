import type * as THREE from 'three';
import { EntityBuilder } from './EntityBuilder';
import { ImportedMeshEntity, type ImportedMeshParams } from '../ImportedMeshEntity';

/**
 * Билдер импортированного меша. В отличие от геометрических примитивов у него
 * нет дефолтов — геометрия и base64 приходят только из STL-loader-а и
 * обязательны.
 */
export class ImportedMeshBuilder extends EntityBuilder<ImportedMeshEntity, ImportedMeshParams> {
  geometry(value: THREE.BufferGeometry): this {
    this.params.geometry = value;
    return this;
  }

  stlBase64(value: string): this {
    this.params.stlBase64 = value;
    return this;
  }

  filename(value: string): this {
    this.params.filename = value;
    return this;
  }

  build(): ImportedMeshEntity {
    if (!this.params.geometry || !this.params.stlBase64 || !this.params.filename) {
      throw new Error(
        '[ImportedMeshBuilder] обязательны все поля: geometry, stlBase64, filename.',
      );
    }
    return new ImportedMeshEntity({
      geometry: this.params.geometry,
      stlBase64: this.params.stlBase64,
      filename: this.params.filename,
    });
  }
}
