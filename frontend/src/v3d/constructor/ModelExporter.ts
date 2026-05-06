import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import type { FeatureDocument } from './features/FeatureDocument';
import type { CompositeOutput, FeatureId, FeatureOutput, LeafOutput } from './features/types';

export type ExportProgressCallback = (done: number, total: number) => void;

export class ModelExporter {
  constructor(
    private readonly getDocument: () => FeatureDocument | null,
    private readonly getSelectedFeatureId: () => FeatureId | null,
  ) {}

  exportSTL(filename = 'scene.stl', onlySelected = false): void {
    const object = this.getExportObject(onlySelected);
    if (!object) return;
    const result = new STLExporter().parse(object, { binary: true });
    ModelExporter.downloadBlob(new Blob([result], { type: 'application/octet-stream' }), filename);
  }

  exportOBJ(filename = 'scene.obj', onlySelected = false): void {
    const object = this.getExportObject(onlySelected);
    if (!object) return;
    const result = new OBJExporter().parse(object);
    ModelExporter.downloadBlob(new Blob([result], { type: 'text/plain' }), filename);
  }

  async exportSTLAsync(
    filename = 'scene.stl',
    onlySelected = false,
    onProgress?: ExportProgressCallback,
  ): Promise<void> {
    const object = await this.getExportObjectAsync(onlySelected, onProgress);
    if (!object) return;
    await new Promise((r) => setTimeout(r, 0));
    const result = new STLExporter().parse(object, { binary: true });
    ModelExporter.downloadBlob(new Blob([result], { type: 'application/octet-stream' }), filename);
  }

  async exportOBJAsync(
    filename = 'scene.obj',
    onlySelected = false,
    onProgress?: ExportProgressCallback,
  ): Promise<void> {
    const object = await this.getExportObjectAsync(onlySelected, onProgress);
    if (!object) return;
    await new Promise((r) => setTimeout(r, 0));
    const result = new OBJExporter().parse(object);
    ModelExporter.downloadBlob(new Blob([result], { type: 'text/plain' }), filename);
  }

  private getExportObject(onlySelected: boolean): THREE.Object3D | null {
    const output = this.pickOutput(onlySelected);
    if (!output) return null;
    const object = this.buildObject(output);
    object.updateMatrixWorld(true);
    return object;
  }

  private async getExportObjectAsync(
    onlySelected: boolean,
    onProgress?: ExportProgressCallback,
  ): Promise<THREE.Object3D | null> {
    const output = this.pickOutput(onlySelected);
    if (!output) return null;
    const total = ModelExporter.countOutputs(output);
    let done = 0;
    onProgress?.(0, total);
    const object = this.buildObject(output, () => {
      done += 1;
      onProgress?.(done, total);
    });
    object.updateMatrixWorld(true);
    return object;
  }

  private pickOutput(onlySelected: boolean): FeatureOutput | null {
    const doc = this.getDocument();
    if (!doc) return null;
    if (onlySelected) {
      const id = this.getSelectedFeatureId();
      return id ? doc.getOutput(id) ?? null : null;
    }
    if (doc.rootIds.length === 1) return doc.getOutput(doc.rootIds[0]) ?? null;
    const group = new THREE.Group();
    void group;
    const rootOutputs = doc.rootIds
      .map((id) => doc.getOutput(id))
      .filter((output): output is FeatureOutput => !!output);
    if (rootOutputs.length === 0) return null;
    return {
      kind: 'composite',
      transform: new THREE.Matrix4(),
      isHole: false,
      children: rootOutputs,
      name: 'scene',
    };
  }

  private buildObject(output: FeatureOutput, onBuilt?: () => void): THREE.Object3D {
    if (output.kind === 'leaf') return this.buildLeaf(output, onBuilt);
    return this.buildComposite(output, onBuilt);
  }

  private buildLeaf(output: LeafOutput, onBuilt?: () => void): THREE.Mesh {
    const mesh = new THREE.Mesh(output.geometry.clone(), new THREE.MeshBasicMaterial());
    output.transform.decompose(mesh.position, mesh.quaternion, mesh.scale);
    if (output.bottomAnchorOffsetZ) mesh.position.z += output.bottomAnchorOffsetZ;
    mesh.name = output.name ?? '';
    onBuilt?.();
    return mesh;
  }

  private buildComposite(output: CompositeOutput, onBuilt?: () => void): THREE.Group {
    const group = new THREE.Group();
    output.transform.decompose(group.position, group.quaternion, group.scale);
    group.name = output.name ?? '';
    for (const child of output.children) group.add(this.buildObject(child, onBuilt));
    onBuilt?.();
    return group;
  }

  private static countOutputs(output: FeatureOutput): number {
    if (output.kind === 'leaf') return 1;
    return 1 + output.children.reduce((sum, child) => sum + ModelExporter.countOutputs(child), 0);
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
