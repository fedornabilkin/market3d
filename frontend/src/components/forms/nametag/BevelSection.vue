<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.nametag-section.nametag-section--bevel
  .field.is-horizontal.form-bg-diff
    .field-label.is-small
      label.label {{ $t('form.nametag.bevel.active') }}
    .field-body
      .field
        .control
          label.checkbox
            input(type='checkbox' v-model='options.nametag.bevel.active')
            span.is-size-7
              i.fa.fa-drafting-compass &nbsp;
              | {{ $t('form.nametag.bevel.activeLabel') }}

  .box.form-bg-diff(v-if='options.nametag.bevel.active')
    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.bevel.size') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.bevel.size' min='0.05' max='3' step='0.05')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.bevel.thickness') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.bevel.thickness' min='0.05' max='3' step='0.05')
              p.control
                a.button.is-static.is-small {{ unit }}
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.bevel.segments') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.bevel.segments' min='1' max='8' step='1')
</template>
