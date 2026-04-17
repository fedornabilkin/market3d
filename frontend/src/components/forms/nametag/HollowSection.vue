<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.nametag-section.nametag-section--hollow
  .field.is-horizontal.form-bg-diff
    .field-label.is-small
      label.label {{ $t('form.nametag.hollow.active') }}
    .field-body
      .field
        .control
          label.checkbox
            input(type='checkbox' v-model='options.nametag.hollow.active')
            span.is-size-7
              i.far.fa-square &nbsp;
              | {{ $t('form.nametag.hollow.activeLabel') }}
            span.has-text-warning.is-size-7.ml-2(v-if='options.nametag.hollow.active')
              | {{ $t('form.nametag.hollow.slowHint') }}

  .box.form-bg-diff(v-if='options.nametag.hollow.active')
    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.hollow.wallThickness') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.hollow.wallThickness' min='0.3' max='5' step='0.1')
              p.control
                a.button.is-static.is-small {{ unit }}
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.hollow.floorThickness') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.hollow.floorThickness' min='0' max='5' step='0.1')
              p.control
                a.button.is-static.is-small {{ unit }}
</template>
