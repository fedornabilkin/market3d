<template lang="pug">
.constructor-panel.constructor-panel--nodes
  .scene-switcher
    button.scene-tab(
      v-for="index in sceneCount"
      :key="index"
      :class="{ 'is-active': activeSceneIndex === index - 1 }"
      @click="$emit('switch-scene', index - 1)"
    ) Сцена {{ index }}
  .panel-header
    span Feature graph
    .panel-header-actions
      button.btn-icon(@click="$emit('save')" title="Сохранить сцену в файл")
        i.fas.fa-save
      button.btn-icon(@click="$emit('load')" title="Загрузить сцену из файла")
        i.fas.fa-folder-open
      button.btn-icon(@click="$emit('clear')" title="Очистить сцену")
        i.fas.fa-trash-alt
  .node-list(v-show="!generatorActive")
    FeatureTree(
      :doc="document"
      :selected-ids="selectedIds"
      :key="treeVersion"
      @select="$emit('select', $event)"
    )
  .panel-actions
    .shape-icons
      button.shape-btn(
        v-for="shape in shapes"
        :key="shape.type"
        :title="shape.title"
        :disabled="addDisabled"
        @click="$emit('add', shape.type)"
      )
        svg.shape-svg(viewBox="0 0 24 24" fill="currentColor")
          path(:d="shape.icon")
</template>

<script setup lang="ts">
import FeatureTree from './FeatureTree.vue';
import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { PrimitiveType } from '@/v3d/constructor';

defineProps<{
  sceneCount: number;
  activeSceneIndex: number;
  document: FeatureDocument | null;
  selectedIds: readonly string[];
  treeVersion: number;
  generatorActive: boolean;
  addDisabled: boolean;
  shapes: readonly { type: PrimitiveType; title: string; icon: string }[];
}>();

defineEmits<{
  'switch-scene': [index: number];
  save: [];
  load: [];
  clear: [];
  select: [payload: { id: string; shiftKey: boolean }];
  add: [type: PrimitiveType];
}>();
</script>

<style scoped>
.constructor-panel { padding:.75rem; overflow:auto; }
.constructor-panel--nodes { flex:0 0 auto; border-bottom:1px solid #d0d0d0; max-height:50%; }
.scene-switcher { display:flex; margin-bottom:.5rem; border:1px solid #d0d0d0; border-radius:6px; overflow:hidden; }
.scene-tab { flex:1; padding:.35rem 0; font-size:.8rem; font-weight:500; border:0; background:#f5f5f5; color:#666; cursor:pointer; }
.scene-tab:not(:last-child) { border-right:1px solid #d0d0d0; }
.scene-tab:hover:not(.is-active) { background:#e8e8e8; color:#333; }
.scene-tab.is-active { background:#4a7cff; color:#fff; font-weight:600; }
.panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.6rem; font-size:.95rem; font-weight:600; }
.panel-header-actions { display:flex; gap:.25rem; }
.btn-icon { padding:.2rem .3rem; border:0; border-radius:3px; background:transparent; color:#666; cursor:pointer; font-size:.8rem; }
.btn-icon:hover { color:#333; background:#e8e8e8; }
.node-list { max-height:28vh; overflow-y:auto; }
.panel-actions { display:flex; flex-direction:column; gap:.4rem; margin-top:.6rem; }
.shape-icons { display:flex; gap:.3rem; margin-bottom:.4rem; }
.shape-btn { display:flex; align-items:center; justify-content:center; width:2.2rem; height:2.2rem; padding:.35rem; border:1px solid #d0d0d0; border-radius:6px; background:#fff; color:#666; cursor:pointer; }
.shape-btn:hover:not(:disabled) { background:#e8e8e8; color:#333; border-color:#aaa; }
.shape-btn:disabled { opacity:.35; cursor:not-allowed; }
.shape-svg { width:1.2rem; height:1.2rem; }
</style>
