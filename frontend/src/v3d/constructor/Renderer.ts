import * as THREE from 'three';
import type { ModelNode } from './nodes/ModelNode';

/**
 * Wrapper over THREE.Scene for rendering the model tree.
 */
export class Renderer {
  private modelRoot: THREE.Group;

  constructor(
    public scene: THREE.Scene,
    private webGLRenderer?: THREE.WebGLRenderer,
    private camera?: THREE.Camera
  ) {
    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getModelRoot(): THREE.Group {
    return this.modelRoot;
  }

  render(node: ModelNode): void {
    while (this.modelRoot.children.length > 0) {
      const child = this.modelRoot.children[0];
      this.modelRoot.remove(child);
      if ((child as THREE.Mesh).geometry) {
        ((child as THREE.Mesh).geometry as THREE.BufferGeometry)?.dispose();
      }
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }
    const mesh = node.getMesh();
    this.modelRoot.add(mesh);
    if (this.webGLRenderer && this.camera) {
      this.webGLRenderer.render(this.scene, this.camera);
    }
  }

  updateFromTree(root: ModelNode): void {
    this.render(root);
  }

  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.webGLRenderer = renderer;
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }
}
