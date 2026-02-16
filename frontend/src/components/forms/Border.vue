<script setup>
const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
.field.is-horizontal.form-bg-diff
  .field-label.is-small
    label.label {{ $t('form.border.active') }}

  .field-body
    .field
      .control
        label.checkbox
          input(type="checkbox" v-model="props.options.border.active")
          span.is-size-7
            i.fa.fa-border-all &nbsp;
            | {{ $t('form.border.activeLabel') }}

.box.form-bg-diff(v-if="props.options.border.active")
  .columns.is-multiline
    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.width') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type="number" v-model.number="props.options.border.width")
            p.control
              a.button.is-static.is-small {{ props.unit }}

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.depth') }}

        .field-body
          .field.has-addons
            .control
              input.input.is-small(type="number" v-model.number="props.options.border.depth")
            p.control
              a.button.is-static.is-small {{ props.unit }}
</template>

<style scoped>
.form-bg-diff {background: gainsboro;}
</style>
