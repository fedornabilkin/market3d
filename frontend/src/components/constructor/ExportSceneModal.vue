<template lang="pug">
.scene-settings-modal(v-if="visible")
  .scene-settings-backdrop(@click="!exporting && $emit('close')")
  .scene-settings-content(@click.stop)
    .scene-settings-header Экспорт модели
    .scene-settings-body
      .field
        label.label Формат файла
        select.select.is-small(v-model="format" :disabled="exporting")
          option(value="stl") STL
          option(value="obj") OBJ
      .field
        label.checkbox
          input(type="checkbox" v-model="onlySelected" :disabled="!hasSelection || exporting")
          span Только активный объект
      .export-progress(v-if="exporting")
        .export-progress-label {{ status }}
        .export-progress-bar
          .export-progress-fill(:style="{ width: percent + '%' }")
    .scene-settings-footer
      button.button.is-small(@click="$emit('close')" :disabled="exporting") Отмена
      button.button.is-small.is-primary(@click="$emit('export')" :disabled="exporting") {{ exporting ? 'Экспорт...' : 'Скачать' }}
</template>
<script setup lang="ts">
defineProps<{ visible: boolean; exporting: boolean; hasSelection: boolean; percent: number; status: string }>();
const format = defineModel<'stl' | 'obj'>('format', { default: 'stl' });
const onlySelected = defineModel<boolean>('onlySelected', { default: false });
defineEmits<{ close: []; export: [] }>();
</script>
<style scoped>
.scene-settings-modal { position:fixed; inset:0; z-index:20; }
.scene-settings-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.25); }
.scene-settings-content { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); min-width:320px; max-width:420px; background:rgba(255,255,255,.98); border:1px solid #d0d0d0; border-radius:8px; padding:1rem; color:#333; box-shadow:0 4px 20px rgba(0,0,0,.15); }
.scene-settings-header { font-weight:600; margin-bottom:.75rem; }
.scene-settings-body .field { margin-bottom:.75rem; }
.scene-settings-footer { display:flex; justify-content:flex-end; gap:.4rem; margin-top:.5rem; }
.export-progress { margin-top:.5rem; }
.export-progress-label { font-size:.8rem; color:#666; margin-bottom:.3rem; }
.export-progress-bar { height:6px; background:#e0e0e0; border-radius:3px; overflow:hidden; }
.export-progress-fill { height:100%; background:#4a7cff; border-radius:3px; transition:width .15s ease; }
</style>
