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
  | 'offsetY';

export interface HandleMesh extends THREE.Mesh {
  userData: { type: HandleType; defaultColor: number };
}

const HANDLE_SIZE = 0.10;
const OFFSET_Y_OFFSET = 0.35;

const EDGE_TYPES: HandleType[] = [
  'edgeWidthLeft',
  'edgeWidthRight',
  'edgeLengthFront',
  'edgeLengthBack',
];
const CORNER_TYPES: HandleType[] = ['cornerBL', 'cornerBR', 'cornerTL', 'cornerTR'];

function createSquareGeometry(): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(HANDLE_SIZE, HANDLE_SIZE);
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

const OUTLINE_COLOR = 0x333333;

function createHandleMesh(
  type: HandleType,
  isBlack: boolean
): HandleMesh {
  const color = isBlack ? 0x000000 : 0xffffff;
  const geometry =
    type === 'offsetY' ? createTriangleGeometry() : createSquareGeometry();
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geometry, material) as unknown as HandleMesh;
  mesh.userData = { type, defaultColor: color };

  const needsOutline = !isBlack && (CORNER_TYPES.includes(type) || type === 'height');
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
 * Handles: 4 black squares on bottom edges (width/length), 4 white squares on corners (scale XZ),
 * 1 white square on top (height), 1 black triangle above top (vertical offset).
 */
export class ModificationGizmo {
  private group: THREE.Group;
  private handles: HandleMesh[] = [];
  private target: THREE.Object3D | null = null;
  private node: { params?: { position?: { x: number; y: number; z: number }; scale?: { x: number; y: number; z: number } }; geometryParams?: { width?: number; height?: number; depth?: number }; [key: string]: unknown } | null = null;
  private box: THREE.Box3;
  private boxSize: THREE.Vector3;
  private boxCenter: THREE.Vector3;
  private camera: THREE.Camera | null = null;

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

  private buildHandles(): void {
    const allTypes: { type: HandleType; black: boolean }[] = [
      ...EDGE_TYPES.map((type) => ({ type, black: true })),
      ...CORNER_TYPES.map((type) => ({ type, black: false })),
      { type: 'height', black: false },
      { type: 'offsetY', black: true },
    ];
    allTypes.forEach(({ type, black }) => {
      const mesh = createHandleMesh(type, black);
      this.group.add(mesh);
      mesh.parent = this.group
      this.handles.push(mesh);
    });
  }

  /** Call after modelRootGroup is added to scene so handles render on top. */
  addToScene(): void {
    if (this.group.parent !== this.scene) {
      this.scene.add(this.group);
    }
    this.group.renderOrder = 1;
    this.group.visible = false;
  }

  setTarget(object3D: THREE.Object3D | null, node: typeof this.node): void {
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

  getNode(): typeof this.node {
    return this.node;
  }

  /** For debug panel: serializable state of the gizmo and its handles. */
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
    return {
      hasTarget,
      groupInScene,
      groupVisible,
      handlesCount: this.handles.length,
      handlePositions,
      boxMin,
      boxMax,
    };
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
  }

  updatePositions(): void {
    if (!this.target || !this.camera) return;
    this.box.setFromObject(this.target);
    this.box.getSize(this.boxSize);
    this.box.getCenter(this.boxCenter);

    const { min, max } = this.box;
    const midX = (min.x + max.x) / 2;
    const midZ = (min.z + max.z) / 2;

    const handleIndexByType: Record<HandleType, number> = {} as Record<HandleType, number>;
    this.handles.forEach((h, i) => {
      handleIndexByType[h.userData.type as HandleType] = i;
    });

    // Edge midpoints (bottom, y = min.y)
    this.handles[handleIndexByType.edgeWidthLeft].position.set(min.x, min.y, midZ);
    this.handles[handleIndexByType.edgeWidthRight].position.set(max.x, min.y, midZ);
    this.handles[handleIndexByType.edgeLengthFront].position.set(midX, min.y, max.z);
    this.handles[handleIndexByType.edgeLengthBack].position.set(midX, min.y, min.z);

    // Corners (bottom)
    this.handles[handleIndexByType.cornerBL].position.set(min.x, min.y, min.z);
    this.handles[handleIndexByType.cornerBR].position.set(max.x, min.y, min.z);
    this.handles[handleIndexByType.cornerTL].position.set(min.x, min.y, max.z);
    this.handles[handleIndexByType.cornerTR].position.set(max.x, min.y, max.z);

    // Top center
    this.handles[handleIndexByType.height].position.set(midX, max.y, midZ);

    // Above top (offset Y handle)
    this.handles[handleIndexByType.offsetY].position.set(
      midX,
      max.y + OFFSET_Y_OFFSET,
      midZ
    );

    // Orient handles toward camera (billboard) for visibility
    this.handles.forEach((handle) => {
      handle.lookAt(this.camera!.position);
    });
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
        if (obj instanceof THREE.LineSegments && obj.material) (obj.material as THREE.Material).dispose();
      });
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
    });
    this.scene.remove(this.group);
  }
}
