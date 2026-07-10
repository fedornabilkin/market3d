<template lang="pug">
.constructor-page
  ConstructorTour
  .constructor-sidebar
    ConstructorNodesPanel(
      :scene-count="SCENE_COUNT"
      :active-scene-index="activeSceneIndex"
      :document="featureDocForUI"
      :selected-ids="selectedFeatureIds"
      :tree-version="treeVersion"
      :generator-active="generatorModeActive"
      :add-disabled="addCooldown"
      :shapes="CONSTRUCTOR_SHAPE_BUTTONS"
      @switch-scene="switchScene"
      @save="saveSceneToFile"
      @load="loadSceneFromFile"
      @clear="clearScene"
      @select="onSelectFeatureFromTree"
      @add="addPrimitiveOfType"
    )

    ConstructorSettingsPanel(
      v-model:generator-type="generatorType"
      v-model:thread="threadSettings"
      v-model:knurl="knurlSettings"
      v-model:chamfer-radius="chamferRadius"
      :generator-active="generatorModeActive"
      :chamfer-active="chamferModeActive"
      :snap-step="snapStep"
      :feature="selectedFeature"
      :tree-version="treeVersion"
      @update:generator-type="setGeneratorType"
      @confirm-generator="confirmGenerator"
      @update:params="onFeatureFormParamsUpdate"
      @update:name="onFeatureFormNameUpdate"
    )

  .constructor-canvas-wrap
    div(ref="containerRef" class="canvas-container")
    SnapToolbar(
      :steps="viewport.snapValues" :model-value="snapStep" :show-grid="sceneSettings.showGrid"
      :zoom-speed="sceneSettings.zoomSpeed" :zoom-speeds="viewport.zoomSpeeds"
      :grid-width="sceneSettings.gridWidth" :grid-length="sceneSettings.gridLength"
      :background="sceneSettings.background"
      @update:model-value="viewport.setSnapStep"
      @toggle-grid="viewport.toggleGrid"
      @zoom="viewport.setZoomSpeed"
      @size="viewport.setGridSize"
      @background="viewport.setBackground"
    )
    ConstructorActionToolbar(
      :selected-count="selectedFeatureIds.length"
      :can-merge="canMerge"
      :can-ungroup="canUngroup"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-delete="canDeleteSelected"
      :has-scene-objects="hasSceneObjects"
      :mirror-active="mirrorModeActive"
      :cruise-active="cruiseModeActive"
      :alignment-active="alignmentModeActive"
      :chamfer-active="chamferModeActive"
      :generator-active="generatorModeActive"
      @merge="mergeSelected"
      @ungroup="ungroupSelected"
      @undo="undo"
      @redo="redo"
      @duplicate="(e) => duplicateSelected(e.shiftKey)"
      @mirror="toggleMirrorMode"
      @cruise="toggleCruiseMode"
      @alignment="toggleAlignmentMode"
      @chamfer="toggleChamferMode"
      @generator="toggleGeneratorMode"
      @delete="deleteSelected"
    )
    SceneLoadingIndicator(:visible="sceneLoading")
    SceneToolbar(:debug="showDebugPanel" :checklist="showTestChecklist" @export="showExportModal = true" @import="importStlFromFile" @debug="toggleDebugPanel" @checklist="toggleTestChecklist")

  //- Export modal
  ExportSceneModal(
    v-model:format="exportFormat"
    v-model:only-selected="exportOnlySelected"
    :visible="showExportModal"
    :exporting="exporting"
    :has-selection="!!selectedFeatureId"
    :percent="exportPercent"
    :status="exportStatusText"
    @close="showExportModal = false"
    @export="doExport"
  )

  //- Debug panel (вынесен в отдельный компонент)
  DebugPanel(
    v-if="showDebugPanel"
    :fps="debugFps"
    :now="debugNow"
    :camera="debugCamera"
    :selection="debugSelection"
    :modes="debugModes"
    :snap-step="snapStep"
    :history="debugHistory"
    :scene-info="debugSceneInfo"
    :gizmo="debugGizmoInfo"
    :feature-doc-stats="debugFeatureDocStats"
    :storage="debugStorageStats"
    :active-scene-index="activeSceneIndex"
    :scene-count="SCENE_COUNT"
    :logs="debugLogger.logs.value"
    @close="toggleDebugPanel"
    @download="onDownloadDebugSnapshot"
    @clear-logs="debugLogger.clear()"
  )

  //- Test checklist (отдельный компонент). Если debug-панель открыта, чеклист
  //- сдвигается левее (через :shifted), чтобы они не перекрывались.
  TestChecklistPanel(
    v-if="showTestChecklist"
    :groups="TEST_CHECKLIST"
    :checked="checklistState.checked.value"
    :shifted="showDebugPanel"
    @close="toggleTestChecklist"
    @toggle="(id) => checklistState.toggle(id)"
    @reset="() => checklistState.reset()"
    @check-all="() => checklistState.checkAll()"
  )
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import ConstructorTour from '@/components/constructor/ConstructorTour.vue';
import ConstructorActionToolbar from '@/components/constructor/ConstructorActionToolbar.vue';
import SnapToolbar from '@/components/constructor/SnapToolbar.vue';
import SceneToolbar from '@/components/constructor/SceneToolbar.vue';
import SceneLoadingIndicator from '@/components/constructor/SceneLoadingIndicator.vue';
import ExportSceneModal from '@/components/constructor/ExportSceneModal.vue';
import ConstructorNodesPanel from '@/components/constructor/ConstructorNodesPanel.vue';
import ConstructorSettingsPanel from '@/components/constructor/ConstructorSettingsPanel.vue';
import { CONSTRUCTOR_SHAPE_BUTTONS } from '@/components/constructor/shapeButtons';
import { useSceneLoading } from '@/composables/useSceneLoading';
import { useConstructorDebug } from '@/composables/useConstructorDebug';
import { useConstructorShortcuts } from '@/composables/useConstructorShortcuts';
import { useConstructorSelection } from '@/composables/useConstructorSelection';
import { useConstructorModes } from '@/composables/useConstructorModes';
import { useConstructorExport } from '@/composables/useConstructorExport';
import { useConstructorScenes } from '@/composables/useConstructorScenes';
import { ScenePersistenceService } from '@/services/ScenePersistenceService';
import { FeatureHistoryService } from '@/services/FeatureHistoryService';
import { ConstructorFeatureCommandService } from '@/services/ConstructorFeatureCommandService';
import { GeneratedFeatureService } from '@/services/GeneratedFeatureService';
import { ChamferCommandService, type ChamferEdge } from '@/services/ChamferCommandService';
import { ConstructorSceneController } from '@/services/ConstructorSceneController';
import { ConstructorFileService } from '@/services/ConstructorFileService';
import { ConstructorHistoryCoordinator } from '@/services/ConstructorHistoryCoordinator';
import { ConstructorSceneEventCoordinator } from '@/services/ConstructorSceneEventCoordinator';
import { ConstructorViewportController } from '@/services/ConstructorViewportController';
import * as THREE from 'three';
import {
  HistoryManager,
  ConstructorSceneService,
} from '@/v3d/constructor';
import type { PrimitiveType } from '@/v3d/constructor';
import { FeatureDocument } from '@/v3d/constructor/features';
// applyFeaturePatchToNode (legacy bridge) больше не используется — все формы
// идут через featureDoc.updateParams напрямую.
import { ensureTransformWrapper } from '@/v3d/constructor/features/utils/dagMutations';
import { PrimitiveFeatureFactory } from '@/v3d/constructor/modes/PrimitiveFeatureFactory';
import {
  AlignmentFeatureOperation,
  type AlignMode,
} from '@/v3d/constructor/modes/AlignmentFeatureOperation';
import {
  TEST_CHECKLIST,
  TestChecklistState,
} from '@/v3d/constructor/debug';
import DebugPanel from '@/components/constructor/DebugPanel.vue';
import TestChecklistPanel from '@/components/constructor/TestChecklistPanel.vue';
import { useSeoHeadI18n } from '@/composables/useSeoHead';

useSeoHeadI18n('seo.constructor');

const SCENE_COUNT = 3;
/**
 * v2 — единственный рантайм-формат хранилища. Legacy v1-ключи мигрируются
 * один раз в `onMounted` через `migrateAllV1ToV2` и удаляются. После этого
 * рантайм работает только с `constructor_scene_v2_*`.
 */
const PRIMARY_KEYS = Array.from({ length: SCENE_COUNT }, (_, i) => `constructor_scene_v2_${i}`);
const scenePersistence = new ScenePersistenceService(PRIMARY_KEYS);

// ─── Refs ──────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null);
/**
 * Selection — primary state в FeatureId. ModelNode-tree пересобирается на
 * каждой mutation (через featureDocumentToLegacy + serializer.fromJSON),
 * ссылки на ModelNode становятся stale. FeatureId стабилен между rebuild'ами,
 * поэтому держим его как источник истины. Legacy-консьюмеры читают
 * `selectedNode`/`selectedNodes` (computed ниже).
 */
const historyManager = new HistoryManager();
const sceneLoadingState = useSceneLoading();
const sceneLoading = sceneLoadingState.visible;
const startSceneLoading = sceneLoadingState.start;
const finishSceneLoading = sceneLoadingState.finish;

/** Incremented to force FeatureTree re-render when graph structure/labels change. */
const treeVersion = ref(0);

let sceneService: ConstructorSceneService | null = null;
const constructorSelection = useConstructorSelection({
  apply: (ids, primaryId) => sceneService?.setSelection(ids, primaryId),
  onCleared: () => constructorModes.disableMirror(),
});
const selectedFeatureId = constructorSelection.primaryId;
const selectedFeatureIds = constructorSelection.selectedIds;
/**
 * Factory для новых Primitive-фич: используется в addPrimitiveOfType.
 * Дефолтные параметры по типу инкапсулированы внутри (см. модуль).
 */
const primitiveFeatureFactory = new PrimitiveFeatureFactory();
const featureCommands = new ConstructorFeatureCommandService();
const generatedFeatures = new GeneratedFeatureService();
const chamferCommands = new ChamferCommandService();
const sceneController = new ConstructorSceneController();
const constructorFiles = new ConstructorFileService();

/**
 * Текущий FeatureDocument — каноничный источник для UI/debug. Берётся из
 * sceneService, который перестраивает его на каждом rebuildSceneFromTree
 * и публикует через `window.__featureDoc` для DevTools.
 */
function currentFeatureDoc(): FeatureDocument | null {
  return sceneService?.getFeatureDocument() ?? null;
}

const featureHistory = new FeatureHistoryService(historyManager, currentFeatureDoc);
const historyCoordinator = new ConstructorHistoryCoordinator({
  history: featureHistory,
  getService: () => sceneService,
  getSelection: () => ({ ids: selectedFeatureIds.value, primaryId: selectedFeatureId.value }),
  onChanged: () => {
    treeVersion.value++;
    _saveToLocalStorage();
  },
  onRestored: () => {
    setSelectionByIds([]);
    treeVersion.value++;
    _saveToLocalStorage();
  },
});
const constructorScenes = useConstructorScenes({
  sceneCount: SCENE_COUNT,
  persistence: scenePersistence,
  history: featureHistory,
  loading: sceneLoadingState,
  getService: () => sceneService,
  flushCurrentScene: () => {
    if (!scenePersistence.flushPending()) _flushSave();
  },
  onLoaded: () => {
    setSelectionByIds([]);
    treeVersion.value++;
  },
});
const activeSceneIndex = constructorScenes.activeIndex;

// ─── Computed ──────────────────────────────────────────────────────────────

/** FeatureDocument из sceneService для UI-дерева. Реактивен через treeVersion. */
const featureDocForUI = computed(() => {
  treeVersion.value;
  return sceneService?.getFeatureDocument() ?? null;
});

/** Клик в FeatureTree → выделение по featureId (shift = multi-select). */
function onSelectFeatureFromTree(payload: { id: string; shiftKey: boolean }): void {
  onSelectFeature(payload.id, payload.shiftKey);
}

/**
 * Текущая выделенная фича из FeatureDocument (rootmost — Transform-обёртка
 * если она есть, иначе сама примитивная фича). Для FeatureParamsForm.
 */
const selectedFeature = computed(() => {
  treeVersion.value;
  const fid = selectedFeatureId.value;
  if (!sceneService || !fid) return null;
  const fd = sceneService.getFeatureDocument();
  return fd?.graph.get(fid) ?? null;
});

/**
 * Bridge-handler: FeatureParamsForm → featureDoc мутация.
 * Form работает в схеме v2; патч передаётся напрямую в `featureDoc.updateParams`,
 * featureRenderer обновляет сцену через events. Fallback на legacy bridge —
 * если у ноды нет featureId mapping (редко, до первого rebuild'а).
 */
function onFeatureFormParamsUpdate(patch: Record<string, unknown>): void {
  const featureId = selectedFeatureId.value;
  if (!featureId) return;
  withFeatureDocHistory((doc) => featureCommands.updateParams(doc, featureId, patch));
}

function onFeatureFormNameUpdate(name: string | undefined): void {
  const featureId = selectedFeatureId.value;
  if (!featureId) return;
  withFeatureDocHistory((doc) => featureCommands.rename(doc, featureId, name));
}

const canUndo = computed(() => {
  treeVersion.value;
  return featureHistory.canUndo();
});
const canRedo = computed(() => {
  treeVersion.value;
  return featureHistory.canRedo();
});

const canDeleteSelected = computed(() => {
  treeVersion.value;
  const fid = selectedFeatureId.value;
  if (!fid || !sceneService) return false;
  const fd = sceneService.getFeatureDocument();
  return !!fd && featureCommands.canDelete(fd, fid);
});

const hasSceneObjects = computed(() => {
  treeVersion.value;
  const fd = sceneService?.getFeatureDocument();
  return !!fd && featureCommands.hasSceneObjects(fd);
});
const canMerge = computed(() => selectedFeatureIds.value.length >= 2);
const canUngroup = computed(() => {
  treeVersion.value;
  const fid = selectedFeatureId.value;
  if (!fid || !sceneService) return false;
  const fd = sceneService.getFeatureDocument();
  if (!fd) return false;
  return featureCommands.canUngroup(fd, fid);
});

// ─── Node settings form ────────────────────────────────────────────────────

const ADD_PRIMITIVE_COOLDOWN_MS = 1500;
const addCooldown = ref(false);
const constructorModes = useConstructorModes(() => sceneService);
const mirrorModeActive = constructorModes.mirror;
const cruiseModeActive = constructorModes.cruise;
const alignmentModeActive = constructorModes.alignment;
const chamferModeActive = constructorModes.chamfer;
const chamferRadius = constructorModes.chamferRadius;
const generatorModeActive = constructorModes.generator;
const generatorType = constructorModes.generatorType;
const threadSettings = constructorModes.threadSettings;
const knurlSettings = constructorModes.knurlSettings;
const setGeneratorType = constructorModes.setGeneratorType;

const viewport = new ConstructorViewportController(() => sceneService);
const snapStep = viewport.snapStep;
const sceneSettings = viewport.settings;

// ─── Debug panel ─────────────────────────────────────────────────────────

const constructorDebug = useConstructorDebug({
  storageKeys: PRIMARY_KEYS,
  getDocument: currentFeatureDoc,
  getFeature: () => selectedFeature.value,
  getSelectedIds: () => selectedFeatureIds.value,
  getSelectedFeatureId: () => selectedFeatureId.value,
  getObject: (featureId) => sceneService?.findObject3DByFeatureId(featureId),
  getActiveSceneIndex: () => activeSceneIndex.value,
  getTreeVersion: () => treeVersion.value,
  getModes: () => ({
    mirror: mirrorModeActive.value,
    cruise: cruiseModeActive.value,
    alignment: alignmentModeActive.value,
    chamfer: chamferModeActive.value,
    generator: generatorModeActive.value,
    generatorType: generatorType.value,
  }),
  getSnapStep: () => snapStep.value,
  getSceneSettings: () => ({ ...sceneSettings }),
  getHistory: () => ({ canUndo: canUndo.value, canRedo: canRedo.value }),
});
const showDebugPanel = constructorDebug.visible;
const debugFps = constructorDebug.fps;
const debugNow = constructorDebug.now;
const debugSceneInfo = constructorDebug.sceneInfo;
const debugGizmoInfo = constructorDebug.gizmo;
const debugCamera = constructorDebug.camera;
const debugFeatureDocStats = constructorDebug.featureDocStats;
const debugStorageStats = constructorDebug.storageStats;
const debugLogger = constructorDebug.logger;
const debugSelection = constructorDebug.selection;
const debugModes = constructorDebug.modes;
const debugHistory = constructorDebug.history;
const onDownloadDebugSnapshot = constructorDebug.download;
const sceneEvents = new ConstructorSceneEventCoordinator({
  history: featureHistory,
  getService: () => sceneService,
  selectFeature: onSelectFeature,
  setSelection: setSelectionByIds,
  handleDebug: (info) => constructorDebug.handleSceneInfo(info, sceneController.getCameraDebug()),
  align: (mode) => alignNodes(mode as AlignMode),
  onDocumentChanged: () => {
    treeVersion.value++;
    _saveToLocalStorage();
  },
});

// ─── Test checklist ──────────────────────────────────────────────────────

const showTestChecklist = ref(false);
const checklistState = new TestChecklistState();
checklistState.load();

function toggleTestChecklist() {
  showTestChecklist.value = !showTestChecklist.value;
}


// ─── Helpers ───────────────────────────────────────────────────────────────

// ─── History ───────────────────────────────────────────────────────────────

const withHistory = (mutate: () => void) => historyCoordinator.mutateScene(mutate);
function withFeatureDocHistory<T>(mutate: (doc: FeatureDocument) => T): T | null {
  return historyCoordinator.mutateDocument(mutate);
}
const undo = () => historyCoordinator.undo();
const redo = () => historyCoordinator.redo();

// ─── localStorage ──────────────────────────────────────────────────────────

/**
 * P2-prep-1 save flip: featureDoc — каноничный источник, читаем из него
 * напрямую. featureDoc обновляется в `sceneService.rebuildSceneFromTree`
 * после каждой мутации, поэтому на момент save'а он всегда актуален.
 *
 * Failed-фичи (ошибки recompute) пропускаем: лучше оставить предыдущий
 * корректный v2 в localStorage, чем затереть его сценой со сломанным
 * recompute. Пользователь увидит warning и сможет откатить изменение.
 */
function _flushSave() {
  const sceneIndex = activeSceneIndex.value;
  const fd = currentFeatureDoc();
  if (!fd) return;
  try {
    const failed = [...fd.graph.values()].filter((f) => f.error);
    if (failed.length > 0) {
      console.warn('[FeatureDoc] save: failed features (skip write)', failed.map((f) => ({ id: f.id, type: f.type, error: f.error })));
      return;
    }
    scenePersistence.save(sceneIndex, fd);
  } catch (e) {
    console.warn('[FeatureDoc] v2 write failed:', e);
  }
}

function _saveToLocalStorage() {
  const fd = currentFeatureDoc();
  if (!fd) return;
  scenePersistence.scheduleSave(activeSceneIndex.value, fd);
}

function _flushPendingSave() {
  scenePersistence.flushPending();
}

function saveSceneToFile() {
  const document = currentFeatureDoc();
  if (!document) return;
  try { constructorFiles.downloadScene(document); }
  catch (error) { console.warn('[Constructor] Failed to save scene to file:', error); }
}

async function loadSceneFromFile() {
  try {
    const document = await constructorFiles.pickScene();
    if (!document) return;
    startSceneLoading();
    await nextTick();
    const before = featureHistory.capture();
    await constructorScenes.loadDocument(document);
    featureHistory.push(before, featureHistory.capture());
  } catch (error) {
    console.warn('[Constructor] Failed to load scene from file:', error);
  } finally {
    if (sceneLoading.value) finishSceneLoading();
  }
}

const switchScene = constructorScenes.switchTo;

function clearScene() {
  if (!sceneService) return;
  withFeatureDocHistory((doc) => {
    const rootId = doc.rootIds[0];
    if (!rootId) return;
    const root = doc.graph.get(rootId);
    if (root && (root.type === 'group' || root.type === 'boolean')) {
      doc.updateInputs(rootId, []);
    }
  });
  setSelectionByIds([]);
}

// ─── Selection ─────────────────────────────────────────────────────────────

/**
 * Primary selection API — featureId-based. ModelNode-tree деривируется,
 * gizmo/glow обновляются через sceneService.setSelection (legacy-side).
 */
function setSelectionByIds(ids: readonly string[]): void {
  constructorSelection.set(ids);
}

function onSelectFeature(featureId: string, shiftKey = false): void {
  constructorSelection.select(featureId, shiftKey);
}

// ─── Primitives & groups ───────────────────────────────────────────────────

function addPrimitiveOfType(type: PrimitiveType) {
  if (addCooldown.value || !sceneService) return;
  const fd = sceneService.getFeatureDocument();
  if (!fd || fd.rootIds.length !== 1) return;
  const rootFeature = fd.graph.get(fd.rootIds[0]);
  if (!rootFeature || (rootFeature.type !== 'group' && rootFeature.type !== 'boolean')) return;

  const { feature, id } = primitiveFeatureFactory.create(type as never);
  withFeatureDocHistory((doc) => {
    doc.addFeature(feature);
    const inputs = [...(rootFeature as { getInputs(): readonly string[] }).getInputs(), id];
    doc.updateInputs(rootFeature.id, inputs);
    // Сразу оборачиваем в Transform — иначе schema-form не покажет
    // isHole/color/position до первого drag'а (где обёртка создаётся лениво).
    ensureTransformWrapper(doc, id);
  });
  setSelectionByIds([id]);

  addCooldown.value = true;
  setTimeout(() => { addCooldown.value = false; }, ADD_PRIMITIVE_COOLDOWN_MS);
}

/**
 * Smart duplicate state.
 * First Ctrl+D clones in place with no offset.
 * After the user modifies the clone (position/scale/rotation), subsequent
 * Ctrl+D duplicates the last clone and applies the same delta again.
 */
function duplicateSelected(shrink: boolean = false) {
  if (!sceneService) return;
  const featureId = selectedFeatureId.value;
  const fd = sceneService.getFeatureDocument();
  if (!featureId || !fd) return;

  // Shrink: рассчитываем уменьшение scale через bbox исходного меша.
  let shrinkFactor: [number, number, number] | null = null;
  if (shrink && snapStep.value > 0) {
    const obj = sceneService.findObject3DByFeatureId(featureId);
    if (obj) {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const step = snapStep.value;
      const EPS = 1e-4;
      const fx = size.x > step + EPS ? (size.x - step) / size.x : EPS;
      const fy = size.y > step + EPS ? (size.y - step) / size.y : EPS;
      const fz = size.z > step + EPS ? (size.z - step) / size.z : EPS;
      shrinkFactor = [fx, fy, fz];
    }
  }

  const newRootId = withFeatureDocHistory(
    (doc) => featureCommands.duplicate(doc, featureId, shrinkFactor),
  );
  if (!newRootId) return;
  setSelectionByIds([newRootId]);
}

function toggleMirrorMode() {
  constructorModes.toggleMirror();
}

function toggleCruiseMode() {
  constructorModes.toggleCruise();
}

function toggleDebugPanel() {
  const visible = constructorDebug.toggle();
  sceneService?.setDebugPanelVisible(visible);
}

function toggleAlignmentMode() {
  constructorModes.toggleAlignment();
}

function toggleGeneratorMode() {
  constructorModes.toggleGenerator();
}

function confirmGenerator() {
  constructorModes.confirmGenerator();
}

function toggleChamferMode() {
  constructorModes.toggleChamfer();
}

function applyChamferToEdge(
  obj: THREE.Object3D,
  edge: ChamferEdge,
  settings: { radius: number; profile: 'convex' | 'concave' | 'flat' },
) {
  if (!sceneService) return;
  // Резолвим featureId через userData.featureId (FeatureRenderer ставит на
  // каждый mesh/group), traversing по parent для child-мешей composite-групп.
  let featureId: string | undefined;
  let cur: THREE.Object3D | null = obj;
  while (cur && !featureId) {
    featureId = (cur.userData as { featureId?: string }).featureId;
    cur = cur.parent;
  }
  if (!featureId) {
    console.warn('[Constructor.applyChamferToEdge] нет featureId на userData — операция пропущена');
    return;
  }
  const applied = withFeatureDocHistory(
    (doc) => chamferCommands.apply(doc, featureId!, edge, settings),
  );
  if (applied) treeVersion.value++;
}

function alignNodes(mode: AlignMode) {
  if (!sceneService) return;
  const featureIds = [...selectedFeatureIds.value];
  if (featureIds.length < 2) return;

  const op = new AlignmentFeatureOperation({
    computeBboxByFeatureId: (fid) => {
      const obj = sceneService!.findObject3DByFeatureId(fid);
      if (!obj) return null;
      obj.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(obj);
    },
  });
  withFeatureDocHistory((doc) => {
    op.run(doc, featureIds, mode);
  });
}

function deleteSelected() {
  if (!sceneService) return;
  const featureId = selectedFeatureId.value;
  if (!featureId) return;
  const removed = withFeatureDocHistory((doc) => featureCommands.delete(doc, featureId));
  if (!removed) return;
  setSelectionByIds(selectedFeatureIds.value.filter((id) => id !== featureId));
}

function mergeSelected() {
  if (!sceneService) return;
  const featureIds = [...selectedFeatureIds.value];
  if (featureIds.length < 2) return;

  const newGroupId = withFeatureDocHistory(
    (doc) => featureCommands.merge(doc, featureIds),
  );
  if (!newGroupId) return;
  setSelectionByIds([newGroupId]);
}

function ungroupSelected() {
  if (!sceneService) return;
  const featureId = selectedFeatureId.value;
  if (!featureId) return;
  const extractedIds = withFeatureDocHistory(
    (doc) => featureCommands.ungroup(doc, featureId),
  );
  if (!extractedIds || extractedIds.length === 0) return;
  setSelectionByIds([extractedIds[0]]);
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

const { handleKeydown } = useConstructorShortcuts({
  hasSelection: () => !!selectedFeatureId.value && !!sceneService,
  selectionCount: () => selectedFeatureIds.value.length,
  canDelete: () => canDeleteSelected.value,
  canMerge: () => canMerge.value,
  canUngroup: () => canUngroup.value,
  canUndo: () => canUndo.value,
  canRedo: () => canRedo.value,
  hasSceneObjects: () => hasSceneObjects.value,
  delete: deleteSelected,
  duplicate: duplicateSelected,
  move: (direction, multiplier) => {
    if (!sceneService) return;
    withHistory(() => sceneService!.moveSelectedByKey(direction, multiplier));
  },
  mirror: toggleMirrorMode,
  toggleSnap: viewport.toggleSnap,
  alignment: toggleAlignmentMode,
  chamfer: toggleChamferMode,
  undo,
  redo,
  merge: mergeSelected,
  ungroup: ungroupSelected,
});

// ─── Export ───────────────────────────────────────────────────────

const constructorExport = useConstructorExport(
  () => sceneService,
  () => currentFeatureDoc()?.metadata.name || 'vsqr',
);
const showExportModal = constructorExport.visible;
const exportFormat = constructorExport.format;
const exportOnlySelected = constructorExport.onlySelected;
const exporting = constructorExport.exporting;
const exportPercent = constructorExport.percent;
const exportStatusText = constructorExport.status;
const doExport = constructorExport.start;

async function importStlFromFile() {
  try {
    const imported = await constructorFiles.pickAndPrepareStl();
    if (!imported) return;
    const id = withFeatureDocHistory((doc) => constructorFiles.attachImportedStl(doc, imported));
    if (id) setSelectionByIds([id]);
  } catch (error) {
    console.warn('[Constructor] STL import failed:', error);
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

onMounted(() => {
  if (!containerRef.value) return;
  sceneService = sceneController.mount(
    containerRef.value,
    sceneEvents.createServiceOptions(),
    viewport.snapshot(),
  );

  sceneService.setSelection(selectedFeatureIds.value, selectedFeatureId.value);

  sceneController.wireModes({
    onChamferEdge: (obj, edge, settings) => applyChamferToEdge(obj, edge, settings),
    onGenerate: (_geometry, _height, name) => {
      if (!sceneService) return;
      const settings = sceneService.getGeneratorMode().settings;
      const newId = withFeatureDocHistory(
        (doc) => generatedFeatures.createAndAttach(doc, settings, name),
      );
      if (!newId) return;
      setSelectionByIds([newId]);
      constructorModes.deactivateGenerator();
    },
  });

  void constructorScenes.initialize();

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', _flushPendingSave);
});

onBeforeUnmount(() => {
  sceneLoadingState.dispose();
  _flushPendingSave();
  scenePersistence.dispose();
  constructorDebug.dispose();
  sceneController.unmount();
  sceneService = null;
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('beforeunload', _flushPendingSave);
});
</script>

<style scoped>
.constructor-page {
  position: relative;
  flex: 1;
  width: 100%;
  background: #f5f5f5;
  color: #333;
}

/* ─── Sidebar ─────────────────────────────────────────────────── */
.constructor-sidebar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 290px;
  z-index: 5;
  background: rgba(255, 255, 255, 0.97);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #d0d0d0;
}

/* ─── Canvas ──────────────────────────────────────────────────── */
.constructor-canvas-wrap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}

</style>
