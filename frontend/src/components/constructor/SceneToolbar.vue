<template lang="pug">
.scene-toolbar
  button.btn-icon(@click="$emit('export')" title="Экспорт модели")
    i.fas.fa-download
  button.btn-icon(@click="$emit('import')" title="Импорт STL")
    i.fas.fa-upload
  button.btn-icon(:class="{ 'is-active-tool': debug }" @click="$emit('debug')" title="Debug")
    i.fas.fa-bug
  button.btn-icon(:class="{ 'is-active-tool': checklist }" @click="$emit('checklist')" title="Тест-чеклист")
    i.fas.fa-tasks
</template>
<script setup lang="ts">
defineProps<{ debug: boolean; checklist: boolean }>();
defineEmits<{ export: []; import: []; debug: []; checklist: [] }>();
</script>
<style scoped>
.scene-toolbar { position:absolute; top:.6rem; right:.6rem; z-index:10; display:flex; gap:.25rem; background:rgba(255,255,255,.9); border:1px solid #d0d0d0; border-radius:6px; padding:.25rem .35rem; }
.btn-icon { border:0; background:transparent; cursor:pointer; padding:.25rem .4rem; }
.btn-icon.is-active-tool { background:#3273dc; color:#fff; border-radius:4px; }
</style>
