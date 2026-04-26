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
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ';

export interface HandleMesh extends THREE.Mesh {
  userData: { type: HandleType; defaultColor: number };
}

const HANDLE_SIZE = 0.10;
/** Desired handle size in screen pixels (visual and raycasting hitbox). */
const HANDLE_SCREEN_PX = 9;
/** Extra offset in screen-pixels to separate offsetY above height handle. */
const OFFSET_Y_SCREEN_PX = 19;
/** Screen-pixels for curved arrow rotation handles. */
const ROTATE_ARROW_SCREEN_PX = 36;
/** Screen-pixel vertical offset above the bounding box for rotation arrows. */
const ROTATE_ARROW_OFFSET_PX = 30;

const EDGE_TYPES: HandleType[] = [
  'edgeWidthLeft',
  'edgeWidthRight',
  'edgeLengthFront',
  'edgeLengthBack',
];
const CORNER_TYPES: HandleType[] = ['cornerBL', 'cornerBR', 'cornerTL', 'cornerTR'];
const ROTATE_TYPES: HandleType[] = ['rotateX', 'rotateY', 'rotateZ'];

const AXIS_COLORS: Record<string, number> = {
  rotateX: 0xee4444,
  rotateY: 0x44bb44,
  rotateZ: 0x4488ff,
};

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

// ─── Curved double-arrow handle (◁~~▷ style, like mirror arrows but curved) ──
function createCurvedDoubleArrowGeometry(): THREE.BufferGeometry {
  const r = HANDLE_SIZE * 0.42;
  const t = HANDLE_SIZE * 0.05;
  const headLen = HANDLE_SIZE * 0.18;
  const headW = HANDLE_SIZE * 0.14;
  const startA = -Math.PI / 3;   // -60°
  const endA = Math.PI / 3;      // +60°  → 120° arc
  const segs = 24;

  // Arc band
  const arcShape = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = startA + (endA - startA) * (i / segs);
    const x = Math.cos(a) * (r + t);
    const y = Math.sin(a) * (r + t);
    if (i === 0) arcShape.moveTo(x, y); else arcShape.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = startA + (endA - startA) * (i / segs);
    arcShape.lineTo(Math.cos(a) * (r - t), Math.sin(a) * (r - t));
  }
  arcShape.closePath();

  // Arrowhead at endA (pointing forward along arc)
  const tipEndA = endA + headLen / r;
  const headEnd = new THREE.Shape();
  headEnd.moveTo(Math.cos(tipEndA) * r, Math.sin(tipEndA) * r);
  headEnd.lineTo(Math.cos(endA) * (r + headW), Math.sin(endA) * (r + headW));
  headEnd.lineTo(Math.cos(endA) * (r - headW), Math.sin(endA) * (r - headW));
  headEnd.closePath();

  // Arrowhead at startA (pointing backward along arc)
  const tipStartA = startA - headLen / r;
  const headStart = new THREE.Shape();
  headStart.moveTo(Math.cos(tipStartA) * r, Math.sin(tipStartA) * r);
  headStart.lineTo(Math.cos(startA) * (r + headW), Math.sin(startA) * (r + headW));
  headStart.lineTo(Math.cos(startA) * (r - headW), Math.sin(startA) * (r - headW));
  headStart.closePath();

  return new THREE.ShapeGeometry([arcShape, headEnd, headStart]) as unknown as THREE.BufferGeometry;
}

// ─── Protractor handle (curved double-arrow, always visible) ─────────
function createProtractorHandle(type: HandleType): HandleMesh {
  const color = AXIS_COLORS[type] ?? 0xffdd00;
  const geo = createCurvedDoubleArrowGeometry();
  const mat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, depthTest: false,
    transparent: true, opacity: 0.7,
  });
  const mesh = new THREE.Mesh(geo, mat) as unknown as HandleMesh;
  mesh.userData = { type, defaultColor: color };
  return mesh;
}

// ─── Triple protractor rings (shown on hover, unit radius, scaled in world) ──
// Center ring: 45° snap (8 parts), inner ring: 5° ticks, outer ring: 1° ticks
function buildRingGroup(color: number): THREE.Group {
  const g = new THREE.Group();

  // Статичные дети ring-группы — локальный трансформ не меняется после создания.
  // Снимаем auto-update: пропускаем compose матрицы на каждом кадре.
  const addStatic = (obj: THREE.Object3D) => {
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
    g.add(obj);
  };

  const tickMat = new THREE.LineBasicMaterial({ color: 0x888888, depthTest: false });
  const majorMat = new THREE.LineBasicMaterial({ color, depthTest: false });

  // ── Center ring: 45° ticks (8 parts) ──────────────────────────────
  const centerRingGeo = new THREE.RingGeometry(0.50, 0.60, 64) as unknown as THREE.BufferGeometry;
  const centerRingMat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity: 0.40,
    depthTest: false, depthWrite: false,
  });
  addStatic(new THREE.Mesh(centerRingGeo, centerRingMat));

  // Center ticks every 22.5° (16 parts)
  for (let deg = 0; deg < 360; deg += 22.5) {
    const rad = -Math.PI / 2 - (deg * Math.PI) / 180;
    const pts = [
      new THREE.Vector3(Math.cos(rad) * 0.44, Math.sin(rad) * 0.44, 0),
      new THREE.Vector3(Math.cos(rad) * 0.50, Math.sin(rad) * 0.50, 0),
    ];
    addStatic(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), majorMat));
  }

  // ── Inner ring: 5° ticks, thicker band ─────────────────────────────
  const innerRingGeo = new THREE.RingGeometry(0.68, 0.78, 64) as unknown as THREE.BufferGeometry;
  const innerRingMat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity: 0.35,
    depthTest: false, depthWrite: false,
  });
  addStatic(new THREE.Mesh(innerRingGeo, innerRingMat));

  // Inner ticks every 5°, major every 15°
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = -Math.PI / 2 - (deg * Math.PI) / 180;
    const isMajor = deg % 15 === 0;
    const inner = isMajor ? 0.62 : 0.66;
    const pts = [
      new THREE.Vector3(Math.cos(rad) * inner, Math.sin(rad) * inner, 0),
      new THREE.Vector3(Math.cos(rad) * 0.68, Math.sin(rad) * 0.68, 0),
    ];
    addStatic(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), isMajor ? majorMat : tickMat));
  }

  // ── Outer ring: 1° ticks, thinner band ─────────────────────────────
  const outerRingGeo = new THREE.RingGeometry(0.88, 1.0, 128) as unknown as THREE.BufferGeometry;
  const outerRingMat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity: 0.25,
    depthTest: false, depthWrite: false,
  });
  addStatic(new THREE.Mesh(outerRingGeo, outerRingMat));

  // Outer ticks every 1°, major every 10°
  for (let deg = 0; deg < 360; deg += 1) {
    const rad = -Math.PI / 2 - (deg * Math.PI) / 180;
    const isMajor = deg % 10 === 0;
    const inner = isMajor ? 0.83 : 0.86;
    const pts = [
      new THREE.Vector3(Math.cos(rad) * inner, Math.sin(rad) * inner, 0),
      new THREE.Vector3(Math.cos(rad) * 0.88, Math.sin(rad) * 0.88, 0),
    ];
    addStatic(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), isMajor ? majorMat : tickMat));
  }

  // Degree labels at every 30° (between the two rings)
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = -Math.PI / 2 - (deg * Math.PI) / 180;
    const labelR = 0.82;
    const sprite = makeTextSprite(String(deg), color);
    sprite.position.set(Math.cos(rad) * labelR, Math.sin(rad) * labelR, 0);
    sprite.scale.set(0.08, 0.08, 1);
    addStatic(sprite);
  }

  // Pointer line (current rotation axis) — points down (toward 0°)
  const ptrMat = new THREE.LineBasicMaterial({ color, depthTest: false, linewidth: 2 });
  const ptrGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0.001), new THREE.Vector3(0, -0.95, 0.001),
  ]);
  const ptr = new THREE.Line(ptrGeo, ptrMat);
  ptr.name = 'rotationPointer';
  g.add(ptr);

  // Cursor pointer line (follows drag angle) — points down
  const cursorPtrGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0.002), new THREE.Vector3(0, -0.95, 0.002),
  ]);
  const cursorPtr = new THREE.Line(cursorPtrGeo, ptrMat.clone());
  cursorPtr.name = 'rotationCursorPointer';
  cursorPtr.visible = false;
  g.add(cursorPtr);

  // Sector fill (highlighted area between start and current angle) — contrasting color
  const sectorMat = new THREE.MeshBasicMaterial({
    color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.30,
    depthTest: false, depthWrite: false,
  });
  const sectorMesh = new THREE.Mesh(new THREE.BufferGeometry(), sectorMat);
  sectorMesh.name = 'rotationSector';
  sectorMesh.visible = false;
  // Позиция сектора статична — меняется только геометрия (в updateRotationSector).
  sectorMesh.matrixAutoUpdate = false;
  sectorMesh.updateMatrix();
  g.add(sectorMesh);

  // Center dot
  const dotGeo = new THREE.CircleGeometry(0.02, 12) as unknown as THREE.BufferGeometry;
  const dotMat = new THREE.MeshBasicMaterial({ color, depthTest: false, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.position.z = 0.001;
  addStatic(dot);

  g.visible = false;
  return g;
}

function makeTextSprite(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  const hex = '#' + new THREE.Color(color).getHexString();
  ctx.fillStyle = hex;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  return new THREE.Sprite(mat);
}

const OUTLINE_COLOR = 0x333333;

function createHandleMesh(type: HandleType): HandleMesh {
  if (ROTATE_TYPES.includes(type)) {
    return createProtractorHandle(type);
  }

  let color: number;
  let geometry: THREE.BufferGeometry;

  if (type === 'offsetY') {
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
  private rotationRings: Map<HandleType, THREE.Group> = new Map();
  /** Fixed ring radius, captured when ring becomes visible. */
  private fixedRingRadius = 0;


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

    // Create protractor rings for rotation handles (hidden by default, shown on hover)
    ROTATE_TYPES.forEach((type) => {
      const color = AXIS_COLORS[type] ?? 0xffdd00;
      const ring = buildRingGroup(color);
      this.group.add(ring);
      this.rotationRings.set(type, ring);
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
    // Если target — пустая группа (например, root пустой сцены), bbox.isEmpty()
    // даст Infinity-extents → весь pipeline (positions, drag-handles) даёт
    // NaN. Явно отказываемся ставить такой target.
    if (object3D) {
      const probeBox = new THREE.Box3().setFromObject(object3D);
      if (probeBox.isEmpty()) {
        this.clearTarget();
        return;
      }
    }
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
      const isRot = ROTATE_TYPES.includes(h.userData.type as HandleType);
      if (isRot) {
        mat.color.setHex(h.userData.defaultColor);
        mat.opacity = 0.7;
      } else {
        mat.color.setHex(h.userData.defaultColor);
      }
    });

    // Hide all rings
    this.rotationRings.forEach((ring) => { ring.visible = false; });

    if (handle) {
      const mat = handle.material as THREE.MeshBasicMaterial;
      const isRot = ROTATE_TYPES.includes(handle.userData.type as HandleType);
      if (isRot) {
        mat.color.setHex(0xffffff);
        mat.opacity = 1.0;
        // Show the corresponding protractor ring, fix radius at this moment
        const ring = this.rotationRings.get(handle.userData.type as HandleType);
        if (ring) {
          ring.visible = true;
          this.fixedRingRadius = this.boxSize.length() * 1.0;
        }
      } else {
        mat.color.setHex(0xff0000);
      }
    }
    this.hoveredHandle = handle;
    this.updateTooltip();
  }

  updatePositions(): void {
    if (!this.target || !this.camera) return;
    this.box.setFromObject(this.target);
    // Пустая bbox (target — пустая группа): setFromObject даёт min=+∞,
    // max=-∞ → дальше вся арифметика NaN'ится. Скрываем гизмо до следующего
    // кадра, когда target наполнится или сменится.
    if (this.box.isEmpty()) {
      this.group.visible = false;
      return;
    }
    if (!this.group.visible) this.group.visible = true;
    this.box.getSize(this.boxSize);
    this.box.getCenter(this.boxCenter);

    const { min, max } = this.box;
    const midX = (min.x + max.x) / 2;
    const midY = (min.y + max.y) / 2;

    // Compute world-per-pixel at the height handle position for dynamic offsets.
    // Z-up: «верх» — это max.z.
    let wpp = 0.35;
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const cam = this.camera as THREE.PerspectiveCamera;
      const fovRad = (cam.fov * Math.PI) / 180;
      const refPos = new THREE.Vector3(midX, midY, max.z);
      const d = refPos.distanceTo(cam.position);
      wpp = (2 * d * Math.tan(fovRad / 2)) / this.containerHeight;
    }

    // Dynamic offsets in world units based on screen pixels
    const offsetVerticalWorld = wpp * OFFSET_Y_SCREEN_PX;

    const handleIndexByType: Record<HandleType, number> = {} as Record<HandleType, number>;
    this.handles.forEach((h, i) => {
      handleIndexByType[h.userData.type as HandleType] = i;
    });

    // Edge midpoints на нижней грани (Z=min.z в Z-up).
    const botZ = min.z;
    this.handles[handleIndexByType.edgeWidthLeft].position.set(min.x, midY, botZ);
    this.handles[handleIndexByType.edgeWidthRight].position.set(max.x, midY, botZ);
    this.handles[handleIndexByType.edgeLengthFront].position.set(midX, max.y, botZ);
    this.handles[handleIndexByType.edgeLengthBack].position.set(midX, min.y, botZ);

    // Углы нижней грани (Z=min.z).
    this.handles[handleIndexByType.cornerBL].position.set(min.x, min.y, botZ);
    this.handles[handleIndexByType.cornerBR].position.set(max.x, min.y, botZ);
    this.handles[handleIndexByType.cornerTL].position.set(min.x, max.y, botZ);
    this.handles[handleIndexByType.cornerTR].position.set(max.x, max.y, botZ);

    // Height handle: над верхней гранью (Z=max.z).
    this.handles[handleIndexByType.height].position.set(midX, midY, max.z + offsetVerticalWorld);

    // OffsetY (тип имени сохранён для совместимости; семантически — vertical Z): выше height handle.
    this.handles[handleIndexByType.offsetY].position.set(midX, midY, max.z + offsetVerticalWorld * 2);

    // Three rotation handles — oriented with arcs facing the object center.
    const rotOff = wpp * ROTATE_ARROW_OFFSET_PX;
    // Orient rotation handle so arc bow faces toward the object (away from grid).
    // Z-up: «земля» — плоскость Z=0, dir вычисляется как сдвиг от ground point до handle.
    const orientArc = (handle: HandleMesh, rotAxis: THREE.Vector3) => {
      const groundPoint = new THREE.Vector3(handle.position.x, handle.position.y, 0);
      const dir = handle.position.clone().sub(groundPoint); // вверх от земли → arc bows toward object
      // Project направление на плоскость, перпендикулярную rotation axis
      dir.sub(rotAxis.clone().multiplyScalar(dir.dot(rotAxis)));
      if (dir.lengthSq() < 0.001) return;
      dir.normalize();
      const localY = new THREE.Vector3().crossVectors(rotAxis, dir).normalize();
      const m = new THREE.Matrix4().makeBasis(dir, localY, rotAxis);
      handle.quaternion.setFromRotationMatrix(m);
    };

    const camX = this.camera!.position.x;
    const camY = this.camera!.position.y;

    // rotateX — поворот вокруг X. Кладём на дальний X-край, midY, чуть выше top.
    const hRX = this.handles[handleIndexByType.rotateX];
    const farX = camX > midX ? min.x : max.x;
    hRX.position.set(farX, midY, max.z + rotOff);
    orientArc(hRX, new THREE.Vector3(1, 0, 0));

    // rotateY — поворот вокруг Y. Кладём на дальний Y-край, midX, чуть выше top.
    const hRY = this.handles[handleIndexByType.rotateY];
    const farY = camY > midY ? min.y : max.y;
    hRY.position.set(midX, farY, max.z + rotOff);
    orientArc(hRY, new THREE.Vector3(0, 1, 0));

    // rotateZ — yaw вокруг вертикальной оси Z. Кладём у нижней грани (min.z),
    // на ближайшем углу к камере (XY-план). Дугу разворачиваем горизонтально.
    const hRZ = this.handles[handleIndexByType.rotateZ];
    const nearX = camX > midX ? max.x : min.x;
    const nearY = camY > midY ? max.y : min.y;
    const dxCam = Math.abs(camX - midX);
    const dyCam = Math.abs(camY - midY);
    if (dxCam > dyCam) {
      hRZ.position.set(nearX + rotOff * Math.sign(camX - midX), midY, min.z);
    } else {
      hRZ.position.set(midX, nearY + rotOff * Math.sign(camY - midY), min.z);
    }
    {
      // Для Z-rotation handle лежит в плоскости Z=min.z — direction чисто
      // вертикальный после проецирования вырождается. Используем горизонтальный
      // вектор от центра bbox к ручке.
      const dir = new THREE.Vector3(
        hRZ.position.x - midX,
        hRZ.position.y - midY,
        0,
      );
      if (dir.lengthSq() > 0.001) {
        dir.normalize();
        const rotAxis = new THREE.Vector3(0, 0, 1);
        const localY = new THREE.Vector3().crossVectors(rotAxis, dir).normalize();
        const m = new THREE.Matrix4().makeBasis(dir, localY, rotAxis);
        hRZ.quaternion.setFromRotationMatrix(m);
      }
    }

    // Billboard: orient non-rotation handles toward the camera
    this.handles.forEach((handle) => {
      if (!ROTATE_TYPES.includes(handle.userData.type as HandleType)) {
        handle.lookAt(this.camera!.position);
      }
    });

    // Screen-space constant size
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const cam = this.camera as THREE.PerspectiveCamera;
      const fovRad = (cam.fov * Math.PI) / 180;
      const worldPos = new THREE.Vector3();

      this.handles.forEach((handle) => {
        const isRotate = ROTATE_TYPES.includes(handle.userData.type as HandleType);
        const screenPx = isRotate ? ROTATE_ARROW_SCREEN_PX : HANDLE_SCREEN_PX;
        const baseSize = HANDLE_SIZE;

        handle.getWorldPosition(worldPos);
        const distance = worldPos.distanceTo(cam.position);
        const viewportHeightWorld = 2 * distance * Math.tan(fovRad / 2);
        const worldPerPixel = viewportHeightWorld / this.containerHeight;
        const desiredWorldSize = worldPerPixel * screenPx;
        const scaleFactor = desiredWorldSize / baseSize;
        handle.scale.setScalar(scaleFactor);
      });

      // Position and scale protractor rings — centered on object, oriented per axis
      const rot = this.node?.params?.rotation;
      const ringRadius = this.fixedRingRadius > 0 ? this.fixedRingRadius : this.boxSize.length() * 1.0;
      this.rotationRings.forEach((ring, type) => {
        if (!ring.visible) return;
        const handle = this.handles[handleIndexByType[type]];
        ring.position.copy(this.boxCenter);
        ring.quaternion.copy(handle.quaternion);

        // Rotate ring so zero mark (-Y in local) faces the handle position
        const worldDir = handle.position.clone().sub(this.boxCenter);
        const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(handle.quaternion);
        const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(handle.quaternion);
        const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(handle.quaternion);
        worldDir.sub(localZ.clone().multiplyScalar(worldDir.dot(localZ))); // project onto ring plane
        const lx = worldDir.dot(localX);
        const ly = worldDir.dot(localY);
        const zeroOffset = Math.atan2(lx, -ly);
        ring.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), zeroOffset)
        );

        ring.scale.setScalar(ringRadius);

        // Pointer = clock hand: points in the direction of current rotation
        const ptr = ring.getObjectByName('rotationPointer') as THREE.Line | undefined;
        if (ptr) {
          if (type === 'rotateX') ptr.rotation.z = (rot?.x ?? 0);
          if (type === 'rotateY') ptr.rotation.z = (rot?.y ?? 0);
          if (type === 'rotateZ') ptr.rotation.z = (rot?.z ?? 0);
        }
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

    // Use AABB dimensions directly — uniformly covers primitives (including
    // cylinders with different radiusTop/radiusBottom), rotated/scaled objects,
    // groups and imports. Values align with what's visible on the grid.
    const bw = +this.boxSize.x.toFixed(2);
    const bh = +this.boxSize.y.toFixed(2);
    const bd = +this.boxSize.z.toFixed(2);
    const rawBottomY = this.box.min.y;
    // Snap near-zero bottom to 0 so an object sitting on the grid never shows a
    // small negative number from floating-point drift or group-pivot offsets.
    const bottomY = Math.abs(rawBottomY) < 0.05 ? 0 : +rawBottomY.toFixed(2);

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
        return `Y: ${bottomY}`;
      case 'rotateX': {
        const deg = +((this.node.params?.rotation?.x ?? 0) * (180 / Math.PI)).toFixed(1);
        return `X: ${deg}°`;
      }
      case 'rotateY': {
        const deg = +((this.node.params?.rotation?.y ?? 0) * (180 / Math.PI)).toFixed(1);
        return `Y: ${deg}°`;
      }
      case 'rotateZ': {
        const deg = +((this.node.params?.rotation?.z ?? 0) * (180 / Math.PI)).toFixed(1);
        return `Z: ${deg}°`;
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

  /** Returns the currently hovered handle (detected during pointermove). */
  getHoveredHandle(): HandleMesh | null {
    return this.hoveredHandle;
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
    // Dispose rotation rings
    this.rotationRings.forEach((ring) => {
      ring.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) obj.geometry.dispose();
        if (obj instanceof THREE.Line && obj.geometry) obj.geometry.dispose();
        if (obj instanceof THREE.Mesh && obj.material) {
          const mat = obj.material as THREE.Material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
        if (obj instanceof THREE.Sprite && obj.material) {
          (obj.material as THREE.SpriteMaterial).map?.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    });
    this.rotationRings.clear();

    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
      this.tooltip = null;
    }
    this.scene.remove(this.group);
  }

  /** Update the rotation sector and cursor pointer during drag. */
  updateRotationSector(type: HandleType, startAngle: number, currentAngle: number): void {
    const ring = this.rotationRings.get(type);
    if (!ring) return;

    const cursorPtr = ring.getObjectByName('rotationCursorPointer') as THREE.Line | undefined;
    const sectorMesh = ring.getObjectByName('rotationSector') as THREE.Mesh | undefined;

    if (cursorPtr) {
      cursorPtr.visible = true;
      cursorPtr.rotation.z = currentAngle;
    }

    if (sectorMesh) {
      sectorMesh.visible = true;
      // Build sector geometry between startAngle and currentAngle
      let delta = currentAngle - startAngle;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;

      const segs = Math.max(3, Math.ceil(Math.abs(delta) / (Math.PI / 36)));
      const vertices: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = -Math.PI / 2 + (startAngle + delta * (i / segs));
        // Center vertex
        vertices.push(0, 0, 0.001);
        // Edge vertex at outer radius
        vertices.push(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.001);
        if (i < segs) {
          const aNext = -Math.PI / 2 + (startAngle + delta * ((i + 1) / segs));
          vertices.push(Math.cos(aNext) * 0.95, Math.sin(aNext) * 0.95, 0.001);
        }
      }
      // Build triangle fan
      const indices: number[] = [];
      for (let i = 0; i < segs; i++) {
        indices.push(i * 3, i * 3 + 1, i * 3 + 2);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      if (sectorMesh.geometry) sectorMesh.geometry.dispose();
      sectorMesh.geometry = geo;
    }
  }

  /** Hide sector and cursor pointer (call on drag end). */
  hideRotationSector(type: HandleType): void {
    const ring = this.rotationRings.get(type);
    if (!ring) return;
    const cursorPtr = ring.getObjectByName('rotationCursorPointer') as THREE.Line | undefined;
    const sectorMesh = ring.getObjectByName('rotationSector') as THREE.Mesh | undefined;
    if (cursorPtr) cursorPtr.visible = false;
    if (sectorMesh) sectorMesh.visible = false;
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
