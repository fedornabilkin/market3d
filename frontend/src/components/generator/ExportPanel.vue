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
