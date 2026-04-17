<template lang="pug">
.gen-export-panel
  .gen-export-title
    span.icon
      i.fa.fa-file-export
    span {{$t('e.title')}}
  .gen-export-actions
    .gen-export-group
      button.button.is-primary.is-small.gen-export-btn(@click="$emit('exportSTL')")
        span.icon
          i.fa.fa-cube
        span {{$t('e.buttonStl')}}
      label.gen-export-option
        input.checkbox(type='checkbox' :checked='multiple' @change="$emit('update:multiple', $event.target.checked)")
        span {{ $t("e.multipleLabel") }}
      label.gen-export-option.is-hidden-mobile
        input.checkbox(type='checkbox' :checked='ascii' @change="$emit('update:ascii', $event.target.checked)")
        span ASCII

    .gen-export-group
      button.button.is-info.is-small.gen-export-btn(@click="$emit('exportOBJ')")
        span.icon
          i.fa.fa-cube
        span {{$t('e.buttonObj')}}

      button.button.is-small.gen-export-btn.is-warning(@click="$emit('exportPNG')")
        span.icon
          i.fa.fa-image
        span PNG

      slot
</template>

<script>
export default {
  name: 'ExportPanel',
  props: {
    multiple: {
      type: Boolean,
      default: false,
    },
    ascii: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['exportSTL', 'exportOBJ', 'exportPNG', 'update:multiple', 'update:ascii'],
}
</script>

<style scoped>
.gen-export-panel {
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  background: #f8f9fb;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.gen-export-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  color: #363636;
}

.gen-export-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gen-export-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.gen-export-btn,
:slotted(.gen-export-btn) {
  border-radius: 6px !important;
}

.gen-export-option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #dbdbdb;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.gen-export-option:hover {
  background: #f0f0f0;
  border-color: #b5b5b5;
}
</style>
