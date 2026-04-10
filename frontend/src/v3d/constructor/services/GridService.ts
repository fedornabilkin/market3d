import * as THREE from 'three';

/**
 * Manages the millimeter grid displayed on the scene floor.
 * Extracted from ConstructorSceneService to keep it focused.
 */
export class GridService {
  private mmGridGroup: THREE.Group | null = null;
  private mmGridLabelTexture: THREE.Texture | null = null;
  private mmGridLabelSprite: THREE.Sprite | null = null;

  /** Dashed-rectangle + filled-area projection of an object onto the Y=0 plane. */
  private projectionGroup: THREE.Group | null = null;

  private gridVisible = true;
  private gridWidthMm = 200;
  private gridLengthMm = 200;

  constructor(private readonly scene: THREE.Scene) {}

  setVisible(visible: boolean): void {
    this.gridVisible = !!visible;
    if (this.mmGridGroup) {
      this.mmGridGroup.visible = this.gridVisible;
    }
  }

  setSize(widthMm: number, lengthMm: number): void {
    this.gridWidthMm = Math.max(10, widthMm);
    this.gridLengthMm = Math.max(10, lengthMm);
    this.create();
  }

  /** Rebuild the grid (call once on init and after size changes). */
  create(): void {
    this.dispose();

    const halfWidth = this.gridWidthMm / 2;
    const halfLength = this.gridLengthMm / 2;

    const positions: number[] = [];
    const colors: number[] = [];

    const baseColor = new THREE.Color(0xbfe8e8); // #00a5a4 lightened 75%
    const boldColor = new THREE.Color(0x80d2d2); // #00a5a4 lightened 50%

    // Lines parallel to Z axis (varying X)
    for (let i = -halfWidth; i <= halfWidth; i++) {
      const index = Math.round(i + halfWidth);
      const color = index % 10 === 0 ? boldColor : baseColor;
      positions.push(i, 0, -halfLength, i, 0, halfLength);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    // Lines parallel to X axis (varying Z)
    for (let i = -halfLength; i <= halfLength; i++) {
      const index = Math.round(i + halfLength);
      const color = index % 10 === 0 ? boldColor : baseColor;
      positions.push(-halfWidth, 0, i, halfWidth, 0, i);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({ vertexColors: true });
    const gridLines = new THREE.LineSegments(geometry, material);

    const group = new THREE.Group();
    group.add(gridLines);

    // Corner label (billboard sprite)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#888888';
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('мм', canvas.width - 16, canvas.height - 16);
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.mmGridLabelTexture = texture;
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(halfWidth, 0.01, halfLength);
    sprite.scale.set(20, 5, 1);
    this.mmGridLabelSprite = sprite;
    group.add(sprite);

    // Axis arrows at left-front corner (-halfWidth, 0, halfLength)
    const axisOrigin = new THREE.Vector3(-halfWidth, 0.02, halfLength);
    const axisLen = Math.min(halfWidth, halfLength) * 0.15;
    const headLen = axisLen * 0.25;
    const headW = axisLen * 0.12;

    // X axis (red) — pointing right
    const xArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), axisOrigin, axisLen, 0xff4444, headLen, headW,
    );
    group.add(xArrow);

    // Z axis (blue) — pointing back (into scene, -Z from front corner)
    const zArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1), axisOrigin, axisLen, 0x4488ff, headLen, headW,
    );
    group.add(zArrow);

    // Y axis (green) — pointing up
    const yArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), axisOrigin, axisLen, 0x44cc44, headLen, headW,
    );
    group.add(yArrow);

    // Axis labels
    this.addAxisLabel(group, 'X', 0xff4444,
      new THREE.Vector3(axisOrigin.x + axisLen + 2, 0.02, axisOrigin.z));
    this.addAxisLabel(group, 'Z', 0x4488ff,
      new THREE.Vector3(axisOrigin.x, 0.02, axisOrigin.z - axisLen - 2));
    this.addAxisLabel(group, 'Y', 0x44cc44,
      new THREE.Vector3(axisOrigin.x, axisLen + 2, axisOrigin.z));

    group.visible = this.gridVisible;
    this.mmGridGroup = group;
    this.scene.add(group);
  }

  private addAxisLabel(parent: THREE.Group, text: string, color: number, position: THREE.Vector3): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.fillText(text, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.setScalar(4);
    parent.add(sprite);
  }

  /** Billboard — call each animation frame to keep the label facing the camera. */
  updateLabelBillboard(camera: THREE.Camera): void {
    if (this.mmGridLabelSprite) {
      this.mmGridLabelSprite.quaternion.copy(camera.quaternion);
    }
  }

  /**
   * Updates the dashed footprint + translucent fill drawn on the Y=0 plane
   * beneath the given object's bounding box. Pass `null` to hide the projection.
   * Call once per animation frame.
   */
  updateProjection(obj: THREE.Object3D | null): void {
    if (!obj) {
      if (this.projectionGroup) this.projectionGroup.visible = false;
      return;
    }

    const box = new THREE.Box3().setFromObject(obj);
    const { min, max } = box;

    // Slightly above 0 to avoid z-fighting with the grid lines
    const gy = 0.02;

    const sizeX = max.x - min.x;
    const sizeZ = max.z - min.z;
    const centerX = (min.x + max.x) / 2;
    const centerZ = (min.z + max.z) / 2;

    const c0 = new THREE.Vector3(min.x, gy, min.z);
    const c1 = new THREE.Vector3(max.x, gy, min.z);
    const c2 = new THREE.Vector3(max.x, gy, max.z);
    const c3 = new THREE.Vector3(min.x, gy, max.z);
    const rectPoints = [c0, c1, c2, c3, c0];

    if (!this.projectionGroup) {
      this.projectionGroup = new THREE.Group();
      this.projectionGroup.renderOrder = 2;

      // Filled area
      const fillGeo = new THREE.PlaneGeometry(1, 1);
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0x888888,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.15,
        depthTest: false,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      fillMesh.rotation.x = -Math.PI / 2;
      fillMesh.name = 'projFill';
      this.projectionGroup.add(fillMesh);

      // Dashed rectangle outline
      const rectGeo = new THREE.BufferGeometry().setFromPoints(rectPoints);
      const rectMat = new THREE.LineDashedMaterial({
        color: 0x888888,
        dashSize: 0.3,
        gapSize: 0.15,
        depthTest: false,
        transparent: true,
        opacity: 0.6,
      });
      const rectLine = new THREE.Line(rectGeo, rectMat);
      rectLine.computeLineDistances();
      rectLine.name = 'projRect';
      this.projectionGroup.add(rectLine);

      this.scene.add(this.projectionGroup);
    } else {
      const rectLine = this.projectionGroup.getObjectByName('projRect') as THREE.Line | undefined;
      if (rectLine) {
        rectLine.geometry.dispose();
        rectLine.geometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
        rectLine.computeLineDistances();
      }
    }

    const fillMesh = this.projectionGroup.getObjectByName('projFill') as THREE.Mesh | undefined;
    if (fillMesh) {
      fillMesh.position.set(centerX, gy + 0.001, centerZ);
      fillMesh.scale.set(sizeX, sizeZ, 1);
    }

    this.projectionGroup.visible = true;
  }

  private disposeProjection(): void {
    if (!this.projectionGroup) return;
    this.projectionGroup.traverse((child) => {
      const line = child as THREE.Line;
      if (line.geometry) line.geometry.dispose();
      const mat = (child as THREE.Mesh).material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    this.scene.remove(this.projectionGroup);
    this.projectionGroup = null;
  }

  dispose(): void {
    this.disposeProjection();
    if (this.mmGridGroup) {
      this.scene.remove(this.mmGridGroup);
      this.mmGridGroup.traverse((obj) => {
        if (obj instanceof THREE.LineSegments) {
          obj.geometry?.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      this.mmGridGroup = null;
    }
    if (this.mmGridLabelTexture) {
      this.mmGridLabelTexture.dispose();
      this.mmGridLabelTexture = null;
    }
    this.mmGridLabelSprite = null;
  }
}
