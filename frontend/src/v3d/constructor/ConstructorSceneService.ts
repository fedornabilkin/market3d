import * as THREE from 'three';
import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelExporter } from './ModelExporter';
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
import { HandleDragController } from './events/HandleDragController';
import { computeHandleConstraintPlane as computeHandleConstraintPlaneFn } from './events/handleConstraintPlane';
import { bakeRotationIntoDimensions as bakeRotationOnDrag } from './events/bakeRotationOnDrag';
import { FeatureRenderer } from './features/rendering/FeatureRenderer';
import { FeatureDocument } from './features/FeatureDocument';
import { TransformFeature } from './features/composite/TransformFeature';
import type { FeatureDocumentJSON, FeatureId } from './features/types';
import { disposeObject3D } from './services/sceneObjectHelpers';
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
  /** Called when the user clicks empty space (grid) — deselect all. */
  onDeselectAll?: () => void;
  /** Called every ~30 frames with scene diagnostic data. */
  onDebugInfoUpdate?: (info: SceneDebugInfo) => void;
  /** Called when an object's transform / geometry params change due to drag. */
  onNodeParamsChanged?: () => void;
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
  /**
   * Фабрика ModelNode-tree из legacyJson — нужна `mutateFeatureDoc` /
   * `loadFromV2JSON` для derive ModelNode'а как side-effect (legacy-консьюмеры:
   * selection ModelNode-вид, debug панель). Caller передаёт один раз при init.
   * После полного удаления nodes/ слоя (Step E) — будет удалена.
   */
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
  private featureRendererBoundDoc: FeatureDocument | null = null;
  private readonly renderBindings = new Map<FeatureDocument, {
    group: THREE.Group;
    renderer: FeatureRenderer;
  }>();
  private activeRenderGroup: THREE.Group | null = null;
  /**
   * Двунаправленные карты featureId ↔ ModelNode (NodeFeatureMapping). Нужны
   * UI'ю (Feature Tree, FeatureParamsForm) и legacy mutation paths
   * (drag/handle/mirror) — пока flip не закрыт. После полного flip'а на
   * FeatureId-selection класс удалится.
   *
   * Заполняется на каждом rebuild через `setFromForwardTrace`
   * (legacy → v2) либо `setFromInverseTrace` (v2 → legacy на load-flip пути).
   */
  /**
   * Когда true, следующий rebuildSceneFromTree пропустит ModelNode → migrate
   * → featureDoc цепочку и просто перепроставит mapping/userData по уже
   * корректному featureDoc (load-flip путь). Сбрасывается после rebuild'а.
   */

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
  /** Featured-id выделенных объектов (primary) и rootmost первичный. */
  private selectedFeatureIds: FeatureId[] = [];
  private selectedFeatureIdPrimary: FeatureId | null = null;
  private selectedObject3D: THREE.Object3D | null = null;
  private selectableMeshesCache: { version: number; meshes: THREE.Mesh[] } | null = null;

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
    initialDocument?: FeatureDocument,
    private readonly options: ConstructorSceneServiceOptions = {}
  ) {
    this.featureDocCurrent = initialDocument ?? new FeatureDocument();
    this.exporter = new ModelExporter(
      () => this.featureDocCurrent,
      () => this.selectedFeatureIdPrimary,
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

  /** Корневая (rootmost) feature-id для ModelNode. */

  /**
   * Зеркалит ноду по оси axis с компенсацией визуального центра через
   * featureDoc API (`MirrorFeatureOperation`). Мутирует featureDoc через
   * updateParams, ModelNode-tree деривируется как side-effect.
   */
  applyMirror(featureId: FeatureId | null, axis: 'x' | 'y' | 'z'): void {
    if (!featureId || !this.featureDocCurrent) {
      console.warn('[ConstructorSceneService.applyMirror] нет featureId или featureDoc — операция пропущена');
      return;
    }
    const op = new MirrorFeatureOperation({
      findObject3DByFeatureId: (fid) => this.findObject3DByFeatureId(fid),
      rootGroup: this.modelRootGroup,
    });
    this.mutateFeatureDoc((doc) => { op.run(doc, featureId, axis); });
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
    (this.controls as unknown as { enableKeys?: boolean }).enableKeys = false;

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
    // После P2-flip'а тип/параметры примитива берутся из FeatureDocument по
    // featureId (userData.node больше нет). Без этого цилиндр детектился как box
    // и круговой обод торца не находился.
    this.chamferMode.getFeatureInfo = (featureId) => {
      const f = this.featureDocCurrent?.graph.get(featureId);
      if (!f) return null;
      return { type: f.type, params: f.params as Record<string, number> };
    };
    this.generatorMode.init(this.scene);

    // View cube navigator
    this.viewCube = new ViewCubeNavigator();

    this._ensureFeatureDocBound();
    if (this.featureDocCurrent && this.featureDocCurrent.rootIds.length === 0) {
      this.featureDocCurrent.loadFromJSON({
        version: 2,
        features: [{ id: 'root', type: 'group', params: {}, inputs: [], name: 'Scene' }],
        rootIds: ['root'],
      });
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

    for (const binding of this.renderBindings.values()) {
      binding.group.removeFromParent();
      binding.renderer.dispose();
    }
    this.renderBindings.clear();
    this.activeRenderGroup = null;
    this.featureRenderer = null;

    // Dispose all remaining model meshes before clearing
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
    this.featureRendererBoundDoc = null;
  }

  // ─── Scene management ──────────────────────────────────────────────────────

  setSelection(featureIds: readonly FeatureId[], primaryId: FeatureId | null): void {
    const prev = this.selectedFeatureIds;
    this.selectedFeatureIds = featureIds.length ? [...featureIds] : [];
    this.selectedFeatureIdPrimary = primaryId;
    this.updateGizmoTarget(prev);
  }

  private getSelectedObjects3D(): THREE.Object3D[] {
    const result: THREE.Object3D[] = [];
    for (const fid of this.selectedFeatureIds) {
      const obj = this.findObject3DByFeatureId(fid);
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

  rebuildSceneFromTree(): void {
    if (!this.modelRootGroup || !this.featureRenderer || !this.featureDocCurrent) return;
    this._ensureFeatureDocBound();
    this.featureDocCurrent.loadFromJSON(this.featureDocCurrent.toJSON());
    this.updateGizmoTarget();
  }

  private _ensureFeatureDocBound(): void {
    if (!this.modelRootGroup) return;
    if (!this.featureDocCurrent) {
      this.featureDocCurrent = new FeatureDocument();
    }
    if (this.featureRendererBoundDoc === this.featureDocCurrent) return;

    if (this.activeRenderGroup) this.modelRootGroup.remove(this.activeRenderGroup);
    let binding = this.renderBindings.get(this.featureDocCurrent);
    if (!binding) {
      const group = new THREE.Group();
      const renderer = new FeatureRenderer(group);
      renderer.bindDocument(this.featureDocCurrent);
      binding = { group, renderer };
      this.renderBindings.set(this.featureDocCurrent, binding);
    }
    this.modelRootGroup.add(binding.group);
    this.activeRenderGroup = binding.group;
    this.featureRenderer = binding.renderer;
    this.featureRendererBoundDoc = this.featureDocCurrent;
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
  loadFromV2JSON(v2: FeatureDocumentJSON): void {
    if (!this.featureRenderer) {
      throw new Error('[ConstructorSceneService.loadFromV2JSON] не примонтировано');
    }
    this._ensureFeatureDocBound();
    this.featureDocCurrent!.loadFromJSON(v2);
    (window as unknown as { __featureDoc?: FeatureDocument }).__featureDoc = this.featureDocCurrent!;
    this.updateGizmoTarget();
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
  mutateFeatureDoc(mutate: (doc: FeatureDocument) => void): void {
    if (!this.featureDocCurrent) {
      throw new Error('[ConstructorSceneService.mutateFeatureDoc] featureDoc не инициализирован — вызовите rebuildSceneFromTree до первой мутации');
    }
    this.featureDocCurrent.batchMutate(() => mutate(this.featureDocCurrent!));
    this.updateGizmoTarget();
  }

  /**
   * Синхронизирует текущий FeatureDocument в derived ModelNode-tree и
   * пересобирает mapping/userData без обратной миграции ModelNode → featureDoc.
   * Используется после undo/redo и live-drag commit'ов, где FeatureDocument уже
   * является источником истины.
   */
  syncCurrentFeatureDocToModelTree(): void {
    if (!this.featureDocCurrent) return;
    this.rebuildSceneFromTree();
  }

  commitSelectedFeatureChanges(): void {
    if (!this.featureDocCurrent || !this.selectedFeatureIdPrimary) return;
    this.featureDocCurrent.recomputeFrom([this.selectedFeatureIdPrimary]);
    this.updateGizmoTarget();
  }

  /**
   * Activates an already evaluated document without serializing and recomputing it.
   * Used by scene slots so returning to an in-memory scene only rebuilds Three.js
   * objects from cached feature outputs.
   */
  replaceFeatureDocument(document: FeatureDocument): void {
    if (!this.featureRenderer) {
      throw new Error('[ConstructorSceneService.replaceFeatureDocument] не примонтировано');
    }
    if (this.featureDocCurrent === document && this.featureRendererBoundDoc === document) return;
    this.featureDocCurrent = document;
    this._ensureFeatureDocBound();
    (window as unknown as { __featureDoc?: FeatureDocument }).__featureDoc = document;
    this.updateGizmoTarget();
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

    // Soft shadows are static enough during drag; recomputing Box3 for every object each frame is expensive.
    if (!this.isPlaneDragging && !this.isHandleDragging) {
      this.gridMode.updateShadows(this.getSelectableMeshes(), this.selectedObject3D);
    }

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

  private getSelectableMeshes(): THREE.Mesh[] {
    const version = this.featureRenderer?.getRenderVersion() ?? 0;
    if (this.selectableMeshesCache?.version === version) {
      return this.selectableMeshesCache.meshes;
    }
    const meshes: THREE.Mesh[] = [];
    if (!this.modelRootGroup) return meshes;
    this.modelRootGroup.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.userData as { featureId?: unknown }).featureId) meshes.push(o);
    });
    this.selectableMeshesCache = { version, meshes };
    return meshes;
  }

  /** Применяет emissive-glow ко всем мешам в obj. */
  private applySelectionGlow(obj: THREE.Object3D): void {
    applyGlow(obj);
  }

  private updateGizmoTarget(prevIds?: readonly FeatureId[]): void {
    if (!this.modificationGizmo || !this.modelRootGroup) return;

    // Clear glow from previous selection
    this.clearSelectionGlowByIds(prevIds ?? this.selectedFeatureIds);

    if (this.selectedFeatureIds.length === 0) {
      this.selectedObject3D = null;
      this.modificationGizmo.clearTarget();
      this.mirrorMode.syncWithSelection(null);
      return;
    }
    const firstId = this.selectedFeatureIds[0];
    const obj = this.findObject3DByFeatureId(firstId);
    this.selectedObject3D = obj || null;
    if (obj && this.selectedFeatureIdPrimary) {
      // Don't show modification gizmo when alignment mode is active
      if (!this.alignmentMode.isActive() && !this.chamferMode.isActive()) {
        this.modificationGizmo.setTarget(obj, this.selectedFeatureIdPrimary);
      }
      this.mirrorMode.syncWithSelection(obj);
      // Apply glow to all selected objects
      for (const fid of this.selectedFeatureIds) {
        const selObj = this.findObject3DByFeatureId(fid);
        if (selObj) this.applySelectionGlow(selObj);
      }
    } else {
      this.modificationGizmo.clearTarget();
      this.mirrorMode.syncWithSelection(null);
    }
  }

  private clearSelectionGlowByIds(ids: readonly FeatureId[]): void {
    for (const fid of ids) {
      const obj = this.findObject3DByFeatureId(fid);
      if (obj) clearGlow(obj);
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

  private applyHandleDragDelta(
    featureId: string | null,
    handleType: string,
    dx: number,
    dy: number,
  ): void {
    this.handleDrag.applyDragDelta(featureId, handleType, dx, dy);
  }

  /**
   * После rotation-drag'а: бейкаем rotation в размеры (для box при 90°).
   * Реализация — в `events/bakeRotationOnDrag.ts`.
   */
  private bakeRotationIntoDimensions(featureId: string | null): void {
    if (!featureId || !this.featureDocCurrent) return;
    bakeRotationOnDrag(featureId, this.featureDocCurrent, {
      selectedObject3D: this.selectedObject3D,
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
    const featureId = this.selectedFeatureIdPrimary;
    if (!featureId || !this.featureDocCurrent) return;
    const transform = this.featureDocCurrent.graph.get(featureId);
    if (!(transform instanceof TransformFeature)) return;

    // Scratch position-копия из Transform.params (tuple → {x,y,z}).
    const tp = transform.params;
    const p = { x: tp.position[0], y: tp.position[1], z: tp.position[2] };

    const baseStep = this.snapStep > 0 ? this.snapStep : 1;
    const step = baseStep * (multiplier > 0 ? multiplier : 1);

    if (direction === 'up' || direction === 'down') {
      p.z += step * (direction === 'up' ? 1 : -1);
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
        p.x += Math.sign(moveDir.x) * step;
        p.x = Math.round((p.x + offMinX) / step) * step - offMinX;
      } else {
        p.y += Math.sign(moveDir.y) * step;
        p.y = Math.round((p.y + offMinY) / step) * step - offMinY;
      }
    }

    // Mutate Transform.params через featureDoc — FeatureRenderer обновит mesh.
    this.featureDocCurrent.updateParamsLive(featureId, {
      position: [p.x, p.y, p.z],
    });

    this.showYZeroIndicatorIfNeeded(featureId);
    this.options.onNodeParamsChanged?.();
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

  private showYZeroIndicatorIfNeeded(featureId: string | null): void {
    const obj = featureId ? this.findObject3DByFeatureId(featureId) : null;
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
