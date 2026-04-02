<script setup>
const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
.field.is-horizontal.form-bg-diff.form-bg--border
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

.box.form-bg-diff.form-bg--border(v-if="props.options.border.active")
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
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.color') }}
        .field-body
          .field
            .control
              input.input.is-small(type='color' :value='props.options.border.color || "#000000"' @input='props.options.border.color = $event.target.value')
</template>

