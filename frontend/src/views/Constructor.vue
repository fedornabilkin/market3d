<template lang="pug">
.constructor-page
  .constructor-sidebar
    .constructor-panel.constructor-panel--nodes
      .panel-header Список узлов
      .node-list
        NodeTree(
          :node="rootNode"
          :selected-nodes="selectedNodes"
          :level="0"
          @select="onSelectNodeFromList"
        )
      .panel-actions
        select.select.is-small.merge-op-select(v-model="mergeOperation" :disabled="!canMerge" title="Операция для новой группы")
          option(value="union") Объединить (union)
          option(value="subtract") Вычесть (subtract)
        button.button.is-small.is-info(@click="mergeSelected" :disabled="!canMerge") Сгруппировать
        .add-primitive-row
          select.select.is-small(v-model="newPrimitiveType")
            option(value="box") Куб
            option(value="sphere") Сфера
            option(value="cylinder") Цилиндр
            option(value="cone") Конус
            option(value="torus") Тор
          label.checkbox.add-negative-label
            input(type="checkbox" v-model="newPrimitiveForSubtract")
            span Для вычитания
        button.button.is-small.is-primary(@click="addPrimitive" :disabled="!canAddToSelection") Добавить
        button.button.is-small(@click="deleteSelected" :disabled="!canDeleteSelected") Удалить
        button.button.is-small(@click="undo" :disabled="!canUndo") Отменить
        button.button.is-small(@click="redo" :disabled="!canRedo") Повторить

    .constructor-panel.constructor-panel--settings
      .panel-header Настройки узла
      .settings-content(v-if="selectedNode")
        .field(v-if="isGroupNode(selectedNode)")
          label.label CSG операция
          select.select(v-model="selectedGroupOperation" @change="applyGroupOperation")
            option(value="union") Объединение (union)
            option(value="subtract") Вычитание (subtract)
            option(value="intersect") Пересечение (intersect)
        .field
          label.label Позиция
          .field.has-addons
            input.input(type="number" step="0.1" v-model.number="selectedPosition.x" @change="applySettingsPosition")
            input.input(type="number" step="0.1" v-model.number="selectedPosition.y" @change="applySettingsPosition")
            input.input(type="number" step="0.1" v-model.number="selectedPosition.z" @change="applySettingsPosition")
        .field
          label.label Масштаб
          .field.has-addons
            input.input(type="number" step="0.1" v-model.number="selectedScale.x" @change="applySettingsScale")
            input.input(type="number" step="0.1" v-model.number="selectedScale.y" @change="applySettingsScale")
            input.input(type="number" step="0.1" v-model.number="selectedScale.z" @change="applySettingsScale")
        .field
          label.label Поворот (рад)
          .field.has-addons
            input.input(type="number" step="0.01" v-model.number="selectedRotation.x" @change="applySettingsRotation")
            input.input(type="number" step="0.01" v-model.number="selectedRotation.y" @change="applySettingsRotation")
            input.input(type="number" step="0.01" v-model.number="selectedRotation.z" @change="applySettingsRotation")
        template(v-if="isPrimitive(selectedNode)")
          .field
            label.label Параметры геометрии
            .field(v-for="(val, key) in selectedGeometryParams" :key="key")
              label.label.is-small {{ key }}
              input.input(type="number" step="0.01" v-model.number="selectedGeometryParams[key]" @change="applySettingsGeometry")
      .settings-placeholder(v-else)
        | Выберите узел в сцене или в списке

  .constructor-canvas-wrap
    .debug-panel
      .debug-panel-header Отладка сцены
      .debug-panel-body
        template(v-if="flattenedDebugTree.length")
          .debug-node(
            v-for="item in flattenedDebugTree"
            :key="item.path"
            :style="{ paddingLeft: (item.level * 12) + 'px' }"
          )
            .debug-node-head
              span.debug-toggle(
                v-if="item.isGroup"
                @click="toggleDebugExpand(item.path)"
              ) {{ item.expanded ? '▼' : '▶' }}
              span.debug-toggle-placeholder(v-else)
              span.debug-label {{ item.label }}
            .debug-node-params(v-if="item.node")
              .debug-param(v-if="item.node.params?.position")
                | pos: ({{ formatNum(item.node.params.position.x) }}, {{ formatNum(item.node.params.position.y) }}, {{ formatNum(item.node.params.position.z) }})
              .debug-param(v-if="item.node.params?.scale")
                | scale: ({{ formatNum(item.node.params.scale.x) }}, {{ formatNum(item.node.params.scale.y) }}, {{ formatNum(item.node.params.scale.z) }})
              .debug-param(v-if="item.node.params?.rotation")
                | rot: ({{ formatNum(item.node.params.rotation.x) }}, {{ formatNum(item.node.params.rotation.y) }}, {{ formatNum(item.node.params.rotation.z) }})
              .debug-param(v-if="item.isPrimitive && item.node.geometryParams")
                | geom: {{ formatGeometry(item.node.geometryParams) }}
        .debug-empty(v-else) Нет узлов
        .debug-section(v-if="sceneDebugInfo")
          .debug-section-title Объекты на сцене
          .debug-param(v-for="c in sceneDebugInfo.sceneChildren" :key="c.index")
            | [{{ c.index }}] {{ c.type }} {{ c.name }} visible={{ c.visible }} children={{ c.childrenCount }}
          .debug-section-title(v-if="sceneDebugInfo.gizmo") Гизмо меток
          template(v-if="sceneDebugInfo.gizmo")
            .debug-param hasTarget={{ sceneDebugInfo.gizmo.hasTarget }}
            .debug-param groupInScene={{ sceneDebugInfo.gizmo.groupInScene }}
            .debug-param groupVisible={{ sceneDebugInfo.gizmo.groupVisible }}
            .debug-param handlesCount={{ sceneDebugInfo.gizmo.handlesCount }}
            .debug-param(v-if="sceneDebugInfo.gizmo.boxMin") AABB min: ({{ formatNum(sceneDebugInfo.gizmo.boxMin.x) }}, {{ formatNum(sceneDebugInfo.gizmo.boxMin.y) }}, {{ formatNum(sceneDebugInfo.gizmo.boxMin.z) }})
            .debug-param(v-if="sceneDebugInfo.gizmo.boxMax") AABB max: ({{ formatNum(sceneDebugInfo.gizmo.boxMax.x) }}, {{ formatNum(sceneDebugInfo.gizmo.boxMax.y) }}, {{ formatNum(sceneDebugInfo.gizmo.boxMax.z) }})
            .debug-param Метки (позиции):
            .debug-param.debug-indent(v-for="(pos, i) in sceneDebugInfo.gizmo.handlePositions" :key="i")
              | {{ pos.type }}: ({{ formatNum(pos.x) }}, {{ formatNum(pos.y) }}, {{ formatNum(pos.z) }})
    div(ref="containerRef" class="canvas-container")
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, toRaw } from 'vue';
import { markRaw } from 'vue';
import * as THREE from 'three';
import {
  ModelApp,
  ModelManager,
  HistoryManager,
  Renderer,
  Serializer,
  GroupNode,
  Primitive,
  ConstructorSceneService,
} from '@/v3d/constructor';
import NodeTree from '@/components/constructor/NodeTree.vue';

const containerRef = ref(null);
const selectedNode = ref(null);
const selectedNodes = ref([]);
const modelApp = ref(null);
const sceneDebugInfo = ref(null);
const debugExpanded = ref({ '': true });

let sceneService = null;

const rootNode = computed(() => modelApp.value?.getModelManager()?.getTree() ?? null);
const canUndo = computed(() => modelApp.value?.getHistoryManager()?.canUndo() ?? false);
const canRedo = computed(() => modelApp.value?.getHistoryManager()?.canRedo() ?? false);
const canAddToSelection = computed(() => !!modelApp.value?.getModelManager()?.getTree());
const root = computed(() => modelApp.value?.getModelManager()?.getTree() ?? null);
const canDeleteSelected = computed(() => {
  const node = selectedNode.value;
  const r = root.value;
  return !!node && !!r && node !== r;
});
const canMerge = computed(() => selectedNodes.value.length >= 2);

function flattenDebugTree(node, path, level, expandedSet) {
  if (!node) return [];
  const isGroup = node instanceof GroupNode;
  const expanded = path in expandedSet ? !!expandedSet[path] : true;
  const label = isGroup ? `Группа (${node.operation})` : `Примитив: ${node.type}`;
  const result = [{ path, node, level, isGroup, isPrimitive: isPrimitive(node), expanded, label }];
  if (isGroup && expanded && node.children && node.children.length) {
    node.children.forEach((child, i) => {
      const childPath = path ? `${path}-${i}` : String(i);
      result.push(...flattenDebugTree(child, childPath, level + 1, expandedSet));
    });
  }
  return result;
}

const flattenedDebugTree = computed(() => {
  const rootVal = rootNode.value;
  if (!rootVal) return [];
  return flattenDebugTree(rootVal, '', 0, debugExpanded.value);
});

function toggleDebugExpand(path) {
  const next = { ...debugExpanded.value };
  next[path] = !next[path];
  debugExpanded.value = next;
}

function formatNum(n) {
  if (typeof n !== 'number') return '-';
  return n.toFixed(2);
}

function formatGeometry(params) {
  if (!params || typeof params !== 'object') return '-';
  return Object.entries(params)
    .map(([k, v]) => (typeof v === 'number' ? `${k}: ${v.toFixed(2)}` : `${k}: ${v}`))
    .join(', ');
}

const newPrimitiveType = ref('box');
const newPrimitiveForSubtract = ref(false);
const selectedGroupOperation = ref('union');
const mergeOperation = ref('union');
const selectedPosition = ref({ x: 0, y: 0, z: 0 });
const selectedScale = ref({ x: 1, y: 1, z: 1 });
const selectedRotation = ref({ x: 0, y: 0, z: 0 });
const selectedGeometryParams = ref({});

function isPrimitive(node) {
  return node && node.constructor && node.constructor.name === 'Primitive';
}

function isGroupNode(node) {
  return node && node instanceof GroupNode;
}

function syncFormFromNode(node) {
  if (!node) return;
  const p = node.params?.position ?? { x: 0, y: 0, z: 0 };
  const s = node.params?.scale ?? { x: 1, y: 1, z: 1 };
  const r = node.params?.rotation ?? { x: 0, y: 0, z: 0 };
  selectedPosition.value = { ...p };
  selectedScale.value = { ...s };
  selectedRotation.value = { ...r };
  if (isPrimitive(node)) {
    selectedGeometryParams.value = { ...node.geometryParams };
  }
  if (isGroupNode(node)) {
    selectedGroupOperation.value = node.operation;
  }
}

function applyGroupOperation() {
  if (!selectedNode.value || !isGroupNode(selectedNode.value)) return;
  selectedNode.value.operation = selectedGroupOperation.value;
}

function applySettingsPosition() {
  if (!selectedNode.value) return;
  selectedNode.value.params = selectedNode.value.params || {};
  selectedNode.value.params.position = { ...selectedPosition.value };
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function applySettingsScale() {
  if (!selectedNode.value) return;
  selectedNode.value.params = selectedNode.value.params || {};
  selectedNode.value.params.scale = { ...selectedScale.value };
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function applySettingsRotation() {
  if (!selectedNode.value) return;
  selectedNode.value.params = selectedNode.value.params || {};
  selectedNode.value.params.rotation = { ...selectedRotation.value };
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function applySettingsGeometry() {
  if (!selectedNode.value || !isPrimitive(selectedNode.value)) return;
  selectedNode.value.geometryParams = { ...selectedGeometryParams.value };
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function setSelection(nodes) {
  selectedNodes.value = nodes.length ? [...nodes] : [];
  selectedNode.value = nodes.length ? nodes[nodes.length - 1] : null;
  if (selectedNode.value) syncFormFromNode(selectedNode.value);
  if (sceneService) sceneService.setSelection(selectedNodes.value, selectedNode.value);
}

function onSelectNode(node, shiftKey = false) {
  const rawNode = toRaw(node);
  const list = selectedNodes.value;
  if (shiftKey) {
    const idx = list.indexOf(rawNode);
    if (idx !== -1) {
      const next = list.filter((_, i) => i !== idx);
      setSelection(next);
    } else {
      setSelection([...list, rawNode]);
    }
  } else {
    setSelection([rawNode]);
  }
}

function onSelectNodeFromList(ev) {
  const { node, shiftKey } = ev;
  onSelectNode(node, shiftKey);
}

function getDefaultParamsForType(type) {
  switch (type) {
    case 'box':
      return { width: 1, height: 1, depth: 1 };
    case 'sphere':
      return { radius: 0.5, widthSegments: 16, heightSegments: 16 };
    case 'cylinder':
      return { radiusTop: 0.5, radiusBottom: 0.5, height: 1, segments: 32 };
    case 'cone':
      return { radius: 0.5, height: 1, segments: 32 };
    case 'torus':
      return { radius: 0.5, tube: 0.2, segments: 32 };
    default:
      return { width: 1, height: 1, depth: 1 };
  }
}

/** Позиция по умолчанию: position.y = 0 — низ объекта на сетке. */
function getDefaultPositionForPrimitive(type, geometryParams) {
  return { x: 0, y: 0, z: 0 };
}

function addPrimitive() {
  const r = modelApp.value.getModelManager().getTree();
  if (!(r instanceof GroupNode)) return;
  const type = newPrimitiveType.value;
  const geometryParams = getDefaultParamsForType(type);
  const defaultPosition = getDefaultPositionForPrimitive(type, geometryParams);
  const prim = new Primitive(type, geometryParams, { position: defaultPosition });

  if (newPrimitiveForSubtract.value) {
    const subtractGroup = new GroupNode();
    subtractGroup.operation = 'subtract';
    subtractGroup.children = [prim];
    r.children.push(subtractGroup);
    if (sceneService) sceneService.rebuildSceneFromTree();
    onSelectNode(prim);
  } else {
    r.children.push(prim);
    if (sceneService) sceneService.rebuildSceneFromTree();
    onSelectNode(prim);
  }
}

function deleteSelected() {
  const node = selectedNode.value;
  const r = modelApp.value.getModelManager().getTree();
  if (!node || !r) return;
  const nodeUuid = node.uuidMesh;
  if (nodeUuid && r.uuidMesh === nodeUuid) return;
  const parent = sceneService ? sceneService.getParentOf(node) : null;
  if (!parent || !(parent instanceof GroupNode)) return;
  const idx = nodeUuid
    ? parent.children.findIndex((c) => c.uuidMesh === nodeUuid)
    : parent.children.indexOf(node);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
    setSelection(selectedNodes.value.filter((n) => (nodeUuid ? n.uuidMesh !== nodeUuid : n !== node)));
    if (sceneService) sceneService.rebuildSceneFromTree();
  }
}

function mergeSelected() {
  const nodes = selectedNodes.value;
  const r = modelApp.value.getModelManager().getTree();
  if (!(r instanceof GroupNode) || nodes.length < 2) return;
  const entries = [];
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
  entries.sort((a, b) => {
    if (a.parent !== b.parent) return 0;
    return b.index - a.index;
  });
  const group = new GroupNode();
  group.operation = mergeOperation.value;
  for (const { parent, index, node } of entries) {
    parent.children.splice(index, 1);
    group.children.push(node);
  }
  if (group.children.length === 0) return;
  r.children.push(group);
  setSelection([group]);
  if (sceneService) sceneService.rebuildSceneFromTree();
}

function undo() {
  modelApp.value.getHistoryManager().undo();
}

function redo() {
  modelApp.value.getHistoryManager().redo();
}

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
    onDebugInfoUpdate(info) {
      sceneDebugInfo.value = info;
    },
    onNodeParamsChanged(node) {
      if (selectedNode.value === node) syncFormFromNode(node);
    },
  });
  sceneService.mount(containerRef.value);
  sceneService.setSelection(selectedNodes.value, selectedNode.value);
});

onBeforeUnmount(() => {
  if (sceneService) {
    sceneService.unmount();
    sceneService = null;
  }
});
</script>

<style scoped>
.constructor-page {
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: 1fr;
  height: 100vh;
  width: 100vw;
  gap: 0;
  background: #0f0f1a;
  color: #e0e0e0;
  overflow: hidden;
}
.constructor-sidebar {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #2a2a3e;
}
.constructor-panel {
  padding: 0.75rem;
  overflow: auto;
}
.constructor-panel--nodes {
  flex: 0 0 auto;
  border-bottom: 1px solid #2a2a3e;
  max-height: 45%;
}
.constructor-panel--settings {
  flex: 1;
  min-height: 0;
}
.panel-header {
  font-weight: 600;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}
.constructor-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
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
.debug-panel {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  z-index: 10;
  width: 280px;
  max-height: 70vh;
  background: rgba(15, 15, 26, 0.92);
  border: 1px solid #2a2a3e;
  border-radius: 6px;
  font-size: 0.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.debug-panel-header {
  padding: 0.4rem 0.6rem;
  font-weight: 600;
  border-bottom: 1px solid #2a2a3e;
  flex-shrink: 0;
}
.debug-panel-body {
  padding: 0.4rem 0;
  overflow-y: auto;
  max-height: calc(70vh - 2rem);
}
.debug-node {
  margin-bottom: 0.25rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}
.debug-node:hover {
  background: rgba(42, 42, 62, 0.6);
}
.debug-node-head {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.debug-toggle,
.debug-toggle-placeholder {
  display: inline-block;
  width: 1rem;
  cursor: pointer;
  user-select: none;
  color: #888;
}
.debug-toggle-placeholder {
  cursor: default;
}
.debug-toggle:hover {
  color: #e0e0e0;
}
.debug-label {
  font-weight: 500;
}
.debug-node-params {
  margin-top: 0.2rem;
  margin-left: 1.25rem;
  color: #9ca3af;
  font-size: 0.7rem;
}
.debug-section {
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid #2a2a3e;
}
.debug-section-title {
  font-weight: 600;
  margin: 0.4rem 0 0.2rem;
  font-size: 0.75rem;
  color: #a5b4fc;
}
.debug-indent {
  margin-left: 0.5rem;
}
.debug-param {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.debug-empty {
  padding: 0.5rem 0.6rem;
  color: #6b7280;
}
.merge-op-select {
  max-width: 11rem;
}
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  align-items: center;
}
.add-primitive-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.add-primitive-row .select {
  flex: 1;
  min-width: 0;
}
.add-negative-label {
  white-space: nowrap;
  font-size: 0.85rem;
}
.settings-content .field {
  margin-bottom: 0.75rem;
}
.settings-content .field.has-addons {
  display: flex;
  gap: 0.25rem;
}
.settings-content .field.has-addons .input {
  flex: 1;
  max-width: 5rem;
}
.settings-placeholder {
  color: #888;
  font-size: 0.9rem;
}
.node-list {
  max-height: 30vh;
  overflow-y: auto;
}
</style>
