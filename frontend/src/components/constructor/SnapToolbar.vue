<template lang="pug">
.snap-toolbar
  .snap-block
    button.snap-grid-toggle(:class="{ 'is-active': showGrid }" @click="$emit('toggle-grid')" title="Сетка")
      i.fas.fa-th
  .toolbar-separator
  .snap-block
    span.snap-icon(title="Шаг привязки")
      i.fas.fa-magnet
    button.snap-step-btn(v-for="step in steps" :key="step" :class="{ 'is-active': step === modelValue }" @click="$emit('update:modelValue', step)") {{ step }}
    span.snap-toolbar-unit мм
  .toolbar-separator
  .snap-block
    span.snap-icon(title="Скорость масштабирования")
      i.fas.fa-search-plus
    button.snap-speed-btn(v-for="speed in zoomSpeeds" :key="speed" :class="{ 'is-active': zoomSpeed === speed }" @click="$emit('zoom', speed)") {{ speed }}
  .toolbar-separator
  .snap-block
    input.snap-size(type="number" min="10" step="10" :value="gridWidth" @change="$emit('size', Number($event.target.value), gridLength)")
    span ×
    input.snap-size(type="number" min="10" step="10" :value="gridLength" @change="$emit('size', gridWidth, Number($event.target.value))")
  .toolbar-separator
  .snap-block
    input.snap-color(type="color" :value="background" @input="$emit('background', $event.target.value)")
</template>
<script setup lang="ts">
defineProps<{ steps: readonly number[]; modelValue: number; showGrid: boolean; zoomSpeed: number; zoomSpeeds: readonly number[]; gridWidth: number; gridLength: number; background: string }>();
defineEmits<{ 'update:modelValue': [value: number]; 'toggle-grid': []; zoom: [value: number]; size: [width: number, length: number]; background: [value: string] }>();
</script>
<style scoped>
.snap-toolbar { position:absolute; bottom:1rem; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:.25rem; z-index:20; width:max-content; white-space:nowrap; color:#333; background:rgba(255,255,255,.95); border:1px solid #d0d0d0; border-radius:6px; padding:.25rem .5rem; }
.snap-block { display:inline-flex; align-items:center; gap:.25rem; }
.snap-icon { width:1rem; text-align:center; color:#777; font-size:.75rem; }
.toolbar-separator { width:1px; height:1.35rem; background:#cfcfcf; margin:0 .2rem; }
.snap-toolbar-unit { font-size:.72rem; color:#777; }
.snap-step-btn,.snap-grid-toggle,.snap-speed-btn { border:1px solid #d0d0d0; background:rgba(255,255,255,.9); border-radius:4px; padding:.2rem .35rem; cursor:pointer; }
.snap-step-btn.is-active,.snap-grid-toggle.is-active,.snap-speed-btn.is-active { background:#3273dc; color:#fff; }
.snap-size { width:3.5rem; border:1px solid #d0d0d0; border-radius:4px; padding:.2rem; }
.snap-color { width:1.6rem; height:1.5rem; padding:0; border:1px solid #d0d0d0; }
</style>
