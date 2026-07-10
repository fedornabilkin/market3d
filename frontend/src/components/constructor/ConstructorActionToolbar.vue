<template lang="pug">
.action-toolbar
  span.selection-counter(v-if="selectedCount")
    i.fas.fa-mouse-pointer
    |  {{ selectedCount }}
  .toolbar-separator(v-if="selectedCount")
  button.btn-icon(@click="$emit('merge')" :disabled="!canMerge" title="Группа")
    i.fas.fa-object-group
  button.btn-icon(@click="$emit('ungroup')" :disabled="!canUngroup" title="Разгруппировать")
    i.fas.fa-object-ungroup
  .toolbar-separator
  button.btn-icon(@click="$emit('undo')" :disabled="!canUndo" title="Отменить")
    i.fas.fa-undo
  button.btn-icon(@click="$emit('redo')" :disabled="!canRedo" title="Повторить")
    i.fas.fa-redo
  .toolbar-separator
  button.btn-icon(@click="$emit('duplicate', $event)" :disabled="!canDelete" title="Дублировать")
    i.fas.fa-clone
  button.btn-icon(:class="{ 'is-active-tool': mirrorActive }" @click="$emit('mirror')" :disabled="!canDelete" title="Зеркалирование")
    i.fas.fa-arrows-alt-h
  button.btn-icon(:class="{ 'is-active-tool': cruiseActive }" @click="$emit('cruise')" title="Прилипание")
    i.fas.fa-magnet
  button.btn-icon(:class="{ 'is-active-tool': alignmentActive }" @click="$emit('alignment')" title="Выравнивание")
    i.fas.fa-ruler-combined
  button.btn-icon(:class="{ 'is-active-tool': chamferActive }" @click="$emit('chamfer')" :disabled="!hasSceneObjects" title="Фаска")
    i.fas.fa-bezier-curve
  button.btn-icon(:class="{ 'is-active-tool': generatorActive }" @click="$emit('generator')" title="Генератор")
    i.fas.fa-cogs
  .toolbar-separator
  button.btn-icon.btn-delete(@click="$emit('delete')" :disabled="!canDelete" title="Удалить")
    i.fas.fa-trash
</template>

<script setup lang="ts">
defineProps<{
  selectedCount: number; canMerge: boolean; canUngroup: boolean; canUndo: boolean;
  canRedo: boolean; canDelete: boolean; hasSceneObjects: boolean;
  mirrorActive: boolean; cruiseActive: boolean; alignmentActive: boolean;
  chamferActive: boolean; generatorActive: boolean;
}>();
defineEmits<{ merge: []; ungroup: []; undo: []; redo: []; duplicate: [event: MouseEvent]; mirror: []; cruise: []; alignment: []; chamfer: []; generator: []; delete: [] }>();
</script>

<style scoped>
.action-toolbar { position:absolute; top:.6rem; left:50%; transform:translateX(-50%); z-index:10; display:flex; align-items:center; gap:.2rem; background:rgba(255,255,255,.9); border:1px solid #d0d0d0; border-radius:6px; padding:.25rem .35rem; }
.btn-icon { font-size:.85rem; padding:.25rem .4rem; border:0; background:transparent; cursor:pointer; }
.btn-icon:disabled { opacity:.35; pointer-events:none; } .btn-icon.is-active-tool { background:#3273dc; color:#fff; border-radius:4px; } .btn-delete { color:#e74c3c; }
.toolbar-separator { width:1px; height:1.2rem; background:#d0d0d0; margin:0 .15rem; }
.selection-counter { display:inline-flex; align-items:center; gap:.3rem; font-size:.75rem; font-weight:600; color:#00a5a4; padding:0 .4rem; min-width:1.4rem; height:1.6rem; border-radius:.3rem; background:rgba(0,165,164,.1); }
</style>
