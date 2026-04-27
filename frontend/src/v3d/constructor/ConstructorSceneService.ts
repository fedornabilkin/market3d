import * as THREE from 'three';
import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { ModelApp } from './ModelApp';
import { ModelExporter } from './ModelExporter';
import type { ModelNode } from './nodes/ModelNode';
import { GroupNode } from './nodes/GroupNode';
import { Primitive } from './nodes/Primitive';
import { ImportedMeshNode } from './nodes/ImportedMeshNode';
import { ModificationGizmo, type HandleMesh } from './modes/ModificationGizmo';
import { ViewCubeNavigator } from './services/ViewCubeNavigator';
import { MirrorMode } from './modes/MirrorMode';
import { CruiseMode } from './modes/CruiseMode';
import { GridMode } from './modes/GridMode';
import { AlignmentMode } from './modes/AlignmentMode';
import { ChamferMode } from './modes/ChamferMode';
import { GeneratorMode } from './generators/GeneratorMode';
import {
  PointerEventController,
  type PointerEventHost,
  type HandleDragState,
} from './events/PointerEventController';
import { applyHoleStyle, removeHoleStyle } from './holeMaterial';
import { HandleDragController } from './events/HandleDragController';
import { computeHandleConstraintPlane as computeHandleConstraintPlaneFn } from './events/handleConstraintPlane';
import { bakeRotationIntoDimensions as bakeRotationOnDrag } from './events/bakeRotationOnDrag';
import { FeatureRenderer } from './features/rendering/FeatureRenderer';
import { FeatureDocument } from './features/FeatureDocument';
import {
  migrateLegacyTreeToDocument,
  type MigrationTrace,
} from './features/migration/migrateLegacyTree';
import {
  featureDocumentToLegacy,
  type InverseMigrationTrace,
} from './features/migration/featureDocumentToLegacy';
import type { FeatureDocumentJSON, FeatureId } from './features/types';
import type { ModelTreeJSON } from './types';
import { NodeFeatureMapping } from './services/NodeFeatureMapping';
import {
  getNodeHalfHeight,
  pairTrees,
  pairTreesByPosition,
  disposeObject3D,
  normalizeAngle,
} from './services/sceneObjectHelpers';
import { MirrorFeatureOperation } from './modes/MirrorFeatureOperation';
import {
  applySelectionGlow as applyGlow,
  clearSelectionGlow as clearGlow,
} from './services/SelectionHighlight';
import { YZeroIndicator } from './services/YZeroIndicator';

// Helpers `getNodeHalfHeight`, `pairTrees`, `normalizeAngle`, `disposeObject3D`
// вынесены в services/sceneObjectHelpers.ts — переиспользуются здесь и в режимах.

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
  /**
   * Primary selection callback — featureId, прочитанный с `userData.featureId`
   * (FeatureRenderer). Constructor.vue резолвит его в ModelNode для legacy UI.
   */
  onSelectFeatureFromScene?: (featureId: string, opts: { shift: boolean }) => void;
  /**
   * Legacy fallback — срабатывает только если на меше нет userData.featureId
   * (catastrophic fallback пути `buildNodeObject3D`).
   */
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
  /** Called when the user clicks an alignment marker (alignment mode). */
  onAlignMarkerClick?: (mode: string) => void;
  /** Primary marquee callback — featureIds. */
  onMarqueeSelectFeatures?: (featureIds: string[]) => void;
  /** Legacy fallback marquee callback — см. `onSelectNodeFromScene`. */
  onMarqueeSelect?: (nodes: ModelNode[]) => void;
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
  /**
   * Render-cutover (Phase 1.A): рендер сцены идёт через FeatureRenderer +
   * FeatureDocument, а не через старый buildNodeObject3D. ModelNode-tree
   * остаётся source-of-truth для мутаций (drag/handle/mirror/chamfer);
   * на каждом rebuild мы конвертируем его в FeatureDocument через
   * migrateLegacyTreeToDocument и протягиваем `userData.node` на меши,
   * чтобы PointerEventController/findObject3DByNode продолжали работать.
   */
  private featureRenderer: FeatureRenderer | null = null;
  private featureDocCurrent: FeatureDocument | null = null;
  /**
   * Двунаправленные карты featureId ↔ ModelNode (NodeFeatureMapping). Нужны
   * UI'ю (Feature Tree, FeatureParamsForm) и legacy mutation paths
   * (drag/handle/mirror) — пока flip не закрыт. После полного flip'а на
   * FeatureId-selection класс удалится.
   *
   * Заполняется на каждом rebuild через `setFromForwardTrace`
   * (legacy → v2) либо `setFromInverseTrace` (v2 → legacy на load-flip пути).
   */
  private readonly nodeFeatureMapping = new NodeFeatureMapping();
  /**
   * Когда true, следующий rebuildSceneFromTree пропустит ModelNode → migrate
   * → featureDoc цепочку и просто перепроставит mapping/userData по уже
   * корректному featureDoc (load-flip путь). Сбрасывается после rebuild'а.
   */
  private skipNextMigrate = false;

  // ─── Modes ────────────────────────────────────────────────────────────────
  private readonly mirrorMode = new MirrorMode();
  private readonly cruiseModeCtrl = new CruiseMode();
  private readonly gridMode = new GridMode();
  private readonly alignmentMode = new AlignmentMode();
  private readonly chamferMode = new ChamferMode();
  private readonly generatorMode = new GeneratorMode();

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
  private readonly yZeroIndicator = new YZeroIndicator();


  // ─── Scene settings (applied before mount or via setters) ──────────────���───
  private backgroundColor: number | string = 0xf0f0f0;
  private zoomSpeed = 1;

  private readonly exporter: ModelExporter;
  private readonly pointerController: PointerEventController;
  private readonly handleDrag: HandleDragController;

  constructor(
    private readonly modelApp: ModelApp,
    private readonly options: ConstructorSceneServiceOptions = {}
  ) {
    this.exporter = new ModelExporter(
      () => this.modelApp.getModelManager().getTree(),
      () => this.selectedNode,
    );
    this.pointerController = new PointerEventController(this._host);
    this.handleDrag = new HandleDragController(this as unknown as import('./events/HandleDragController').HandleDragHost);
  }

  /** Returns the export helper (STL/OBJ download). */
  getExporter(): ModelExporter {
    return this.exporter;
  }

  /** Captures a screenshot of the current scene as a data URL. */
  getScreenshotDataUrl(): string | null {
    if (!this.renderer) return null;
    return this.renderer.domElement.toDataURL('image/png');
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

  setGeneratorMode(active: boolean): void {
    this.generatorMode.setActive(active);
    if (this.modificationGizmo) {
      if (active) {
        this.modificationGizmo.clearTarget();
      } else {
        this.updateGizmoTarget();
      }
    }
  }

  getGeneratorMode(): GeneratorMode {
    return this.generatorMode;
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

  /**
   * Find Three.js object by feature-id.
   *
   * `FeatureRenderer.objectsByFeatureId` индексирует только rootIds, но
   * `userData.featureId` проставляется на КАЖДЫЙ вложенный mesh/group
   * (Transform/Box внутри root scene-group). Сначала спрашиваем кэш, при
   * промахе делаем traverse по сцене.
   */
  findObject3DByFeatureId(featureId: string): THREE.Object3D | null {
    const cached = this.featureRenderer?.getObject3D(featureId);
    if (cached) return cached;
    if (!this.modelRootGroup) return null;
    let found: THREE.Object3D | null = null;
    this.modelRootGroup.traverse((obj) => {
      if (found) return;
      if ((obj.userData as { featureId?: string }).featureId === featureId) {
        found = obj;
      }
    });
    return found;
  }

  /** Текущий FeatureDocument (заполняется на каждом rebuild). Для UI/debug. */
  getFeatureDocument(): FeatureDocument | null {
    return this.featureDocCurrent;
  }

  /** ModelNode, соответствующий feature-id (через trace последнего rebuild'а). */
  getModelNodeByFeatureId(featureId: string): ModelNode | null {
    return this.nodeFeatureMapping.getNode(featureId) ?? null;
  }

  /** Корневая (rootmost) feature-id для ModelNode. */
  getFeatureIdByNode(node: ModelNode): string | null {
    return this.nodeFeatureMapping.getFeatureId(node) ?? null;
  }

  /**
   * Live-апдейт transform у ноды через FeatureDocument.updateParamsLive
   * (без полной пересборки сцены). Caller обязан УЖЕ обновить
   * node.params.{position|rotation|scale} (legacy source-of-truth Phase 1).
   *
   * Если у ноды есть Transform-обёртка в featureDoc — точечно обновляет её
   * params, FeatureRenderer применит targeted-decompose к мешу.
   * Иначе (нода с тривиальными nodeParams — Transform ещё не создан) →
   * fallback на rebuildSceneFromTree, который создаст обёртку при следующем
   * проходе migrateLegacyTreeToDocument; последующие вызовы пойдут по
   * быстрому пути.
   */
  updateNodeTransformLive(
    node: ModelNode,
    patch: {
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: { x: number; y: number; z: number };
    },
  ): void {
    if (!this.applyLiveTransform(node, patch)) {
      this.rebuildSceneFromTree();
    }
  }

  /**
   * Batch live-update transform'ов нескольких нод (alignment / formation).
   * "Все или ничего": если у любой ноды нет Transform-обёртки в featureDoc,
   * делаем один полный rebuildSceneFromTree (он создаст недостающие обёртки).
   * Иначе — N точечных updateParamsLive подряд, без rebuild'а.
   *
   * Caller обязан УЖЕ обновить node.params (legacy source-of-truth).
   */
  batchUpdateNodeTransformsLive(
    updates: Array<{
      node: ModelNode;
      patch: {
        position?: { x: number; y: number; z: number };
        rotation?: { x: number; y: number; z: number };
        scale?: { x: number; y: number; z: number };
      };
    }>,
  ): void {
    for (const { node } of updates) {
      const featureId = this.nodeFeatureMapping.getFeatureId(node);
      const feature = featureId ? this.featureDocCurrent?.graph.get(featureId) : null;
      if (!feature || feature.type !== 'transform') {
        this.rebuildSceneFromTree();
        return;
      }
    }
    for (const { node, patch } of updates) {
      this.applyLiveTransform(node, patch);
    }
  }

  /**
   * Drag-frame путь: silent-sync `node.params.{position,rotation,scale}` →
   * featureDoc через updateParamsLive. Без rebuild-fallback'а — на drag-frame'ах
   * полный rebuild был бы катастрофически дорог. Если Transform-обёртки ещё
   * нет, no-op: featureDoc останется stale до `onAfterDrag`-rebuild'а, где
   * каноническая пересборка создаст обёртку и приведёт документ в соответствие.
   *
   * Сама сцена (three.js) во время драга обновляется напрямую в
   * HandleDragController через obj.position/rotation/scale, поэтому отсутствие
   * featureDoc-sync на frame'е не влияет на визуал.
   */
  syncNodeTransformLive(node: ModelNode): void {
    const params = node.params;
    if (!params) return;
    const patch: {
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: { x: number; y: number; z: number };
    } = {};
    if (params.position) patch.position = params.position;
    if (params.rotation) patch.rotation = params.rotation;
    if (params.scale) patch.scale = params.scale;
    this.applyLiveTransform(node, patch);
  }

  private applyLiveTransform(
    node: ModelNode,
    patch: {
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: { x: number; y: number; z: number };
    },
  ): boolean {
    const featureId = this.nodeFeatureMapping.getFeatureId(node);
    const feature = featureId ? this.featureDocCurrent?.graph.get(featureId) : null;
    if (!feature || feature.type !== 'transform') return false;
    const livePatch: Record<string, [number, number, number]> = {};
    if (patch.position) livePatch.position = [patch.position.x, patch.position.y, patch.position.z];
    if (patch.rotation) livePatch.rotation = [patch.rotation.x, patch.rotation.y, patch.rotation.z];
    if (patch.scale) livePatch.scale = [patch.scale.x, patch.scale.y, patch.scale.z];
    this.featureDocCurrent!.updateParamsLive(featureId!, livePatch);
    return true;
  }

  /**
   * Зеркалит ноду по оси axis с компенсацией визуального центра через
   * featureDoc API (`MirrorFeatureOperation`). Мутирует featureDoc через
   * updateParams, ModelNode-tree деривируется как side-effect.
   */
  applyMirror(node: ModelNode, axis: 'x' | 'y' | 'z'): void {
    const featureId = this.nodeFeatureMapping.getFeatureId(node);
    if (!featureId || !this.featureDocCurrent) {
      console.warn('[ConstructorSceneService.applyMirror] нет featureId mapping или featureDoc — операция пропущена');
      return;
    }
    const op = new MirrorFeatureOperation({
      findObject3DByFeatureId: (fid) => this.findObject3DByFeatureId(fid),
      rootGroup: this.modelRootGroup,
    });
    const serializer = this.modelApp.getSerializer();
    this.mutateFeatureDoc(
      (doc) => { op.run(doc, featureId, axis); },
      (legacyJson) => serializer.fromJSON(legacyJson),
    );
    // Selection re-resolve происходит на caller-стороне через computed
    // selectedNode/selectedNodes (FeatureId стабилен через rebuild).
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

    // Z-up конвенция (как у FreeCAD/SolidWorks/Fusion). Все Object3D с этого
    // момента считают +Z вертикалью; OrbitControls и lookAt() работают
    // относительно этого. Грид и геометрия примитивов соответственно
    // ориентированы в XY-плоскости.
    THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.backgroundColor as Parameters<THREE.Color['set']>[0]);
    this.yZeroIndicator.attach(this.scene);

    // Grid (лежит в XY, Z=0)
    this.gridMode.init(this.scene);

    // Camera — target the grid center so orbit feels natural even though world
    // origin now sits at the grid's left-front corner.
    const gridCenter = this.gridMode.getCenter();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    this.camera.up.set(0, 0, 1);
    // Камера смотрит вдоль +Y (фронтальный вид CAD): располагаем её в -Y от
    // сцены, слегка приподнятую по Z, без бокового сдвига.
    this.camera.position.set(gridCenter.x, gridCenter.y - 300, gridCenter.z + 100);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(this.renderer.domElement);

    // Lights — направленный свет сверху (по +Z) и немного сбоку.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 5, 10);
    this.scene.add(dir);

    // Controls — right-click rotates, left-click is used for selection/drag
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.mouseButtons.LEFT = null as unknown as MOUSE;
    this.controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
    this.controls.mouseButtons.RIGHT = MOUSE.ROTATE;
    this.controls.zoomSpeed = this.zoomSpeed;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 2000;
    this.controls.target.copy(gridCenter);
    this.controls.update();
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

    // Render-cutover: FeatureRenderer пишет меши в modelRootGroup.
    this.featureRenderer = new FeatureRenderer(this.modelRootGroup);

    // Cruise mode needs scene + model root
    this.cruiseModeCtrl.init(this.scene, this.modelRootGroup);
    this.alignmentMode.init(this.scene, this.modelRootGroup!, this.camera);
    this.alignmentMode.setContainerHeight(height);
    this.chamferMode.init(this.scene, this.camera);
    this.generatorMode.init(this.scene);

    // View cube navigator
    this.viewCube = new ViewCubeNavigator();

    this.rebuildSceneFromTree();

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
    this.generatorMode.dispose();
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
    this.yZeroIndicator.detach();
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

  /**
   * Render-cutover: пересобираем сцену через FeatureRenderer.
   *
   * Два режима, выбираемых флагом `skipNextMigrate`:
   *
   * 1. **Legacy (ModelNode primary)** — поведение по умолчанию:
   *    ```
   *    ModelNode-tree → toRootJSON → migrate → FeatureDocumentJSON v2
   *      → loadFromJSON в stable featureDoc
   *      → FeatureRenderer.bindDocument реактивно обновит scene
   *      → mapping featureId↔ModelNode через MigrationTrace
   *    ```
   *
   * 2. **Load-flip (FeatureDoc primary)** — после `loadFromV2JSON`:
   *    featureDoc уже корректный, ModelNode-tree уже derived. Достаточно
   *    обновить mapping/userData по inverse-trace, не пересобирая featureDoc.
   *    Это позволяет featureId выживать load (mirror/chamfer/etc. flips
   *    могут полагаться на стабильные id'шники).
   */
  rebuildSceneFromTree(): void {
    if (!this.modelRootGroup || !this.featureRenderer) return;

    const rootVal = this.modelApp.getModelManager().getTree();
    if (!rootVal) {
      this.featureRenderer.unbindDocument();
      this.featureDocCurrent = null;
      this.nodeFeatureMapping.clear();
      this.skipNextMigrate = false;
      this.updateGizmoTarget();
      return;
    }

    if (this.skipNextMigrate && this.featureDocCurrent) {
      this.skipNextMigrate = false;
      try {
        this._rebuildFromCurrentFeatureDoc(rootVal);
        this.updateGizmoTarget();
        return;
      } catch (e) {
        console.warn('[ConstructorSceneService] feature-doc rebuild failed, falling back to legacy migrate:', e);
        // Падает в legacy путь.
      }
    }

    try {
      this._rebuildFromModelTree(rootVal);
    } catch (e) {
      console.warn('[ConstructorSceneService] FeatureRenderer rebuild failed; falling back to legacy build:', e);
      this._rebuildLegacyFallback();
    }

    this.updateGizmoTarget();
  }

  /**
   * Legacy путь: ModelNode-tree → migrate → featureDoc → mapping. Дефолтное
   * поведение, не ломает ни одно существующее место.
   */
  private _rebuildFromModelTree(rootVal: ModelNode): void {
    const serializer = this.modelApp.getSerializer();
    const json = serializer.toRootJSON(rootVal);

    const jsonToNode = new Map<ModelTreeJSON, ModelNode>();
    pairTrees(json, rootVal, jsonToNode);

    const trace: MigrationTrace = new Map();
    const v2 = migrateLegacyTreeToDocument(json, trace);

    this._injectImportedGeometriesFromTrace(v2, trace, jsonToNode);
    this._ensureFeatureDocBound();
    this.featureDocCurrent!.loadFromJSON(v2);
    (window as unknown as { __featureDoc?: FeatureDocument }).__featureDoc = this.featureDocCurrent!;

    this.nodeFeatureMapping.setFromForwardTrace(v2, trace, jsonToNode);
    this._propagateUserDataNode(trace, jsonToNode);
  }

  /**
   * Load-flip путь: featureDoc уже актуален (loadFromV2JSON только что его
   * заполнил), ModelNode-tree derived через featureDocumentToLegacy. Делаем
   * inverse parallel walk и обновляем mapping/userData без re-migrate.
   */
  private _rebuildFromCurrentFeatureDoc(rootVal: ModelNode): void {
    const v2 = this.featureDocCurrent!.toJSON();
    const inverseTrace: InverseMigrationTrace = new Map();
    // Re-run featureDocumentToLegacy с trace, чтобы получить
    // featureId → ModelTreeJSON соответствие. Сам ModelTreeJSON выбрасываем —
    // ModelNode-tree уже построен в `loadFromV2JSON` из этого же v2.
    featureDocumentToLegacy(v2, inverseTrace);

    // Параллельный walk: derived ModelNode-tree ↔ legacyJson.
    // Для consistency сериализуем текущий ModelNode-tree (toRootJSON) — это
    // даёт нам ModelTreeJSON-структуру, идентичную inverseTrace.values()
    // ПОЗИЦИОННО (потому что featureDocumentToLegacy и Serializer.toRootJSON
    // сохраняют порядок детей одинаково для документов, прошедших round-trip).
    const serializer = this.modelApp.getSerializer();
    const legacyJsonFromTree = serializer.toRootJSON(rootVal);
    const jsonToNode = new Map<ModelTreeJSON, ModelNode>();
    pairTrees(legacyJsonFromTree, rootVal, jsonToNode);

    // inverseTrace.values() и legacyJsonFromTree — два разных JSON-объекта
    // одной структуры. Чтобы получить featureId → ModelNode, надо
    // ассоциировать ModelTreeJSON inverseTrace с ModelTreeJSON legacyJsonFromTree
    // позиционно. Делаем это через walk обоих деревьев параллельно.
    const inverseJsonToTreeJson = new Map<ModelTreeJSON, ModelTreeJSON>();
    {
      const inverseRoot = inverseTrace.get(v2.rootIds[0]);
      if (inverseRoot) pairTreesByPosition(inverseRoot, legacyJsonFromTree, inverseJsonToTreeJson);
    }
    // featureId (через inverseTrace) → inverseJson → treeJson → ModelNode.
    const flatTrace = new Map<FeatureId, ModelTreeJSON>();
    for (const [fid, inverseJson] of inverseTrace) {
      const treeJson = inverseJsonToTreeJson.get(inverseJson);
      if (treeJson) flatTrace.set(fid, treeJson);
    }

    this.nodeFeatureMapping.setFromInverseTrace(v2, flatTrace, jsonToNode);
    this._propagateUserDataNode(flatTrace, jsonToNode);
  }

  /**
   * Catastrophic fallback: пересобираем сцену через legacy `buildNodeObject3D`,
   * минуя FeatureRenderer. Срабатывает только если migrate упал — это
   * означает баг в feature-tree модели, но user не теряет сцену.
   */
  private _rebuildLegacyFallback(): void {
    if (!this.modelRootGroup || !this.featureRenderer) return;
    this.featureRenderer.unbindDocument();
    this.featureDocCurrent = null;
    this.nodeFeatureMapping.clear();
    disposeObject3D(this.modelRootGroup);
    while (this.modelRootGroup.children.length) {
      this.modelRootGroup.remove(this.modelRootGroup.children[0]);
    }
    const root = this.modelApp.getModelManager().getTree();
    if (root) this.modelRootGroup.add(this.buildNodeObject3D(root, true));
  }

  private _ensureFeatureDocBound(): void {
    if (!this.featureRenderer) return;
    if (!this.featureDocCurrent) {
      this.featureDocCurrent = new FeatureDocument();
      this.featureRenderer.bindDocument(this.featureDocCurrent);
    }
  }

  private _injectImportedGeometriesFromTrace(
    v2: FeatureDocumentJSON,
    trace: MigrationTrace,
    jsonToNode: ReadonlyMap<ModelTreeJSON, ModelNode>,
  ): void {
    for (const f of v2.features) {
      if (f.type !== 'imported') continue;
      const sourceJson = trace.get(f.id);
      if (!sourceJson) continue;
      const node = jsonToNode.get(sourceJson);
      if (node instanceof ImportedMeshNode && node.geometry) {
        (f.params as Record<string, unknown>).geometry = node.geometry;
      }
    }
  }

  private _propagateUserDataNode(
    trace: ReadonlyMap<FeatureId, ModelTreeJSON>,
    jsonToNode: ReadonlyMap<ModelTreeJSON, ModelNode>,
  ): void {
    if (!this.modelRootGroup) return;
    this.modelRootGroup.traverse((obj) => {
      const featureId = (obj.userData as { featureId?: FeatureId }).featureId;
      if (!featureId) return;
      const sourceJson = trace.get(featureId);
      if (!sourceJson) return;
      const node = jsonToNode.get(sourceJson);
      if (!node) return;
      obj.userData.node = node;
      node.setUuid(obj.uuid);
    });
  }

  /**
   * **Load-flip API**: загружает FeatureDocumentJSON v2 напрямую в featureDoc,
   * минуя ModelNode-round-trip. ModelNode-tree деривируется через
   * `featureDocumentToLegacy` для legacy mutation paths (drag/handle/mirror,
   * пока flip не закрыт).
   *
   * Дальнейший `rebuildSceneFromTree` пропустит migrate-шаг (skipNextMigrate
   * флаг), сохранив featureId'шки v2-документа — это критично для
   * mirror/chamfer/etc. flip'ов, где caller добавляет фичи в featureDoc и
   * полагается на их id.
   *
   * Caller должен передать v2 со всеми резолвенными бинарниками (geometry в
   * params для imported-фич). См. `loader/loadFeatureDocument` для async-варианта.
   */
  loadFromV2JSON(v2: FeatureDocumentJSON, deriveModelTree: (legacyJson: ModelTreeJSON) => ModelNode): void {
    if (!this.featureRenderer) {
      throw new Error('[ConstructorSceneService.loadFromV2JSON] не примонтировано');
    }
    this._ensureFeatureDocBound();
    this.featureDocCurrent!.loadFromJSON(v2);
    (window as unknown as { __featureDoc?: FeatureDocument }).__featureDoc = this.featureDocCurrent!;

    // Derive ModelNode-tree из v2 → legacyJson → caller fromJSON.
    const legacyJson = featureDocumentToLegacy(v2);
    const newRoot = deriveModelTree(legacyJson);
    this.modelApp.getModelManager().setTree(newRoot);

    // Следующий rebuild пропустит migrate (см. _rebuildFromCurrentFeatureDoc).
    this.skipNextMigrate = true;
    this.rebuildSceneFromTree();
  }

  /**
   * **Mutation flip API** (Template Method): обёртка для операций, мутирующих
   * featureDoc напрямую (mirror/merge/chamfer/generator после flip'а). Делает:
   *
   *  1. Запускает `mutate()` — caller вызывает featureDoc.addFeature/
   *     updateParams/updateInputs/setRootIds. featureRenderer реактивно
   *     обновит сцену через подписку.
   *  2. Derive ModelNode-tree из новой версии featureDoc (через
   *     featureDocumentToLegacy + caller `deriveModelTree`) — нужен legacy
   *     mutation paths (drag/handle/applyMirror в их текущем виде).
   *  3. Помечает skipNextMigrate = true и вызывает rebuildSceneFromTree —
   *     тот пройдёт inverse-mapping путь, не теряя featureId'шек после
   *     мутации.
   *
   * Caller отвечает только за featureDoc-мутацию и за фабрику ModelNode'а из
   * legacyJson (обычно `serializer.fromJSON`). Ни featureDoc, ни ModelNode-tree
   * напрямую не трогает.
   */
  mutateFeatureDoc(
    mutate: (doc: FeatureDocument) => void,
    deriveModelTree: (legacyJson: ModelTreeJSON) => ModelNode,
  ): void {
    if (!this.featureDocCurrent) {
      throw new Error('[ConstructorSceneService.mutateFeatureDoc] featureDoc не инициализирован — вызовите rebuildSceneFromTree до первой мутации');
    }
    mutate(this.featureDocCurrent);
    const v2 = this.featureDocCurrent.toJSON();
    const legacyJson = featureDocumentToLegacy(v2);
    const newRoot = deriveModelTree(legacyJson);
    this.modelApp.getModelManager().setTree(newRoot);
    this.skipNextMigrate = true;
    this.rebuildSceneFromTree();
  }

  /**
   * Appends a single node to the live scene.
   *
   * До render-cutover это был быстрый incremental-апдейт: добавить меш в
   * корневой THREE.Group без перестройки существующих. После cutover'а
   * сцена строится FeatureRenderer'ом из FeatureDocument — incremental
   * добавление потребовало бы поддержания featureId↔ModelNode инкрементально,
   * что хрупко. Делаем полный rebuild — он O(N) от размера сцены, но
   * вызывается только на addPrimitive (не на drag/handle), так что заметной
   * деградации нет.
   */
  appendNodeToScene(node: ModelNode): void {
    void node;
    this.rebuildSceneFromTree();
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

    // Soft shadows for non-selected objects
    this.gridMode.updateShadows(this.getSelectableMeshes(), this.selectedObject3D);

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
      // EdgesGeometry на плотной STL блокирует UI (проход по всем граням с порогом
      // угла). Для импортированных мешей обводку не строим.
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
      // Рантайм без CSG для простого union без hole-детей (mergeSelected двух
      // STL и т.п.). CSG применяется только на экспорте (ModelExporter) и тем
      // non-root группам, где visual без CSG был бы неверным: subtract/intersect
      // или наличие hole-детей (чамфер).
      const hasHoleChild = node.children.some((c) => !!c.params?.isHole);
      const renderAsContainer = isRoot || (node.operation === 'union' && !hasHoleChild);

      if (renderAsContainer) {
        const group = new THREE.Group();
        node.setUuid(group.uuid);
        group.userData.node = node;
        // Маркер для PointerEventController: клик по любому потомку выделяет
        // эту группу целиком (как было с CSG-мешом), а не отдельный child-меш.
        if (!isRoot) group.userData.selectAsUnit = true;
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
        // Hole-группа: обводим зеброй/прозрачностью все меши внутри — CSG не
        // применяем, но визуальный сигнал «вычитается» сохраняется.
        if (!isRoot && node.params?.isHole) {
          group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              applyHoleStyle(child.material as THREE.MeshPhongMaterial);
            }
          });
        }
        return group;
      }
      // Non-root group c CSG: subtract/intersect или есть hole-дети (чамфер).
      const mesh = node.getMesh();
      node.setUuid(mesh.uuid);
      mesh.userData.node = node;
      ConstructorSceneService.addEdgeLines(mesh);
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

  /** Снимает emissive-glow с мешей всех заданных нод (если найдены). */
  private clearSelectionGlow(nodes: ModelNode[]): void {
    if (!this.modelRootGroup) return;
    for (const node of nodes) {
      const obj = this.findObjectByNode(this.modelRootGroup, node);
      if (obj) clearGlow(obj);
    }
  }

  /** Применяет emissive-glow ко всем мешам в obj. */
  private applySelectionGlow(obj: THREE.Object3D): void {
    applyGlow(obj);
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
    // Локальный трансформ edge-lines — identity, меняется только матрица родителя.
    lines.matrixAutoUpdate = false;
    lines.updateMatrix();
    mesh.add(lines);
  }

  private updatePrimitiveGeometryInPlace(prim: Primitive, mesh: THREE.Mesh): void {
    const oldGeo = mesh.geometry;
    mesh.geometry = prim.createGeometry();
    oldGeo.dispose();

    // Z-up: params.position.z — нижняя грань; halfHeight по Z даёт центр меша.
    const halfH = prim.getHalfHeight();
    const p = prim.params.position ?? { x: 0, y: 0, z: 0 };
    mesh.position.set(p.x, p.y, (p.z ?? 0) + halfH);

    // Update edge lines
    ConstructorSceneService.addEdgeLines(mesh);
  }

  /**
   * Applies a delta from a handle drag. Реализация — в `HandleDragController`
   * (`events/HandleDragController.ts`). Здесь — тонкий делегатор для
   * совместимости с `PointerEventHost` интерфейсом.
   */
  private applyHandleDragDelta(
    node: ModelNode | null,
    handleType: string,
    dx: number,
    dy: number,
  ): void {
    this.handleDrag.applyDragDelta(node, handleType, dx, dy);
  }

  /**
   * После rotation-drag'а: бейкаем rotation в размеры (для box при 90°).
   * Реализация — в `events/bakeRotationOnDrag.ts`.
   */
  private bakeRotationIntoDimensions(node: ModelNode): void {
    bakeRotationOnDrag(node, {
      selectedObject3D: this.selectedObject3D,
      updatePrimitiveGeometryInPlace: (prim, mesh) => this.updatePrimitiveGeometryInPlace(prim, mesh),
      updateGizmoTarget: () => this.updateGizmoTarget(),
      options: this.options,
    });
  }

  // ─── Public: keyboard movement ──────────────────────────────────

  /**
   * Moves the selected node by the snap step relative to camera orientation.
   * direction: 'left' | 'right' | 'forward' | 'backward' — горизонтальная XY-плоскость (Z-up),
   *            'up' | 'down' — вертикаль по Z.
   */
  moveSelectedByKey(
    direction: 'left' | 'right' | 'forward' | 'backward' | 'up' | 'down',
    multiplier: number = 1
  ): void {
    const node = this.selectedNode;
    if (!node) return;
    node.params = node.params || {};
    node.params.position = node.params.position || { x: 0, y: 0, z: 0 };
    const baseStep = this.snapStep > 0 ? this.snapStep : 1;
    const step = baseStep * (multiplier > 0 ? multiplier : 1);
    const p = node.params.position;

    if (direction === 'up' || direction === 'down') {
      p.z = (p.z ?? 0) + step * (direction === 'up' ? 1 : -1);
      p.z = Math.round(p.z / step) * step;
    } else {
      // Camera-relative направление, snapped к доминантной оси в XY-плоскости.
      const camDir = new THREE.Vector3();
      this.camera!.getWorldDirection(camDir);
      camDir.z = 0;
      camDir.normalize();
      const camRight = new THREE.Vector3();
      camRight.crossVectors(camDir, new THREE.Vector3(0, 0, 1)).normalize();

      let moveDir: THREE.Vector3;
      switch (direction) {
        case 'forward':  moveDir = camDir.clone(); break;
        case 'backward': moveDir = camDir.clone().negate(); break;
        case 'right':    moveDir = camRight.clone(); break;
        case 'left':     moveDir = camRight.clone().negate(); break;
      }

      // Snap left/front face to grid вместо центра — odd-sized объекты держат
      // видимую грань на сетке.
      const objForBox = this.selectedObject3D;
      const bbox = objForBox ? new THREE.Box3().setFromObject(objForBox) : null;
      const offMinX = bbox && objForBox ? bbox.min.x - objForBox.position.x : 0;
      const offMinY = bbox && objForBox ? bbox.min.y - objForBox.position.y : 0;

      if (Math.abs(moveDir.x) >= Math.abs(moveDir.y)) {
        p.x = (p.x ?? 0) + Math.sign(moveDir.x) * step;
        p.x = Math.round((p.x + offMinX) / step) * step - offMinX;
      } else {
        p.y = (p.y ?? 0) + Math.sign(moveDir.y) * step;
        p.y = Math.round((p.y + offMinY) / step) * step - offMinY;
      }
    }

    // Update mesh
    const obj = this.selectedObject3D;
    if (obj) {
      const halfH = getNodeHalfHeight(node);
      obj.position.set(p.x, p.y, (p.z ?? 0) + halfH);
    }

    // Синхронизируем featureDoc — иначе любая последующая mutateFeatureDoc
    // (merge/mirror/etc.) перепишет ModelNode-tree из stale featureDoc
    // и keyboard-move будет потерян.
    this.syncNodeTransformLive(node);
    this.showYZeroIndicatorIfNeeded(node);
    this.options.onNodeParamsChanged?.(node);
  }

  /**
   * Constraint-плоскость для handle-drag'а. Реализация — в
   * `events/handleConstraintPlane.ts`.
   */
  private computeHandleConstraintPlane(handleType: string): ReturnType<typeof computeHandleConstraintPlaneFn> {
    return computeHandleConstraintPlaneFn(handleType, {
      selectedObject3D: this.selectedObject3D,
      camera: this.camera,
    });
  }

  // ─── Private: Y=0 indicator ───────────────────────────────────
  // Логика и lifecycle самого индикатора живут в `services/YZeroIndicator.ts`.
  // Здесь — мост: компьютим world-AABB ноды и передаём в YZeroIndicator.

  private showYZeroIndicatorIfNeeded(node: ModelNode): void {
    const obj = this.modelRootGroup ? this.findObjectByNode(this.modelRootGroup, node) : null;
    const box = obj ? new THREE.Box3().setFromObject(obj) : null;
    this.yZeroIndicator.showIfOnGrid(box);
  }

  private hideYZeroIndicator(): void {
    this.yZeroIndicator.hide();
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
