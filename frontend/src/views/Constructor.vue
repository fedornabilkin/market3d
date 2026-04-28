<template lang="pug">
.constructor-page
  el-tour(
    v-model="tourStore.constructorOpen"
    v-model:current="tourCurrent"
    @finish="onTourFinish"
    @close="onTourDone"
    @change="onTourChange"
    :next-button-props="{ children: 'Далее' }"
    :prev-button-props="{ children: 'Назад' }"
  )
    el-tour-step(
      :target="tourButtonTarget"
      title="Кнопка запуска тура"
      description="Нажмите эту кнопку в любой момент, чтобы пройти тур по текущей странице заново."
    )
    el-tour-step(
      :target="nodesTarget"
      title="Панель узлов"
      description="Здесь отображается дерево узлов сцены. Добавляйте примитивы и управляйте ими."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="settingsTarget"
      title="Панель настроек"
      description="Здесь настраиваются свойства выбранного узла: размеры, положение, материалы."
      :placement="tp('left')"
    )
    el-tour-step(
      :target="actionToolbarTarget"
      title="Управление объектом"
      description="Группировка, отмена/повтор, дублирование, зеркалирование, прилипание, фаска, удаление — действия над выделенными объектами."
      placement="top"
    )
    el-tour-step(
      :target="exportButtonsTarget"
      title="Экспорт и импорт"
      description="Скачайте модель в STL/OBJ или загрузите существующий STL-файл в сцену."
      placement="top"
      :next-button-props="{ children: 'Готово' }"
    )
  .constructor-sidebar
    .constructor-panel.constructor-panel--nodes
      .scene-switcher
        button.scene-tab(
          v-for="i in SCENE_COUNT"
          :key="i"
          :class="{ 'is-active': activeSceneIndex === i - 1 }"
          @click="switchScene(i - 1)"
        ) Сцена {{ i }}
      .panel-header
        span Feature graph
        .panel-header-actions
          button.btn-icon(@click="saveSceneToFile" title="Сохранить сцену в файл")
            i.fas.fa-save
          button.btn-icon(@click="loadSceneFromFile" title="Загрузить сцену из файла")
            i.fas.fa-folder-open
          button.btn-icon(@click="clearScene" title="Очистить сцену")
            i.fas.fa-trash-alt
      .node-list(v-show="!generatorModeActive")
        FeatureTree(
          :doc="featureDocForUI"
          :selected-ids="selectedFeatureIds"
          :key="treeVersion"
          @select="onSelectFeatureFromTree"
        )
      .panel-actions
        .shape-icons
          button.shape-btn(
            v-for="shape in shapeButtons"
            :key="shape.type"
            :title="shape.title"
            :disabled="addCooldown"
            @click="addPrimitiveOfType(shape.type)"
          )
            svg.shape-svg(viewBox="0 0 24 24" fill="currentColor")
              path(:d="shape.icon")

    .constructor-panel.constructor-panel--settings
      template(v-if="generatorModeActive")
        .panel-header Генератор
        .generator-tabs
          button.generator-tab(
            :class="{ 'is-active': generatorType === 'thread' }"
            @click="setGeneratorType('thread')"
          ) Резьба
          button.generator-tab(
            :class="{ 'is-active': generatorType === 'knurl' }"
            @click="setGeneratorType('knurl')"
          ) Насечки
        .settings-content
          template(v-if="generatorType === 'thread'")
            .field
              label.label Внешний диаметр (мм)
              input.input.is-small(type="number" step="0.5" min="1" v-model.number="threadSettings.outerDiameter")
            .field
              label.label Внутренний диаметр (мм)
              input.input.is-small(type="number" step="0.5" min="0.5" v-model.number="threadSettings.innerDiameter")
            .field
              label.label Шаг (мм)
              input.input.is-small(type="number" step="0.25" min="0.25" v-model.number="threadSettings.pitch")
            .field
              label.label Витки
              input.input.is-small(type="number" step="1" min="1" v-model.number="threadSettings.turns")
            .field
              label.label Сегментов на виток
              input.input.is-small(type="number" step="8" min="8" v-model.number="threadSettings.segmentsPerTurn")
            .field
              label.checkbox
                input(type="checkbox" v-model="threadSettings.leftHand")
                span  Левая резьба
          template(v-else-if="generatorType === 'knurl'")
            .field
              label.label Внешний диаметр (мм)
              input.input.is-small(
                type="number"
                step="0.5"
                :min="knurlSettings.innerDiameter"
                v-model.number="knurlSettings.outerDiameter"
              )
            .field
              label.label Внутренний диаметр (мм)
              input.input.is-small(
                type="number"
                step="0.5"
                min="0.5"
                :max="knurlSettings.outerDiameter"
                v-model.number="knurlSettings.innerDiameter"
              )
            .field
              label.label Высота (мм)
              input.input.is-small(type="number" step="0.5" min="0.5" v-model.number="knurlSettings.height")
            .field
              label.label Количество насечек
              input.input.is-small(type="number" step="1" min="3" v-model.number="knurlSettings.notchCount")
            .field
              label.label Узор
              select.input.is-small(v-model="knurlSettings.pattern")
                option(value="straight") Прямые
                option(value="diagonal" disabled) Диагональные (скоро)
                option(value="diamond" disabled) Ромбовидные (скоро)
                option(value="cross45" disabled) Перекрёстные 45° (скоро)
                option(value="flatDiamond" disabled) Плоский ромб (скоро)
            .field
              label.label Сегментов на насечку
              input.input.is-small(type="number" step="1" min="2" v-model.number="knurlSettings.segmentsPerNotch")
            .field
              label.label Шагов по высоте
              input.input.is-small(type="number" step="4" min="4" v-model.number="knurlSettings.heightSegments")
          .field
            button.button.is-small.is-primary(@click="confirmGenerator" style="width:100%") Применить
      template(v-else-if="chamferModeActive")
        .panel-header Фаска
        .settings-content
          .field
            label.label Размер (мм)
            input.input.is-small(type="number" :step="snapStep || 0.5" :min="snapStep || 0.1" v-model.number="chamferRadius")
      template(v-else)
        .panel-header Настройки фичи
        //- Schema-driven форма по выбранной фиче (FeatureTree-primary).
        //- Мутации идут напрямую через featureDoc.updateParams → FeatureRenderer.
        .settings-content(v-if="selectedFeature")
          FeatureParamsForm(
            :feature="selectedFeature"
            :version="treeVersion"
            @update:params="onFeatureFormParamsUpdate"
            @update:name="onFeatureFormNameUpdate"
          )
        .settings-placeholder(v-else)
          | Выберите фичу в сцене или в дереве

  .constructor-canvas-wrap
    div(ref="containerRef" class="canvas-container")
    .snap-toolbar
      span.snap-toolbar-label Шаг привязки
      button.snap-step-btn(
        v-for="step in snapValues"
        :key="step"
        :class="{ 'is-active': snapStep === step }"
        @click="applySnapStep(step)"
      ) {{ step }}
      span.snap-toolbar-unit мм
    .action-toolbar
      span.selection-counter(v-if="selectedFeatureIds.length" :title="`Выделено объектов: ${selectedFeatureIds.length}`")
        i.fas.fa-mouse-pointer
        |  {{ selectedFeatureIds.length }}
      .toolbar-separator(v-if="selectedFeatureIds.length")
      button.btn-icon(@click="mergeSelected" :disabled="!canMerge" title="Группа (Ctrl+G)")
        i.fas.fa-object-group
      button.btn-icon(@click="ungroupSelected" :disabled="!canUngroup" title="Разгруппировать (Ctrl+Shift+G)")
        i.fas.fa-object-ungroup
      .toolbar-separator
      button.btn-icon(@click="undo" :disabled="!canUndo" title="Отменить (Ctrl+Z)")
        i.fas.fa-undo
      button.btn-icon(@click="redo" :disabled="!canRedo" title="Повторить (Ctrl+Shift+Z)")
        i.fas.fa-redo
      .toolbar-separator
      button.btn-icon(@click="(e) => duplicateSelected(e.shiftKey)" :disabled="!canDeleteSelected" title="Дублировать (Ctrl+D). С Shift — клон меньше на шаг привязки")
        i.fas.fa-clone
      button.btn-icon(
        :class="{ 'is-active-tool': mirrorModeActive }"
        @click="toggleMirrorMode"
        :disabled="!canDeleteSelected"
        title="Зеркалирование (Ctrl+M)"
      )
        i.fas.fa-arrows-alt-h
      button.btn-icon(
        :class="{ 'is-active-tool': cruiseModeActive }"
        @click="toggleCruiseMode"
        title="Прилипание к объектам"
      )
        i.fas.fa-magnet
      button.btn-icon(
        :class="{ 'is-active-tool': alignmentModeActive }"
        @click="toggleAlignmentMode"
        title="Метки выравнивания"
      )
        i.fas.fa-ruler-combined
      button.btn-icon(
        :class="{ 'is-active-tool': chamferModeActive }"
        @click="toggleChamferMode"
        :disabled="!hasSceneObjects"
        title="Фаска (F)"
      )
        i.fas.fa-bezier-curve
      button.btn-icon(
        :class="{ 'is-active-tool': generatorModeActive }"
        @click="toggleGeneratorMode"
        title="Генератор"
      )
        i.fas.fa-cogs
      .toolbar-separator
      button.btn-icon.btn-delete(@click="deleteSelected" :disabled="!canDeleteSelected" title="Удалить (Del)")
        i.fas.fa-trash
    .scene-toolbar
      button.btn-icon(@click="showSceneSettings = true" title="Параметры сцены")
        i.fas.fa-cog
      button.btn-icon(@click="showExportModal = true" title="Экспорт модели")
        i.fas.fa-download
      button.btn-icon(@click="triggerImportSTL" title="Импорт STL")
        i.fas.fa-upload
      button.btn-icon(@click="toggleDebugPanel" :class="{ 'is-active-tool': showDebugPanel }" title="Debug")
        i.fas.fa-bug
      button.btn-icon(
        @click="toggleTestChecklist"
        :class="{ 'is-active-tool': showTestChecklist }"
        :title="`Тест-чеклист (${checklistState.checked.value.size}/${checklistTotalCount})`"
      )
        i.fas.fa-tasks
      input(
        ref="stlFileInput"
        type="file"
        accept=".stl"
        style="display:none"
        @change="handleImportSTL"
      )

  //- Scene settings modal
  .scene-settings-modal(v-if="showSceneSettings")
    .scene-settings-backdrop(@click="showSceneSettings = false")
    .scene-settings-content(@click.stop)
      .scene-settings-header Параметры сцены
      .scene-settings-body
        .field
          label.checkbox
            input(type="checkbox" v-model="sceneSettings.showGrid" @change="sceneService && sceneService.setGridVisible(sceneSettings.showGrid)")
            span  Отображать сетку
        .field
          label.label Цвет фона
          input(type="color" v-model="sceneSettings.background" @change="sceneService && sceneService.setBackgroundColor(sceneSettings.background)")
        .field
          label.label Скорость масштабирования
          input(type="range" min="0.1" max="3" step="0.1" v-model.number="sceneSettings.zoomSpeed" @input="sceneService && sceneService.setZoomSpeed(sceneSettings.zoomSpeed)")
          span.range-value  {{ sceneSettings.zoomSpeed.toFixed(1) }}
        .field
          label.label Шаг привязки (мм)
          select.select.is-small(v-model.number="snapStep" @change="sceneService && sceneService.setSnapStep(snapStep)")
            option(value="0.1") 0.1
            option(value="0.25") 0.25
            option(value="0.5") 0.5
            option(value="1") 1
            option(value="2") 2
            option(value="5") 5
            option(value="10") 10
        .field
          label.label Размер сетки (мм)
          .field.has-addons
            input.input(type="number" min="10" step="10" v-model.number="sceneSettings.gridWidth" @change="sceneService && sceneService.setGridSize(sceneSettings.gridWidth, sceneSettings.gridLength)")
            span.field-addon  ×
            input.input(type="number" min="10" step="10" v-model.number="sceneSettings.gridLength" @change="sceneService && sceneService.setGridSize(sceneSettings.gridWidth, sceneSettings.gridLength)")
      .scene-settings-footer
        button.button.is-small(@click="showSceneSettings = false") Закрыть

  //- Export modal
  .scene-settings-modal(v-if="showExportModal")
    .scene-settings-backdrop(@click="!exporting && (showExportModal = false)")
    .scene-settings-content(@click.stop)
      .scene-settings-header Экспорт модели
      .scene-settings-body
        .field
          label.label Формат файла
          select.select.is-small(v-model="exportFormat" :disabled="exporting")
            option(value="stl") STL
            option(value="obj") OBJ
        .field
          label.checkbox
            input(type="checkbox" v-model="exportOnlySelected" :disabled="!selectedFeatureId || exporting")
            span  Только активный объект
        .export-progress(v-if="exporting")
          .export-progress-label {{ exportStatusText }}
          .export-progress-bar
            .export-progress-fill(:style="{ width: exportPercent + '%' }")
      .scene-settings-footer
        button.button.is-small(@click="showExportModal = false" :disabled="exporting") Отмена
        button.button.is-small.is-primary(@click="doExport" :disabled="exporting") {{ exporting ? 'Экспорт...' : 'Скачать' }}

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
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, toRaw, watch } from 'vue';
import { markRaw } from 'vue';
import * as THREE from 'three';
import {
  ModelApp,
  ModelManager,
  HistoryManager,
  Serializer,
  ModelNode,
  GroupNode,
  Primitive,
  ImportedMeshNode,
  ConstructorSceneService,
} from '@/v3d/constructor';
import type { PrimitiveType } from '@/v3d/constructor';
import {
  FeatureDocument,
  featureDocumentToLegacy,
  migrateLegacyTreeToDocument,
  FeatureSnapshotCommand,
  ThreadFeature,
  KnurlFeature,
  GroupFeature,
  ImportedMeshFeature,
} from '@/v3d/constructor/features';
// applyFeaturePatchToNode (legacy bridge) больше не используется — все формы
// идут через featureDoc.updateParams напрямую.
import type { FeatureDocumentJSON } from '@/v3d/constructor/features';
import {
  nextP2FeatureId,
  ensureTransformWrapper,
  findParent,
  cloneFeatureSubgraph,
} from '@/v3d/constructor/features/utils/dagMutations';
import { TransformFeature } from '@/v3d/constructor/features/composite/TransformFeature';
import { GroupingFeatureOperations } from '@/v3d/constructor/modes/GroupingFeatureOperations';
import {
  ChamferFeatureBuilder,
  type EdgeSpec,
} from '@/v3d/constructor/modes/ChamferFeatureBuilder';
import { PrimitiveFeatureFactory } from '@/v3d/constructor/modes/PrimitiveFeatureFactory';
import {
  AlignmentFeatureOperation,
  type AlignMode,
} from '@/v3d/constructor/modes/AlignmentFeatureOperation';
import FeatureParamsForm from '@/v3d/constructor/features/schema/FeatureParamsForm.vue';
import { migrateAllV1ToV2 } from '@/v3d/constructor/loader/migrateV1Storage';
import {
  DebugLogger,
  buildFeatureDocStats,
  buildStorageStats,
  buildDebugSnapshot,
  downloadDebugSnapshot,
  TEST_CHECKLIST,
  totalChecklistCount,
  TestChecklistState,
  type FeatureDocStats,
  type StorageStat,
} from '@/v3d/constructor/debug';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { dataURItoBlob } from '@/utils';
import FeatureTree from '@/components/constructor/FeatureTree.vue';
import DebugPanel from '@/components/constructor/DebugPanel.vue';
import TestChecklistPanel from '@/components/constructor/TestChecklistPanel.vue';
import { useTourStore } from '@/store/tour';
import { useTourPlacement } from '@/service/useTourPlacement';
import { useSeoHeadI18n } from '@/composables/useSeoHead';

useSeoHeadI18n('seo.constructor');

const tourStore = useTourStore();
const { tp } = useTourPlacement();
const CONSTRUCTOR_STEPS = [
  'common.tourButton',
  'constructor.nodes',
  'constructor.settings',
  'constructor.actions',
  'constructor.export',
];
const tourCurrent = ref(0);
const visibleEl = (el: HTMLElement | null): HTMLElement | null => el && el.offsetWidth > 0 ? el : null;
const tourButtonTarget = () => visibleEl(document.querySelector('.gen-tour-btn') as HTMLElement | null);
const nodesTarget = () => visibleEl(document.querySelector('.constructor-panel--nodes') as HTMLElement | null);
const settingsTarget = () => visibleEl(document.querySelector('.constructor-panel--settings') as HTMLElement | null);
const actionToolbarTarget = () => visibleEl(document.querySelector('.action-toolbar') as HTMLElement | null);
const exportButtonsTarget = () => visibleEl(document.querySelector('.scene-toolbar') as HTMLElement | null);
watch(() => tourStore.constructorOpen, (v) => {
  if (v) {
    tourCurrent.value = tourStore.startStepFor(CONSTRUCTOR_STEPS);
    tourStore.markStepSeen(CONSTRUCTOR_STEPS[tourCurrent.value]);
  }
});
const onTourChange = (idx: number) => {
  tourStore.markStepSeen(CONSTRUCTOR_STEPS[idx]);
};
const onTourDone = () => {
  tourStore.constructorOpen = false;
};
const onTourFinish = () => {
  tourStore.markAllSeen(CONSTRUCTOR_STEPS);
  onTourDone();
};
onMounted(async () => {
  if (tourStore.hasUnseen(CONSTRUCTOR_STEPS)) {
    await new Promise((r) => setTimeout(r, 100));
    tourStore.openFor('Constructor');
  }
});

const SCENE_COUNT = 3;
/**
 * v2 — единственный рантайм-формат хранилища. Legacy v1-ключи мигрируются
 * один раз в `onMounted` через `migrateAllV1ToV2` и удаляются. После этого
 * рантайм работает только с `constructor_scene_v2_*`.
 */
const PRIMARY_KEYS = Array.from({ length: SCENE_COUNT }, (_, i) => `constructor_scene_v2_${i}`);
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

// ─── Refs ──────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null);
/**
 * Selection — primary state в FeatureId. ModelNode-tree пересобирается на
 * каждой mutation (через featureDocumentToLegacy + serializer.fromJSON),
 * ссылки на ModelNode становятся stale. FeatureId стабилен между rebuild'ами,
 * поэтому держим его как источник истины. Legacy-консьюмеры читают
 * `selectedNode`/`selectedNodes` (computed ниже).
 */
const selectedFeatureId = shallowRef<string | null>(null);
const selectedFeatureIdsRaw = shallowRef<string[]>([]);
const modelApp = shallowRef<ModelApp | null>(null);
const activeSceneIndex = ref(0);

/** Incremented to force FeatureTree re-render when graph structure/labels change. */
const treeVersion = ref(0);

let sceneService: ConstructorSceneService | null = null;
/**
 * Factory для новых Primitive-фич: используется в addPrimitiveOfType.
 * Дефолтные параметры по типу инкапсулированы внутри (см. модуль).
 */
const primitiveFeatureFactory = new PrimitiveFeatureFactory();
/** Snapshot taken at drag-start for undo/redo of drag operations. */
let beforeDragJSON: FeatureDocumentJSON | null = null;

/**
 * Текущий FeatureDocument — каноничный источник для UI/debug. Берётся из
 * sceneService, который перестраивает его на каждом rebuildSceneFromTree
 * и публикует через `window.__featureDoc` для DevTools.
 */
function currentFeatureDoc(): FeatureDocument | null {
  return sceneService?.getFeatureDocument() ?? null;
}

// ─── Computed ──────────────────────────────────────────────────────────────

const rootNode = computed(() => {
  // treeVersion as dependency: forces re-evaluation when tree structure changes
  treeVersion.value;
  return modelApp.value?.getModelManager()?.getTree() ?? null;
});

/** FeatureDocument из sceneService для UI-дерева. Реактивен через treeVersion. */
const featureDocForUI = computed(() => {
  treeVersion.value;
  return sceneService?.getFeatureDocument() ?? null;
});

/**
 * Selection как массив FeatureId (primary state — stable across rebuild).
 * Read-only computed для UI консьюмеров (FeatureTree multi-select).
 */
const selectedFeatureIds = computed<readonly string[]>(() => selectedFeatureIdsRaw.value);

/**
 * Derived ModelNode для legacy-консьюмеров. После каждого treeVersion bump'а
 * computed пересчитывается — getModelNodeByFeatureId возвращает свежий
 * ModelNode (или null если фича удалена / mapping ещё не построен).
 */
const selectedNode = computed<ModelNode | null>(() => {
  treeVersion.value;
  if (!selectedFeatureId.value || !sceneService) return null;
  return sceneService.getModelNodeByFeatureId(selectedFeatureId.value);
});

const selectedNodes = computed<ModelNode[]>(() => {
  treeVersion.value;
  if (!sceneService) return [];
  const out: ModelNode[] = [];
  for (const fid of selectedFeatureIdsRaw.value) {
    const n = sceneService.getModelNodeByFeatureId(fid);
    if (n) out.push(n);
  }
  return out;
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
  if (!sceneService || !selectedFeature.value) return;
  const featureId = selectedFeatureId.value;
  if (!featureId) return;
  // Маршрутизируем patch: transform-params (position/rotation/scale/isHole/color)
  // идут на Transform-обёртку, геометрические — на inner primitive.
  withFeatureDocHistory((doc) => {
    const target = doc.graph.get(featureId);
    if (!target) return;
    if (target.type === 'transform') {
      const transformKeys = ['position', 'rotation', 'scale', 'isHole', 'color'];
      const transformPatch: Record<string, unknown> = {};
      const innerPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (transformKeys.includes(k)) transformPatch[k] = v;
        else innerPatch[k] = v;
      }
      if (Object.keys(transformPatch).length > 0) {
        doc.updateParams(featureId, transformPatch);
      }
      if (Object.keys(innerPatch).length > 0) {
        const inner = (target as { getInputs(): readonly string[] }).getInputs()[0];
        if (inner) doc.updateParams(inner, innerPatch);
      }
    } else {
      doc.updateParams(featureId, patch);
    }
  });
}

function onFeatureFormNameUpdate(name: string | undefined): void {
  const featureId = selectedFeatureId.value;
  if (!featureId || !sceneService) return;
  withFeatureDocHistory((doc) => {
    const f = doc.graph.get(featureId);
    if (f) f.name = name;
  });
}

const canUndo = computed(() => {
  treeVersion.value;
  return modelApp.value?.getHistoryManager()?.canUndo() ?? false;
});
const canRedo = computed(() => {
  treeVersion.value;
  return modelApp.value?.getHistoryManager()?.canRedo() ?? false;
});

const canDeleteSelected = computed(() => {
  treeVersion.value;
  const fid = selectedFeatureId.value;
  if (!fid || !sceneService) return false;
  const fd = sceneService.getFeatureDocument();
  // Single root scene-group удалять нельзя.
  return !!fd && !(fd.rootIds.length === 1 && fd.rootIds[0] === fid);
});

const hasSceneObjects = computed(() => {
  treeVersion.value;
  const fd = sceneService?.getFeatureDocument();
  if (!fd || fd.rootIds.length === 0) return false;
  const root = fd.graph.get(fd.rootIds[0]);
  if (!root || !('getInputs' in root)) return false;
  return (root as { getInputs(): readonly string[] }).getInputs().length > 0;
});
const canMerge = computed(() => selectedFeatureIds.value.length >= 2);
const canUngroup = computed(() => {
  treeVersion.value;
  const fid = selectedFeatureId.value;
  if (!fid || !sceneService) return false;
  const fd = sceneService.getFeatureDocument();
  if (!fd) return false;
  // Не root scene-group и фича — composite (group или boolean).
  if (fd.rootIds.length === 1 && fd.rootIds[0] === fid) return false;
  const f = fd.graph.get(fid);
  return !!f && (f.type === 'group' || f.type === 'boolean');
});

// SVG paths for shape icons (simple outlines)
const shapeButtons = [
  { type: 'box', title: 'Куб', icon: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm9-2L5.5 8 12 11l6.5-3L12 5zM4 8.5v8l7 3.1v-8L4 8.5zm16 0l-7 3.1v8l7-3.1v-8z' },
  { type: 'cylinder', title: 'Цилиндр', icon: 'M12 2C7.58 2 4 3.79 4 6v12c0 2.21 3.58 4 8 4s8-1.79 8-4V6c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.46 6 2s-2.13 2-6 2-6-1.46-6-2 2.13-2 6-2zM6 8.71C7.6 9.53 9.72 10 12 10s4.4-.47 6-1.29V18c0 .54-2.13 2-6 2s-6-1.46-6-2V8.71z' },
  { type: 'sphere', title: 'Сфера', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-14.5c-3.17.82-5.5 3.69-5.5 7.1h2c0-2.47 1.37-4.63 3.5-5.72v-1.38zm2 0v1.38c2.13 1.09 3.5 3.25 3.5 5.72h2c0-3.41-2.33-6.28-5.5-7.1z' },
  { type: 'cone', title: 'Конус', icon: 'M12 2L3 20h18L12 2zm0 4.5L17.5 18h-11L12 6.5z' },
  { type: 'torus', title: 'Тор', icon: 'M12 4C7.03 4 3 7.13 3 11s4.03 7 9 7 9-3.13 9-7-4.03-7-9-7zm0 2c3.87 0 7 2.24 7 5s-3.13 5-7 5-7-2.24-7-5 3.13-5 7-5zm0 2c-2.76 0-5 1.34-5 3s2.24 3 5 3 5-1.34 5-3-2.24-3-5-3z' },
];

// ─── Node settings form ────────────────────────────────────────────────────

const addCooldown = ref(false);
const mirrorModeActive = ref(false);
const cruiseModeActive = ref(false);
const alignmentModeActive = ref(false);
const chamferModeActive = ref(false);
const chamferRadius = ref(2);

const generatorModeActive = ref(false);
const generatorType = ref<'thread' | 'knurl'>('thread');
const threadSettings = ref({
  outerDiameter: 10,
  innerDiameter: 8,
  pitch: 2,
  turns: 5,
  segmentsPerTurn: 64,
  leftHand: false,
});
const knurlSettings = ref<{
  outerDiameter: number;
  innerDiameter: number;
  height: number;
  notchCount: number;
  pattern: 'straight' | 'diagonal' | 'diamond' | 'cross45' | 'flatDiamond';
  angle: number;
  segmentsPerNotch: number;
  heightSegments: number;
}>({
  outerDiameter: 10,
  innerDiameter: 9,
  height: 10,
  notchCount: 16,
  pattern: 'straight',
  angle: 30,
  segmentsPerNotch: 4,
  heightSegments: 12,
});
watch([chamferRadius], () => {
  if (sceneService && chamferModeActive.value) {
    const cm = sceneService.getChamferMode();
    cm.settings.radius = chamferRadius.value;
    cm.settings.profile = 'concave';
    cm.refreshPreview();
  }
});
watch(threadSettings, () => {
  if (sceneService && generatorModeActive.value && generatorType.value === 'thread') {
    const gm = sceneService.getGeneratorMode();
    const s = threadSettings.value;
    gm.settings.thread = { ...s, profile: 'trapezoid' };
    gm.updatePreview();
  }
}, { deep: true });
watch(knurlSettings, () => {
  if (sceneService && generatorModeActive.value && generatorType.value === 'knurl') {
    const gm = sceneService.getGeneratorMode();
    gm.settings.knurl = { ...knurlSettings.value };
    gm.updatePreview();
  }
}, { deep: true });

watch(() => knurlSettings.value.outerDiameter, (newOuter, oldOuter) => {
  if (typeof newOuter !== 'number' || newOuter <= 0) return;
  if (typeof oldOuter === 'number' && oldOuter > 0 && oldOuter !== newOuter) {
    const ratio = newOuter / oldOuter;
    const scaled = Math.max(3, Math.round(knurlSettings.value.notchCount * ratio));
    if (scaled !== knurlSettings.value.notchCount) {
      knurlSettings.value.notchCount = scaled;
    }
  }
  if (newOuter < knurlSettings.value.innerDiameter) {
    knurlSettings.value.innerDiameter = newOuter;
  }
});

watch(() => knurlSettings.value.innerDiameter, (newInner) => {
  if (typeof newInner !== 'number' || newInner <= 0) return;
  if (newInner > knurlSettings.value.outerDiameter) {
    knurlSettings.value.outerDiameter = newInner;
  }
});

function setGeneratorType(type: 'thread' | 'knurl') {
  generatorType.value = type;
  if (!sceneService || !generatorModeActive.value) return;
  const gm = sceneService.getGeneratorMode();
  gm.settings.type = type;
  if (type === 'thread') {
    gm.settings.thread = { ...threadSettings.value, profile: 'trapezoid' };
  } else {
    gm.settings.knurl = { ...knurlSettings.value };
  }
  gm.updatePreview();
}

const snapStep = ref(1);
const snapValues = [0.1, 0.25, 0.5, 1, 2, 5, 10];
function applySnapStep(step: number) {
  snapStep.value = step;
  sceneService?.setSnapStep(step);
}

const showSceneSettings = ref(false);
const sceneSettings = ref({
  showGrid: true,
  background: '#f0f0f0',
  zoomSpeed: 1,
  gridWidth: 200,
  gridLength: 200,
});

// ─── Debug panel ─────────────────────────────────────────────────────────

const showDebugPanel = ref(false);
const debugFps = ref(0);
const debugNow = ref('');
const debugSceneInfo = ref<Array<{ index: number; type: string; name: string; visible: boolean; childrenCount: number }>>([]);
const debugGizmoInfo = ref('—');
const debugCamera = ref<{ x: string; y: string; z: string; tx: string; ty: string; tz: string } | null>(null);
const debugFeatureDocStats = ref<FeatureDocStats | null>(null);
const debugStorageStats = ref<StorageStat[]>([]);

/** Перехватчик console.warn/error — установлен при открытии панели. */
const debugLogger = new DebugLogger(200);

// ─── Test checklist ──────────────────────────────────────────────────────

const showTestChecklist = ref(false);
const checklistState = new TestChecklistState();
const checklistTotalCount = totalChecklistCount();
checklistState.load();

function toggleTestChecklist() {
  showTestChecklist.value = !showTestChecklist.value;
}

let _debugFrames = 0;
let _debugLastTime = performance.now();

function updateDebugFps() {
  _debugFrames++;
  const now = performance.now();
  if (now - _debugLastTime >= 1000) {
    debugFps.value = _debugFrames;
    _debugFrames = 0;
    _debugLastTime = now;
    debugNow.value = new Date().toLocaleTimeString('ru-RU');
    if (showDebugPanel.value) refreshDebugStats();
  }
}

function refreshDebugStats(): void {
  debugFeatureDocStats.value = buildFeatureDocStats(currentFeatureDoc());
  debugStorageStats.value = buildStorageStats(PRIMARY_KEYS);
}

function onDownloadDebugSnapshot(): void {
  refreshDebugStats();
  const snapshot = buildDebugSnapshot({
    activeSceneIndex: activeSceneIndex.value,
    treeVersion: treeVersion.value,
    fps: debugFps.value,
    camera: debugCamera.value,
    selection: {
      count: selectedFeatureIds.value.length,
      primary: selectedFeature.value
        ? {
            type: debugNodeType.value,
            name: selectedFeature.value.name ?? null,
            uuid: selectedFeature.value.id,
            params: selectedFeature.value.params
              ? JSON.parse(JSON.stringify(selectedFeature.value.params))
              : null,
            geometryParams: null,
          }
        : null,
    },
    modes: {
      mirror: mirrorModeActive.value,
      cruise: cruiseModeActive.value,
      alignment: alignmentModeActive.value,
      chamfer: chamferModeActive.value,
      generator: generatorModeActive.value,
      generatorType: generatorType.value,
    },
    snapStep: snapStep.value,
    sceneSettings: { ...sceneSettings.value },
    sceneInfo: debugSceneInfo.value,
    gizmo: debugGizmoInfo.value,
    history: { canUndo: canUndo.value, canRedo: canRedo.value },
    featureDoc: debugFeatureDocStats.value,
    storage: debugStorageStats.value,
    logs: [...debugLogger.logs.value],
  });

  // Текущая сцена в обоих форматах.
  try {
    const root = modelApp.value?.getModelManager()?.getTree();
    if (root) {
      const serializer = modelApp.value!.getSerializer();
      snapshot.legacyTree = serializer.toRootJSON(root);
    }
  } catch (e) {
    snapshot.legacyTreeError = e instanceof Error ? e.message : String(e);
  }
  const fd = currentFeatureDoc();
  if (fd) {
    try { snapshot.featureDocJson = fd.toJSON(); }
    catch (e) { snapshot.featureDocJsonError = e instanceof Error ? e.message : String(e); }
  }

  downloadDebugSnapshot(snapshot);
}

const debugNodeType = computed(() => {
  treeVersion.value;
  const f = selectedFeature.value;
  if (!f) return '—';
  return `${f.type}`;
});

function readVec3(arr: unknown): [number, number, number] | null {
  if (Array.isArray(arr) && arr.length >= 3
      && typeof arr[0] === 'number' && typeof arr[1] === 'number' && typeof arr[2] === 'number') {
    return [arr[0], arr[1], arr[2]];
  }
  return null;
}

const debugNodePos = computed(() => {
  treeVersion.value;
  const p = readVec3((selectedFeature.value?.params as Record<string, unknown> | undefined)?.position);
  return p ? `${p[0].toFixed(1)}, ${p[1].toFixed(1)}, ${p[2].toFixed(1)}` : '—';
});

const debugNodeScale = computed(() => {
  treeVersion.value;
  const s = readVec3((selectedFeature.value?.params as Record<string, unknown> | undefined)?.scale);
  return s ? `${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${s[2].toFixed(2)}` : '1, 1, 1';
});

const debugNodeRot = computed(() => {
  treeVersion.value;
  const r = readVec3((selectedFeature.value?.params as Record<string, unknown> | undefined)?.rotation);
  return r ? `${(r[0] * RAD_TO_DEG).toFixed(1)}°, ${(r[1] * RAD_TO_DEG).toFixed(1)}°, ${(r[2] * RAD_TO_DEG).toFixed(1)}°` : '0, 0, 0';
});

const debugNodeCenter = computed(() => {
  if (!sceneService) return '—';
  const fid = selectedFeatureId.value;
  if (!fid) return '—';
  const obj = sceneService.findObject3DByFeatureId(fid);
  if (!obj) return '—';
  const box = new THREE.Box3().setFromObject(obj);
  const c = new THREE.Vector3();
  box.getCenter(c);
  return `${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`;
});

/** Объединённый объект selection для DebugPanel.vue. */
const debugSelection = computed(() => {
  const f = selectedFeature.value;
  if (!f) return null;
  return {
    type: debugNodeType.value,
    name: f.name ?? null,
    uuid: f.id,
    pos: debugNodePos.value,
    scale: debugNodeScale.value,
    rot: debugNodeRot.value,
    center: debugNodeCenter.value,
    totalCount: selectedFeatureIds.value.length,
  };
});

/** Объединённый объект режимов для DebugPanel.vue. */
const debugModes = computed(() => ({
  mirror: mirrorModeActive.value,
  cruise: cruiseModeActive.value,
  alignment: alignmentModeActive.value,
  chamfer: chamferModeActive.value,
  generator: generatorModeActive.value,
  generatorType: generatorType.value,
}));

/** История + версия дерева. */
const debugHistory = computed(() => ({
  canUndo: canUndo.value,
  canRedo: canRedo.value,
  treeVersion: treeVersion.value,
}));

// ─── Geometry field definitions per primitive type ─────────────────────────

const GEOMETRY_FIELDS = {
  box: [
    { key: 'width', label: 'Ширина' },
    { key: 'height', label: 'Высота' },
    { key: 'depth', label: 'Глубина' },
    { key: 'bevelRadius', label: 'Скругление' },
    { key: 'bevelSegments', label: 'Сегм. скругл.' },
  ],
  sphere: [
    { key: 'radius', label: 'Радиус' },
    { key: 'widthSegments', label: 'Сегм. долготы' },
    { key: 'heightSegments', label: 'Сегм. широты' },
  ],
  cylinder: [
    { key: 'radiusTop', label: 'Радиус верха' },
    { key: 'radiusBottom', label: 'Радиус основания' },
    { key: 'height', label: 'Высота' },
    { key: 'segments', label: 'Сегменты' },
    { key: 'bevelRadius', label: 'Скругление' },
    { key: 'bevelSegments', label: 'Сегм. скругл.' },
  ],
  cone: [
    { key: 'radius', label: 'Радиус основания' },
    { key: 'height', label: 'Высота' },
    { key: 'segments', label: 'Сегменты' },
  ],
  torus: [
    { key: 'radius', label: 'Радиус кольца' },
    { key: 'tube', label: 'Толщина трубки' },
    { key: 'segments', label: 'Сегменты' },
  ],
  plane: [
    { key: 'width', label: 'Ширина' },
    { key: 'height', label: 'Высота' },
  ],
  ring: [
    { key: 'innerRadius', label: 'Внутр. радиус' },
    { key: 'outerRadius', label: 'Внешн. радиус' },
    { key: 'segments', label: 'Сегменты' },
  ],
  thread: [
    { key: 'outerDiameter', label: 'Внеш. Ø' },
    { key: 'innerDiameter', label: 'Внутр. Ø' },
    { key: 'pitch', label: 'Шаг' },
    { key: 'turns', label: 'Витки' },
    { key: 'segments', label: 'Сегм/виток' },
  ],
  knurl: [
    { key: 'outerDiameter', label: 'Внеш. Ø' },
    { key: 'innerDiameter', label: 'Внутр. Ø' },
    { key: 'height', label: 'Высота' },
    { key: 'notchCount', label: 'Насечек' },
    { key: 'knurlAngle', label: 'Угол' },
    { key: 'segmentsPerNotch', label: 'Сегм/нас.' },
    { key: 'heightSegments', label: 'Сегм/выс.' },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function isPrimitive(node: any): node is Primitive {
  return node instanceof Primitive;
}

function isGroupNode(node: any): node is GroupNode {
  return node instanceof GroupNode;
}

// ─── History ───────────────────────────────────────────────────────────────

/**
 * Снапшот текущего состояния в виде FeatureDocumentJSON v2 (canonical
 * формат). После save/load flip'а primary path: читаем из живого
 * featureDoc'а напрямую (его `toJSON()` — canonical). Fallback на legacy
 * migrate, если featureDoc по каким-то причинам ещё не инициализирован.
 */
function captureFeatureDocSnapshot(): FeatureDocumentJSON | null {
  const fd = sceneService?.getFeatureDocument();
  if (fd) {
    try {
      return fd.toJSON();
    } catch (e) {
      console.warn('[Constructor] featureDoc.toJSON failed, falling back to legacy migrate:', e);
    }
  }
  const root = modelApp.value?.getModelManager()?.getTree();
  if (!root) return null;
  const serializer = modelApp.value!.getSerializer();
  const legacyJson = serializer.toRootJSON(root);
  return migrateLegacyTreeToDocument(legacyJson);
}

/**
 * Restore из FeatureDocumentJSON: использует унифицированный load-flip путь
 * через sceneService.loadFromV2JSON. featureDoc восстанавливается напрямую,
 * ModelNode-tree деривируется внутри.
 */
function restoreFromFeatureSnapshot(json: FeatureDocumentJSON): void {
  if (!sceneService) return;
  const serializer = modelApp.value!.getSerializer();
  sceneService.loadFromV2JSON(json, (legacyJson) => {
    const newRoot = serializer.fromJSON(legacyJson);
    sanitizeRootParams(newRoot);
    return newRoot;
  });
  setSelection([]);
  treeVersion.value++;
  _saveToLocalStorage();
}

/**
 * Оборачивает мутацию before/after-снапшотами в FeatureDocumentJSON v2
 * формате и пушит FeatureSnapshotCommand. Мутация синхронно меняет
 * ModelNode-tree (текущий source-of-truth Phase 1); на undo/redo дерево
 * derive'ится обратно из снапшота через featureDocumentToLegacy.
 */
function withHistory(mutate: () => void) {
  const beforeJSON = captureFeatureDocSnapshot();
  mutate();
  const afterJSON = captureFeatureDocSnapshot();
  if (beforeJSON && afterJSON) {
    const cmd = new FeatureSnapshotCommand(beforeJSON, afterJSON, restoreFromFeatureSnapshot);
    modelApp.value!.getHistoryManager().push(cmd);
  }
  treeVersion.value++;
  _saveToLocalStorage();
}

/**
 * History-обёртка для feature-doc мутаций (P2-prep flip API). Объединяет:
 *  - before/after captureFeatureDocSnapshot.
 *  - sceneService.mutateFeatureDoc (Template Method из ConstructorSceneService).
 *  - push FeatureSnapshotCommand в history.
 *  - treeVersion bump + _saveToLocalStorage.
 *
 * `mutate` получает featureDoc и возвращает произвольный T (например, id новой
 * фичи или extracted children) — caller может его использовать после.
 *
 * Замена для дублирующегося boilerplate в mergeSelected/ungroupSelected/
 * generator/mirror/etc.
 */
function withFeatureDocHistory<T>(mutate: (doc: FeatureDocument) => T): T | null {
  if (!sceneService) return null;
  let captured: T | null = null;
  const beforeJSON = captureFeatureDocSnapshot();
  sceneService.mutateFeatureDoc((doc) => { captured = mutate(doc); });
  // Sync gizmo/glow через sceneService.setSelection. FeatureIds стабильны
  // через rebuild — никакого re-resolve не нужно.
  sceneService.setSelection(selectedFeatureIdsRaw.value, selectedFeatureId.value);
  const afterJSON = captureFeatureDocSnapshot();
  if (beforeJSON && afterJSON) {
    const cmd = new FeatureSnapshotCommand(beforeJSON, afterJSON, restoreFromFeatureSnapshot);
    modelApp.value!.getHistoryManager().push(cmd);
  }
  treeVersion.value++;
  _saveToLocalStorage();
  return captured;
}

function undo() {
  modelApp.value!.getHistoryManager().undo();
  // treeVersion++ and rebuildSceneFromTree happen inside restoreFromFeatureSnapshot
}

function redo() {
  modelApp.value!.getHistoryManager().redo();
}

// ─── localStorage ──────────────────────────────────────────────────────────

// Дебаунс + перенос фактической записи на setTimeout(0): JSON.stringify дерева
// с большими base64-строками STL и последующий localStorage.setItem — это
// сотни миллисекунд синхронной работы, которую нельзя было делать прямо в
// flow импорта/драга (оттуда и подвисания «страница не отвечает»).
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

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
    const v2 = fd.toJSON();
    localStorage.setItem(PRIMARY_KEYS[sceneIndex], JSON.stringify(v2));
  } catch (e) {
    console.warn('[FeatureDoc] v2 write failed:', e);
  }
}

function _saveToLocalStorage() {
  if (_saveTimer !== null) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    _flushSave();
  }, 300);
}

function _flushPendingSave() {
  if (_saveTimer !== null) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
    _flushSave();
  }
}

function saveToLocalStorage() {
  _saveToLocalStorage();
}

async function loadFromLocalStorage() {
  try {
    const v2Saved = localStorage.getItem(PRIMARY_KEYS[activeSceneIndex.value]);
    if (!v2Saved || !sceneService) return;
    const v2: FeatureDocumentJSON = JSON.parse(v2Saved);
    await loadV2IntoScene(v2);
  } catch (e) {
    console.warn('[Constructor] Failed to load scene:', e);
  }
}

/**
 * Общий хелпер для load-flip путей: пушит v2 в sceneService через
 * loadFromV2JSON. ModelNode-tree деривация делегирована Serializer.fromJSON
 * через callback (sceneService не знает про serializer).
 *
 * Imported-фичи требуют резолвенного `params.geometry` ДО loadFromJSON
 * (EvaluateVisitor бросит без него). Резолвим через preResolveBinaryRefs
 * на legacyJson, потом legacyJson попадает обратно в featureDoc через
 * inverse-конверсию (то есть через `loadFromV2JSON` → `featureDocumentToLegacy`
 * → ModelNode → legacy fromJSON, который умеет binaryRef-resolve в memory).
 */
async function loadV2IntoScene(v2: FeatureDocumentJSON): Promise<void> {
  if (!sceneService) return;
  const serializer = modelApp.value!.getSerializer();

  // Резолвим бинарники: для imported-фич v2 переводим в legacy, потом
  // serializer.fromJSON на legacy умеет подгружать binaryRef'ы из IDB и
  // кладёт BufferGeometry в ImportedMeshNode.geometry. После того как
  // ModelNode-tree готов, его можно сериализовать обратно в v2 c уже
  // загруженной geometry. Этот roundtrip временный — после mutation flips
  // будем грузить geometry напрямую в v2.params.
  const legacyForResolve = featureDocumentToLegacy(v2);
  Serializer.migrateLegacyYupToZupIfNeeded(legacyForResolve);
  await Serializer.preResolveBinaryRefs(legacyForResolve);

  sceneService.loadFromV2JSON(v2, (legacyJson) => {
    // Используем legacyForResolve, в котором geometry уже подгружена.
    // Игнорируем legacyJson, который sceneService свеже-сгенерировал —
    // его imported-фичи не имеют geometry в памяти.
    const newRoot = serializer.fromJSON(legacyForResolve);
    sanitizeRootParams(newRoot);
    return newRoot;
  });

  setSelection([]);
  treeVersion.value++;
}

/**
 * Чистит у корневой группы position/rotation/scale: ни одна штатная операция
 * Constructor.vue не должна их выставлять, но они могли случайно «протечь»
 * (например, mirror/rotate с выделенным root). Если оставить, вся сцена
 * рендерится через эту корневую трансформацию — примитивы появляются вне
 * сетки, выравнивание/зеркалирование считают мировые bbox в смещённой системе.
 */
function sanitizeRootParams(root: ModelNode): void {
  if (!root.params) return;
  if (root.params.position) delete root.params.position;
  if (root.params.rotation) delete root.params.rotation;
  if (root.params.scale) delete root.params.scale;
}

async function saveSceneToFile() {
  try {
    // Экспорт в v2-формате через текущий featureDoc. Fallback на
    // legacy v1, если featureDoc невалиден.
    let payload: any;
    const fd = currentFeatureDoc();
    if (fd) {
      try {
        payload = fd.toJSON();
      } catch (e) {
        console.warn('[Constructor] file export: featureDoc.toJSON failed:', e);
      }
    }
    if (!payload) {
      const serializer = modelApp.value!.getSerializer();
      const root = modelApp.value!.getModelManager().getTree();
      payload = serializer.toRootJSON(root);
    }
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('[Constructor] Failed to save scene to file:', e);
  }
}

function loadSceneFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        // Унифицированный load-flip путь: оба формата сводятся к v2 и идут
        // через loadV2IntoScene. История пишется ДО загрузки (before/after
        // снапшот featureDoc охватит изменение root'а).
        let v2: FeatureDocumentJSON;
        if (parsed && typeof parsed === 'object' && parsed.version === 2) {
          v2 = parsed as FeatureDocumentJSON;
        } else {
          // Legacy v1: применяем Y↔Z миграцию и резолв binaryRef'ов до миграции в v2,
          // чтобы Serializer.fromJSON смог инжектить geometry в ImportedMeshNode.
          Serializer.migrateLegacyYupToZupIfNeeded(parsed);
          await Serializer.preResolveBinaryRefs(parsed);
          v2 = migrateLegacyTreeToDocument(parsed);
        }
        const beforeJSON = captureFeatureDocSnapshot();
        await loadV2IntoScene(v2);
        const afterJSON = captureFeatureDocSnapshot();
        if (beforeJSON && afterJSON) {
          const cmd = new FeatureSnapshotCommand(beforeJSON, afterJSON, restoreFromFeatureSnapshot);
          modelApp.value!.getHistoryManager().push(cmd);
        }
      } catch (e) {
        console.warn('[Constructor] Failed to load scene from file:', e);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function switchScene(index: number) {
  if (index === activeSceneIndex.value) return;
  _saveToLocalStorage();
  activeSceneIndex.value = index;
  modelApp.value!.getHistoryManager().clear();

  const v2Saved = localStorage.getItem(PRIMARY_KEYS[index]);
  if (v2Saved && sceneService) {
    try {
      const v2: FeatureDocumentJSON = JSON.parse(v2Saved);
      await loadV2IntoScene(v2);
      return;
    } catch (e) {
      console.warn('[Constructor] v2 switch load failed:', e);
    }
  }
  // Пустой слот → чистая сцена.
  modelApp.value!.getModelManager().setTree(new GroupNode());
  setSelection([]);
  treeVersion.value++;
  if (sceneService) sceneService.rebuildSceneFromTree();
}

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
  selectedFeatureIdsRaw.value = ids.length ? [...ids] : [];
  selectedFeatureId.value = ids.length ? ids[ids.length - 1] : null;
  if (!ids.length && mirrorModeActive.value) {
    mirrorModeActive.value = false;
    if (sceneService) sceneService.setMirrorMode(false);
  }
  if (sceneService) {
    sceneService.setSelection(selectedFeatureIdsRaw.value, selectedFeatureId.value);
  }
}

/** Backward-compat: ModelNode-based setSelection — резолвит nodes → featureIds. */
function setSelection(nodes: ModelNode[]): void {
  if (!sceneService) {
    setSelectionByIds([]);
    return;
  }
  const ids: string[] = [];
  for (const n of nodes) {
    const fid = sceneService.getFeatureIdByNode(n);
    if (fid) ids.push(fid);
  }
  setSelectionByIds(ids);
}

function onSelectFeature(featureId: string, shiftKey = false): void {
  const list = selectedFeatureIdsRaw.value;
  if (shiftKey) {
    const idx = list.indexOf(featureId);
    if (idx !== -1) {
      setSelectionByIds(list.filter((_, i) => i !== idx));
    } else {
      setSelectionByIds([...list, featureId]);
    }
  } else {
    setSelectionByIds([featureId]);
  }
}

/** Legacy wrapper — резолвит ModelNode → featureId, делегирует onSelectFeature. */
function onSelectNode(node: ModelNode, shiftKey = false): void {
  const fid = sceneService?.getFeatureIdByNode(toRaw(node));
  if (fid) onSelectFeature(fid, shiftKey);
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
  setTimeout(() => { addCooldown.value = false; }, 3000);
}

/**
 * Smart duplicate state.
 * First Ctrl+D clones in place with no offset.
 * After the user modifies the clone (position/scale/rotation), subsequent
 * Ctrl+D duplicates the last clone and applies the same delta again.
 */
type Vec3 = [number, number, number];
const smartDup = {
  /** Source feature-id, последняя дублированная (для smart-delta). */
  lastCloneId: null as string | null,
  /** Snapshot params Transform-обёртки сразу после клонирования. */
  snapshotParams: null as { position: Vec3; rotation: Vec3; scale: Vec3 } | null,
  /** Remembered delta. Если пользователь не двигал клон — переиспользуется. */
  lastDelta: null as { pos: Vec3; scale: Vec3; rot: Vec3 } | null,
};

function duplicateSelected(shrink: boolean = false) {
  if (!sceneService) return;
  const featureId = selectedFeatureId.value;
  const fd = sceneService.getFeatureDocument();
  if (!featureId || !fd) return;

  // Root scene-group дублировать нельзя.
  if (fd.rootIds.includes(featureId) && fd.rootIds.length === 1) {
    const target = fd.graph.get(featureId);
    if (target?.type === 'group') return;
  }

  // Найти место (parent.inputs либо rootIds), чтобы вставить клон после
  // оригинала.
  const parent = findParent(fd, featureId);
  if (!parent && !fd.rootIds.includes(featureId)) return;

  // Smart-duplicate delta: если последняя дубликация была из этого же
  // featureId и пользователь сдвинул клон — повторяем смещение.
  let delta: { pos: Vec3; scale: Vec3; rot: Vec3 } | null = null;
  const target = fd.graph.get(featureId);
  if (smartDup.lastCloneId === featureId && smartDup.snapshotParams && target?.type === 'transform') {
    const cur = (target as TransformFeature).params;
    const snap = smartDup.snapshotParams;
    const dp: Vec3 = [cur.position[0] - snap.position[0], cur.position[1] - snap.position[1], cur.position[2] - snap.position[2]];
    const ds: Vec3 = [cur.scale[0] / snap.scale[0], cur.scale[1] / snap.scale[1], cur.scale[2] / snap.scale[2]];
    const dr: Vec3 = [cur.rotation[0] - snap.rotation[0], cur.rotation[1] - snap.rotation[1], cur.rotation[2] - snap.rotation[2]];
    const hasChange = dp.some((v) => v !== 0) || ds.some((v) => v !== 1) || dr.some((v) => v !== 0);
    if (hasChange) smartDup.lastDelta = { pos: dp, scale: ds, rot: dr };
    delta = smartDup.lastDelta;
  } else {
    smartDup.lastDelta = null;
  }

  // Shrink: рассчитываем уменьшение scale через bbox исходного меша.
  let shrinkFactor: Vec3 | null = null;
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
    smartDup.lastDelta = null;
    delta = null;
  }

  let newRootId: string | null = null;
  withFeatureDocHistory((doc) => {
    const { rootId } = cloneFeatureSubgraph(doc, featureId);
    newRootId = rootId;

    // Гарантируем Transform-обёртку на корне клона — нужно для shrink/delta
    // и для последующего smartDup сравнения.
    const transformId = ensureTransformWrapper(doc, rootId);
    const transform = doc.graph.get(transformId) as TransformFeature;
    const cur = transform.params;
    let nextPos: Vec3 = [...cur.position];
    let nextScale: Vec3 = [...cur.scale];
    let nextRot: Vec3 = [...cur.rotation];
    if (delta) {
      nextPos = [nextPos[0] + delta.pos[0], nextPos[1] + delta.pos[1], nextPos[2] + delta.pos[2]];
      if (delta.scale.some((v) => v !== 1)) {
        nextScale = [nextScale[0] * delta.scale[0], nextScale[1] * delta.scale[1], nextScale[2] * delta.scale[2]];
      }
      if (delta.rot.some((v) => v !== 0)) {
        nextRot = [nextRot[0] + delta.rot[0], nextRot[1] + delta.rot[1], nextRot[2] + delta.rot[2]];
      }
    }
    if (shrinkFactor) {
      nextScale = [nextScale[0] * shrinkFactor[0], nextScale[1] * shrinkFactor[1], nextScale[2] * shrinkFactor[2]];
    }
    doc.updateParams<{ position: Vec3; scale: Vec3; rotation: Vec3 }>(transformId, {
      position: nextPos, scale: nextScale, rotation: nextRot,
    });
    newRootId = transformId;

    // Подключаем клон к parent сразу после оригинала. Если parent — composite,
    // вставляем в inputs; иначе — в rootIds.
    if (parent) {
      const parentFeature = doc.graph.get(parent.parentId);
      if (parentFeature && 'getInputs' in parentFeature) {
        const inputs = [...(parentFeature as { getInputs(): readonly string[] }).getInputs()];
        const idx = inputs.indexOf(featureId);
        if (idx !== -1) inputs.splice(idx + 1, 0, transformId);
        else inputs.push(transformId);
        doc.updateInputs(parent.parentId, inputs);
      }
    } else {
      const nextRoots = [...doc.rootIds];
      const idx = nextRoots.indexOf(featureId);
      if (idx !== -1) nextRoots.splice(idx + 1, 0, transformId);
      else nextRoots.push(transformId);
      doc.setRootIds(nextRoots);
    }
  });

  if (!newRootId) return;

  smartDup.lastCloneId = newRootId;
  const fd2 = sceneService.getFeatureDocument();
  const clonedTransform = fd2?.graph.get(newRootId);
  if (clonedTransform?.type === 'transform') {
    const p = (clonedTransform as TransformFeature).params;
    smartDup.snapshotParams = {
      position: [...p.position] as Vec3,
      scale: [...p.scale] as Vec3,
      rotation: [...p.rotation] as Vec3,
    };
  } else {
    smartDup.snapshotParams = null;
  }

  setSelectionByIds([newRootId]);
}

function toggleMirrorMode() {
  if (!sceneService) return;
  mirrorModeActive.value = !mirrorModeActive.value;
  sceneService.setMirrorMode(mirrorModeActive.value);
}

function toggleCruiseMode() {
  if (!sceneService) return;
  cruiseModeActive.value = !cruiseModeActive.value;
  sceneService.setCruiseMode(cruiseModeActive.value);
}

function toggleDebugPanel() {
  showDebugPanel.value = !showDebugPanel.value;
  if (sceneService) sceneService.setDebugPanelVisible(showDebugPanel.value);
  if (showDebugPanel.value) {
    debugLogger.install();
    refreshDebugStats();
  } else {
    debugLogger.uninstall();
  }
}

function toggleAlignmentMode() {
  if (!sceneService) return;
  alignmentModeActive.value = !alignmentModeActive.value;
  sceneService.setAlignmentMode(alignmentModeActive.value);
}

function toggleGeneratorMode() {
  if (!sceneService) return;
  generatorModeActive.value = !generatorModeActive.value;
  sceneService.setGeneratorMode(generatorModeActive.value);
  if (generatorModeActive.value) {
    const gm = sceneService.getGeneratorMode();
    gm.settings.type = generatorType.value;
    gm.settings.thread = { ...threadSettings.value, profile: 'trapezoid' };
    gm.settings.knurl = { ...knurlSettings.value };
    gm.updatePreview();
    // Deactivate other exclusive modes
    if (chamferModeActive.value) {
      chamferModeActive.value = false;
      sceneService.setChamferMode(false);
    }
  }
}

function confirmGenerator() {
  if (!sceneService || !modelApp.value) return;
  const gm = sceneService.getGeneratorMode();
  gm.confirm();
}

function toggleChamferMode() {
  if (!sceneService) return;
  chamferModeActive.value = !chamferModeActive.value;
  sceneService.setChamferMode(chamferModeActive.value);
  if (chamferModeActive.value) {
    const cm = sceneService.getChamferMode();
    cm.settings.radius = chamferRadius.value;
    cm.settings.profile = 'concave';
  }
}

/**
 * Featuredoc-путь chamfer-операции. Возвращает true если operation выполнена,
 * false если нужен fallback (target не найден, инвалидный inputs у Transform'а).
 *
 * Стратегия:
 *  1. ensureTransformWrapper(target) — гарантируем Transform над target'ом
 *     (он держит position/rotation/scale).
 *  2. Получаем innerPrimitiveId = transform.inputs[0].
 *  3. Создаём новую GroupFeature[innerPrimitiveId, chamferRootId] и
 *     заменяем transform.inputs на [newGroupId]. После этого target =
 *     transform → group → {primitive, chamfer} — оба ребёнка в одной
 *     local-системе, что даёт корректный subtract.
 *  4. Если target уже composite (group/boolean) — просто добавляем chamfer
 *     в его inputs.
 */
function _applyChamferToFeature(
  featureId: string,
  edge: Record<string, any>,
  settings: { radius: number; profile: 'convex' | 'concave' | 'flat' },
): boolean {
  if (!sceneService) return false;
  const fd = sceneService.getFeatureDocument();
  if (!fd) return false;
  const target = fd.graph.get(featureId);
  if (!target) return false;

  const r = settings.radius;
  const spec: EdgeSpec = edge.kind === 'circular'
    ? {
        kind: 'circular',
        localMid: (edge.localMid as THREE.Vector3).clone(),
        radius: edge.radius as number,
        isTopRim: edge.isTopRim === true,
      }
    : {
        kind: 'linear',
        axis: edge.axis as 'x' | 'y' | 'z',
        localMid: (edge.localMid as THREE.Vector3).clone(),
        length: (edge.localStart as THREE.Vector3).distanceTo(edge.localEnd as THREE.Vector3),
        perpDirX: edge.perpDirX as number,
        perpDirZ: edge.perpDirZ as number,
      };
  const chamfer = ChamferFeatureBuilder.build(spec, r);

  withFeatureDocHistory((doc) => {
    for (const f of chamfer.features) doc.addFeature(f);

    const t = doc.graph.get(featureId);
    if (!t) return;
    if (t.type === 'group' || t.type === 'boolean') {
      const inputs = [...(t as { getInputs(): readonly string[] }).getInputs(), chamfer.rootId];
      doc.updateInputs(featureId, inputs);
      return;
    }
    if (t.type === 'transform') {
      const inner = (t as { getInputs(): readonly string[] }).getInputs();
      if (inner.length !== 1) return;
      const innerId = inner[0];
      const wrapId = nextP2FeatureId('chamfer_target_group');
      const wrap = new GroupFeature(wrapId, {}, [innerId, chamfer.rootId]);
      doc.addFeature(wrap);
      doc.updateInputs(featureId, [wrapId]);
      return;
    }
    // Leaf (примитив без Transform): обернём в Transform, потом тот же путь.
    const transformId = ensureTransformWrapper(doc, featureId);
    const wrapId = nextP2FeatureId('chamfer_target_group');
    const wrap = new GroupFeature(wrapId, {}, [featureId, chamfer.rootId]);
    doc.addFeature(wrap);
    doc.updateInputs(transformId, [wrapId]);
  });
  return true;
}

function applyChamferToEdge(
  obj: THREE.Object3D,
  edge: Record<string, any>,
  settings: { radius: number; profile: 'convex' | 'concave' | 'flat' },
) {
  if (!sceneService || !modelApp.value) return;
  const node = (obj.userData as { node?: ModelNode }).node;
  if (!node) return;
  const featureId = sceneService.getFeatureIdByNode(node);
  if (!featureId) {
    console.warn('[Constructor.applyChamferToEdge] нет featureId mapping — операция пропущена');
    return;
  }
  if (_applyChamferToFeature(featureId, edge, settings)) {
    treeVersion.value++;
  }
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
  const fd = sceneService.getFeatureDocument();
  if (!featureId || !fd) return;

  // Root scene-group удалять нельзя.
  if (fd.rootIds.includes(featureId) && fd.rootIds.length === 1) {
    const target = fd.graph.get(featureId);
    if (target?.type === 'group') return;
  }

  const removed = withFeatureDocHistory((doc) => {
    const target = doc.graph.get(featureId);
    if (!target) return false;
    // 1. Detach из parent.inputs либо rootIds.
    const parent = findParent(doc, featureId);
    if (parent) {
      const parentFeature = doc.graph.get(parent.parentId);
      if (parentFeature && 'getInputs' in parentFeature) {
        const next = (parentFeature as { getInputs(): readonly string[] }).getInputs()
          .filter((id) => id !== featureId);
        doc.updateInputs(parent.parentId, next);
      }
    } else {
      const nextRoots = doc.rootIds.filter((id) => id !== featureId);
      doc.setRootIds(nextRoots);
    }
    // 2. Garbage collect orphan-фичи sub-DAG'а (топосорт reverse): удаляем
    //    каждую только если на неё больше никто не ссылается.
    const visited = new Set<string>();
    const collect = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const f = doc.graph.get(id);
      if (!f) return;
      for (const inputId of f.getInputs()) collect(inputId);
    };
    collect(featureId);
    const removalOrder = [...visited].reverse();
    for (const id of removalOrder) {
      const stillReferenced =
        doc.rootIds.includes(id)
        || [...doc.graph.values()].some((f) => f.getInputs().includes(id));
      if (!stillReferenced && doc.graph.has(id)) {
        const f = doc.graph.get(id);
        if (f && 'getInputs' in f && f.getInputs().length > 0) {
          try { doc.updateInputs(id, []); } catch { /* leaf */ }
        }
        try { doc.removeFeature(id); } catch { /* still referenced */ }
      }
    }
    return true;
  });
  if (!removed) return;
  setSelectionByIds(selectedFeatureIds.value.filter((id) => id !== featureId));
}

function mergeSelected() {
  if (!sceneService) return;
  const featureIds = [...selectedFeatureIds.value];
  if (featureIds.length < 2) return;

  const newGroupId = withFeatureDocHistory(
    (doc) => GroupingFeatureOperations.merge(doc, featureIds),
  );
  if (!newGroupId) return;
  setSelectionByIds([newGroupId]);
}

function ungroupSelected() {
  if (!sceneService) return;
  const featureId = selectedFeatureId.value;
  if (!featureId) return;
  const fd = sceneService.getFeatureDocument();
  if (!fd) return;
  // Не разгруппировываем root scene-group.
  if (fd.rootIds.includes(featureId) && fd.rootIds.length === 1) {
    const target = fd.graph.get(featureId);
    if (target?.type === 'group') return;
  }

  const extractedIds = withFeatureDocHistory(
    (doc) => GroupingFeatureOperations.ungroup(doc, featureId),
  );
  if (!extractedIds || extractedIds.length === 0) return;
  setSelectionByIds([extractedIds[0]]);
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const tag = (target?.tagName ?? '').toLowerCase();
  const isInputLike = ['input', 'textarea', 'select'].includes(tag)
    || target?.isContentEditable;
  if (isInputLike) return;

  const hasCtrl = event.ctrlKey || event.metaKey;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (canDeleteSelected.value) { event.preventDefault(); deleteSelected(); }
    return;
  }

  // Arrow keys: move selected object relative to camera. Оборачиваем в общий
  // withHistory — он сам капчит before/after и пушит FeatureSnapshotCommand.
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && selectedFeatureId.value && sceneService) {
    event.preventDefault();
    const mult = event.shiftKey ? 5 : 1;
    withHistory(() => {
      if (hasCtrl) {
        if (event.key === 'ArrowUp') sceneService!.moveSelectedByKey('up', mult);
        else if (event.key === 'ArrowDown') sceneService!.moveSelectedByKey('down', mult);
      } else {
        if (event.key === 'ArrowLeft') sceneService!.moveSelectedByKey('left', mult);
        else if (event.key === 'ArrowRight') sceneService!.moveSelectedByKey('right', mult);
        else if (event.key === 'ArrowUp') sceneService!.moveSelectedByKey('forward', mult);
        else if (event.key === 'ArrowDown') sceneService!.moveSelectedByKey('backward', mult);
      }
    });
    return;
  }

  if (event.code === 'KeyM' && !hasCtrl) {
    event.preventDefault();
    toggleMirrorMode();
    return;
  }
  if (event.code === 'KeyC' && !hasCtrl) {
    event.preventDefault();
    if (sceneService) {
      snapStep.value = snapStep.value > 0 ? 0 : 1;
      sceneService.setSnapStep(snapStep.value);
    }
    return;
  }
  if (event.code === 'KeyL' && !hasCtrl) {
    if (selectedFeatureIds.value.length >= 2) {
      event.preventDefault();
      toggleAlignmentMode();
    }
    return;
  }
  if (event.code === 'KeyF' && !hasCtrl) {
    if (hasSceneObjects.value) {
      event.preventDefault();
      toggleChamferMode();
    }
    return;
  }

  if (!hasCtrl) return;
  if (event.code === 'KeyZ') {
    event.preventDefault();
    if (event.shiftKey) { if (canRedo.value) redo(); }
    else { if (canUndo.value) undo(); }
    return;
  }
  if (event.code === 'KeyD') {
    event.preventDefault();
    if (canDeleteSelected.value) duplicateSelected(event.shiftKey);
    return;
  }
  if (event.code === 'KeyM') {
    event.preventDefault();
    toggleMirrorMode();
    return;
  }
  if (event.code === 'KeyG') {
    event.preventDefault();
    if (event.shiftKey) { if (canUngroup.value) ungroupSelected(); }
    else { if (canMerge.value) mergeSelected(); }
    return;
  }
}

// ─── Export ───────────────────────────────────────────────────────

const showExportModal = ref(false);
const exportFormat = ref('stl');
const exportOnlySelected = ref(false);
const exporting = ref(false);
const exportPercent = ref(0);
const exportStatusText = ref('');

async function doExport() {
  if (!sceneService || exporting.value) return;
  exporting.value = true;
  exportPercent.value = 0;
  exportStatusText.value = 'Подготовка модели...';

  const ext = exportFormat.value;
  const onlySelected = exportOnlySelected.value;
  const root = modelApp.value?.getModelManager()?.getTree();
  const baseName = root?.name || 'vsqr';
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const filename = `${baseName}_${ts}.${ext}`;

  const onProgress = (done: number, total: number) => {
    if (total === 0) {
      exportPercent.value = 100;
    } else {
      exportPercent.value = Math.round((done / total) * 90);
    }
    exportStatusText.value = `CSG: ${done} / ${total}`;
  };

  try {
    // Allow UI to render the progress bar before blocking
    await new Promise((r) => setTimeout(r, 50));

    const exporter = sceneService.getExporter();
    if (ext === 'stl') {
      await exporter.exportSTLAsync(filename, onlySelected, onProgress);
    } else {
      await exporter.exportOBJAsync(filename, onlySelected, onProgress);
    }

    exportPercent.value = 100;
    exportStatusText.value = 'Готово!';

    // Send screenshot to backend
    sendSceneScreenshot();

    await new Promise((r) => setTimeout(r, 400));
  } catch (e) {
    console.error('[Export] failed:', e);
    exportStatusText.value = 'Ошибка экспорта';
    await new Promise((r) => setTimeout(r, 1500));
  } finally {
    exporting.value = false;
    exportPercent.value = 0;
    showExportModal.value = false;
  }
}

function sendSceneScreenshot() {
  if (!sceneService) return;
  const image = sceneService.getScreenshotDataUrl();
  if (!image) return;

  const host = window.location.host;
  if (host.includes('localhost')) return;

  const url = `${window.location.origin}/constructor`;
  const endpoint = `/api/image?${new URLSearchParams({ url, host }).toString()}`;

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: dataURItoBlob(image),
  }).catch((err) => {
    console.warn('[Constructor] Failed to send screenshot:', err);
  });
}

// ─── Import STL ──────────────────────────────────────────────────────────

const stlFileInput = ref<HTMLInputElement | null>(null);

function triggerImportSTL() {
  stlFileInput.value?.click();
}

async function handleImportSTL(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !modelApp.value || !sceneService) return;

  const reader = new FileReader();
  reader.onload = async () => {
    if (!sceneService) return;

    const buffer = reader.result as ArrayBuffer;
    // Parse + center geometry.
    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const center = new THREE.Vector3();
    bb.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();

    // Бинарник в IndexedDB (асинхронно): не блокирует UI и не раздувает
    // localStorage многомегабайтной base64-строкой. Узел хранит только
    // binaryRef (id в IDB).
    let binaryRef: string | undefined;
    try {
      const { BinaryStorage } = await import('@/v3d/constructor/services/BinaryStorage');
      binaryRef = BinaryStorage.newId();
      await BinaryStorage.put(binaryRef, buffer);
    } catch (e) {
      console.warn('[Constructor] BinaryStorage.put failed, fallback to base64:', e);
      binaryRef = undefined;
    }

    // Fallback на base64, если IDB недоступен — узел всё равно создаётся.
    let stlBase64 = '';
    if (!binaryRef) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      stlBase64 = btoa(binary);
    }

    const fd = sceneService?.getFeatureDocument();
    if (!fd || fd.rootIds.length !== 1) return;
    const rootFeature = fd.graph.get(fd.rootIds[0]);
    if (!rootFeature || (rootFeature.type !== 'group' && rootFeature.type !== 'boolean')) return;

    const id = nextP2FeatureId('imported');
    const params: Record<string, unknown> = { filename: file.name, geometry };
    if (binaryRef) params.binaryRef = binaryRef;
    if (stlBase64) params.stlBase64 = stlBase64;
    const feature = new ImportedMeshFeature(id, params as never);
    withFeatureDocHistory((doc) => {
      doc.addFeature(feature);
      const inputs = [...(rootFeature as { getInputs(): readonly string[] }).getInputs(), id];
      doc.updateInputs(rootFeature.id, inputs);
    });
    setSelectionByIds([id]);
  };
  reader.readAsArrayBuffer(file);

  // Reset input so re-importing the same file triggers change
  input.value = '';
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

onMounted(() => {
  if (!containerRef.value) return;

  const serializer = new Serializer();
  const tempRoot = new GroupNode();
  const modelManager = new ModelManager(tempRoot);
  const historyManager = new HistoryManager();

  modelApp.value = markRaw(new ModelApp(modelManager, historyManager, serializer));
  modelApp.value.init();

  const serializerForDerive = modelApp.value.getSerializer();
  sceneService = new ConstructorSceneService(modelApp.value, {
    deriveModelTree(legacyJson) {
      const newRoot = serializerForDerive.fromJSON(legacyJson);
      sanitizeRootParams(newRoot);
      return newRoot;
    },
    onSelectFeatureFromScene(featureId, { shift }) {
      onSelectFeature(featureId, shift);
    },
    onSelectNodeFromScene(node, { shift }) {
      onSelectNode(node, shift);
    },
    onDeselectAll() {
      setSelectionByIds([]);
    },
    onMarqueeSelectFeatures(featureIds) {
      setSelectionByIds(featureIds);
    },
    onMarqueeSelect(nodes) {
      setSelection(nodes);
    },
    onDebugInfoUpdate(info) {
      updateDebugFps();
      if (!showDebugPanel.value) return;
      debugSceneInfo.value = info.sceneChildren;
      const g = info.gizmo;
      debugGizmoInfo.value = g
        ? `target=${g.hasTarget} visible=${g.groupVisible} handles=${g.handlesCount}`
        : 'none';
      // Camera
      if (sceneService) {
        const cam = (sceneService as any).camera;
        const ctrl = (sceneService as any).controls;
        if (cam) {
          const t = ctrl?.target;
          debugCamera.value = {
            x: cam.position.x.toFixed(1),
            y: cam.position.y.toFixed(1),
            z: cam.position.z.toFixed(1),
            tx: t ? t.x.toFixed(1) : '0',
            ty: t ? t.y.toFixed(1) : '0',
            tz: t ? t.z.toFixed(1) : '0',
          };
        }
      }
    },
    onNodeParamsChanged() {
      // FeatureParamsForm реактивен через `version` prop (treeVersion bump
      // на любой mutation). Дополнительный sync формы не нужен.
    },
    onBeforeDrag() {
      // Снапшоты для history теперь в FeatureDocumentJSON v2-формате.
      try {
        beforeDragJSON = captureFeatureDocSnapshot();
      } catch (_) {
        beforeDragJSON = null;
      }
    },
    onAfterDrag() {
      if (!beforeDragJSON) return;
      try {
        // Drag меняет node.params + manually obj.position/scale/rotation, минуя
        // rebuildSceneFromTree → sceneService.featureDoc остаётся pre-drag
        // (стейл). Чтобы _saveToLocalStorage сохранял актуальный v2, обновляем
        // featureDoc через rebuild. Stage-B оптимизация (live-sync без полного
        // rebuild) — отдельный шаг.
        if (sceneService) sceneService.rebuildSceneFromTree();
        const afterJSON = captureFeatureDocSnapshot();
        if (afterJSON) {
          const cmd = new FeatureSnapshotCommand(beforeDragJSON, afterJSON, restoreFromFeatureSnapshot);
          modelApp.value!.getHistoryManager().push(cmd);
        }
        treeVersion.value++;
        _saveToLocalStorage();
      } catch (_) {
        // ignore
      } finally {
        beforeDragJSON = null;
      }
    },
    onAlignMarkerClick(mode: string) {
      alignNodes(mode as AlignMode);
    },
  });

  sceneService.mount(containerRef.value);
  sceneService.setSelection(selectedFeatureIdsRaw.value, selectedFeatureId.value);
  sceneService.setSnapStep(snapStep.value);
  sceneService.setGridVisible(sceneSettings.value.showGrid);
  sceneService.setBackgroundColor(sceneSettings.value.background);
  sceneService.setZoomSpeed(sceneSettings.value.zoomSpeed);
  sceneService.setGridSize(sceneSettings.value.gridWidth, sceneSettings.value.gridLength);

  // Chamfer mode: wire up edge click callback
  sceneService.getChamferMode().onEdgeClick = (obj, edge, settings) => {
    applyChamferToEdge(obj, edge, settings);
  };

  // Generator mode: featureDoc-flip путь. Создаём ThreadFeature/KnurlFeature
  // напрямую и через sceneService.mutateFeatureDoc интегрируем в граф —
  // featureRenderer обновит сцену через events, ModelNode-tree деривируется
  // как side-effect для legacy paths.
  sceneService.getGeneratorMode().onGenerate = (_geometry, _height, name) => {
    if (!sceneService) return;
    const fd = sceneService.getFeatureDocument();
    if (!fd) return;
    const rootIds = fd.rootIds;
    if (rootIds.length !== 1) return;
    const rootFeature = fd.graph.get(rootIds[0]);
    if (!rootFeature) return;

    const gm = sceneService.getGeneratorMode();
    const newId = nextP2FeatureId(gm.settings.type);
    let newFeature: ThreadFeature | KnurlFeature;
    if (gm.settings.type === 'thread') {
      const ts = gm.settings.thread;
      newFeature = new ThreadFeature(newId, {
        outerDiameter: ts.outerDiameter,
        innerDiameter: ts.innerDiameter,
        pitch: ts.pitch,
        turns: ts.turns,
        profile: ts.profile,
        segmentsPerTurn: ts.segmentsPerTurn,
        leftHand: ts.leftHand === true,
      });
    } else {
      const ks = gm.settings.knurl;
      newFeature = new KnurlFeature(newId, {
        outerDiameter: ks.outerDiameter,
        innerDiameter: ks.innerDiameter,
        height: ks.height,
        notchCount: ks.notchCount,
        pattern: ks.pattern,
        angle: ks.angle,
        segmentsPerNotch: ks.segmentsPerNotch,
        heightSegments: ks.heightSegments,
      });
    }
    newFeature.name = name;

    withFeatureDocHistory((doc) => {
      doc.addFeature(newFeature);
      // Подключаем к root group: либо в inputs (если root — composite),
      // либо в rootIds (если root — leaf, что редко).
      if (rootFeature.type === 'group' || rootFeature.type === 'boolean') {
        const inputs = [...rootFeature.getInputs(), newId];
        doc.updateInputs(rootFeature.id, inputs);
      } else {
        doc.setRootIds([...doc.rootIds, newId]);
      }
    });

    setSelectionByIds([newId]);

    generatorModeActive.value = false;
    sceneService.setGeneratorMode(false);
  };

  // One-time legacy v1 → v2 миграция (single-scene и индексированные слоты).
  // Идемпотентна; после первого прохода v1-ключи физически удалены из
  // localStorage. ДО loadFromLocalStorage — иначе чтение пройдёт мимо.
  migrateAllV1ToV2({ sceneCount: SCENE_COUNT })
    .catch((e) => {
      console.warn('[Constructor] v1→v2 migration failed:', e);
    })
    .finally(() => {
      loadFromLocalStorage().catch((e) => {
        console.warn('[Constructor] initial load failed:', e);
      });
    });

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', _flushPendingSave);
});

onBeforeUnmount(() => {
  _flushPendingSave();
  debugLogger.uninstall();
  if (sceneService) {
    sceneService.unmount();
    sceneService = null;
  }
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

.constructor-panel {
  padding: 0.75rem;
  overflow: auto;
}
.constructor-panel--nodes {
  flex: 0 0 auto;
  border-bottom: 1px solid #d0d0d0;
  max-height: 50%;
}
.constructor-panel--settings {
  flex: 1;
  min-height: 0;
}

/* ─── Scene switcher ─────────────────────────────────────────── */
.scene-switcher {
  display: flex;
  gap: 0;
  margin-bottom: 0.5rem;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  overflow: hidden;
}
.scene-tab {
  flex: 1;
  padding: 0.35rem 0;
  font-size: 0.8rem;
  font-weight: 500;
  border: none;
  background: #f5f5f5;
  color: #666;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.scene-tab:not(:last-child) {
  border-right: 1px solid #d0d0d0;
}
.scene-tab:hover:not(.is-active) {
  background: #e8e8e8;
  color: #333;
}
.scene-tab.is-active {
  background: #4a7cff;
  color: #fff;
  font-weight: 600;
}

.panel-header {
  font-weight: 600;
  margin-bottom: 0.6rem;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-header-actions {
  display: flex;
  gap: 0.25rem;
}
.btn-icon {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.2rem 0.3rem;
  border-radius: 3px;
  font-size: 0.8rem;
}
.btn-icon:hover { color: #333; background: #e8e8e8; }

/* ─── Node list ───────────────────────────────────────────────── */
.node-list {
  max-height: 28vh;
  overflow-y: auto;
}
.node-list-empty {
  color: #999;
  font-size: 0.85rem;
  padding: 0.3rem 0;
}

/* ─── Actions ─────────────────────────────────────────────────── */
.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.6rem;
}
.merge-op-select { max-width: 9rem; }

/* ─── Shape icons ────────────────────────────────────────────── */
.shape-icons {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.4rem;
}
.shape-btn {
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  color: #666;
  cursor: pointer;
  padding: 0.35rem;
  width: 2.2rem;
  height: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.shape-btn:hover:not(:disabled) {
  background: #e8e8e8;
  color: #333;
  border-color: #aaa;
}
.shape-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.shape-svg {
  width: 1.2rem;
  height: 1.2rem;
}

/* ─── Generator tabs ──────────────────────────────────────────── */
.generator-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 0.75rem;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  overflow: hidden;
}
.generator-tab {
  flex: 1;
  padding: 0.4rem 0;
  font-size: 0.82rem;
  font-weight: 500;
  border: none;
  background: #f5f5f5;
  color: #666;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.generator-tab:not(:last-child) {
  border-right: 1px solid #d0d0d0;
}
.generator-tab:hover:not(.is-active) {
  background: #e8e8e8;
  color: #333;
}
.generator-tab.is-active {
  background: #4a7cff;
  color: #fff;
  font-weight: 600;
}

/* ─── Settings panel ──────────────────────────────────────────── */
.settings-content .field {
  margin-bottom: 0.65rem;
}
.settings-content .label {
  font-size: 0.82rem;
  margin-bottom: 0.2rem;
}
.settings-content .field.has-addons {
  display: flex;
  gap: 0.3rem;
}
.xyz-input {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
}
.xyz-label {
  font-size: 0.7rem;
  color: #888;
  width: 0.8rem;
  flex-shrink: 0;
}
.xyz-input .input {
  flex: 1;
  min-width: 0;
  padding: 0.2rem 0.3rem;
  font-size: 0.82rem;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.color-row input[type="color"] {
  width: 2.2rem;
  height: 1.8rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}
.reset-color {
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
}
.geometry-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.geometry-item {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex: 1 1 45%;
  min-width: 0;
}
.geometry-label {
  font-size: 0.68rem;
  color: #888;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 4.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
}
.geometry-input {
  flex: 1;
  min-width: 0;
  max-width: 4.5rem;
  padding: 0.15rem 0.25rem !important;
  font-size: 0.78rem !important;
}
.settings-placeholder {
  color: #999;
  font-size: 0.9rem;
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

/* ─── Action toolbar (top-left over canvas) ──────────────────── */
.action-toolbar {
  position: absolute;
  top: 0.6rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  padding: 0.25rem 0.35rem;
}
.action-toolbar .btn-icon {
  font-size: 0.85rem;
  padding: 0.25rem 0.4rem;
}
.action-toolbar .btn-delete {
  color: #e74c3c;
}
.action-toolbar .btn-icon.is-active-tool {
  background: #3273dc;
  color: #fff;
  border-radius: 4px;
}
.action-toolbar .btn-icon:disabled {
  opacity: 0.35;
  pointer-events: none;
}
.action-toolbar .align-label {
  font-size: 0.75rem;
  color: #888;
  margin: 0 0.15rem;
}
.action-toolbar .selection-counter {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #00a5a4;
  padding: 0 0.4rem;
  min-width: 1.4rem;
  height: 1.6rem;
  border-radius: 0.3rem;
  background: rgba(0, 165, 164, 0.1);
}
.toolbar-separator {
  width: 1px;
  height: 1.2rem;
  background: #d0d0d0;
  margin: 0 0.15rem;
}

/* ─── Scene toolbar (top-right over canvas) ──────────────────── */
.scene-toolbar {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  z-index: 10;
  display: flex;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  padding: 0.25rem 0.35rem;
}
.scene-toolbar .btn-icon {
  font-size: 0.9rem;
  padding: 0.3rem 0.45rem;
}

/* ─── Snap-step toolbar (bottom-center over canvas) ──────────── */
.snap-toolbar {
  position: absolute;
  bottom: 0.6rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: #555;
}
.snap-toolbar-label {
  margin-right: 0.3rem;
  font-weight: 600;
}
.snap-toolbar-unit {
  margin-left: 0.25rem;
  color: #888;
}
.snap-step-btn {
  min-width: 2rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #333;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.snap-step-btn:hover {
  background: #e8e8e8;
}
.snap-step-btn.is-active {
  background: #3273dc;
  color: #fff;
  border-color: #3273dc;
}

/* ─── Chamfer settings panel ─────────────────────────────────── */

/* ─── Scene settings modal ────────────────────────────────────── */
.scene-settings-modal {
  position: absolute;
  inset: 0;
  z-index: 20;
}
.scene-settings-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
}
.scene-settings-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 320px;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 8px;
  border: 1px solid #d0d0d0;
  padding: 1rem;
  color: #333;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
.scene-settings-header {
  font-weight: 600;
  margin-bottom: 0.75rem;
}
.scene-settings-body .field {
  margin-bottom: 0.75rem;
}
.scene-settings-body .field.has-addons {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.field-addon {
  color: #888;
}
.range-value {
  font-size: 0.8rem;
  color: #888;
}
.scene-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

/* ─── Export progress bar ────────────────────────────────────── */
.export-progress {
  margin-top: 0.5rem;
}
.export-progress-label {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.3rem;
}
.export-progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}
.export-progress-fill {
  height: 100%;
  background: #4a7cff;
  border-radius: 3px;
  transition: width 0.15s ease;
}

/* Debug-панель и её стили вынесены в @/components/constructor/DebugPanel.vue. */
.is-active-tool {
  color: #e67700 !important;
}
</style>
