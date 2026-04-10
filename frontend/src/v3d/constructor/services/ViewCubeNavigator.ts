import * as THREE from 'three';

const CUBE_SIZE = 0.6;
const AXIS_LENGTH = 1.0;
const AXIS_HEAD_LEN = 0.15;
const AXIS_HEAD_W = 0.06;
const VIEWPORT_PX = 120;

/**
 * Small orientation cube + axis arrows rendered in the top-right corner.
 * Mirrors the main camera's rotation so the user can see which direction
 * they're looking from.
 */
export class ViewCubeNavigator {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cubeGroup: THREE.Group;

  constructor() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 3);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(2, 3, 4);
    this.scene.add(dirLight);

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this.buildCube();
    this.buildAxes();
  }

  private buildCube(): void {
    const geo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

    // Per-face materials: +X, -X, +Y, -Y, +Z, -Z
    const faceColors = [0xcc4444, 0x884444, 0x44cc44, 0x448844, 0x4488cc, 0x446688];
    const materials = faceColors.map(
      (c) =>
        new THREE.MeshPhongMaterial({
          color: c,
          transparent: true,
          opacity: 0.55,
          shininess: 20,
        })
    );

    const cube = new THREE.Mesh(geo, materials);
    this.cubeGroup.add(cube);

    // Wireframe edges
    const edges = new THREE.EdgesGeometry(geo, 1);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    this.cubeGroup.add(wireframe);

    // Face labels
    this.addFaceLabels();
  }

  private addFaceLabels(): void {
    const labels: Array<{ text: string; pos: THREE.Vector3 }> = [
      { text: 'X', pos: new THREE.Vector3(CUBE_SIZE / 2 + 0.01, 0, 0) },
      { text: 'Y', pos: new THREE.Vector3(0, CUBE_SIZE / 2 + 0.01, 0) },
      { text: 'Z', pos: new THREE.Vector3(0, 0, CUBE_SIZE / 2 + 0.01) },
    ];

    labels.forEach(({ text, pos }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, 64, 64);
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 32, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(pos);
      sprite.scale.setScalar(0.3);
      sprite.renderOrder = 10;
      this.cubeGroup.add(sprite);
    });
  }

  private buildAxes(): void {
    // X — red
    const xArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      AXIS_LENGTH,
      0xff4444,
      AXIS_HEAD_LEN,
      AXIS_HEAD_W
    );
    this.cubeGroup.add(xArrow);

    // Y — green
    const yArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      AXIS_LENGTH,
      0x44cc44,
      AXIS_HEAD_LEN,
      AXIS_HEAD_W
    );
    this.cubeGroup.add(yArrow);

    // Z — blue
    const zArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      AXIS_LENGTH,
      0x4488ff,
      AXIS_HEAD_LEN,
      AXIS_HEAD_W
    );
    this.cubeGroup.add(zArrow);
  }

  /**
   * Renders the navigator into the top-right corner of the given renderer.
   * Call this every frame after the main scene render.
   */
  render(renderer: THREE.WebGLRenderer, mainCamera: THREE.Camera): void {
    const domEl = renderer.domElement;
    const fullW = domEl.width / renderer.getPixelRatio();
    const fullH = domEl.height / renderer.getPixelRatio();
    const size = VIEWPORT_PX;
    const margin = 8;

    // Sync cube rotation to match the main camera's view direction
    // The cube group should rotate opposite to the camera so it reflects
    // what direction we're looking from.
    const q = mainCamera.quaternion.clone();
    this.cubeGroup.quaternion.copy(q).invert();

    // Save renderer state
    const prevScissorTest = renderer.getScissorTest();

    renderer.setScissorTest(true);
    renderer.setViewport(fullW - size - margin, fullH - size - margin, size, size);
    renderer.setScissor(fullW - size - margin, fullH - size - margin, size, size);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);

    // Restore
    renderer.setScissorTest(prevScissorTest);
    renderer.setViewport(0, 0, fullW, fullH);
    renderer.setScissor(0, 0, fullW, fullH);
  }

  dispose(): void {
    this.cubeGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material)?.dispose();
      } else if (obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose();
        (obj.material as THREE.Material)?.dispose();
      } else if (obj instanceof THREE.Sprite) {
        (obj.material as THREE.SpriteMaterial).map?.dispose();
        (obj.material as THREE.SpriteMaterial).dispose();
      }
    });
  }
}
