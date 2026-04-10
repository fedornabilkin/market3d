import * as THREE from 'three';
import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { ModelApp } from './ModelApp';
import { ModelExporter } from './ModelExporter';
import type { ModelNode } from './nodes/ModelNode';
import { GroupNode } from './nodes/GroupNode';
import { Primitive } from './nodes/Primitive';
import { ImportedMeshNode } from './nodes/ImportedMeshNode';
import { ModificationGizmo, type HandleMesh } from './ModificationGizmo';
import { ViewCubeNavigator } from './ViewCubeNavigator';
import { MirrorMode } from './modes/MirrorMode';
import { CruiseMode } from './modes/CruiseMode';
import { GridMode } from './modes/GridMode';
import { AlignmentMode } from './modes/AlignmentMode';
import { ChamferMode } from './modes/ChamferMode';
import {
  PointerEventController,
  type PointerEventHost,
  type HandleDragState,
} from './events/PointerEventController';
import { applyHoleStyle, removeHoleStyle } from './holeMaterial';
import { bakeRotation, remapAxisForRotatedGroup } from './primitiveTransforms';

/** Normalize angle to [-π, π] range. */
function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
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
  private viewCube: ViewCubeNavigator | null = null;
  private modelRootGroup: THREE.Group | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private mouse: THREE.Vector2 | null = null;

  // ─── Modes ────────────────────────────────────────────────────────────────
  private readonly mirrorMode = new MirrorMode();
  private readonly cruiseModeCtrl = new CruiseMode();
  private readonly gridMode = new GridMode();
  private readonly alignmentMode = new AlignmentMode();
  private readonly chamferMode = new ChamferMode();

  // ─── Debug center marker ──────────────────────────────────────────────────
  private centerMarker: THREE.Mesh | null = null;
  private debugPanelVisible = false;

  // ─── Drag state ────────────────────────────────────────────────────────────
  private dragPlane: THREE.Plane | null = null;
  private dragTarget: THREE.Object3D | null = null;
  private isPlaneDragging = false;
  private pointerDownHit: { object: THREE.Object3D; point: THREE.Vector3 } | null = null;
  private pointerDownClient = { x: 0, y: 0 };
  private pointerDownShift = false;
  private pointerDownHandle: HandleMesh | null = null;
  private isHandleDragging = false;
  private handleDragState: HandleDragState | null = null;

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

  /** Visual ring shown at Y=0 when dragging an object vertically. */
  private yZeroIndicator: THREE.Mesh | null = null;
  private yZeroIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;


  // ─── Scene settings (applied before mount or via setters) ──────────────���───
  private backgroundColor: number | string = 0xf0f0f0;
  private zoomSpeed = 1;

  private readonly exporter: ModelExporter;
  private readonly pointerController: PointerEventController;

  constructor(
    private readonly modelApp: ModelApp,
    private readonly options: ConstructorSceneServiceOptions = {}
  ) {
    this.exporter = new ModelExporter(
      () => this.modelApp.getModelManager().getTree(),
      () => this.selectedNode,
    );
    this.pointerController = new PointerEventController(this._host);
  }

  /** Returns the export helper (STL/OBJ download). */
  getExporter(): ModelExporter {
    return this.exporter;
  }

  /**
   * Returns this service cast to PointerEventHost.
   * Also serves as a compile-time reference so TS doesn't flag host-interface
   * members as unused (they are accessed at runtime by PointerEventController).
   * @internal
   */
  private get _host(): PointerEventHost {
    void this.raycaster; void this.mouse;
    void this.dragPlane; void this.dragTarget; void this.isPlaneDragging;
    void this.pointerDownHit; void this.pointerDownClient;
    void this.pointerDownShift; void this.pointerDownHandle;
    void this.isHandleDragging; void this.dragOffset;
    void this.getSelectableMeshes; void this.applyHandleDragDelta;
    void this.bakeRotationIntoDimensions; void this.computeHandleConstraintPlane;
    void this.collectNeighborEdges; void this.applyCruiseSnap;
    void this.showCruiseGuides; void this.clearCruiseGuides;
    void this.chamferMode;
    return this as unknown as PointerEventHost;
  }

  // ─── Public setters ────────────────────────────────────────────────────────

  setSnapStep(step: number): void {
    this.gridMode.setSnapStep(step);
  }

  /** Convenience getter used by PointerEventHost. */
  get snapStep(): number {
    return this.gridMode.snapStep;
  }

  setCruiseMode(active: boolean): void {
    this.cruiseModeCtrl.setActive(active);
  }

  isCruiseMode(): boolean {
    return this.cruiseModeCtrl.isActive();
  }

  setAlignmentMode(active: boolean): void {
    this.alignmentMode.setActive(active);
    // Hide modification gizmo in alignment mode to avoid interference
    if (this.modificationGizmo) {
      if (active) {
        this.modificationGizmo.clearTarget();
      } else {
        this.updateGizmoTarget();
      }
    }
  }

  isAlignmentMode(): boolean {
    return this.alignmentMode.isActive();
  }

  setChamferMode(active: boolean): void {
    this.chamferMode.setActive(active);
    if (this.modificationGizmo) {
      if (active) {
        this.modificationGizmo.clearTarget();
      } else {
        this.updateGizmoTarget();
      }
    }
  }

  isChamferMode(): boolean {
    return this.chamferMode.isActive();
  }

  getChamferMode(): ChamferMode {
    return this.chamferMode;
  }

  setDebugPanelVisible(visible: boolean): void {
    this.debugPanelVisible = visible;
    if (!visible && this.centerMarker) {
      this.centerMarker.visible = false;
    }
  }

  /** Find the Three.js object corresponding to a model node. */
  findObject3DByNode(node: ModelNode): THREE.Object3D | null {
    return this.findObjectByNode(this.modelRootGroup, node);
  }

  setGridVisible(visible: boolean): void {
    this.gridMode.setVisible(visible);
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
    this.gridMode.setSize(widthMm, lengthMm);
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
    this.gridMode.init(this.scene);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    this.camera.position.set(0, 160, 300);

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
    this.controls.minDistance = 10;
    this.controls.maxDistance = 2000;
    // Disable arrow key camera movement — arrows are used to move objects
    this.controls.enableKeys = false;

    // Gizmo
    this.modificationGizmo = new ModificationGizmo(this.scene);
    this.modificationGizmo.setCamera(this.camera);
    this.modificationGizmo.setContainerEl(containerEl);
    this.modificationGizmo.setContainerHeight(height);

    // Mirror gizmo
    this.mirrorMode.init(this.scene, this.camera, height);

    // Model root
    this.modelRootGroup = new THREE.Group();
    this.scene.add(this.modelRootGroup);
    this.modificationGizmo.addToScene();

    // Cruise mode needs scene + model root
    this.cruiseModeCtrl.init(this.scene, this.modelRootGroup);
    this.alignmentMode.init(this.scene, this.modelRootGroup!, this.camera);
    this.alignmentMode.setContainerHeight(height);
    this.chamferMode.init(this.scene, this.camera);

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

    this.pointerController.attach(this.renderer.domElement);

    this.resizeHandler = () => {
      if (!this.containerEl || !this.camera || !this.renderer) return;
      const w = this.containerEl.clientWidth || window.innerWidth;
      const h = this.containerEl.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.modificationGizmo?.setContainerHeight(h);
      this.mirrorMode.setContainerHeight(h);
      this.alignmentMode.setContainerHeight(h);
    };
    window.addEventListener('resize', this.resizeHandler);

    this.animate();
  }

  unmount(): void {
    if (!this.scene || !this.renderer) return;

    this.modificationGizmo?.dispose();
    this.mirrorMode.dispose();
    this.cruiseModeCtrl.dispose();
    this.alignmentMode.dispose();
    this.chamferMode.dispose();
    this.viewCube?.dispose();

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.pointerController.detach(this.renderer.domElement);

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
    this.gridMode.dispose();

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

  private getSelectedObjects3D(): THREE.Object3D[] {
    if (!this.modelRootGroup) return [];
    const result: THREE.Object3D[] = [];
    for (const node of this.selectedNodes) {
      const obj = this.findObjectByNode(this.modelRootGroup, node);
      if (obj) result.push(obj);
    }
    return result;
  }

  // ─── Mirror mode ──────────────────────────────────────────────────────────

  setMirrorMode(active: boolean): void {
    this.mirrorMode.setActive(active, this.selectedObject3D);
  }

  isMirrorMode(): boolean {
    return this.mirrorMode.isActive();
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

    this.gridMode.updateLabel(this.camera);

    if (this.modificationGizmo?.getTarget()) {
      this.modificationGizmo.updatePositions();
    }
    this.mirrorMode.update();

    // Alignment markers for selected objects
    this.alignmentMode.update(this.getSelectedObjects3D());

    // Dashed projection of active object onto the grid
    this.gridMode.updateProjection(this.selectedObject3D);

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
      this.mirrorMode.syncWithSelection(null);
      return;
    }
    const first = this.selectedNodes[0];
    const obj = this.findObjectByNode(this.modelRootGroup, first);
    this.selectedObject3D = obj || null;
    if (obj && this.selectedNode) {
      // Don't show modification gizmo when alignment mode is active
      if (!this.alignmentMode.isActive() && !this.chamferMode.isActive()) {
        this.modificationGizmo.setTarget(obj, this.selectedNode as unknown as Parameters<ModificationGizmo['setTarget']>[1]);
      }
      this.mirrorMode.syncWithSelection(obj);
      // Apply glow to all selected objects
      for (const node of this.selectedNodes) {
        const selObj = this.findObjectByNode(this.modelRootGroup!, node);
        if (selObj) this.applySelectionGlow(selObj);
      }
    } else {
      this.modificationGizmo.clearTarget();
      this.mirrorMode.syncWithSelection(null);
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

    // Remap world handle direction to the best-matching local scale axis.
    // E.g. if object is rotated 90° around Y, world X handle should scale local Z.
    const remapAxis = (worldAxis: 'x' | 'y' | 'z'): 'x' | 'y' | 'z' => {
      const rot = params.rotation;
      if (!rot) return worldAxis;
      return remapAxisForRotatedGroup(rot, worldAxis);
    };

    // Helper: scale object along one axis using "before-after" AABB approach:
    // record the fixed face position, change scale, measure drift, compensate with position.
    const growDim = (
      delta: number,
      _geomKey: 'width' | 'height' | 'depth',
      scaleAxis: 'x' | 'y' | 'z',
      posAxis: 'x' | 'y' | 'z',
      posSign: number // +1 or -1: direction position shifts to keep opposite face fixed
    ) => {
      // For rotated groups, remap scale axis to best-matching local axis
      const effectiveScaleAxis = remapAxis(scaleAxis);

      if (this.selectedObject3D) {
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

        {
          const heightAxis = remapAxis('y');
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
          {
            const halfH = prim ? prim.getHalfHeight() : 0;
            hObj.position.set(p.x, (p.y ?? 0) + halfH, p.z);
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

    if (obj) {
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

  // ─── Debug: center marker ──────────────────────────────────────────────────

  private static readonly CENTER_MARKER_SCREEN_PX = 6;

  private updateCenterMarker(): void {
    if (!this.debugPanelVisible || !this.selectedObject3D || !this.scene || !this.camera) {
      if (this.centerMarker) {
        this.centerMarker.visible = false;
      }
      return;
    }

    const obj = this.selectedObject3D;
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);

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

    // Dynamic screen-space constant size
    const cam = this.camera as THREE.PerspectiveCamera;
    const fovRad = (cam.fov * Math.PI) / 180;
    const distance = center.distanceTo(cam.position);
    const viewportHeightWorld = 2 * distance * Math.tan(fovRad / 2);
    const containerH = this.renderer?.domElement.clientHeight ?? 800;
    const worldPerPixel = viewportHeightWorld / containerH;
    const radius = worldPerPixel * ConstructorSceneService.CENTER_MARKER_SCREEN_PX;

    this.centerMarker.visible = true;
    this.centerMarker.position.copy(center);
    this.centerMarker.scale.setScalar(radius);
  }

  // ─── Private: cruise mode delegates (PointerEventHost contract) ────────────

  private collectNeighborEdges(exclude: THREE.Object3D): { xs: number[]; zs: number[] } {
    return this.cruiseModeCtrl.collectNeighborEdges(exclude);
  }

  private applyCruiseSnap(
    target: THREE.Object3D,
    posX: number,
    posZ: number,
    neighborEdges: { xs: number[]; zs: number[] },
  ): { x: number; z: number; guideXs: number[]; guideZs: number[] } {
    return this.cruiseModeCtrl.applySnap(target, posX, posZ, neighborEdges);
  }

  private showCruiseGuides(xs: number[], zs: number[], y: number): void {
    this.cruiseModeCtrl.showGuides(xs, zs, y);
  }

  private clearCruiseGuides(): void {
    this.cruiseModeCtrl.clearGuides();
  }

}
