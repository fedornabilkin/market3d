import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureDocumentJSON, FeatureId } from '@/v3d/constructor/features/types';
import { ImportedMeshFeature } from '@/v3d/constructor/features/primitives/ImportedMeshFeature';
import { migrateLegacyTreeToDocument } from '@/v3d/constructor/features/migration/migrateLegacyTree';
import { nextP2FeatureId } from '@/v3d/constructor/features/utils/dagMutations';

type ImportedStl = {
  filename: string;
  geometry: THREE.BufferGeometry;
  binaryRef?: string;
  stlBase64?: string;
};

/** Browser file I/O and STL preparation for the constructor. */
export class ConstructorFileService {
  async pickScene(): Promise<FeatureDocumentJSON | null> {
    const file = await this.pickFile('.json');
    if (!file) return null;
    const parsed = JSON.parse(await file.text());
    return parsed && typeof parsed === 'object' && parsed.version === 2
      ? parsed as FeatureDocumentJSON
      : migrateLegacyTreeToDocument(parsed);
  }

  downloadScene(document: FeatureDocument): void {
    this.download(
      JSON.stringify(document.toJSON(), null, 2),
      'application/json',
      `scene_${Date.now()}.json`,
    );
  }

  async pickAndPrepareStl(): Promise<ImportedStl | null> {
    const file = await this.pickFile('.stl');
    if (!file) return null;
    const buffer = await file.arrayBuffer();
    const geometry = new STLLoader().parse(buffer);
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox?.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();

    try {
      const { BinaryStorage } = await import('@/v3d/constructor/services/BinaryStorage');
      const binaryRef = BinaryStorage.newId();
      await BinaryStorage.put(binaryRef, buffer);
      return { filename: file.name, geometry, binaryRef };
    } catch (error) {
      console.warn('[ConstructorFileService] BinaryStorage unavailable, using base64:', error);
      return { filename: file.name, geometry, stlBase64: arrayBufferToBase64(buffer) };
    }
  }

  attachImportedStl(document: FeatureDocument, imported: ImportedStl): FeatureId | null {
    if (document.rootIds.length !== 1) return null;
    const root = document.graph.get(document.rootIds[0]);
    if (!root || (root.type !== 'group' && root.type !== 'boolean')) return null;
    const id = nextP2FeatureId('imported');
    document.addFeature(new ImportedMeshFeature(id, { ...imported } as never));
    document.updateInputs(root.id, [...root.getInputs(), id]);
    return id;
  }

  private pickFile(accept: string): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  private download(content: BlobPart, type: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
