import * as THREE from 'three';
import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import type { ModelApp } from './ModelApp';
import type { ModelNode } from './nodes/ModelNode';
import { GroupNode } from './nodes/GroupNode';
import { Primitive } from './nodes/Primitive';
import { ImportedMeshNode } from './nodes/ImportedMeshNode';
import { ModificationGizmo, type HandleMesh } from './ModificationGizmo';
import { MirrorGizmo, type MirrorHandleMesh } from './MirrorGizmo';
import { ViewCubeNavigator } from './ViewCubeNavigator';
import { GridService } from './services/GridService';
import { applyHoleStyle, removeHoleStyle } from './holeMaterial';
import { bakeRotation, remapAxisForRotatedGroup } from './primitiveTransforms';

// ─── Tuning constants ────────────────────────────────────────────────────────

/** Pixels a pointer must move before a click becomes a drag. */
const DRAG_THRESHOLD = 4;

/** Normalize angle to [-π, π] range. */
function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Compute the angle on a rotation plane defined by its normal and two
 * tangent axes.  The hit point is projected onto the plane through center,
 * then atan2 of the two tangent coordinates gives the angle.
 */
function planeAngle(
  hit: THREE.Vector3,
  center: THREE.Vector3,
  tangentU: THREE.Vector3,
  tangentV: THREE.Vector3,
): number {
  const d = hit.clone().sub(center);
  return Math.atan2(d.dot(tangentU), d.dot(tangentV));
}

/**
 * Build the world-space rotation-plane normal and tangent axes for a given
 * Euler handle, taking into account preceding rotations (XYZ order).
 *
 *  rotateX  → plane normal = X            (no prior rotations)
 *  rotateY  → plane normal = Rx · Y       (after X rotation)
 *  rotateZ  → plane normal = Rx · Ry · Z  (after X and Y rotations)
 *
 * Returns { normal, tangentU, tangentV } where U × V = normal (right-hand).
 * tangentU / tangentV define the 2-D coordinate system on the plane.
 */
function rotationPlaneAxes(
  handleType: string,
  _rotation: { x: number; y: number; z: number },
): { normal: THREE.Vector3; tangentU: THREE.Vector3; tangentV: THREE.Vector3 } {
  let normal: THREE.Vector3;
  let tangentU: THREE.Vector3;
  let tangentV: THREE.Vector3;

  switch (handleType) {
    case 'rotateX':
      normal   = new THREE.Vector3(1, 0, 0);
      tangentU = new THREE.Vector3(0, 0, 1);
      tangentV = new THREE.Vector3(0, 1, 0);
      break;
    case 'rotateY':
      normal   = new THREE.Vector3(0, 1, 0);
      tangentU = new THREE.Vector3(-1, 0, 0);
      tangentV = new THREE.Vector3(0, 0, -1);
      break;
    case 'rotateZ':
      normal   = new THREE.Vector3(0, 0, 1);
      tangentU = new THREE.Vector3(-1, 0, 0);
      tangentV = new THREE.Vector3(0, 1, 0);
      break;
    default:
      normal   = new THREE.Vector3(0, 0, 1);
      tangentU = new THREE.Vector3(1, 0, 0);
      tangentV = new THREE.Vector3(0, 1, 0);
  }

  return { normal, tangentU, tangentV };
}

// ─── Debug / callback types ───────────────────────────────────────────────────

export interface SceneDebugChildInfo {
  index: number;
  type: string;
  name: string;
  uuid: string;
  visible: boolean;
  childrenCount: number;
}

export interface SceneDebugInfo {
  sceneChildren: SceneDebugChildInfo[];
  gizmo: ReturnType<ModificationGizmo['getDebugInfo']> | null;
}

export interface ConstructorSceneServiceOptions {
  /** Called when the user clicks (not drags) an object in the scene. */
  onSelectNodeFromScene?: (node: ModelNode, opts: { shift: boolean }) => void;
  /** Called when the user clicks empty space (grid) — deselect all. */
  onDeselectAll?: () => void;
  /** Called every ~30 frames with scene diagnostic data. */
  onDebugInfoUpdate?: (info: SceneDebugInfo) => void;
  /** Called when a node's transform / geometry params change due to drag. */
  onNodeParamsChanged?: (node: ModelNode) => void;
  /**
   * Called the moment a drag begins (threshold exceeded).
   * Use to snapshot the "before" state for undo/redo.
   */
  onBeforeDrag?: () => void;
  /**
   * Called when a drag ends (pointer up after dragging).
   * Use to push a SnapshotCommand with before/after JSON to HistoryManager.
   */
  onAfterDrag?: () => void;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Recursively disposes geometries and materials of all Mesh/LineSegments
 * descendants of obj (does NOT dispose obj itself if it is a Group).
 */
function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    } else if (child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      (child.material as THREE.Material | undefined)?.dispose();
    }
  });
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ConstructorSceneService {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private modificationGizmo: ModificationGizmo | null = null;
  private mirrorGizmo: MirrorGizmo | null = null;
  private mirrorMode = false;
  private viewCube: ViewCubeNavigator | null = null;
  private modelRootGroup: THREE.Group | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private mouse: THREE.Vector2 | null = null;
  private gridService: GridService | null = null;

  // ─── Debug center marker ──────────────────────────────────────────────────
  private centerMarker: THREE.Mesh | null = null;

  // ─── Drag state ────────────────────────────────────────────────────────────
  private dragPlane: THREE.Plane | null = null;
  private dragTarget: THREE.Object3D | null = null;
  private isPlaneDragging = false;
  private pointerDownHit: { object: THREE.Object3D; point: THREE.Vector3 } | null = null;
  private pointerDownClient = { x: 0, y: 0 };
  private pointerDownShift = false;
  private pointerDownHandle: HandleMesh | null = null;
  private isHandleDragging = false;
  private handleDragState: {
    handleType: string;
    node: ModelNode | null;
    /** Constraint plane for raycasting during drag. */
    plane: THREE.Plane;
    /** World-space intersection point at drag start. */
    startWorldPoint: THREE.Vector3;
    /** World axis/axes this handle operates along. */
    worldAxis: THREE.Vector3;
    /** Whether this is a vertical (Y-axis) handle. */
    isVertical: boolean;
    /** Whether this is a corner handle (tracks X and Z independently). */
    isCorner: boolean;
    /** Accumulated raw world-space delta (before snapping). */
    totalDeltaX: number;
    totalDeltaY: number;
    /** Already-applied (snapped) delta. */
    appliedDeltaX: number;
    appliedDeltaY: number;
    /** Screen-space start for rotation handles. */
    startClientX: number;
    startClientY: number;
    /** Rotation plane for raycasting (perpendicular to the rotation axis). */
    rotationPlane?: THREE.Plane;
    /** Center of the object in world space (rotation pivot). */
    rotationCenter?: THREE.Vector3;
    /** Angle on the rotation plane at drag start. */
    startPlaneAngle?: number;
    /** Rotation value at drag start (radians) for the active axis. */
    startRotation?: number;
    /** Tangent axes of the rotation plane (for planeAngle computation). */
    rotationTangentU?: THREE.Vector3;
    rotationTangentV?: THREE.Vector3;
    /** Fixed world-space pivot for rotation. */
    groupPivotWorld?: THREE.Vector3;
    /** Pivot in group's local space at drag start. */
    groupPivotLocal?: THREE.Vector3;
    /** Quaternion of the object at drag start (for world-axis rotation). */
    startQuaternion?: THREE.Quaternion;
    /** World axis for the active rotation handle. */
    rotationWorldAxis?: THREE.Vector3;
    /** World-space radius of the rotation ring (for dual-ring snap detection). */
    ringRadius?: number;
    /** Object's local X axis in world space (for corner drag). */
    localAxisX?: THREE.Vector3;
    /** Object's local Z axis in world space (for corner drag). */
    localAxisZ?: THREE.Vector3;
  } | null = null;

  /** Offset between the pointer click point and the object center on the XZ plane. */
  private dragOffset = new THREE.Vector2(0, 0);

  // ─── Selection ─────────────────────────────────────────────────────────────
  private selectedNodes: ModelNode[] = [];
  private selectedNode: ModelNode | null = null;
  private selectedObject3D: THREE.Object3D | null = null;

  // ─── Misc ──────────────────────────────────────────────────────────────────
  private animationId: number | null = null;
  private resizeHandler: (() => void) | null = null;
  private containerEl: HTMLElement | null = null;
  private debugFrameCount = 0;
  private showDebug = false;

  /** Visual ring shown at Y=0 when dragging an object vertically. */
  private yZeroIndicator: THREE.Mesh | null = null;
  private yZeroIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Dashed-line projection of the active object onto the Y=0 grid plane. */
  private gridProjection: THREE.Group | null = null;

  // ─── Cruise mode (object-to-object snapping) ──────────────────────────────
  private cruiseMode = false;
  private cruiseThreshold = 5; // snap distance in mm
  private cruiseGuides: THREE.Line[] = [];

  // ─── Middle-button camera cruise ─────────────────────────────────────────
  private middleDragging = false;
  private middleLastX = 0;
  private middleLastY = 0;

  // ─── Scene settings (applied before mount or via setters) ──────────────���───
  private snapStep = 1;
  /** @deprecated Rotation snap is now determined by dual-ring position (5° inner / 1° outer). */
  // private rotationSnapStep = Math.PI / 12;
  private backgroundColor: number | string = 0xf0f0f0;
  private zoomSpeed = 1;
  private gridWidthMm = 200;
  private gridLengthMm = 200;
  private gridVisible = true;

  constructor(
    private readonly modelApp: ModelApp,
    private readonly options: ConstructorSceneServiceOptions = {}
  ) {}

  // ─── Public setters ────────────────────────────────────────────────────────

  setSnapStep(step: number): void {
    this.snapStep = Number.isFinite(step) && step > 0 ? step : 1;
  }

  setCruiseMode(active: boolean): void {
    this.cruiseMode = active;
    if (!active) this.clearCruiseGuides();
  }

  isCruiseMode(): boolean {
    return this.cruiseMode;
  }

  /** Find the Three.js object corresponding to a model node. */
  findObject3DByNode(node: ModelNode): THREE.Object3D | null {
    return this.findObjectByNode(this.modelRootGroup, node);
  }

  setGridVisible(visible: boolean): void {
    this.gridVisible = !!visible;
    this.gridService?.setVisible(this.gridVisible);
  }

  setBackgroundColor(hex: number | string): void {
    this.backgroundColor = hex;
    if (this.scene) this.scene.background = new THREE.Color(hex as Parameters<THREE.Color['set']>[0]);
  }

  setZoomSpeed(speed: number): void {
    this.zoomSpeed = Math.min(3, Math.max(0.1, speed));
    if (this.controls) this.controls.zoomSpeed = this.zoomSpeed;
  }

  setGridSize(widthMm: number, lengthMm: number): void {
    this.gridWidthMm = Math.max(10, widthMm);
    this.gridLengthMm = Math.max(10, lengthMm);
    this.gridService?.setSize(this.gridWidthMm, this.gridLengthMm);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  mount(containerEl: HTMLElement): void {
    if (this.scene) return;
    this.containerEl = containerEl;
    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.backgroundColor as Parameters<THREE.Color['set']>[0]);

    // Grid
    this.gridService = new GridService(this.scene);
    this.gridService.setSize(this.gridWidthMm, this.gridLengthMm);
    this.gridService.setVisible(this.gridVisible);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(220, 160, 220);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(this.renderer.domElement);

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);

    // Controls — right-click rotates, left-click is used for selection/drag
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.mouseButtons.LEFT = null as unknown as MOUSE;
    this.controls.mouseButtons.MIDDLE = null as unknown as MOUSE; // middle button used for camera cruise
    this.controls.mouseButtons.RIGHT = MOUSE.ROTATE;
    this.controls.zoomSpeed = this.zoomSpeed;
    // Disable arrow key camera movement — arrows are used to move objects
    this.controls.enableKeys = false;

    // Gizmo
    this.modificationGizmo = new ModificationGizmo(this.scene);
    this.modificationGizmo.setCamera(this.camera);
    this.modificationGizmo.setContainerEl(containerEl);
    this.modificationGizmo.setContainerHeight(height);

    // Mirror gizmo
    this.mirrorGizmo = new MirrorGizmo(this.scene);
    this.mirrorGizmo.setCamera(this.camera);
    this.mirrorGizmo.setContainerHeight(height);

    // Model root
    this.modelRootGroup = new THREE.Group();
    this.scene.add(this.modelRootGroup);
    this.modificationGizmo.addToScene();
    this.mirrorGizmo.addToScene();

    // View cube navigator
    this.viewCube = new ViewCubeNavigator();

    const rootVal = this.modelApp.getModelManager().getTree();
    if (rootVal) {
      this.modelRootGroup.add(this.buildNodeObject3D(rootVal, true));
    }

    // Input
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = null;
    this.dragTarget = null;
    this.isPlaneDragging = false;

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    this.resizeHandler = () => {
      if (!this.containerEl || !this.camera || !this.renderer) return;
      const w = this.containerEl.clientWidth || window.innerWidth;
      const h = this.containerEl.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.modificationGizmo?.setContainerHeight(h);
      this.mirrorGizmo?.setContainerHeight(h);
    };
    window.addEventListener('resize', this.resizeHandler);

    this.animate();
  }

  unmount(): void {
    if (!this.scene || !this.renderer) return;

    this.modificationGizmo?.dispose();
    this.mirrorGizmo?.dispose();
    this.viewCube?.dispose();

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);

    if (this.animationId != null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.containerEl && this.renderer.domElement.parentNode === this.containerEl) {
      this.containerEl.removeChild(this.renderer.domElement);
    }

    // Dispose all model meshes before clearing
    if (this.modelRootGroup) disposeObject3D(this.modelRootGroup);

    this.hideYZeroIndicator();
    this.clearCruiseGuides();
    if (this.centerMarker) {
      this.centerMarker.geometry.dispose();
      (this.centerMarker.material as THREE.Material).dispose();
      this.scene?.remove(this.centerMarker);
      this.centerMarker = null;
    }
    if (this.yZeroIndicator) {
      this.yZeroIndicator.geometry.dispose();
      (this.yZeroIndicator.material as THREE.Material).dispose();
      this.yZeroIndicator = null;
    }
    if (this.gridProjection) {
      this.gridProjection.traverse((child) => {
        if ((child as THREE.Line).geometry) (child as THREE.Line).geometry.dispose();
        if ((child as THREE.Line).material) ((child as THREE.Line).material as THREE.Material).dispose();
      });
      this.scene?.remove(this.gridProjection);
      this.gridProjection = null;
    }

    this.gridService?.dispose();
    this.gridService = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.modificationGizmo = null;
    this.modelRootGroup = null;
    this.raycaster = null;
    this.mouse = null;
    this.dragPlane = null;
    this.dragTarget = null;
  }

  // ─── Scene management ──────────────────────────────────────────────────────

  setSelection(nodes: ModelNode[], node: ModelNode | null): void {
    const prevNodes = this.selectedNodes;
    this.selectedNodes = nodes.length ? [...nodes] : [];
    this.selectedNode = node;
    this.updateGizmoTarget(prevNodes);
  }

  // ─── Mirror mode ──────────────────────────────────────────────────────────

  setMirrorMode(active: boolean): void {
    this.mirrorMode = active;
    if (!this.mirrorGizmo) return;
    if (active && this.selectedObject3D) {
      this.mirrorGizmo.show(this.selectedObject3D);
    } else {
      this.mirrorGizmo.hide();
    }
  }

  isMirrorMode(): boolean {
    return this.mirrorMode;
  }

  /** Dispose all existing scene objects and rebuild from the model tree. */
  rebuildSceneFromTree(): void {
    if (!this.modelRootGroup) return;

    // Dispose WebGL resources before removing objects to prevent memory leaks
    disposeObject3D(this.modelRootGroup);
    while (this.modelRootGroup.children.length) {
      this.modelRootGroup.remove(this.modelRootGroup.children[0]);
    }

    const rootVal = this.modelApp.getModelManager().getTree();
    if (rootVal) {
      this.modelRootGroup.add(this.buildNodeObject3D(rootVal, true));
    }
    this.updateGizmoTarget();
  }

  /**
   * Appends a single node to the live scene without rebuilding existing objects.
   * Use for addPrimitive — avoids the full rebuild that displaces other objects.
   */
  appendNodeToScene(node: ModelNode): void {
    if (!this.modelRootGroup || this.modelRootGroup.children.length === 0) return;
    const rootGroup = this.modelRootGroup.children[0] as THREE.Group;
    const obj = this.buildNodeObject3D(node, false);
    rootGroup.add(obj);
  }

  /**
   * Updates a node's material in-place (color / isHole transparency).
   * Avoids a full scene rebuild for material-only changes.
   */
  updateNodeMaterial(node: ModelNode): void {
    if (!this.modelRootGroup) return;
    const obj = this.findObjectByNode(this.modelRootGroup, node);
    if (!obj) return;
    const isHole = !!node.params?.isHole;
    const color = (node.params?.color) as string | undefined;
    // Apply to all meshes in the object (handles groups with multiple children)
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && !child.userData.isEdgeLine) {
        const mat = child.material as THREE.MeshPhongMaterial;
        if (color) mat.color.setStyle(color);
        if (isHole) {
          applyHoleStyle(mat);
        } else {
          removeHoleStyle(mat);
        }
      }
    });
  }

  /** Returns the parent GroupNode of target in the model tree (used for delete/merge). */
  getParentOf(target: ModelNode): GroupNode | null {
    const root = this.modelApp.getModelManager().getTree();
    return this.findParentOf(root, target);
  }

  // ─── Private: scene construction ──────────────────────────────────────────

  private findParentOf(rootNode: ModelNode | null, target: ModelNode): GroupNode | null {
    if (!rootNode || !target) return null;
    const targetUuid = target.uuidMesh;
    if (targetUuid && rootNode.uuidMesh === targetUuid) return null;
    if (rootNode instanceof GroupNode) {
      const idx = targetUuid
        ? rootNode.children.findIndex((c) => c.uuidMesh === targetUuid)
        : rootNode.children.indexOf(target);
      if (idx !== -1) return rootNode;
      for (const child of rootNode.children) {
        const found = this.findParentOf(child, target);
        if (found) return found;
      }
    }
    return null;
  }

  private animate = (): void => {
    if (!this.renderer || !this.scene || !this.camera || !this.controls) return;
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();

    this.gridService?.updateLabelBillboard(this.camera);

    if (this.modificationGizmo?.getTarget()) {
      this.modificationGizmo.updatePositions();
    }
    if (this.mirrorGizmo?.isVisible()) {
      this.mirrorGizmo.updatePositions();
    }

    // Dashed projection of active object onto the grid
    this.updateGridProjection();

    // Debug center marker
    this.updateCenterMarker();

    // Periodic debug info (every 30 frames)
    this.debugFrameCount++;
    if (this.debugFrameCount % 30 === 0 && this.scene && this.modificationGizmo && this.options.onDebugInfoUpdate) {
      const children: SceneDebugChildInfo[] = [];
      this.scene.children.forEach((c, i) => {
        children.push({
          index: i,
          type: c.type,
          name: c.name || '(unnamed)',
          uuid: c.uuid ? c.uuid.slice(0, 8) : '-',
          visible: c.visible,
          childrenCount: c.children ? c.children.length : 0,
        });
      });
      this.options.onDebugInfoUpdate({
        sceneChildren: children,
        gizmo: this.modificationGizmo.getDebugInfo?.() ?? null,
      });
    }

    this.renderer.render(this.scene, this.camera);

    // View cube overlay
    if (this.viewCube) {
      this.viewCube.render(this.renderer, this.camera);
    }
  };

  /**
   * Builds a Three.js object from a model tree node.
   *
   * - Root GroupNode (isRoot=true): THREE.Group container so children are independently
   *   selectable and draggable.
   * - Non-root GroupNode: single CSG-merged mesh (TinkerCAD style).
   * - Primitive: mesh from getMesh() which already applies position/scale/rotation
   *   with the correct halfHeight offset.
   */
  private buildNodeObject3D(node: ModelNode, isRoot = false): THREE.Object3D {
    if (node instanceof ImportedMeshNode) {
      const mesh = node.getMesh();
      node.setUuid(mesh.uuid);
      mesh.userData.node = node;
      ConstructorSceneService.addEdgeLines(mesh);
      return mesh;
    }
    if (node instanceof Primitive) {
      // getMesh() already calls applyParamsToMesh (position + halfH, scale, rotation)
      const mesh = node.getMesh();
      node.setUuid(mesh.uuid);
      mesh.userData.node = node;
      ConstructorSceneService.addEdgeLines(mesh);
      return mesh;
    }
    if (node instanceof GroupNode) {
      if (isRoot) {
        // Root container: render each child individually so they stay independently
        // selectable and movable on the workplane.
        const group = new THREE.Group();
        node.setUuid(group.uuid);
        group.userData.node = node;
        const { position, scale, rotation } = node.params;
        if (position) group.position.set(position.x, position.y, position.z);
        if (scale) group.scale.set(scale.x, scale.y, scale.z);
        if (rotation) group.rotation.set(rotation.x, rotation.y, rotation.z);
        node.children.forEach((child) => group.add(this.buildNodeObject3D(child, false)));
        // Propagate group color to child meshes that don't have their own color
        const groupColor = node.params?.color as string | undefined;
        if (groupColor) {
          group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const childNode = (child.userData as { node?: ModelNode }).node;
              if (!childNode?.params?.color) {
                const mat = child.material as THREE.MeshPhongMaterial;
                mat.color.setStyle(groupColor);
                mat.needsUpdate = true;
              }
            }
          });
        }
        return group;
      }
      // Non-root group: apply CSG and return a single merged mesh
      const mesh = node.getMesh();
      node.setUuid(mesh.uuid);
      mesh.userData.node = node;
      ConstructorSceneService.addEdgeLines(mesh);
      // Apply zebra + transparency if group is marked as hole
      if (node.params?.isHole) {
        applyHoleStyle(mesh.material as THREE.MeshPhongMaterial);
      }
      return mesh;
    }
    return new THREE.Group();
  }

  private findObjectByNode(group: THREE.Object3D | null, node: ModelNode | null): THREE.Object3D | null {
    if (!group || !node) return null;
    const nodeUuid = node.uuidMesh;
    const stored = (group.userData as { node?: ModelNode })?.node;
    if (nodeUuid && stored?.uuidMesh === nodeUuid) return group;
    if (!nodeUuid && stored === node) return group;
    for (let i = 0; i < group.children.length; i++) {
      const found = this.findObjectByNode(group.children[i], node);
      if (found) return found;
    }
    return null;
  }

  private getSelectableMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    if (!this.modelRootGroup) return meshes;
    this.modelRootGroup.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.userData as { node?: unknown }).node) meshes.push(o);
    });
    return meshes;
  }

  private updateMouseFromEvent(event: PointerEvent): void {
    if (!this.containerEl || !this.mouse) return;
    const rect = this.containerEl.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private static readonly NEON_EMISSIVE = new THREE.Color(0x00a5a4);
  private static readonly NEON_INTENSITY = 0.15;

  private clearSelectionGlow(nodes: ModelNode[]): void {
    if (!this.modelRootGroup) return;
    for (const node of nodes) {
      const obj = this.findObjectByNode(this.modelRootGroup, node);
      if (!obj) continue;
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material && !child.userData.isEdgeLine) {
          const mat = child.material as THREE.MeshPhongMaterial;
          mat.emissive.setScalar(0);
          mat.needsUpdate = true;
        }
      });
    }
  }

  private applySelectionGlow(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && !child.userData.isEdgeLine) {
        const mat = child.material as THREE.MeshPhongMaterial;
        mat.emissive.copy(ConstructorSceneService.NEON_EMISSIVE);
        mat.emissiveIntensity = ConstructorSceneService.NEON_INTENSITY;
        mat.needsUpdate = true;
      }
    });
  }

  private updateGizmoTarget(prevNodes?: ModelNode[]): void {
    if (!this.modificationGizmo || !this.modelRootGroup) return;

    // Clear glow from previous selection
    this.clearSelectionGlow(prevNodes ?? this.selectedNodes);

    if (this.selectedNodes.length === 0) {
      this.selectedObject3D = null;
      this.modificationGizmo.clearTarget();
      this.mirrorGizmo?.hide();
      return;
    }
    const first = this.selectedNodes[0];
    const obj = this.findObjectByNode(this.modelRootGroup, first);
    this.selectedObject3D = obj || null;
    if (obj && this.selectedNode) {
      this.modificationGizmo.setTarget(obj, this.selectedNode as unknown as Parameters<ModificationGizmo['setTarget']>[1]);
      if (this.mirrorMode && this.mirrorGizmo) this.mirrorGizmo.show(obj);
      // Apply glow to all selected objects
      for (const node of this.selectedNodes) {
        const selObj = this.findObjectByNode(this.modelRootGroup!, node);
        if (selObj) this.applySelectionGlow(selObj);
      }
    } else {
      this.modificationGizmo.clearTarget();
      this.mirrorGizmo?.hide();
    }
  }

  // ─── Private: handle drag geometry update ─────────────────────────────────

  /**
   * Updates a primitive mesh's geometry in-place after a geometry-param change
   * (width/height/depth/radius via handles). Avoids rebuilding the entire scene.
   */
  /** Edge outline material shared across all meshes */
  private static edgeLineMaterial = new THREE.LineBasicMaterial({
    color: 0x222222,
    transparent: true,
    opacity: 0.25,
  });

  /** Adds or updates dark edge lines on a mesh */
  private static addEdgeLines(mesh: THREE.Mesh): void {
    // Remove existing edge lines
    const existing = mesh.children.filter(c => c.userData.isEdgeLine);
    existing.forEach(c => {
      (c as THREE.LineSegments).geometry.dispose();
      mesh.remove(c);
    });
    const edges = new THREE.EdgesGeometry(mesh.geometry, 20);
    const lines = new THREE.LineSegments(edges, ConstructorSceneService.edgeLineMaterial);
    lines.userData.isEdgeLine = true;
    lines.raycast = () => {}; // not pickable
    mesh.add(lines);
  }

  private updatePrimitiveGeometryInPlace(prim: Primitive, mesh: THREE.Mesh): void {
    const oldGeo = mesh.geometry;
    mesh.geometry = prim.createGeometry();
    oldGeo.dispose();

    // Re-apply Y offset: position.y in params means "bottom on grid"
    const halfH = prim.getHalfHeight();
    const p = prim.params.position ?? { x: 0, y: 0, z: 0 };
    mesh.position.set(p.x, (p.y ?? 0) + halfH, p.z);

    // Update edge lines
    ConstructorSceneService.addEdgeLines(mesh);
  }

  /**
   * Applies a delta from a handle drag.
   * `dx` is the horizontal delta, `dy` is the vertical delta.
   */
  private applyHandleDragDelta(
    node: ModelNode | null,
    handleType: string,
    dx: number,
    dy: number
  ): void {
    if (!node) return;

    const prim = node instanceof Primitive ? node : null;
    node.params = node.params || {};
    const params = node.params;
    params.position = params.position || { x: 0, y: 0, z: 0 };
    params.scale = params.scale || { x: 1, y: 1, z: 1 };

    const p = params.position!;
    const g = prim?.geometryParams ?? {};
    const s = params.scale!;

    // Compute AABB and unrotated bbox for scale-based sizing.
    // Needed for groups (no geometryParams) and for primitives whose geomKey
    // is absent (e.g. cylinder/cone have no width/depth — edge handles use scale).
    let objBoxSize: THREE.Vector3 | null = null;
    let objBox: THREE.Box3 | null = null;
    if (this.selectedObject3D) {
      objBox = new THREE.Box3().setFromObject(this.selectedObject3D);

      // Unrotated bbox — for size along each local axis (scale operates before rotation)
      const savedQ = this.selectedObject3D.quaternion.clone();
      this.selectedObject3D.quaternion.set(0, 0, 0, 1);
      this.selectedObject3D.updateMatrixWorld(true);
      const objBoxUnrotated = new THREE.Box3().setFromObject(this.selectedObject3D);
      this.selectedObject3D.quaternion.copy(savedQ);
      this.selectedObject3D.updateMatrixWorld(true);

      objBoxSize = new THREE.Vector3();
      objBoxUnrotated.getSize(objBoxSize);
    }

    // For rotated groups: remap world handle direction to the best-matching local scale axis.
    // E.g. if group is rotated 90° around Y, world X handle should scale local Z.
    const remapAxisForGroup = (worldAxis: 'x' | 'y' | 'z'): 'x' | 'y' | 'z' => {
      if (prim) return worldAxis;
      const rot = params.rotation;
      if (!rot) return worldAxis;
      return remapAxisForRotatedGroup(rot, worldAxis);
    };

    // Helper: grow a geometry param or fall back to scale.
    // For groups (incl. rotated), uses "before-after" AABB approach:
    // record the fixed face position, change scale, measure drift, compensate with position.
    const growDim = (
      delta: number,
      geomKey: 'width' | 'height' | 'depth',
      scaleAxis: 'x' | 'y' | 'z',
      posAxis: 'x' | 'y' | 'z',
      posSign: number // +1 or -1: direction position shifts to keep opposite face fixed
    ) => {
      // For rotated groups, remap scale axis to best-matching local axis
      const effectiveScaleAxis = prim ? scaleAxis : remapAxisForGroup(scaleAxis);

      if (prim && geomKey in g) {
        g[geomKey] = Math.max(0.01, (g[geomKey] as number ?? 1) + delta);
        const shift = (delta / 2) * posSign;
        p[posAxis] += shift;
      } else if (this.selectedObject3D) {
        const obj = this.selectedObject3D;
        const currentSize = objBoxSize ? objBoxSize[effectiveScaleAxis] : 0;
        if (currentSize > 0.01) {
          // Record which AABB face must stay fixed (world-space)
          const fixedBefore = objBox
            ? (posSign > 0 ? objBox.min[posAxis] : objBox.max[posAxis])
            : p[posAxis];

          // Change scale in local space (using remapped axis)
          const oldScale = s[effectiveScaleAxis] ?? 1;
          const scaleDelta = delta / currentSize * oldScale;
          s[effectiveScaleAxis] = Math.max(0.01, oldScale + scaleDelta);

          // Apply new scale to 3D object and measure where the fixed face moved
          obj.scale.set(s.x, s.y, s.z);
          obj.updateMatrixWorld(true);
          const newBox = new THREE.Box3().setFromObject(obj);
          const fixedAfter = posSign > 0 ? newBox.min[posAxis] : newBox.max[posAxis];

          // Compensate position so the fixed face doesn't move
          const drift = fixedAfter - fixedBefore;
          p[posAxis] -= drift;

          // Sync 3D object position for subsequent growDim calls (corners call twice)
          const halfH = prim ? prim.getHalfHeight() : 0;
          obj.position.set(p.x, p.y + halfH, p.z);
          obj.updateMatrixWorld(true);
          objBox = new THREE.Box3().setFromObject(obj);
        } else {
          s[effectiveScaleAxis] = Math.max(0.01, (s[effectiveScaleAxis] ?? 1) + delta * 0.01);
          p[posAxis] += (delta / 2) * posSign;
        }
      }
    };

    switch (handleType) {
      // Edge handles: grow one dimension, shift position so the opposite face stays put
      case 'edgeWidthRight': growDim(dx, 'width',  'x', 'x', +1); break;
      case 'edgeWidthLeft':  growDim(-dx, 'width',  'x', 'x', -1); break;
      case 'edgeLengthFront':growDim(dx, 'depth',  'z', 'z', +1); break;
      case 'edgeLengthBack': growDim(-dx, 'depth',  'z', 'z', -1); break;

      // Corner handles: dx = X-axis delta (width), dy = Z-axis delta (depth)
      case 'cornerTR': {
        growDim(dx, 'width', 'x', 'x', +1);
        growDim(dy, 'depth', 'z', 'z', +1);
        break;
      }
      case 'cornerTL': {
        growDim(-dx, 'width', 'x', 'x', -1);
        growDim(dy, 'depth', 'z', 'z', +1);
        break;
      }
      case 'cornerBR': {
        growDim(dx, 'width', 'x', 'x', +1);
        growDim(-dy, 'depth', 'z', 'z', -1);
        break;
      }
      case 'cornerBL': {
        growDim(-dx, 'width', 'x', 'x', -1);
        growDim(-dy, 'depth', 'z', 'z', -1);
        break;
      }

      // Height: grow upward, bottom face stays fixed
      case 'height': {
        const hObj = this.selectedObject3D;
        // Запоминаем bbox.min.y до изменения
        let bottomBefore: number | null = null;
        if (hObj) {
          const bBefore = new THREE.Box3().setFromObject(hObj);
          bottomBefore = bBefore.min.y;
        }

        if (prim && 'height' in g) {
          g.height = Math.max(0.01, (g.height as number ?? 1) + dy);
        } else {
          const heightAxis = remapAxisForGroup('y');
          const currentH = objBoxSize ? objBoxSize[heightAxis] : 0;
          if (currentH > 0.01) {
            const oldScaleH = s[heightAxis] ?? 1;
            const scaleDelta = dy / currentH * oldScaleH;
            s[heightAxis] = Math.max(0.01, oldScaleH + scaleDelta);
          } else {
            s[heightAxis] = Math.max(0.01, (s[heightAxis] ?? 1) + dy * 0.01);
          }
        }

        // Компенсируем позицию, чтобы bbox.min.y остался на месте
        if (hObj && bottomBefore !== null) {
          // Удаляем устаревшие edge-line дочерние объекты — их bbox от предыдущей
          // геометрии раздувает setFromObject и ломает вычисление drift.
          // updatePrimitiveGeometryInPlace пересоздаст их ниже.
          const staleEdges = hObj.children.filter(c => c.userData.isEdgeLine);
          staleEdges.forEach(c => {
            if ((c as THREE.LineSegments).geometry) (c as THREE.LineSegments).geometry.dispose();
            hObj.remove(c);
          });

          // Применяем промежуточные значения к mesh для вычисления нового bbox
          if (prim) {
            const tmpOldGeo = (hObj as THREE.Mesh).geometry;
            (hObj as THREE.Mesh).geometry = prim.createGeometry();
            tmpOldGeo.dispose();
            const halfH = prim.getHalfHeight();
            hObj.position.set(p.x, (p.y ?? 0) + halfH, p.z);
          } else {
            hObj.position.set(p.x, p.y, p.z);
            if (params.scale) hObj.scale.set(params.scale.x, params.scale.y, params.scale.z);
          }
          hObj.updateMatrixWorld(true);
          const bAfter = new THREE.Box3().setFromObject(hObj);
          const drift = bAfter.min.y - bottomBefore;
          if (Math.abs(drift) > 0.0001) {
            p.y -= drift;
          }
        }
        break;
      }

      // Vertical offset: pure translation
      case 'offsetY':
        p.y = (p.y ?? 0) + dy;
        this.showYZeroIndicatorIfNeeded(node);
        break;

      // Axis-constrained rotation: dx = absolute angle, applied in world space via quaternion
      case 'rotateX':
      case 'rotateY':
      case 'rotateZ': {
        params.rotation = params.rotation || { x: 0, y: 0, z: 0 };
        const ds = this.handleDragState;
        if (ds?.startQuaternion && ds.rotationWorldAxis) {
          const startRot = ds.startRotation ?? 0;
          const deltaAngle = dx - startRot;
          // Дельта-поворот вокруг мировой оси
          const deltaQuat = new THREE.Quaternion().setFromAxisAngle(ds.rotationWorldAxis, deltaAngle);
          // Новый кватернион = дельта * начальный (world-space rotation)
          const newQuat = deltaQuat.multiply(ds.startQuaternion.clone());
          // Разложить обратно в Euler
          const euler = new THREE.Euler().setFromQuaternion(newQuat, 'XYZ');
          params.rotation.x = normalizeAngle(euler.x);
          params.rotation.y = normalizeAngle(euler.y);
          params.rotation.z = normalizeAngle(euler.z);
        }
        break;
      }
      default:
        break;
    }

    // Snap позиции только для вертикального смещения (offsetY)
    if (this.snapStep > 0 && handleType === 'offsetY') {
      p.y = Math.round(p.y / this.snapStep) * this.snapStep;
    }

    // Update mesh visuals
    const obj = this.selectedObject3D;
    const isGeomChange = handleType.startsWith('edge') || handleType.startsWith('corner') || handleType === 'height';

    if (obj && prim && isGeomChange) {
      this.updatePrimitiveGeometryInPlace(prim, obj as THREE.Mesh);
    } else if (obj) {
      const halfH = prim ? prim.getHalfHeight() : 0;
      if (params.position) {
        obj.position.set(params.position.x, (params.position.y ?? 0) + halfH, params.position.z);
      }
      if (params.scale) obj.scale.set(params.scale.x, params.scale.y, params.scale.z);
      if (params.rotation) {
        if (this.handleDragState?.groupPivotWorld
            && this.handleDragState?.groupPivotLocal) {
          const pivotWorld = this.handleDragState.groupPivotWorld;
          const pivotLocal = this.handleDragState.groupPivotLocal;

          // Поставить новое вращение
          obj.rotation.set(params.rotation.x, params.rotation.y, params.rotation.z);
          obj.updateMatrixWorld(true);

          // Куда сместился pivot после вращения (localToWorld = R * v + P)
          const rotatedOffset = obj.localToWorld(pivotLocal.clone()).sub(obj.position);

          // Позиция = pivot_мировой − повёрнутый_offset
          obj.position.copy(pivotWorld).sub(rotatedOffset);

          params.position = params.position || { x: 0, y: 0, z: 0 };
          params.position.x = obj.position.x;
          params.position.y = obj.position.y - halfH;
          params.position.z = obj.position.z;
        } else {
          obj.rotation.set(params.rotation.x, params.rotation.y, params.rotation.z);
        }
      }
    }

    this.options.onNodeParamsChanged?.(node);
  }

  /**
   * After a rotation drag ends, if the resulting rotation is aligned to 90° increments,
   * bake the rotation into geometry dimensions (swap width/height/depth) and reset rotation to 0.
   * Uses the pure `bakeRotation()` function for the math; this method applies the
   * result to the node, 3D object, and gizmo.
   */
  private bakeRotationIntoDimensions(node: ModelNode): void {
    const rot = node.params?.rotation;
    if (!rot) return;

    const prim = node instanceof Primitive ? node : null;
    const isGroup = node instanceof GroupNode;

    // ── Box primitive baking ──
    if (prim) {
      const transform = {
        position: node.params!.position || { x: 0, y: 0, z: 0 },
        scale: node.params!.scale || { x: 1, y: 1, z: 1 },
        rotation: { ...rot },
      };
      const result = bakeRotation(prim.type, { ...prim.geometryParams }, transform);
      if (!result.baked) return;

      prim.geometryParams.width = result.geom.width;
      prim.geometryParams.height = result.geom.height;
      prim.geometryParams.depth = result.geom.depth;
      node.params!.position = result.transform.position;
      node.params!.scale = result.transform.scale;
      rot.x = 0; rot.y = 0; rot.z = 0;

      const obj = this.selectedObject3D;
      if (obj) {
        obj.rotation.set(0, 0, 0);
        obj.scale.set(result.transform.scale.x, result.transform.scale.y, result.transform.scale.z);
        this.updatePrimitiveGeometryInPlace(prim, obj as THREE.Mesh);
      }
    }

    // Groups keep their rotation — no baking. Handles are rotation-aware.
    else {
      return;
    }

    this.updateGizmoTarget();
    this.options.onNodeParamsChanged?.(node);
  }

  // ─── Public: keyboard movement ──────────────────────────────────

  /**
   * Moves the selected node by the snap step relative to camera orientation.
   * direction: 'left' | 'right' | 'forward' | 'backward' for horizontal XZ plane,
   *            'up' | 'down' for vertical Y axis.
   */
  moveSelectedByKey(direction: 'left' | 'right' | 'forward' | 'backward' | 'up' | 'down'): void {
    const node = this.selectedNode;
    if (!node) return;
    node.params = node.params || {};
    node.params.position = node.params.position || { x: 0, y: 0, z: 0 };
    const step = this.snapStep > 0 ? this.snapStep : 1;
    const p = node.params.position;

    if (direction === 'up' || direction === 'down') {
      p.y = (p.y ?? 0) + step * (direction === 'up' ? 1 : -1);
      p.y = Math.round(p.y / step) * step;
      this.showYZeroIndicatorIfNeeded(node);
    } else {
      // Camera-relative direction, but snapped to the dominant world axis
      const camDir = new THREE.Vector3();
      this.camera!.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      const camRight = new THREE.Vector3();
      camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

      let moveDir: THREE.Vector3;
      switch (direction) {
        case 'forward':  moveDir = camDir.clone(); break;
        case 'backward': moveDir = camDir.clone().negate(); break;
        case 'right':    moveDir = camRight.clone(); break;
        case 'left':     moveDir = camRight.clone().negate(); break;
      }

      // Pick the dominant axis (X or Z) and move only along it
      if (Math.abs(moveDir.x) >= Math.abs(moveDir.z)) {
        p.x = (p.x ?? 0) + Math.sign(moveDir.x) * step;
        p.x = Math.round(p.x / step) * step;
      } else {
        p.z = (p.z ?? 0) + Math.sign(moveDir.z) * step;
        p.z = Math.round(p.z / step) * step;
      }
    }

    // Update mesh
    const obj = this.selectedObject3D;
    if (obj) {
      const halfH = node instanceof Primitive ? node.getHalfHeight() : 0;
      obj.position.set(p.x, (p.y ?? 0) + halfH, p.z);
    }

    this.options.onNodeParamsChanged?.(node);
  }

  // ─── Public: export ───────────────────────────────────────────

  exportSTL(filename = 'scene.stl', onlySelected = false): void {
    const mesh = this.getExportMesh(onlySelected);
    if (!mesh) return;
    const exporter = new STLExporter();
    const result = exporter.parse(mesh, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    this.downloadBlob(blob, filename);
  }

  exportOBJ(filename = 'scene.obj', onlySelected = false): void {
    const mesh = this.getExportMesh(onlySelected);
    if (!mesh) return;
    const exporter = new OBJExporter();
    const result = exporter.parse(mesh);
    const blob = new Blob([result], { type: 'text/plain' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Async STL export with progress callback.
   * Yields between CSG operations so the UI can update a progress bar.
   */
  async exportSTLAsync(
    filename = 'scene.stl',
    onlySelected = false,
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    const mesh = await this.getExportMeshAsync(onlySelected, onProgress);
    if (!mesh) return;
    await new Promise((r) => setTimeout(r, 0));
    const exporter = new STLExporter();
    const result = exporter.parse(mesh, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Async OBJ export with progress callback.
   */
  async exportOBJAsync(
    filename = 'scene.obj',
    onlySelected = false,
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    const mesh = await this.getExportMeshAsync(onlySelected, onProgress);
    if (!mesh) return;
    await new Promise((r) => setTimeout(r, 0));
    const exporter = new OBJExporter();
    const result = exporter.parse(mesh);
    const blob = new Blob([result], { type: 'text/plain' });
    this.downloadBlob(blob, filename);
  }

  private getExportMesh(onlySelected: boolean): THREE.Mesh | null {
    if (onlySelected && this.selectedNode) {
      const mesh = this.selectedNode.getMesh();
      mesh.updateMatrixWorld(true);
      return mesh;
    }
    const root = this.modelApp.getModelManager().getTree();
    if (!root) return null;
    const mesh = root.getMesh();
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  private async getExportMeshAsync(
    onlySelected: boolean,
    onProgress?: (done: number, total: number) => void,
  ): Promise<THREE.Mesh | null> {
    const node = onlySelected && this.selectedNode
      ? this.selectedNode
      : this.modelApp.getModelManager().getTree();
    if (!node) return null;

    const totalOps = node.countCSGOperations();
    const counter = { done: 0, total: totalOps };

    if (onProgress) onProgress(0, totalOps);
    const mesh = await node.getMeshAsync(onProgress, counter);
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Private: camera-aware axis projection ────────────────────

  /**
   * Computes the constraint plane and world axis for a handle drag.
   *
   * For horizontal handles (edges, corners): the constraint plane is Y=objectY (the XZ grid plane
   * at the object's height), so the cursor raycast always tracks real grid cells.
   *
   * For vertical handles (height, offsetY): the constraint plane passes through the object
   * and faces the camera, so vertical mouse movement maps to Y-axis displacement regardless
   * of camera rotation.
   */
  private computeHandleConstraintPlane(handleType: string): {
    plane: THREE.Plane;
    worldAxis: THREE.Vector3;
    isVertical: boolean;
    isCorner: boolean;
    localAxisX?: THREE.Vector3;
    localAxisZ?: THREE.Vector3;
  } {
    const objectPos = new THREE.Vector3();
    if (this.selectedObject3D) {
      this.selectedObject3D.getWorldPosition(objectPos);
    }

    // Точка на плоскости проекции (Y=0) под центром объекта
    const projOrigin = new THREE.Vector3(objectPos.x, 0, objectPos.z);

    // Оси проекции — мировые, ручки работают в визуальном пространстве
    let worldAxis: THREE.Vector3;
    let isVertical = false;
    let isCorner = false;
    let localAxisX: THREE.Vector3 | undefined;
    let localAxisZ: THREE.Vector3 | undefined;

    switch (handleType) {
      case 'edgeWidthLeft':
      case 'edgeWidthRight':
        worldAxis = new THREE.Vector3(1, 0, 0);
        break;
      case 'edgeLengthFront':
      case 'edgeLengthBack':
        worldAxis = new THREE.Vector3(0, 0, 1);
        break;
      case 'height':
      case 'offsetY':
        worldAxis = new THREE.Vector3(0, 1, 0);
        isVertical = true;
        break;
      case 'cornerBL':
      case 'cornerBR':
      case 'cornerTL':
      case 'cornerTR':
        worldAxis = new THREE.Vector3(1, 0, 1).normalize();
        isCorner = true;
        localAxisX = new THREE.Vector3(1, 0, 0);
        localAxisZ = new THREE.Vector3(0, 0, 1);
        break;
      default:
        worldAxis = new THREE.Vector3(1, 0, 0);
        break;
    }

    let plane: THREE.Plane;
    if (isVertical) {
      // Вертикальные: плоскость лицом к камере
      const camDir = new THREE.Vector3();
      this.camera!.getWorldDirection(camDir);
      const normal = camDir.clone().negate().normalize();
      if (normal.lengthSq() < 0.001) {
        normal.set(0, 0, 1);
      }
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, objectPos);
    } else {
      // Рёбра и углы: горизонтальная плоскость Y=0
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        projOrigin,
      );
    }

    return { plane, worldAxis, isVertical, isCorner, localAxisX, localAxisZ };
  }

  // ─── Private: Y=0 indicator ───────────────────────────────────

  private showYZeroIndicatorIfNeeded(node: ModelNode): void {
    if (!this.scene || !node.params?.position) return;
    const posY = node.params.position.y ?? 0;
    // Show indicator when Y position is exactly 0 (on grid)
    if (Math.abs(posY) < 0.001) {
      this.showYZeroIndicator(node);
    } else {
      this.hideYZeroIndicator();
    }
  }

  private showYZeroIndicator(node: ModelNode): void {
    if (!this.scene) return;

    // Find the 3D object to compute its bounding box footprint
    const obj = this.modelRootGroup ? this.findObjectByNode(this.modelRootGroup, node) : null;
    const box = new THREE.Box3();
    if (obj) {
      box.setFromObject(obj);
    } else {
      // Fallback: small area around position
      const pos = node.params?.position ?? { x: 0, y: 0, z: 0 };
      box.min.set(pos.x - 5, 0, pos.z - 5);
      box.max.set(pos.x + 5, 0, pos.z + 5);
    }

    const sizeX = box.max.x - box.min.x;
    const sizeZ = box.max.z - box.min.z;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;

    // Dispose old indicator geometry to recreate with correct size
    if (this.yZeroIndicator) {
      this.yZeroIndicator.geometry.dispose();
      const geo = new THREE.PlaneBufferGeometry(sizeX, sizeZ);
      this.yZeroIndicator.geometry = geo;
    } else {
      const geo = new THREE.PlaneBufferGeometry(sizeX, sizeZ);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
      });
      this.yZeroIndicator = new THREE.Mesh(geo, mat);
      this.yZeroIndicator.rotation.x = -Math.PI / 2;
      this.yZeroIndicator.renderOrder = 2;
    }

    this.yZeroIndicator.position.set(centerX, 0.01, centerZ);
    if (this.yZeroIndicator.parent !== this.scene) {
      this.scene.add(this.yZeroIndicator);
    }
    this.yZeroIndicator.visible = true;

    // Auto-hide after 800ms
    if (this.yZeroIndicatorTimeout) clearTimeout(this.yZeroIndicatorTimeout);
    this.yZeroIndicatorTimeout = setTimeout(() => {
      this.hideYZeroIndicator();
    }, 800);
  }

  private hideYZeroIndicator(): void {
    if (this.yZeroIndicator) {
      this.yZeroIndicator.visible = false;
    }
    if (this.yZeroIndicatorTimeout) {
      clearTimeout(this.yZeroIndicatorTimeout);
      this.yZeroIndicatorTimeout = null;
    }
  }

  // ─── Grid projection (dashed outline + filled area on Y=0) ─────────────────

  private updateGridProjection(): void {
    if (!this.selectedObject3D || !this.scene) {
      if (this.gridProjection) this.gridProjection.visible = false;
      return;
    }

    const obj = this.selectedObject3D;
    const box = new THREE.Box3().setFromObject(obj);
    const { min, max } = box;

    // Grid-plane Y coordinate (slightly above 0 to avoid z-fighting)
    const gy = 0.02;

    const sizeX = max.x - min.x;
    const sizeZ = max.z - min.z;
    const centerX = (min.x + max.x) / 2;
    const centerZ = (min.z + max.z) / 2;

    // Four corners of the bounding box projected onto Y=0
    const c0 = new THREE.Vector3(min.x, gy, min.z);
    const c1 = new THREE.Vector3(max.x, gy, min.z);
    const c2 = new THREE.Vector3(max.x, gy, max.z);
    const c3 = new THREE.Vector3(min.x, gy, max.z);

    // Rectangle on the grid (closed loop)
    const rectPoints = [c0, c1, c2, c3, c0];

    if (!this.gridProjection) {
      this.gridProjection = new THREE.Group();
      this.gridProjection.renderOrder = 2;

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
      this.gridProjection.add(fillMesh);

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
      this.gridProjection.add(rectLine);

      this.scene.add(this.gridProjection);
    } else {
      // Update dashed outline
      const rectLine = this.gridProjection.getObjectByName('projRect') as THREE.Line;
      if (rectLine) {
        rectLine.geometry.dispose();
        rectLine.geometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
        rectLine.computeLineDistances();
      }
    }

    // Update filled area position and scale
    const fillMesh = this.gridProjection.getObjectByName('projFill') as THREE.Mesh;
    if (fillMesh) {
      fillMesh.position.set(centerX, gy + 0.001, centerZ);
      fillMesh.scale.set(sizeX, sizeZ, 1);
    }

    this.gridProjection.visible = true;
  }

  // ─── Debug: center marker ──────────────────────────────────────────────────

  private updateCenterMarker(): void {
    if (!this.selectedObject3D || !this.scene) {
      if (this.centerMarker) {
        this.centerMarker.visible = false;
      }
      return;
    }

    const obj = this.selectedObject3D;
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const radius = Math.max(size.x, size.y, size.z) * 0.05;

    if (!this.centerMarker) {
      const geo = new THREE.SphereGeometry(1, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        depthTest: false,
        transparent: true,
        opacity: 0.7,
      });
      this.centerMarker = new THREE.Mesh(geo, mat);
      this.centerMarker.renderOrder = 999;
      this.scene.add(this.centerMarker);
    }

    this.centerMarker.visible = true;
    this.centerMarker.position.copy(center);
    this.centerMarker.scale.setScalar(radius);
  }

  // ─── Private: cruise mode (object-to-object snapping) ──────────────────────

  /**
   * Collects bounding-box edges of all scene objects except the dragged one.
   * Returns arrays of X and Z edge coordinates.
   */
  private collectNeighborEdges(exclude: THREE.Object3D): { xs: number[]; zs: number[] } {
    const xs: number[] = [];
    const zs: number[] = [];
    if (!this.modelRootGroup) return { xs, zs };
    const box = new THREE.Box3();
    this.modelRootGroup.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o === exclude) return;
      if (!(o.userData as { node?: unknown }).node) return;
      box.setFromObject(o);
      if (box.isEmpty()) return;
      xs.push(box.min.x, (box.min.x + box.max.x) / 2, box.max.x);
      zs.push(box.min.z, (box.min.z + box.max.z) / 2, box.max.z);
    });
    return { xs, zs };
  }

  /**
   * Given the dragged object's candidate position, snaps X and/or Z
   * to the nearest neighbor edge within cruiseThreshold.
   * Returns the snapped position and the snap coordinates for guides.
   */
  private applyCruiseSnap(
    target: THREE.Object3D,
    posX: number,
    posZ: number,
    neighborEdges: { xs: number[]; zs: number[] }
  ): { x: number; z: number; guideXs: number[]; guideZs: number[] } {
    const box = new THREE.Box3().setFromObject(target);
    const halfW = (box.max.x - box.min.x) / 2;
    const halfD = (box.max.z - box.min.z) / 2;
    const centerX = posX;
    const centerZ = posZ;

    // Edges of the dragged object at the candidate position
    const myXs = [centerX - halfW, centerX, centerX + halfW];
    const myZs = [centerZ - halfD, centerZ, centerZ + halfD];

    let bestDx = Infinity;
    let snapX = posX;
    const guideXs: number[] = [];

    for (const mx of myXs) {
      for (const nx of neighborEdges.xs) {
        const d = Math.abs(mx - nx);
        if (d < this.cruiseThreshold && d < Math.abs(bestDx)) {
          bestDx = nx - mx;
          snapX = posX + bestDx;
        }
      }
    }
    if (Math.abs(bestDx) < this.cruiseThreshold) {
      // Collect all neighbor X edges that align with any edge of the snapped object
      const snappedXs = [snapX - halfW, snapX, snapX + halfW];
      for (const sx of snappedXs) {
        for (const nx of neighborEdges.xs) {
          if (Math.abs(sx - nx) < 0.01) guideXs.push(sx);
        }
      }
    }

    let bestDz = Infinity;
    let snapZ = posZ;
    const guideZs: number[] = [];

    for (const mz of myZs) {
      for (const nz of neighborEdges.zs) {
        const d = Math.abs(mz - nz);
        if (d < this.cruiseThreshold && d < Math.abs(bestDz)) {
          bestDz = nz - mz;
          snapZ = posZ + bestDz;
        }
      }
    }
    if (Math.abs(bestDz) < this.cruiseThreshold) {
      const snappedZs = [snapZ - halfD, snapZ, snapZ + halfD];
      for (const sz of snappedZs) {
        for (const nz of neighborEdges.zs) {
          if (Math.abs(sz - nz) < 0.01) guideZs.push(sz);
        }
      }
    }

    return { x: snapX, z: snapZ, guideXs, guideZs };
  }

  private showCruiseGuides(xs: number[], zs: number[], y: number): void {
    this.clearCruiseGuides();
    if (!this.scene) return;
    const guideLen = 500;
    const mat = new THREE.LineBasicMaterial({ color: 0x00ccff, depthTest: false, linewidth: 1 });

    const uniqueXs = [...new Set(xs.map(v => Math.round(v * 100) / 100))];
    const uniqueZs = [...new Set(zs.map(v => Math.round(v * 100) / 100))];

    for (const x of uniqueXs) {
      const pts = [new THREE.Vector3(x, y, -guideLen), new THREE.Vector3(x, y, guideLen)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 3;
      this.scene.add(line);
      this.cruiseGuides.push(line);
    }
    for (const z of uniqueZs) {
      const pts = [new THREE.Vector3(-guideLen, y, z), new THREE.Vector3(guideLen, y, z)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 3;
      this.scene.add(line);
      this.cruiseGuides.push(line);
    }
  }

  private clearCruiseGuides(): void {
    for (const line of this.cruiseGuides) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.scene?.remove(line);
    }
    this.cruiseGuides = [];
  }

  // ─── Private: pointer events ───────────────────────────────────────────────

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.modelRootGroup || !this.raycaster || !this.mouse) return;

    // Middle button: start camera cruise
    if (event.button === 1) {
      event.preventDefault();
      this.middleDragging = true;
      this.middleLastX = event.clientX;
      this.middleLastY = event.clientY;
      return;
    }

    if (event.button !== 0) return;
    this.updateMouseFromEvent(event);
    this.raycaster.setFromCamera(this.mouse, this.camera!);

    // Mirror handle click
    if (this.mirrorMode && this.mirrorGizmo?.isVisible() && this.selectedNode) {
      this.mirrorGizmo.updateMatrixWorld();
      const mirrorHits = this.raycaster.intersectObjects(this.mirrorGizmo.getHandles());
      if (mirrorHits.length > 0) {
        const handle = mirrorHits[0].object as MirrorHandleMesh;
        const axis = handle.userData?.axis;
        if (axis) {
          this.options.onBeforeDrag?.();
          const node = this.selectedNode;
          node.params = node.params || {};
          node.params.scale = node.params.scale || { x: 1, y: 1, z: 1 };
          node.params.scale[axis] *= -1;
          this.rebuildSceneFromTree();
          this.options.onNodeParamsChanged?.(node);
          this.options.onAfterDrag?.();
        }
        return;
      }
    }

    if (this.modificationGizmo?.getTarget()) {
      // Force matrix update so raycasting reflects the latest handle positions.
      this.modificationGizmo.updateMatrixWorldForHandles();
      const handleHits = this.raycaster.intersectObjects(this.modificationGizmo.getHandles());
      if (handleHits.length > 0) {
        const handle = handleHits[0].object as HandleMesh;
        if (handle.userData?.type) {
          this.pointerDownHandle = handle;
          this.pointerDownClient = { x: event.clientX, y: event.clientY };
          this.pointerDownShift = !!event.shiftKey;
          return;
        }
      }
    }

    const meshes = this.getSelectableMeshes();
    const hits = this.raycaster.intersectObjects(meshes);
    this.pointerDownClient = { x: event.clientX, y: event.clientY };
    this.pointerDownShift = !!event.shiftKey;
    this.pointerDownHandle = null;
    this.pointerDownHit = hits.length > 0
      ? { object: hits[0].object, point: hits[0].point }
      : null;
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.modelRootGroup || !this.raycaster || !this.mouse) return;

    // ── Middle-button camera cruise ────────────────────────────────────────
    if (this.middleDragging && this.camera && this.controls) {
      const dx = event.clientX - this.middleLastX;
      const dy = event.clientY - this.middleLastY;
      this.middleLastX = event.clientX;
      this.middleLastY = event.clientY;

      const dist = this.camera.position.distanceTo(this.controls.target);
      const speed = dist * 0.002 * this.zoomSpeed;

      // Horizontal mouse → strafe (camera right), vertical → pan (camera up)
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();

      const offset = new THREE.Vector3();
      offset.addScaledVector(right, -dx * speed);
      offset.addScaledVector(up, dy * speed);

      this.camera.position.add(offset);
      this.controls.target.add(offset);
      this.controls.update();
      return;
    }

    this.updateMouseFromEvent(event);
    this.raycaster.setFromCamera(this.mouse, this.camera!);

    // ── Handle drag ────────────────────────────────────────────────────────
    if (this.isHandleDragging && this.handleDragState) {
      const isRotation = this.handleDragState.handleType.startsWith('rotate');

      if (isRotation) {
        const rp = this.handleDragState.rotationPlane;
        const rc = this.handleDragState.rotationCenter;
        if (rp && rc && this.handleDragState.startPlaneAngle !== undefined) {
          // Raycast cursor onto the rotation plane
          const hitPoint = new THREE.Vector3();
          const didHit = this.raycaster.ray.intersectPlane(rp, hitPoint);
          if (!didHit) return;

          // Compute current angle on the rotation plane
          const tU = this.handleDragState.rotationTangentU!;
          const tV = this.handleDragState.rotationTangentV!;
          const currentAngle = planeAngle(hitPoint, rc, tU, tV);
          let delta = currentAngle - this.handleDragState.startPlaneAngle;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;

          // Dual-ring snap: distance from center determines 5° (inner) or 1° (outer)
          const ringRadius = this.handleDragState.ringRadius ?? 1;
          const distFromCenter = hitPoint.distanceTo(rc);
          const normalizedDist = distFromCenter / ringRadius;
          // Inner ring boundary ~0.82 (midpoint between rings)
          const snapDeg = normalizedDist < 0.82 ? 5 : 1;
          const snapStep = (snapDeg * Math.PI) / 180;

          const startRot = this.handleDragState.startRotation ?? 0;
          const rawTarget = startRot + delta;
          const snappedTarget = snapStep > 0
            ? Math.round(rawTarget / snapStep) * snapStep
            : rawTarget;

          // Pass absolute angle
          this.applyHandleDragDelta(this.handleDragState.node, this.handleDragState.handleType, snappedTarget, 0);
        }
        return;
      }

      // Raycast cursor onto the constraint plane to get world-space position
      const worldPoint = new THREE.Vector3();
      const hit = this.raycaster.ray.intersectPlane(this.handleDragState.plane, worldPoint);
      if (!hit) return;

      // Project world delta onto the handle's axis
      const rawDelta = worldPoint.clone().sub(this.handleDragState.startWorldPoint);

      if (this.handleDragState.isVertical) {
        // Y-axis handles: use vertical component
        this.handleDragState.totalDeltaY = rawDelta.y;
      } else if (this.handleDragState.isCorner) {
        // Corner handles: проекция на локальные оси объекта (dx=localX, dy=localZ)
        const lx = this.handleDragState.localAxisX;
        const lz = this.handleDragState.localAxisZ;
        if (lx && lz) {
          this.handleDragState.totalDeltaX = rawDelta.dot(lx);
          this.handleDragState.totalDeltaY = rawDelta.dot(lz);
        } else {
          this.handleDragState.totalDeltaX = rawDelta.x;
          this.handleDragState.totalDeltaY = rawDelta.z;
        }
      } else {
        // Edge handles: project onto the single world axis
        const axisDot = rawDelta.dot(this.handleDragState.worldAxis);
        this.handleDragState.totalDeltaX = axisDot;
      }

      const snappedX = this.snapStep > 0
        ? Math.round(this.handleDragState.totalDeltaX / this.snapStep) * this.snapStep
        : this.handleDragState.totalDeltaX;
      const snappedY = this.snapStep > 0
        ? Math.round(this.handleDragState.totalDeltaY / this.snapStep) * this.snapStep
        : this.handleDragState.totalDeltaY;

      const deltaXToApply = snappedX - this.handleDragState.appliedDeltaX;
      const deltaYToApply = snappedY - this.handleDragState.appliedDeltaY;

      if (deltaXToApply !== 0 || deltaYToApply !== 0) {
        this.applyHandleDragDelta(
          this.handleDragState.node,
          this.handleDragState.handleType,
          deltaXToApply,
          deltaYToApply
        );
        this.handleDragState.appliedDeltaX = snappedX;
        this.handleDragState.appliedDeltaY = snappedY;
      }

      return;
    }

    // ── Plane drag ────────────────────────────────────────────────────────
    if (this.isPlaneDragging && this.dragTarget && this.dragPlane) {
      const ray = this.raycaster.ray;
      const targetPoint = new THREE.Vector3();
      if (ray.intersectPlane(this.dragPlane, targetPoint)) {
        // Subtract click offset so the object follows the cursor from where it was clicked
        targetPoint.x -= this.dragOffset.x;
        targetPoint.z -= this.dragOffset.y;
        if (this.snapStep > 0) {
          targetPoint.x = Math.round(targetPoint.x / this.snapStep) * this.snapStep;
          targetPoint.z = Math.round(targetPoint.z / this.snapStep) * this.snapStep;
        }

        // Cruise mode: snap to neighbor edges
        if (this.cruiseMode) {
          const edges = this.collectNeighborEdges(this.dragTarget);
          // Temporarily move object to candidate position for bbox computation
          if (this.dragTarget.parent) this.dragTarget.parent.worldToLocal(targetPoint);
          this.dragTarget.position.x = targetPoint.x;
          this.dragTarget.position.z = targetPoint.z;

          const worldPos = new THREE.Vector3();
          this.dragTarget.getWorldPosition(worldPos);
          const snap = this.applyCruiseSnap(this.dragTarget, worldPos.x, worldPos.z, edges);

          // Convert snapped world position back to local
          const snappedWorld = new THREE.Vector3(snap.x, worldPos.y, snap.z);
          if (this.dragTarget.parent) this.dragTarget.parent.worldToLocal(snappedWorld);
          this.dragTarget.position.x = snappedWorld.x;
          this.dragTarget.position.z = snappedWorld.z;

          if (snap.guideXs.length || snap.guideZs.length) {
            this.showCruiseGuides(snap.guideXs, snap.guideZs, worldPos.y);
          } else {
            this.clearCruiseGuides();
          }
        } else {
          if (this.dragTarget.parent) this.dragTarget.parent.worldToLocal(targetPoint);
          this.dragTarget.position.x = targetPoint.x;
          this.dragTarget.position.z = targetPoint.z;
        }

        // Update node params
        const node = (this.dragTarget.userData as { node?: ModelNode }).node;
        if (node?.params) {
          node.params.position = node.params.position || { x: 0, y: 0, z: 0 };
          node.params.position.x = this.dragTarget.position.x;
          node.params.position.z = this.dragTarget.position.z;
          this.options.onNodeParamsChanged?.(node);
        }
      }
      return;
    }

    // ── Begin handle drag ─────────────────────────────────────────────────
    if (this.pointerDownHandle && (event.buttons & 1) === 1 && !this.isHandleDragging) {
      const dx = event.clientX - this.pointerDownClient.x;
      const dy = event.clientY - this.pointerDownClient.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        this.isHandleDragging = true;
        if (this.controls) this.controls.enabled = false;
        this.options.onBeforeDrag?.();
        const node = this.modificationGizmo?.getNode() as ModelNode | null;
        const handleType = (this.pointerDownHandle.userData as { type: string }).type;

        // Compute the constraint plane and world axis for this handle
        const { plane, worldAxis, isVertical, isCorner, localAxisX, localAxisZ } = this.computeHandleConstraintPlane(handleType);

        // Raycast to get the starting world-space intersection point
        const startWorldPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, startWorldPoint);

        this.handleDragState = {
          handleType,
          node,
          plane,
          startWorldPoint,
          worldAxis,
          isVertical,
          isCorner,
          totalDeltaX: 0,
          totalDeltaY: 0,
          appliedDeltaX: 0,
          appliedDeltaY: 0,
          startClientX: event.clientX,
          startClientY: event.clientY,
          localAxisX,
          localAxisZ,
        };

        // For rotation handles: set up rotation plane and initial angle
        if (handleType.startsWith('rotate') && this.selectedObject3D && this.camera) {
          const obj = this.selectedObject3D;
          obj.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(obj);
          const center = new THREE.Vector3();
          box.getCenter(center);

          // Build rotation plane from current Euler, accounting for prior axes
          const curRot = this.handleDragState.node?.params?.rotation ?? { x: 0, y: 0, z: 0 };
          const { normal, tangentU, tangentV } = rotationPlaneAxes(handleType, curRot);
          const rotPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);

          // Raycast cursor onto the rotation plane to get starting angle
          const hitStart = new THREE.Vector3();
          const didHit = this.raycaster.ray.intersectPlane(rotPlane, hitStart);

          if (didHit) {
            const startAngle = planeAngle(hitStart, center, tangentU, tangentV);
            const axisKey = handleType === 'rotateX' ? 'x' : handleType === 'rotateY' ? 'y' : 'z';
            this.handleDragState.rotationPlane = rotPlane;
            this.handleDragState.rotationCenter = center;
            this.handleDragState.rotationTangentU = tangentU;
            this.handleDragState.rotationTangentV = tangentV;
            this.handleDragState.startPlaneAngle = startAngle;
            this.handleDragState.startRotation = this.handleDragState.node?.params?.rotation?.[axisKey] ?? 0;
            // Сохраняем начальный кватернион и мировую ось для корректного вращения
            this.handleDragState.startQuaternion = obj.quaternion.clone();
            this.handleDragState.rotationWorldAxis = normal.clone();
          }

          // Вычисляем радиус кольца для определения snap-зоны
          const boxSize = new THREE.Vector3();
          box.getSize(boxSize);
          this.handleDragState.ringRadius = boxSize.length() * 0.6;

          // Cache the bbox center as fixed pivot for position correction
          const pivot = center.clone();
          this.handleDragState.groupPivotWorld = pivot;
          this.handleDragState.groupPivotLocal = obj.worldToLocal(pivot.clone());
        }
      }
    }

    // ── Begin plane drag ──────────────────────────────────────────────────
    if (this.pointerDownHit && !this.isPlaneDragging && !this.isHandleDragging && (event.buttons & 1) === 1) {
      const dx = event.clientX - this.pointerDownClient.x;
      const dy = event.clientY - this.pointerDownClient.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        this.isPlaneDragging = true;
        if (this.controls) this.controls.enabled = false;
        this.options.onBeforeDrag?.();
        this.dragTarget = this.pointerDownHit.object;
        const worldPos = new THREE.Vector3();
        this.dragTarget.getWorldPosition(worldPos);
        // Store offset between click point and object center so the object
        // doesn't jump to center under the cursor at drag start.
        this.dragOffset.set(
          this.pointerDownHit.point.x - worldPos.x,
          this.pointerDownHit.point.z - worldPos.z
        );
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), worldPos);
      }
    }

    // ── Handle hover highlight ────────────────────────────────────────────
    if (!this.isHandleDragging && !this.isPlaneDragging && this.modificationGizmo?.getTarget()) {
      this.modificationGizmo.updateMatrixWorldForHandles();
      const handleHits = this.raycaster.intersectObjects(this.modificationGizmo.getHandles());
      const hovered = handleHits.length > 0 ? (handleHits[0].object as HandleMesh) : null;
      this.modificationGizmo.setHovered(hovered);
    }

    // ── Mirror handle hover highlight ─────────────────────────────────────
    if (!this.isHandleDragging && !this.isPlaneDragging && this.mirrorMode && this.mirrorGizmo?.isVisible()) {
      this.mirrorGizmo.updateMatrixWorld();
      const mirrorHits = this.raycaster.intersectObjects(this.mirrorGizmo.getHandles());
      const hovered = mirrorHits.length > 0 ? (mirrorHits[0].object as MirrorHandleMesh) : null;
      this.mirrorGizmo.setHovered(hovered);
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.renderer) return;

    // Middle button release: stop camera cruise
    if (event.button === 1) {
      this.middleDragging = false;
      return;
    }

    if (event.button !== 0) return;

    if (this.isHandleDragging) {
      const wasRotation = this.handleDragState?.handleType?.startsWith('rotate');
      const rotNode = this.handleDragState?.node ?? null;
      this.isHandleDragging = false;
      this.handleDragState = null;
      this.pointerDownHandle = null;
      if (this.controls) this.controls.enabled = true;
      if (wasRotation && rotNode) {
        this.bakeRotationIntoDimensions(rotNode);
      }
      this.options.onAfterDrag?.();
      return;
    }

    if (this.isPlaneDragging) {
      this.isPlaneDragging = false;
      if (this.controls) this.controls.enabled = true;
      this.dragTarget = null;
      this.pointerDownHit = null;
      this.clearCruiseGuides();
      this.updateGizmoTarget();
      this.options.onAfterDrag?.();
      return;
    }

    const isCanvasRelease = this.renderer.domElement && event.target === this.renderer.domElement;
    if (isCanvasRelease) {
      const dx = event.clientX - this.pointerDownClient.x;
      const dy = event.clientY - this.pointerDownClient.y;
      const isClick = Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD;

      if (this.pointerDownHandle) {
        this.pointerDownHandle = null;
      } else if (this.pointerDownHit && isClick) {
        const node = (this.pointerDownHit.object.userData as { node?: ModelNode }).node;
        if (node && this.options.onSelectNodeFromScene) {
          this.options.onSelectNodeFromScene(node, { shift: this.pointerDownShift });
        }
      } else if (!this.pointerDownHit && isClick) {
        // Clicked on empty space (grid) — deselect all
        this.options.onDeselectAll?.();
      }
      event.stopPropagation();
    }
    this.pointerDownHit = null;
    this.pointerDownHandle = null;
  };
}
