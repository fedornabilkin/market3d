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
        span Узлы
        .panel-header-actions
          button.btn-icon(@click="saveSceneToFile" title="Сохранить сцену в файл")
            i.fas.fa-save
          button.btn-icon(@click="loadSceneFromFile" title="Загрузить сцену из файла")
            i.fas.fa-folder-open
          button.btn-icon(@click="clearScene" title="Очистить сцену")
            i.fas.fa-trash-alt
      .node-list(v-show="!generatorModeActive")
        NodeTree(
          v-if="rootNode"
          :node="rootNode"
          :selected-nodes="selectedNodes"
          :level="0"
          :key="treeVersion"
          @select="onSelectNodeFromList"
        )
        .node-list-empty(v-else) Сцена пуста
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
        .panel-header Настройки узла
        .settings-content(v-if="selectedNode")
          //- Name (inline, no label)
          .field
            input.input.is-small(
              type="text"
              v-model="selectedName"
              placeholder="Название узла"
              @change="applyName"
            )
          //- isHole
          .field
            label.checkbox
              input(type="checkbox" v-model="selectedIsHole" @change="applyIsHole")
              span  Отверстие
          //- Color (inline, no label)
          .field
            .color-row
              input(type="color" v-model="selectedColor" @change="applyColor")
              button.button.is-small.reset-color(@click="resetColor" title="Сбросить цвет") ✕
          //- Position
          .field
            label.label Позиция (мм)
            .field.has-addons
              .xyz-input
                span.xyz-label X
                input.input(type="number" step="1" v-model.number="selectedPosition.x" @change="applySettingsPosition")
              .xyz-input
                span.xyz-label Y
                input.input(type="number" step="1" v-model.number="selectedPosition.y" @change="applySettingsPosition")
              .xyz-input
                span.xyz-label Z
                input.input(type="number" step="1" v-model.number="selectedPosition.z" @change="applySettingsPosition")
          //- Scale
          .field
            label.label Масштаб
            .field.has-addons
              .xyz-input
                span.xyz-label X
                input.input(type="number" step="0.1" min="0.01" v-model.number="selectedScale.x" @change="applySettingsScale")
              .xyz-input
                span.xyz-label Y
                input.input(type="number" step="0.1" min="0.01" v-model.number="selectedScale.y" @change="applySettingsScale")
              .xyz-input
                span.xyz-label Z
                input.input(type="number" step="0.1" min="0.01" v-model.number="selectedScale.z" @change="applySettingsScale")
          //- Rotation in degrees
          .field
            label.label Поворот (°)
            .field.has-addons
              .xyz-input
                span.xyz-label X
                input.input(type="number" step="1" v-model.number="selectedRotationDeg.x" @change="applySettingsRotation")
              .xyz-input
                span.xyz-label Y
                input.input(type="number" step="1" v-model.number="selectedRotationDeg.y" @change="applySettingsRotation")
              .xyz-input
                span.xyz-label Z
                input.input(type="number" step="1" v-model.number="selectedRotationDeg.z" @change="applySettingsRotation")
          //- Geometry params (primitives and groups)
          .field(v-if="currentGeometryFields.length")
            label.label Геометрия
            .geometry-grid
              .geometry-item(v-for="field in currentGeometryFields" :key="field.key")
                span.geometry-label {{ field.label }}
                input.input.is-small.geometry-input(
                  type="number"
                  step="0.5"
                  min="0.01"
                  v-model.number="selectedGeometryParams[field.key]"
                  @change="applySettingsGeometry"
                )
        .settings-placeholder(v-else)
          | Выберите узел в сцене или в списке

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
      span.selection-counter(v-if="selectedNodes.length" :title="`Выделено объектов: ${selectedNodes.length}`")
        i.fas.fa-mouse-pointer
        |  {{ selectedNodes.length }}
      .toolbar-separator(v-if="selectedNodes.length")
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
            input(type="checkbox" v-model="exportOnlySelected" :disabled="!selectedNode || exporting")
            span  Только активный объект
        .export-progress(v-if="exporting")
          .export-progress-label {{ exportStatusText }}
          .export-progress-bar
            .export-progress-fill(:style="{ width: exportPercent + '%' }")
      .scene-settings-footer
        button.button.is-small(@click="showExportModal = false" :disabled="exporting") Отмена
        button.button.is-small.is-primary(@click="doExport" :disabled="exporting") {{ exporting ? 'Экспорт...' : 'Скачать' }}

  //- Debug panel
  .debug-panel(v-if="showDebugPanel")
    .debug-header
      span Debug
      button.debug-close(@click="toggleDebugPanel") &times;
    .debug-body
      .debug-section
        .debug-title FPS
        .debug-value {{ debugFps }}
      .debug-section
        .debug-title Camera
        .debug-value(v-if="debugCamera")
          | pos: ({{ debugCamera.x }}, {{ debugCamera.y }}, {{ debugCamera.z }})
          br
          | target: ({{ debugCamera.tx }}, {{ debugCamera.ty }}, {{ debugCamera.tz }})
      .debug-section
        .debug-title Selection
        .debug-value(v-if="selectedNode")
          | type: {{ debugNodeType }}
          br
          | name: {{ selectedNode.name || '—' }}
          br
          | uuid: {{ selectedNode.uuidMesh ? selectedNode.uuidMesh.slice(0, 8) : '—' }}
          br
          | pos: ({{ debugNodePos }})
          br
          | scale: ({{ debugNodeScale }})
          br
          | rot: ({{ debugNodeRot }})
          br
          | center: ({{ debugNodeCenter }})
        .debug-value(v-else) none
      .debug-section
        .debug-title Scene ({{ debugSceneInfo.length }})
        .debug-value
          .debug-row(v-for="c in debugSceneInfo" :key="c.index")
            | {{ c.index }}: {{ c.type }} "{{ c.name }}" vis={{ c.visible }} ch={{ c.childrenCount }}
      .debug-section
        .debug-title Gizmo
        .debug-value {{ debugGizmoInfo }}
      .debug-section
        .debug-title History
        .debug-value undo={{ canUndo }} redo={{ canRedo }} mirror={{ mirrorModeActive }}
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, toRaw, watch } from 'vue';
import { markRaw } from 'vue';
import * as THREE from 'three';
import {
  ModelApp,
  ModelManager,
  HistoryManager,
  Renderer,
  Serializer,
  ModelNode,
  GroupNode,
  Primitive,
  ImportedMeshNode,
  ConstructorSceneService,
  SnapshotCommand,
} from '@/v3d/constructor';
import type { PrimitiveType } from '@/v3d/constructor';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { dataURItoBlob } from '@/utils';
import NodeTree from '@/components/constructor/NodeTree.vue';
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
const STORAGE_KEYS = Array.from({ length: SCENE_COUNT }, (_, i) => `constructor_scene_v1_${i}`);
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

// ─── Refs ──────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null);
const selectedNode = shallowRef<ModelNode | null>(null);
const selectedNodes = shallowRef<ModelNode[]>([]);
const modelApp = shallowRef<ModelApp | null>(null);
const activeSceneIndex = ref(0);

/** Incremented to force NodeTree re-render when tree structure/labels change. */
const treeVersion = ref(0);

let sceneService: ConstructorSceneService | null = null;
/** Snapshot taken at drag-start for undo/redo of drag operations. */
let beforeDragJSON: any = null;

// ─── Computed ──────────────────────────────────────────────────────────────

const rootNode = computed(() => {
  // treeVersion as dependency: forces re-evaluation when tree structure changes
  treeVersion.value;
  return modelApp.value?.getModelManager()?.getTree() ?? null;
});

const canUndo = computed(() => {
  treeVersion.value;
  return modelApp.value?.getHistoryManager()?.canUndo() ?? false;
});
const canRedo = computed(() => {
  treeVersion.value;
  return modelApp.value?.getHistoryManager()?.canRedo() ?? false;
});

const canDeleteSelected = computed(() => {
  const node = selectedNode.value;
  const r = rootNode.value;
  return !!node && !!r && node !== r;
});

const hasSceneObjects = computed(() => {
  treeVersion.value;
  const r = rootNode.value;
  return r instanceof GroupNode && r.children.length > 0;
});
const canMerge = computed(() => selectedNodes.value.length >= 2);
const canUngroup = computed(() => {
  const node = selectedNode.value;
  return !!node && isGroupNode(node) && node !== rootNode.value;
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

const selectedGroupOperation = ref('union');
const selectedPosition = ref({ x: 0, y: 0, z: 0 });
const selectedScale = ref({ x: 1, y: 1, z: 1 });
/** Rotation stored in degrees for the UI. Converted to radians on apply. */
const selectedRotationDeg = ref({ x: 0, y: 0, z: 0 });
const selectedGeometryParams = ref({});
const selectedIsHole = ref(false);
const selectedColor = ref('#cccccc');
const selectedName = ref('');

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
const debugSceneInfo = ref<Array<{ index: number; type: string; name: string; visible: boolean; childrenCount: number }>>([]);
const debugGizmoInfo = ref('—');
const debugCamera = ref<{ x: string; y: string; z: string; tx: string; ty: string; tz: string } | null>(null);

let _debugFrames = 0;
let _debugLastTime = performance.now();

function updateDebugFps() {
  _debugFrames++;
  const now = performance.now();
  if (now - _debugLastTime >= 1000) {
    debugFps.value = _debugFrames;
    _debugFrames = 0;
    _debugLastTime = now;
  }
}

const debugNodeType = computed(() => {
  const n = selectedNode.value;
  if (!n) return '—';
  if (n instanceof Primitive) return `Primitive (${(n as any).type})`;
  if (n instanceof GroupNode) return `Group (${(n as any).operation})`;
  if (n instanceof ImportedMeshNode) return `STL (${(n as any).filename})`;
  return n.constructor?.name ?? 'unknown';
});

const debugNodePos = computed(() => {
  const p = selectedNode.value?.params?.position;
  if (!p) return '—';
  return `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
});

const debugNodeScale = computed(() => {
  const s = selectedNode.value?.params?.scale;
  if (!s) return '1, 1, 1';
  return `${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)}`;
});

const debugNodeRot = computed(() => {
  const r = selectedNode.value?.params?.rotation;
  if (!r) return '0, 0, 0';
  return `${(r.x * RAD_TO_DEG).toFixed(1)}°, ${(r.y * RAD_TO_DEG).toFixed(1)}°, ${(r.z * RAD_TO_DEG).toFixed(1)}°`;
});

const debugNodeCenter = computed(() => {
  if (!sceneService || !selectedNode.value) return '—';
  const obj = (sceneService as any).findObject3DByNode?.(selectedNode.value)
    ?? (sceneService as any).selectedObject3D;
  if (!obj) return '—';
  const box = new THREE.Box3().setFromObject(obj);
  const c = new THREE.Vector3();
  box.getCenter(c);
  return `${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`;
});

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

const GROUP_GEOMETRY_FIELDS = [
  { key: 'width', label: 'Ширина' },
  { key: 'height', label: 'Высота' },
  { key: 'depth', label: 'Глубина' },
];

const currentGeometryFields = computed(() => {
  const node = selectedNode.value;
  if (!node) return [];
  if (isPrimitive(node)) return GEOMETRY_FIELDS[node.type] ?? [];
  if (isGroupNode(node) && node !== rootNode.value) return GROUP_GEOMETRY_FIELDS;
  return [];
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function isPrimitive(node: any): node is Primitive {
  return node instanceof Primitive;
}

function isGroupNode(node: any): node is GroupNode {
  return node instanceof GroupNode;
}

function computeGroupDimensions(node: any): { width?: number; height?: number; depth?: number } {
  if (!isGroupNode(node)) return {};
  try {
    const mesh = node.getMesh();
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    return {
      width: parseFloat(size.x.toFixed(2)),
      height: parseFloat(size.y.toFixed(2)),
      depth: parseFloat(size.z.toFixed(2)),
    };
  } catch {
    return { width: 0, height: 0, depth: 0 };
  }
}

function getDefaultParamsForType(type: PrimitiveType) {
  switch (type) {
    case 'box': return { width: 20, height: 20, depth: 20 };
    case 'sphere': return { radius: 10, widthSegments: 32, heightSegments: 32 };
    case 'cylinder': return { radiusTop: 10, radiusBottom: 10, height: 20, segments: 32 };
    case 'cone': return { radius: 10, height: 20, segments: 32 };
    case 'torus': return { radius: 10, tube: 2, segments: 32 };
    case 'plane': return { width: 20, height: 20 };
    case 'ring': return { innerRadius: 5, outerRadius: 10, segments: 32 };
    default: return { width: 20, height: 20, depth: 20 };
  }
}

// ─── Sync form ↔ node ──────────────────────────────────────────────────────

function syncFormFromNode(node: ModelNode) {
  if (!node) return;
  const p = node.params?.position ?? { x: 0, y: 0, z: 0 };
  const s = node.params?.scale ?? { x: 1, y: 1, z: 1 };
  const r = node.params?.rotation ?? { x: 0, y: 0, z: 0 };
  selectedPosition.value = { ...p };
  selectedScale.value = { ...s };
  // Store degrees in the form
  selectedRotationDeg.value = {
    x: parseFloat((r.x * RAD_TO_DEG).toFixed(2)),
    y: parseFloat((r.y * RAD_TO_DEG).toFixed(2)),
    z: parseFloat((r.z * RAD_TO_DEG).toFixed(2)),
  };
  selectedColor.value = (node.params?.color) ?? '#cccccc';
  selectedName.value = node.name ?? '';
  if (isPrimitive(node)) {
    selectedGeometryParams.value = { ...node.geometryParams };
  } else if (isGroupNode(node)) {
    // For groups, compute bounding-box based dimensions
    selectedGeometryParams.value = computeGroupDimensions(node);
  } else {
    selectedGeometryParams.value = {};
  }
  selectedIsHole.value = !!node.params?.isHole;
  if (isGroupNode(node)) {
    selectedGroupOperation.value = node.operation;
  }
}

// ─── History ───────────────────────────────────────────────────────────────

/**
 * Restore the model tree from a JSON snapshot.
 * Called by SnapshotCommand on undo/redo.
 */
function restoreFromSnapshot(json: any) {
  const serializer = modelApp.value!.getSerializer();
  const newRoot = serializer.fromJSON(json);
  modelApp.value!.getModelManager().setTree(newRoot);
  setSelection([]);
  treeVersion.value++;
  if (sceneService) sceneService.rebuildSceneFromTree();
  _saveToLocalStorage();
}

/**
 * Wraps a mutation with before/after snapshots and pushes a SnapshotCommand.
 * The mutation must synchronously modify the model tree.
 */
function withHistory(mutate: () => void) {
  const serializer = modelApp.value!.getSerializer();
  const root = modelApp.value!.getModelManager().getTree();
  const beforeJSON = serializer.toJSON(root);
  mutate();
  const afterRoot = modelApp.value!.getModelManager().getTree();
  const afterJSON = serializer.toJSON(afterRoot);
  const cmd = new SnapshotCommand(beforeJSON, afterJSON, restoreFromSnapshot);
  modelApp.value!.getHistoryManager().push(cmd);
  treeVersion.value++;
  _saveToLocalStorage();
}

function undo() {
  modelApp.value!.getHistoryManager().undo();
  // treeVersion++ and rebuildSceneFromTree happen inside restoreFromSnapshot
}

function redo() {
  modelApp.value!.getHistoryManager().redo();
}

// ─── localStorage ──────────────────────────────────────────────────────────

function _saveToLocalStorage() {
  try {
    const serializer = modelApp.value!.getSerializer();
    const root = modelApp.value!.getModelManager().getTree();
    localStorage.setItem(STORAGE_KEYS[activeSceneIndex.value], JSON.stringify(serializer.toJSON(root)));
  } catch (e) {
    console.warn('[Constructor] Failed to save scene:', e);
  }
}

function saveToLocalStorage() {
  _saveToLocalStorage();
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS[activeSceneIndex.value]);
    if (!saved) return;
    const json = JSON.parse(saved);
    const serializer = modelApp.value!.getSerializer();
    const newRoot = serializer.fromJSON(json);
    modelApp.value!.getModelManager().setTree(newRoot);
    setSelection([]);
    treeVersion.value++;
    if (sceneService) sceneService.rebuildSceneFromTree();
  } catch (e) {
    console.warn('[Constructor] Failed to load scene:', e);
  }
}

function saveSceneToFile() {
  try {
    const serializer = modelApp.value!.getSerializer();
    const root = modelApp.value!.getModelManager().getTree();
    const json = JSON.stringify(serializer.toJSON(root), null, 2);
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
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        const serializer = modelApp.value!.getSerializer();
        const newRoot = serializer.fromJSON(json);
        withHistory(() => {
          modelApp.value!.getModelManager().setTree(newRoot);
        });
        setSelection([]);
        treeVersion.value++;
        if (sceneService) sceneService.rebuildSceneFromTree();
      } catch (e) {
        console.warn('[Constructor] Failed to load scene from file:', e);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function switchScene(index: number) {
  if (index === activeSceneIndex.value) return;
  // Save current scene
  _saveToLocalStorage();
  // Switch
  activeSceneIndex.value = index;
  // Reset history for the new scene
  modelApp.value!.getHistoryManager().clear();
  // Load new scene (or create empty)
  const saved = localStorage.getItem(STORAGE_KEYS[index]);
  if (saved) {
    try {
      const json = JSON.parse(saved);
      const serializer = modelApp.value!.getSerializer();
      const newRoot = serializer.fromJSON(json);
      modelApp.value!.getModelManager().setTree(newRoot);
    } catch (e) {
      console.warn('[Constructor] Failed to load scene:', e);
      modelApp.value!.getModelManager().setTree(new GroupNode());
    }
  } else {
    modelApp.value!.getModelManager().setTree(new GroupNode());
  }
  setSelection([]);
  treeVersion.value++;
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function clearScene() {
  withHistory(() => {
    const r = modelApp.value!.getModelManager().getTree();
    if (r instanceof GroupNode) r.children = [];
  });
  setSelection([]);
  if (sceneService) sceneService.rebuildSceneFromTree();
}

// ─── Selection ─────────────────────────────────────────────────────────────

function setSelection(nodes: ModelNode[]) {
  selectedNodes.value = nodes.length ? [...nodes] : [];
  selectedNode.value = nodes.length ? nodes[nodes.length - 1] : null;
  if (selectedNode.value) syncFormFromNode(selectedNode.value);
  if (!nodes.length && mirrorModeActive.value) {
    mirrorModeActive.value = false;
    if (sceneService) sceneService.setMirrorMode(false);
  }
  if (sceneService) sceneService.setSelection(selectedNodes.value, selectedNode.value);
}

function onSelectNode(node: ModelNode, shiftKey = false) {
  const rawNode = toRaw(node);
  const list = selectedNodes.value;
  if (shiftKey) {
    const idx = list.indexOf(rawNode);
    if (idx !== -1) {
      setSelection(list.filter((_, i) => i !== idx));
    } else {
      setSelection([...list, rawNode]);
    }
  } else {
    setSelection([rawNode]);
  }
}

function onSelectNodeFromList(ev: any) {
  onSelectNode(ev.node, ev.shiftKey);
}

// ─── Primitives & groups ───────────────────────────────────────────────────

function addPrimitiveOfType(type: PrimitiveType) {
  if (addCooldown.value) return;
  const r = modelApp.value!.getModelManager().getTree();
  if (!(r instanceof GroupNode)) return;
  const geometryParams = getDefaultParamsForType(type);
  const prim = new Primitive(type, geometryParams, { position: { x: 0, y: 0, z: 0 } });

  withHistory(() => {
    r.children.push(prim);
  });

  if (sceneService) sceneService.appendNodeToScene(prim);
  onSelectNode(prim);

  // 3-second cooldown
  addCooldown.value = true;
  setTimeout(() => { addCooldown.value = false; }, 3000);
}

/**
 * Smart duplicate state.
 * First Ctrl+D clones in place with no offset.
 * After the user modifies the clone (position/scale/rotation), subsequent
 * Ctrl+D duplicates the last clone and applies the same delta again.
 */
const smartDup = {
  /** The node that was last created via duplication. */
  lastClone: null as ModelNode | null,
  /** Snapshot of clone params right after creation — used to detect user changes. */
  snapshotParams: null as Record<string, any> | null,
  /** Remembered delta from the last duplication (reused when user doesn't modify). */
  lastDelta: null as { pos: {x:number,y:number,z:number}, scale: {x:number,y:number,z:number}, rot: {x:number,y:number,z:number} } | null,
};

function duplicateSelected(shrink: boolean = false) {
  const node = selectedNode.value;
  const r = modelApp.value!.getModelManager().getTree();
  if (!node || !r) return;
  const nodeUuid = node.uuidMesh;
  if (nodeUuid && r.uuidMesh === nodeUuid) return;
  const parent = sceneService ? sceneService.getParentOf(node) : null;
  if (!parent || !(parent instanceof GroupNode)) return;

  const cloned = node.clone();
  cloned.params = cloned.params || {};

  if (shrink && snapStep.value > 0 && sceneService) {
    const obj = sceneService.findObject3DByNode(node);
    if (obj) {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const step = snapStep.value;
      const EPS = 1e-4;
      const fx = size.x > step + EPS ? (size.x - step) / size.x : EPS;
      const fy = size.y > step + EPS ? (size.y - step) / size.y : EPS;
      const fz = size.z > step + EPS ? (size.z - step) / size.z : EPS;
      const cs = cloned.params.scale || { x: 1, y: 1, z: 1 };
      cloned.params.scale = { x: cs.x * fx, y: cs.y * fy, z: cs.z * fz };
    }
    smartDup.lastDelta = null;

    withHistory(() => { parent.children.push(cloned); });
    smartDup.lastClone = cloned;
    smartDup.snapshotParams = {
      position: cloned.params.position ? { ...cloned.params.position } : undefined,
      scale: cloned.params.scale ? { ...cloned.params.scale } : undefined,
      rotation: cloned.params.rotation ? { ...cloned.params.rotation } : undefined,
    };
    if (sceneService) sceneService.rebuildSceneFromTree();
    onSelectNode(cloned);
    return;
  }

  // If duplicating the previous clone, compute or reuse delta
  if (smartDup.lastClone && toRaw(node) === toRaw(smartDup.lastClone) && smartDup.snapshotParams) {
    const snap = smartDup.snapshotParams;
    const cur = node.params || {};

    // Compute fresh delta from user modifications
    const dp = {
      x: (cur.position?.x ?? 0) - (snap.position?.x ?? 0),
      y: (cur.position?.y ?? 0) - (snap.position?.y ?? 0),
      z: (cur.position?.z ?? 0) - (snap.position?.z ?? 0),
    };
    const ds = {
      x: (cur.scale?.x ?? 1) / (snap.scale?.x ?? 1),
      y: (cur.scale?.y ?? 1) / (snap.scale?.y ?? 1),
      z: (cur.scale?.z ?? 1) / (snap.scale?.z ?? 1),
    };
    const dr = {
      x: (cur.rotation?.x ?? 0) - (snap.rotation?.x ?? 0),
      y: (cur.rotation?.y ?? 0) - (snap.rotation?.y ?? 0),
      z: (cur.rotation?.z ?? 0) - (snap.rotation?.z ?? 0),
    };

    const hasChange = dp.x || dp.y || dp.z
      || ds.x !== 1 || ds.y !== 1 || ds.z !== 1
      || dr.x || dr.y || dr.z;

    // If user modified the clone, save new delta; otherwise reuse previous
    if (hasChange) {
      smartDup.lastDelta = { pos: dp, scale: ds, rot: dr };
    }

    const delta = smartDup.lastDelta;
    if (delta) {
      cloned.params.position = {
        x: (cur.position?.x ?? 0) + delta.pos.x,
        y: (cur.position?.y ?? 0) + delta.pos.y,
        z: (cur.position?.z ?? 0) + delta.pos.z,
      };
      if (delta.scale.x !== 1 || delta.scale.y !== 1 || delta.scale.z !== 1) {
        cloned.params.scale = {
          x: (cur.scale?.x ?? 1) * delta.scale.x,
          y: (cur.scale?.y ?? 1) * delta.scale.y,
          z: (cur.scale?.z ?? 1) * delta.scale.z,
        };
      }
      if (delta.rot.x || delta.rot.y || delta.rot.z) {
        cloned.params.rotation = {
          x: (cur.rotation?.x ?? 0) + delta.rot.x,
          y: (cur.rotation?.y ?? 0) + delta.rot.y,
          z: (cur.rotation?.z ?? 0) + delta.rot.z,
        };
      }
    }
  } else {
    // First duplicate of a new source — reset delta
    smartDup.lastDelta = null;
  }

  withHistory(() => {
    parent.children.push(cloned);
  });

  // Snapshot the clone's params at creation time
  smartDup.lastClone = cloned;
  smartDup.snapshotParams = {
    position: cloned.params.position ? { ...cloned.params.position } : undefined,
    scale: cloned.params.scale ? { ...cloned.params.scale } : undefined,
    rotation: cloned.params.rotation ? { ...cloned.params.rotation } : undefined,
  };

  if (sceneService) sceneService.rebuildSceneFromTree();
  onSelectNode(cloned);
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

function applyChamferToEdge(
  obj: THREE.Object3D,
  edge: Record<string, any>,
  settings: { radius: number; profile: 'convex' | 'concave' | 'flat' },
) {
  if (!sceneService || !modelApp.value) return;
  const node = (obj.userData as { node?: ModelNode }).node;
  if (!node) return;

  const parent = sceneService.getParentOf(node);
  if (!parent || !(parent instanceof GroupNode)) return;

  const r = settings.radius;

  const chamferGroup = edge.kind === 'circular'
    ? buildCircularChamfer(edge, r, node)
    : buildLinearChamfer(edge, r, settings.profile, node);

  withHistory(() => {
    if (node instanceof GroupNode) {
      node.children.push(chamferGroup);
    } else {
      // Primitive: wrap original + chamfer in a new group for CSG
      const idx = parent.children.indexOf(node);
      if (idx === -1) return;
      const wrapper = new GroupNode();
      wrapper.operation = 'union';
      wrapper.name = node.name || 'Группа';
      wrapper.params = {
        position: node.params?.position ? { ...node.params.position } : { x: 0, y: 0, z: 0 },
        scale: node.params?.scale ? { ...node.params.scale } : undefined,
        rotation: node.params?.rotation ? { ...node.params.rotation } : undefined,
        color: node.params?.color,
        isHole: node.params?.isHole,
      };
      node.params = {
        ...node.params,
        position: { x: 0, y: 0, z: 0 },
      };
      wrapper.children.push(node, chamferGroup);
      parent.children[idx] = wrapper;
    }
  });

  sceneService!.rebuildSceneFromTree();
  treeVersion.value++;
  _saveToLocalStorage();
}

/**
 * Build chamfer group for a linear edge — convex rounding.
 *
 * In chamfer-local space Y is always the edge axis. perpDirX/Z point
 * from the edge toward the bbox center. We place a box (size r×h×r)
 * and a cylinder (radius r, height h) offset so they form a quarter-
 * cylinder at the corner. The cylinder is subtracted from the box
 * (isHole), leaving a concave cutout. When the whole group (also isHole)
 * is subtracted from the object, the corner becomes convex-rounded.
 */
function buildLinearChamfer(
  edge: Record<string, any>,
  r: number,
  _profile: 'convex' | 'concave' | 'flat',
  node: ModelNode,
): GroupNode {
  const edgeLen = (edge.localStart as THREE.Vector3).distanceTo(edge.localEnd as THREE.Vector3);
  const lm = (edge.localMid as THREE.Vector3).clone();

  if (node instanceof Primitive) {
    lm.y += node.getHalfHeight();
  }

  const dx: number = edge.perpDirX; // +1 or −1
  const dz: number = edge.perpDirZ;
  const h = edgeLen + 0.2;

  const chamferGroup = new GroupNode();
  chamferGroup.operation = 'union';
  chamferGroup.name = 'Скругление';

  // Box: r × h × r, shifted half-r toward the center in X and Z
  const box = new Primitive('box', { width: r, height: h, depth: r });
  box.params = { position: { x: dx * r / 2, y: -h / 2, z: dz * r / 2 } };

  // Cylinder at the inner corner of the box (full r offset from edge)
  const cyl = new Primitive('cylinder', {
    radiusTop: r, radiusBottom: r, height: h, segments: 32,
  });
  cyl.params = { position: { x: dx * r, y: -h / 2, z: dz * r }, isHole: true };

  chamferGroup.children.push(box, cyl);

  chamferGroup.params = {
    position: { x: lm.x, y: lm.y, z: lm.z },
    isHole: true,
  };

  if (edge.axis === 'x') {
    chamferGroup.params.rotation = { x: 0, y: 0, z: Math.PI / 2 };
  } else if (edge.axis === 'z') {
    chamferGroup.params.rotation = { x: Math.PI / 2, y: 0, z: 0 };
  }

  return chamferGroup;
}

/**
 * Build chamfer group for a cylinder rim (circular edge) — concave fillet.
 *
 * Subtracting this group (isHole) from the cylinder yields a rounded outer rim.
 * The group's effective volume is (annulus − fillet_torus):
 *   outer_cyl(R, r)  −  inner_cyl(R−r, r+eps)  −  torus(R−r, r)
 * (Group CSG: solids combined, then holes subtracted — so all three primitives
 * collapse into that single expression in one CSG pass.)
 *
 * Canonical orientation builds the chamfer for the BOTTOM rim; the top rim is
 * handled by translating to y=h and flipping with rotation.x = π (axially
 * symmetric around Y, so the Z flip is harmless).
 */
function buildCircularChamfer(
  edge: Record<string, any>,
  r: number,
  node: ModelNode,
): GroupNode {
  const R = Math.max(0.01, edge.radius as number);
  const fillet = Math.min(r, R * 0.99);
  const isTopRim = edge.isTopRim === true;
  const lm = (edge.localMid as THREE.Vector3).clone();
  if (node instanceof Primitive) {
    lm.y += node.getHalfHeight();
  }

  const eps = 0.05;
  const chamferGroup = new GroupNode();
  chamferGroup.operation = 'union';
  chamferGroup.name = 'Скругление';

  // Annulus outer wall — radius R, height r, bottom face at group-local y=0.
  const outerCyl = new Primitive('cylinder', {
    radiusTop: R, radiusBottom: R, height: fillet, segments: 64,
  });
  outerCyl.params = { position: { x: 0, y: 0, z: 0 } };

  // Inner cylinder carving out the annulus hollow; slightly taller/wider than
  // the outer slab so CSG doesn't hit coplanar faces.
  const innerCyl = new Primitive('cylinder', {
    radiusTop: R - fillet,
    radiusBottom: R - fillet,
    height: fillet + eps,
    segments: 64,
  });
  innerCyl.params = { position: { x: 0, y: -eps / 2, z: 0 }, isHole: true };

  // Fillet torus — major radius (R−r), minor radius r, rotated so its axis is Y.
  // Primitive torus halfHeight = tube, so position.y=0 places its center at y=r
  // which is exactly the inside corner of the annulus.
  const torus = new Primitive('torus', {
    radius: R - fillet,
    tube: fillet,
    segments: 48,
  });
  torus.params = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    isHole: true,
  };

  chamferGroup.children.push(outerCyl, innerCyl, torus);

  chamferGroup.params = {
    position: { x: lm.x, y: lm.y, z: lm.z },
    isHole: true,
  };

  if (isTopRim) {
    chamferGroup.params.rotation = { x: Math.PI, y: 0, z: 0 };
  }

  return chamferGroup;
}


type AlignMode = 'minX' | 'centerX' | 'maxX' | 'minY' | 'centerY' | 'maxY' | 'minZ' | 'centerZ' | 'maxZ';

function alignNodes(mode: AlignMode) {
  const nodes = selectedNodes.value;
  if (nodes.length < 2 || !sceneService) return;

  // Collect bounding boxes for each node via its 3D object
  const entries: { node: ModelNode; box: THREE.Box3 }[] = [];
  for (const node of nodes) {
    const obj = sceneService.findObject3DByNode(node);
    if (!obj) continue;
    const box = new THREE.Box3().setFromObject(obj);
    entries.push({ node, box });
  }
  if (entries.length < 2) return;

  // Compute target value from the first selected node (anchor)
  const anchor = entries[0].box;
  let target: number;
  switch (mode) {
    case 'minX':    target = anchor.min.x; break;
    case 'maxX':    target = anchor.max.x; break;
    case 'centerX': target = (anchor.min.x + anchor.max.x) / 2; break;
    case 'minY':    target = anchor.min.y; break;
    case 'maxY':    target = anchor.max.y; break;
    case 'centerY': target = (anchor.min.y + anchor.max.y) / 2; break;
    case 'minZ':    target = anchor.min.z; break;
    case 'maxZ':    target = anchor.max.z; break;
    case 'centerZ': target = (anchor.min.z + anchor.max.z) / 2; break;
  }

  withHistory(() => {
    for (let i = 1; i < entries.length; i++) {
      const { node, box } = entries[i];
      node.params = node.params || {};
      node.params.position = node.params.position || { x: 0, y: 0, z: 0 };
      const p = node.params.position;

      let current: number;
      switch (mode) {
        case 'minX':    current = box.min.x; p.x += target - current; break;
        case 'maxX':    current = box.max.x; p.x += target - current; break;
        case 'centerX': current = (box.min.x + box.max.x) / 2; p.x += target - current; break;
        case 'minY':    current = box.min.y; p.y += target - current; break;
        case 'maxY':    current = box.max.y; p.y += target - current; break;
        case 'centerY': current = (box.min.y + box.max.y) / 2; p.y += target - current; break;
        case 'minZ':    current = box.min.z; p.z += target - current; break;
        case 'maxZ':    current = box.max.z; p.z += target - current; break;
        case 'centerZ': current = (box.min.z + box.max.z) / 2; p.z += target - current; break;
      }
    }
  });

  if (sceneService) sceneService.rebuildSceneFromTree();
}

function deleteSelected() {
  const node = selectedNode.value;
  const r = modelApp.value!.getModelManager().getTree();
  if (!node || !r) return;
  const nodeUuid = node.uuidMesh;
  if (nodeUuid && r.uuidMesh === nodeUuid) return;
  const parent = sceneService ? sceneService.getParentOf(node) : null;
  if (!parent || !(parent instanceof GroupNode)) return;
  const idx = nodeUuid
    ? parent.children.findIndex((c) => c.uuidMesh === nodeUuid)
    : parent.children.indexOf(node);
  if (idx === -1) return;

  withHistory(() => {
    parent.children.splice(idx, 1);
    if (sceneService) pruneEmptyGroups(r);
  });

  setSelection(selectedNodes.value.filter((n) => (nodeUuid ? n.uuidMesh !== nodeUuid : n !== node)));
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function pruneEmptyGroups(rootNode: any) {
  if (!(rootNode instanceof GroupNode)) return;
  const stack = [rootNode];
  while (stack.length) {
    const current = stack.pop();
    if (!(current instanceof GroupNode)) continue;
    for (let i = current.children.length - 1; i >= 0; i--) {
      const child = current.children[i];
      if (child instanceof GroupNode) {
        if (child.children.length === 0 && child !== rootNode) {
          current.children.splice(i, 1);
        } else {
          stack.push(child);
        }
      }
    }
  }
}

function mergeSelected() {
  const nodes = selectedNodes.value;
  const r = modelApp.value!.getModelManager().getTree();
  if (!(r instanceof GroupNode) || nodes.length < 2) return;

  // Always create a NEW group containing all selected nodes.
  // Nodes with isHole=true will be auto-subtracted inside GroupNode.getMesh().
  const entries: { parent: GroupNode; index: number; node: ModelNode }[] = [];
  for (const node of nodes) {
    const parent = sceneService ? sceneService.getParentOf(node) : null;
    const nodeUuid = node.uuidMesh;
    const sameAsParent = nodeUuid && parent && parent.uuidMesh === nodeUuid;
    if (parent && !sameAsParent) {
      const i = nodeUuid
        ? parent.children.findIndex((c) => c.uuidMesh === nodeUuid)
        : parent.children.indexOf(node);
      if (i !== -1) entries.push({ parent, index: i, node });
    }
  }
  if (entries.length < 2) return;
  // Remove from back to front to preserve indices
  entries.sort((a, b) => (a.parent !== b.parent ? 0 : b.index - a.index));

  const group = new GroupNode();
  group.operation = 'union';

  withHistory(() => {
    for (const { parent, index, node } of entries) {
      parent.children.splice(index, 1);
      group.children.push(node);
    }
    if (group.children.length === 0) return;
    r.children.push(group);
    pruneEmptyGroups(r);
  });

  if (group.children.length === 0) return;
  if (sceneService) sceneService.rebuildSceneFromTree();
  setSelection([group]);
}

function ungroupSelected() {
  const node = selectedNode.value;
  const r = modelApp.value!.getModelManager().getTree();
  if (!node || !r || !isGroupNode(node) || node === r) return;
  const parent = sceneService ? sceneService.getParentOf(node) : null;
  if (!parent || !(parent instanceof GroupNode)) return;
  const nodeUuid = node.uuidMesh;
  const idx = nodeUuid
    ? parent.children.findIndex((c) => c.uuidMesh === nodeUuid)
    : parent.children.indexOf(node);
  if (idx === -1) return;

  const children = [...node.children];
  withHistory(() => {
    parent.children.splice(idx, 1, ...children);
  });

  if (sceneService) sceneService.rebuildSceneFromTree();
  setSelection(children.length ? [children[0]] : []);
}

// ─── Apply settings ────────────────────────────────────────────────────────

function applyName() {
  if (!selectedNode.value) return;
  withHistory(() => {
    selectedNode.value!.name = selectedName.value;
  });
  // No scene rebuild needed — name is UI-only
}

function applyGroupOperation() {
  if (!selectedNode.value || !isGroupNode(selectedNode.value)) return;
  withHistory(() => {
    (selectedNode.value as GroupNode).operation = selectedGroupOperation.value as any;
  });
}

function applyColor() {
  if (!selectedNode.value) return;
  withHistory(() => {
    selectedNode.value!.params = selectedNode.value!.params || {};
    selectedNode.value!.params.color = selectedColor.value;
  });
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function resetColor() {
  selectedColor.value = '#cccccc';
  applyColor();
}

function applySettingsPosition() {
  if (!selectedNode.value) return;
  withHistory(() => {
    selectedNode.value!.params = selectedNode.value!.params || {};
    selectedNode.value!.params.position = { ...selectedPosition.value };
  });
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function applySettingsScale() {
  if (!selectedNode.value) return;
  withHistory(() => {
    selectedNode.value!.params = selectedNode.value!.params || {};
    selectedNode.value!.params.scale = { ...selectedScale.value };
  });
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function applySettingsRotation() {
  if (!selectedNode.value) return;
  withHistory(() => {
    selectedNode.value!.params = selectedNode.value!.params || {};
    selectedNode.value!.params.rotation = {
      x: selectedRotationDeg.value.x * DEG_TO_RAD,
      y: selectedRotationDeg.value.y * DEG_TO_RAD,
      z: selectedRotationDeg.value.z * DEG_TO_RAD,
    };
  });
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function applySettingsGeometry() {
  if (!selectedNode.value) return;
  if (isPrimitive(selectedNode.value)) {
    withHistory(() => {
      (selectedNode.value as Primitive).geometryParams = { ...selectedGeometryParams.value };
    });
    if (sceneService) sceneService.rebuildSceneFromTree();
  } else if (isGroupNode(selectedNode.value)) {
    // For groups, changing geometry = scaling relative to original dimensions
    const origDims = computeGroupDimensions(selectedNode.value);
    const newParams = selectedGeometryParams.value as { width?: number; height?: number; depth?: number };
    const sx = origDims.width && origDims.width > 0 ? (newParams.width ?? origDims.width) / origDims.width : 1;
    const sy = origDims.height && origDims.height > 0 ? (newParams.height ?? origDims.height) / origDims.height : 1;
    const sz = origDims.depth && origDims.depth > 0 ? (newParams.depth ?? origDims.depth) / origDims.depth : 1;
    const curScale = selectedNode.value.params?.scale ?? { x: 1, y: 1, z: 1 };
    withHistory(() => {
      selectedNode.value!.params = selectedNode.value!.params || {};
      selectedNode.value!.params.scale = {
        x: curScale.x * sx,
        y: curScale.y * sy,
        z: curScale.z * sz,
      };
    });
    selectedScale.value = { ...selectedNode.value!.params.scale! };
    if (sceneService) sceneService.rebuildSceneFromTree();
    // Recompute dimensions after scale change
    selectedGeometryParams.value = computeGroupDimensions(selectedNode.value);
  }
}

function applyIsHole() {
  if (!selectedNode.value) return;
  withHistory(() => {
    selectedNode.value!.params = selectedNode.value!.params || {};
    selectedNode.value!.params.isHole = selectedIsHole.value;
  });
  if (sceneService) sceneService.rebuildSceneFromTree();
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

  // Arrow keys: move selected object relative to camera
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && selectedNode.value && sceneService) {
    event.preventDefault();
    const s = modelApp.value!.getSerializer();
    const root = modelApp.value!.getModelManager().getTree();
    const beforeJSON = s.toJSON(root);

    const mult = event.shiftKey ? 5 : 1;
    if (hasCtrl) {
      if (event.key === 'ArrowUp') sceneService.moveSelectedByKey('up', mult);
      else if (event.key === 'ArrowDown') sceneService.moveSelectedByKey('down', mult);
    } else {
      if (event.key === 'ArrowLeft') sceneService.moveSelectedByKey('left', mult);
      else if (event.key === 'ArrowRight') sceneService.moveSelectedByKey('right', mult);
      else if (event.key === 'ArrowUp') sceneService.moveSelectedByKey('forward', mult);
      else if (event.key === 'ArrowDown') sceneService.moveSelectedByKey('backward', mult);
    }

    const afterJSON = s.toJSON(root);
    const cmd = new SnapshotCommand(beforeJSON, afterJSON, restoreFromSnapshot);
    modelApp.value!.getHistoryManager().push(cmd);
    treeVersion.value++;
    _saveToLocalStorage();
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
    if (selectedNodes.value.length >= 2) {
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

function handleImportSTL(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !modelApp.value) return;

  const reader = new FileReader();
  reader.onload = () => {
    const buffer = reader.result as ArrayBuffer;
    const r = modelApp.value!.getModelManager().getTree();
    if (!(r instanceof GroupNode)) return;

    // Parse geometry
    const loader = new STLLoader();
    const geometry = loader.parse(buffer);

    // Center geometry at origin and compute size
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const center = new THREE.Vector3();
    bb.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();

    // Store as base64 for persistence
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const stlBase64 = btoa(binary);

    const node = new ImportedMeshNode(
      geometry,
      stlBase64,
      file.name,
      { position: { x: 0, y: 0, z: 0 } },
    );

    withHistory(() => {
      r.children.push(node);
    });

    if (sceneService) sceneService.rebuildSceneFromTree();
    onSelectNode(node);
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
  const dummyScene = new THREE.Scene();
  const threeRenderer = new Renderer(dummyScene);

  modelApp.value = markRaw(new ModelApp(modelManager, historyManager, threeRenderer, serializer));
  modelApp.value.init();

  sceneService = new ConstructorSceneService(modelApp.value, {
    onSelectNodeFromScene(node, { shift }) {
      onSelectNode(node, shift);
    },
    onDeselectAll() {
      setSelection([]);
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
    onNodeParamsChanged(node) {
      if (selectedNode.value === node || toRaw(selectedNode.value) === node) {
        syncFormFromNode(node);
      }
    },
    onBeforeDrag() {
      try {
        const s = modelApp.value!.getSerializer();
        const root = modelApp.value!.getModelManager().getTree();
        beforeDragJSON = s.toJSON(root);
      } catch (_) {
        beforeDragJSON = null;
      }
    },
    onAfterDrag() {
      if (!beforeDragJSON) return;
      try {
        const s = modelApp.value!.getSerializer();
        const root = modelApp.value!.getModelManager().getTree();
        const afterJSON = s.toJSON(root);
        const cmd = new SnapshotCommand(beforeDragJSON, afterJSON, restoreFromSnapshot);
        modelApp.value!.getHistoryManager().push(cmd);
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
  sceneService.setSelection(selectedNodes.value, selectedNode.value);
  sceneService.setSnapStep(snapStep.value);
  sceneService.setGridVisible(sceneSettings.value.showGrid);
  sceneService.setBackgroundColor(sceneSettings.value.background);
  sceneService.setZoomSpeed(sceneSettings.value.zoomSpeed);
  sceneService.setGridSize(sceneSettings.value.gridWidth, sceneSettings.value.gridLength);

  // Chamfer mode: wire up edge click callback
  sceneService.getChamferMode().onEdgeClick = (obj, edge, settings) => {
    applyChamferToEdge(obj, edge, settings);
  };

  // Generator mode: wire up generate callback
  sceneService.getGeneratorMode().onGenerate = (_geometry, _height, name) => {
    const r = modelApp.value!.getModelManager().getTree();
    if (!(r instanceof GroupNode)) return;

    const gm = sceneService!.getGeneratorMode();
    let prim: Primitive;

    if (gm.settings.type === 'thread') {
      const ts = gm.settings.thread;
      prim = new Primitive('thread', {
        outerDiameter: ts.outerDiameter,
        innerDiameter: ts.innerDiameter,
        pitch: ts.pitch,
        turns: ts.turns,
        threadProfile: ts.profile,
        segments: ts.segmentsPerTurn,
        leftHand: ts.leftHand === true,
      }, { position: { x: 0, y: 0, z: 0 } });
    } else {
      const ks = gm.settings.knurl;
      prim = new Primitive('knurl', {
        outerDiameter: ks.outerDiameter,
        innerDiameter: ks.innerDiameter,
        height: ks.height,
        notchCount: ks.notchCount,
        knurlPattern: ks.pattern,
        knurlAngle: ks.angle,
        segmentsPerNotch: ks.segmentsPerNotch,
        heightSegments: ks.heightSegments,
      }, { position: { x: 0, y: 0, z: 0 } });
    }
    prim.name = name;

    withHistory(() => {
      r.children.push(prim);
    });

    sceneService!.rebuildSceneFromTree();
    onSelectNode(prim);
    treeVersion.value++;

    // Deactivate generator mode
    generatorModeActive.value = false;
    sceneService!.setGeneratorMode(false);
  };

  // Migrate old single-scene data to scene 0
  const oldKey = 'constructor_scene_v1';
  const oldData = localStorage.getItem(oldKey);
  if (oldData && !localStorage.getItem(STORAGE_KEYS[0])) {
    localStorage.setItem(STORAGE_KEYS[0], oldData);
    localStorage.removeItem(oldKey);
  }

  // Restore scene from localStorage (if any)
  loadFromLocalStorage();

  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  if (sceneService) {
    sceneService.unmount();
    sceneService = null;
  }
  window.removeEventListener('keydown', handleKeydown);
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

/* ─── Debug panel ────────────────────────────────────────────── */
.debug-panel {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  z-index: 15;
  width: 300px;
  max-height: 50vh;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.72rem;
  color: #333;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.3rem 0.5rem;
  font-weight: 700;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.78rem;
}
.debug-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: #999;
  line-height: 1;
}
.debug-close:hover { color: #333; }
.debug-body {
  padding: 0.3rem 0.5rem;
}
.debug-section {
  margin-bottom: 0.35rem;
}
.debug-title {
  font-weight: 600;
  color: #666;
  margin-bottom: 0.1rem;
}
.debug-value {
  color: #333;
  word-break: break-all;
  line-height: 1.4;
}
.debug-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.is-active-tool {
  color: #e67700 !important;
}
</style>
