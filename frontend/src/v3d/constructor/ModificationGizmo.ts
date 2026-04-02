import * as THREE from 'three';

export type HandleType =
  | 'edgeWidthLeft'
  | 'edgeWidthRight'
  | 'edgeLengthFront'
  | 'edgeLengthBack'
  | 'cornerBL'
  | 'cornerBR'
  | 'cornerTL'
  | 'cornerTR'
  | 'height'
  | 'offsetY'
  | 'rotate';

export interface HandleMesh extends THREE.Mesh {
  userData: { type: HandleType; defaultColor: number };
}

const HANDLE_SIZE = 0.10;
/** Desired handle size in screen pixels (visual and raycasting hitbox). */
const HANDLE_SCREEN_PX = 9;
/** Extra offset in screen-pixels to separate offsetY above height handle. */
const OFFSET_Y_SCREEN_PX = 19;
/** Extra offset in screen-pixels to place rotation handles outside bounding box. */
const ROTATE_SCREEN_PX = 13;

const EDGE_TYPES: HandleType[] = [
  'edgeWidthLeft',
  'edgeWidthRight',
  'edgeLengthFront',
  'edgeLengthBack',
];
const CORNER_TYPES: HandleType[] = ['cornerBL', 'cornerBR', 'cornerTL', 'cornerTR'];
const ROTATE_TYPES: HandleType[] = ['rotate'];

function createSquareGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(HANDLE_SIZE, HANDLE_SIZE) as unknown as THREE.BufferGeometry;
}

function createTriangleGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const h = HANDLE_SIZE * 0.8;
  const w = HANDLE_SIZE;
  shape.moveTo(0, h / 2);
  shape.lineTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.closePath();
  return new THREE.ShapeGeometry(shape) as unknown as THREE.BufferGeometry;
}

function createArcGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r1 = HANDLE_SIZE * 0.4;
  const r2 = HANDLE_SIZE * 0.85;
  const start = Math.PI * 0.15;
  const end = Math.PI * 1.85;
  shape.absarc(0, 0, r2, start, end, false);
  shape.absarc(0, 0, r1, end, start, true);
  shape.closePath();
  return new THREE.ShapeGeometry(shape) as unknown as THREE.BufferGeometry;
}

const OUTLINE_COLOR = 0x333333;

function createHandleMesh(type: HandleType): HandleMesh {
  let color: number;
  let geometry: THREE.BufferGeometry;

  if (ROTATE_TYPES.includes(type)) {
    color = 0xffdd00;
    geometry = createArcGeometry();
  } else if (type === 'offsetY') {
    color = 0x000000;
    geometry = createTriangleGeometry();
  } else if (CORNER_TYPES.includes(type)) {
    color = 0xffffff;
    geometry = createSquareGeometry();
  } else {
    color = 0x000000;
    geometry = createSquareGeometry();
  }

  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geometry, material) as unknown as HandleMesh;
  mesh.userData = { type, defaultColor: color };

  const needsOutline = color === 0xffffff && (CORNER_TYPES.includes(type) || type === 'height');
  if (needsOutline) {
    const edges = new THREE.EdgesGeometry(geometry, 1);
    const lineMat = new THREE.LineBasicMaterial({
      color: OUTLINE_COLOR,
      depthTest: false,
      linewidth: 2,
    });
    const line = new THREE.LineSegments(edges, lineMat);
    mesh.add(line);
  }

  return mesh;
}

/**
 * Gizmo that displays modification handles around a selected object.
 *
 * Handle layout:
 *  - 4 black squares on bottom edges (scale width/depth)
 *  - 4 white squares on bottom corners (uniform XZ scale)
 *  - 1 white square on top center (height)
 *  - 1 black triangle above height handle (vertical offset)
 *  - 1 arc handle (yellow): rotates in the camera's view plane
 */
export class ModificationGizmo {
  private group: THREE.Group;
  private handles: HandleMesh[] = [];
  private target: THREE.Object3D | null = null;
  private node: ModelNodeLike | null = null;
  private box: THREE.Box3;
  private boxSize: THREE.Vector3;
  private boxCenter: THREE.Vector3;
  private camera: THREE.Camera | null = null;
  private containerHeight = 800;
  private tooltip: HTMLDivElement | null = null;
  private containerEl: HTMLElement | null = null;
  private hoveredHandle: HandleMesh | null = null;

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.box = new THREE.Box3();
    this.boxSize = new THREE.Vector3();
    this.boxCenter = new THREE.Vector3();
    this.buildHandles();
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  setContainerHeight(height: number): void {
    this.containerHeight = height > 0 ? height : 800;
  }

  setContainerEl(el: HTMLElement): void {
    this.containerEl = el;
    this.containerHeight = el.clientHeight || 800;
    this.createTooltip();
  }

  private buildHandles(): void {
    const allTypes: HandleType[] = [
      ...EDGE_TYPES,
      ...CORNER_TYPES,
      'height',
      'offsetY',
      ...ROTATE_TYPES,
    ];
    allTypes.forEach((type) => {
      const mesh = createHandleMesh(type);
      this.group.add(mesh);
      mesh.parent = this.group;
      this.handles.push(mesh);
    });
  }

  addToScene(): void {
    if (this.group.parent !== this.scene) {
      this.scene.add(this.group);
    }
    this.group.renderOrder = 1;
    this.group.visible = false;
  }

  setTarget(object3D: THREE.Object3D | null, node: ModelNodeLike): void {
    this.setHovered(null);
    this.target = object3D;
    this.node = node;
    this.group.visible = true;
  }

  clearTarget(): void {
    this.setHovered(null);
    this.target = null;
    this.node = null;
    this.group.visible = false;
  }

  getHandles(): THREE.Mesh[] {
    return this.handles;
  }

  getTarget(): THREE.Object3D | null {
    return this.target;
  }

  getNode(): ModelNodeLike | null {
    return this.node;
  }

  getDebugInfo(): {
    hasTarget: boolean;
    groupInScene: boolean;
    groupVisible: boolean;
    handlesCount: number;
    handlePositions: Array<{ type: string; x: number; y: number; z: number }>;
    boxMin?: { x: number; y: number; z: number };
    boxMax?: { x: number; y: number; z: number };
  } {
    const hasTarget = !!this.target;
    const firstHandle = this.handles[0];
    const group = firstHandle?.parent;
    const groupInScene = !!(group && group.parent === this.scene);
    const groupVisible = group ? group.visible : false;

    const handlePositions = this.handles.map((h) => ({
      type: (h.userData as { type?: string }).type ?? '?',
      x: h.position.x,
      y: h.position.y,
      z: h.position.z,
    }));
    const boxMin = hasTarget && this.box
      ? { x: this.box.min.x, y: this.box.min.y, z: this.box.min.z }
      : undefined;
    const boxMax = hasTarget && this.box
      ? { x: this.box.max.x, y: this.box.max.y, z: this.box.max.z }
      : undefined;
    return { hasTarget, groupInScene, groupVisible, handlesCount: this.handles.length, handlePositions, boxMin, boxMax };
  }

  setHovered(handle: HandleMesh | null): void {
    this.handles.forEach((h) => {
      const mat = h.material as THREE.MeshBasicMaterial;
      mat.color.setHex(h.userData.defaultColor);
    });
    if (handle) {
      const mat = handle.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0xff0000);
    }
    this.hoveredHandle = handle;
    this.updateTooltip();
  }

  updatePositions(): void {
    if (!this.target || !this.camera) return;
    this.box.setFromObject(this.target);
    this.box.getSize(this.boxSize);
    this.box.getCenter(this.boxCenter);

    const { min, max } = this.box;
    const midX = (min.x + max.x) / 2;
    const midZ = (min.z + max.z) / 2;

    // Compute world-per-pixel at the height handle position for dynamic offsets
    let wpp = 0.35;
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const cam = this.camera as THREE.PerspectiveCamera;
      const fovRad = (cam.fov * Math.PI) / 180;
      const refPos = new THREE.Vector3(midX, max.y, midZ);
      const d = refPos.distanceTo(cam.position);
      wpp = (2 * d * Math.tan(fovRad / 2)) / this.containerHeight;
    }

    // Dynamic offsets in world units based on screen pixels
    const offsetYWorld = wpp * OFFSET_Y_SCREEN_PX;
    const rotateOffsetWorld = wpp * ROTATE_SCREEN_PX;

    const handleIndexByType: Record<HandleType, number> = {} as Record<HandleType, number>;
    this.handles.forEach((h, i) => {
      handleIndexByType[h.userData.type as HandleType] = i;
    });

    // Edge midpoints at bottom face
    this.handles[handleIndexByType.edgeWidthLeft].position.set(min.x, min.y, midZ);
    this.handles[handleIndexByType.edgeWidthRight].position.set(max.x, min.y, midZ);
    this.handles[handleIndexByType.edgeLengthFront].position.set(midX, min.y, max.z);
    this.handles[handleIndexByType.edgeLengthBack].position.set(midX, min.y, min.z);

    // Corners at bottom face
    this.handles[handleIndexByType.cornerBL].position.set(min.x, min.y, min.z);
    this.handles[handleIndexByType.cornerBR].position.set(max.x, min.y, min.z);
    this.handles[handleIndexByType.cornerTL].position.set(min.x, min.y, max.z);
    this.handles[handleIndexByType.cornerTR].position.set(max.x, min.y, max.z);

    // Height handle: above top center
    this.handles[handleIndexByType.height].position.set(midX, max.y + offsetYWorld, midZ);

    // OffsetY: above height handle by a screen-space-proportional amount
    this.handles[handleIndexByType.offsetY].position.set(midX, max.y + offsetYWorld * 2, midZ);

    // Single rotation handle: top-right corner, rotates in the camera's view plane
    this.handles[handleIndexByType.rotate].position.set(max.x + rotateOffsetWorld, max.y + rotateOffsetWorld, midZ);

    // Billboard: orient each handle toward the camera
    this.handles.forEach((handle) => {
      handle.lookAt(this.camera!.position);
    });

    // Screen-space constant size
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const cam = this.camera as THREE.PerspectiveCamera;
      const fovRad = (cam.fov * Math.PI) / 180;
      const worldPos = new THREE.Vector3();

      this.handles.forEach((handle) => {
        handle.getWorldPosition(worldPos);
        const distance = worldPos.distanceTo(cam.position);
        const viewportHeightWorld = 2 * distance * Math.tan(fovRad / 2);
        const worldPerPixel = viewportHeightWorld / this.containerHeight;
        const desiredWorldSize = worldPerPixel * HANDLE_SCREEN_PX;
        const scaleFactor = desiredWorldSize / HANDLE_SIZE;
        handle.scale.setScalar(scaleFactor);
      });
    }

    this.updateTooltip();
  }

  private createTooltip(): void {
    if (this.tooltip) return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;pointer-events:none;padding:2px 6px;' +
      'background:rgba(0,0,0,0.8);color:#fff;font-size:12px;border-radius:4px;' +
      'white-space:nowrap;display:none;z-index:100;font-family:monospace;';
    if (this.containerEl) {
      if (!this.containerEl.style.position || this.containerEl.style.position === 'static') {
        this.containerEl.style.position = 'relative';
      }
      this.containerEl.appendChild(el);
    }
    this.tooltip = el;
  }

  private getDimensionLabel(type: HandleType): string | null {
    if (!this.node) return null;
    const g = this.node.geometryParams;
    const s = this.node.params?.scale;
    const sx = s?.x ?? 1;
    const sy = s?.y ?? 1;
    const sz = s?.z ?? 1;

    // For groups without geometryParams, use bounding box size
    if (!g) {
      const bw = +this.boxSize.x.toFixed(1);
      const bh = +this.boxSize.y.toFixed(1);
      const bd = +this.boxSize.z.toFixed(1);
      switch (type) {
        case 'edgeWidthLeft':
        case 'edgeWidthRight':
          return `W: ${bw}`;
        case 'edgeLengthFront':
        case 'edgeLengthBack':
          return `D: ${bd}`;
        case 'height':
          return `H: ${bh}`;
        case 'cornerBL':
        case 'cornerBR':
        case 'cornerTL':
        case 'cornerTR':
          return `${bw} × ${bd}`;
        case 'offsetY':
          return `Y: ${+(this.node.params?.position?.y ?? 0).toFixed(1)}`;
        default:
          return null;
      }
    }

    const nodeType = this.node.type as string | undefined;
    const w = g.width ?? 1;
    const h = g.height ?? 1;
    const d = g.depth ?? 1;
    const r = g.radius ?? 0.5;

    switch (type) {
      case 'edgeWidthLeft':
      case 'edgeWidthRight':
        if (nodeType === 'sphere') return `R: ${+(r * sx).toFixed(2)}`;
        if (nodeType === 'cylinder' || nodeType === 'cone') return `R: ${+(r * sx).toFixed(2)}`;
        if (nodeType === 'torus') return `R: ${+(r * sx).toFixed(2)}`;
        return `W: ${+(w * sx).toFixed(2)}`;
      case 'edgeLengthFront':
      case 'edgeLengthBack':
        if (nodeType === 'sphere') return `R: ${+(r * sz).toFixed(2)}`;
        if (nodeType === 'cylinder' || nodeType === 'cone') return `R: ${+(r * sz).toFixed(2)}`;
        if (nodeType === 'torus') return `R: ${+(r * sz).toFixed(2)}`;
        return `D: ${+(d * sz).toFixed(2)}`;
      case 'height':
        if (nodeType === 'sphere') return `R: ${+(r * sy).toFixed(2)}`;
        if (nodeType === 'torus') return `T: ${+((g.tube ?? 0.2) * sy).toFixed(2)}`;
        return `H: ${+(h * sy).toFixed(2)}`;
      case 'cornerBL':
      case 'cornerBR':
      case 'cornerTL':
      case 'cornerTR':
        if (nodeType === 'sphere') return `R: ${+(r * sx).toFixed(2)}`;
        if (nodeType === 'cylinder' || nodeType === 'cone') return `R: ${+(r * sx).toFixed(2)}`;
        return `${+(w * sx).toFixed(2)} × ${+(d * sz).toFixed(2)}`;
      case 'offsetY':
        return `Y: ${+(this.node.params?.position?.y ?? 0).toFixed(2)}`;
      case 'rotate': {
        const rot = this.node.params?.rotation;
        if (!rot) return 'θ: 0°';
        const deg = +(rot.y * (180 / Math.PI)).toFixed(1);
        return `θ: ${deg}°`;
      }
      default:
        return null;
    }
  }

  private updateTooltip(): void {
    if (!this.tooltip) return;
    if (!this.hoveredHandle || !this.camera || !this.containerEl) {
      this.tooltip.style.display = 'none';
      return;
    }

    const label = this.getDimensionLabel(this.hoveredHandle.userData.type);
    if (!label) {
      this.tooltip.style.display = 'none';
      return;
    }

    // Project handle position to screen coordinates
    const worldPos = new THREE.Vector3();
    this.hoveredHandle.getWorldPosition(worldPos);
    const projected = worldPos.clone().project(this.camera);

    const cw = this.containerEl.clientWidth;
    const ch = this.containerEl.clientHeight;
    const sx = (projected.x * 0.5 + 0.5) * cw;
    const sy = (-projected.y * 0.5 + 0.5) * ch;

    this.tooltip.textContent = label;
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${sx + 16}px`;
    this.tooltip.style.top = `${sy - 10}px`;
  }

  /** Force matrixWorld update on all handles so raycasting is accurate. */
  updateMatrixWorldForHandles(): void {
    this.group.updateMatrixWorld(true);
  }

  dispose(): void {
    this.handles.forEach((h) => {
      h.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) obj.geometry.dispose();
        if (obj instanceof THREE.LineSegments && obj.geometry) obj.geometry.dispose();
        if (obj instanceof THREE.Mesh && obj.material) {
          const mat = obj.material as THREE.Material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
        if (obj instanceof THREE.LineSegments && obj.material) {
          (obj.material as THREE.Material).dispose();
        }
      });
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
    });
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
      this.tooltip = null;
    }
    this.scene.remove(this.group);
  }
}

type ModelNodeLike = {
  params?: {
    position?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number; order?: string };
  };
  geometryParams?: { width?: number; height?: number; depth?: number; radius?: number; tube?: number; innerRadius?: number; outerRadius?: number; radiusTop?: number; radiusBottom?: number };
  type?: string;
  [key: string]: unknown;
};
