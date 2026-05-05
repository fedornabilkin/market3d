import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import type { ModelNode } from './nodes/ModelNode';

export type ExportProgressCallback = (done: number, total: number) => void;

/**
 * Builds STL/OBJ files from the model tree (or the current selection)
 * and triggers a browser download.
 *
 * Decoupled from ConstructorSceneService so the scene service stays focused
 * on Three.js scene management. Holds no state of its own — selection and
 * tree are read on demand via injected accessors.
 */
export class ModelExporter {
  constructor(
    private getRoot: () => ModelNode | null,
    private getSelected: () => ModelNode | null,
  ) {}

  exportSTL(filename = 'scene.stl', onlySelected = false): void {
    const mesh = this.getExportMesh(onlySelected);
    if (!mesh) return;
    const result = new STLExporter().parse(mesh, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    ModelExporter.downloadBlob(blob, filename);
  }

  exportOBJ(filename = 'scene.obj', onlySelected = false): void {
    const mesh = this.getExportMesh(onlySelected);
    if (!mesh) return;
    const result = new OBJExporter().parse(mesh);
    const blob = new Blob([result], { type: 'text/plain' });
    ModelExporter.downloadBlob(blob, filename);
  }

  /**
   * Async STL export with progress callback.
   * Yields between CSG operations so the UI can update a progress bar.
   */
  async exportSTLAsync(
    filename = 'scene.stl',
    onlySelected = false,
    onProgress?: ExportProgressCallback,
  ): Promise<void> {
    const mesh = await this.getExportMeshAsync(onlySelected, onProgress);
    if (!mesh) return;
    await new Promise((r) => setTimeout(r, 0));
    const result = new STLExporter().parse(mesh, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    ModelExporter.downloadBlob(blob, filename);
  }

  /**
   * Async OBJ export with progress callback.
   */
  async exportOBJAsync(
    filename = 'scene.obj',
    onlySelected = false,
    onProgress?: ExportProgressCallback,
  ): Promise<void> {
    const mesh = await this.getExportMeshAsync(onlySelected, onProgress);
    if (!mesh) return;
    await new Promise((r) => setTimeout(r, 0));
    const result = new OBJExporter().parse(mesh);
    const blob = new Blob([result], { type: 'text/plain' });
    ModelExporter.downloadBlob(blob, filename);
  }

  private getExportMesh(onlySelected: boolean): THREE.Mesh | null {
    const node = this.pickNode(onlySelected);
    if (!node) return null;
    const mesh = node.getMesh();
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  private async getExportMeshAsync(
    onlySelected: boolean,
    onProgress?: ExportProgressCallback,
  ): Promise<THREE.Mesh | null> {
    const node = this.pickNode(onlySelected);
    if (!node) return null;

    const totalOps = node.countCSGOperations();
    const counter = { done: 0, total: totalOps };

    if (onProgress) onProgress(0, totalOps);
    const mesh = await node.getMeshAsync(onProgress, counter);
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  private pickNode(onlySelected: boolean): ModelNode | null {
    if (onlySelected) {
      const sel = this.getSelected();
      if (sel) return sel;
    }
    return this.getRoot();
  }

  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
