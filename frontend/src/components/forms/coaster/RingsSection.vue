<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.coaster-section.coaster-section--rings
  .field.is-horizontal.form-bg-diff
    .field-label.is-small
      label.label {{ $t('form.coaster.rings.active') }}
    .field-body
      .field
        .control
          label.checkbox
            input(type='checkbox' v-model='options.rings.active')
            span.is-size-7
              i.fa.fa-bullseye &nbsp;
              | {{ $t('form.coaster.rings.activeLabel') }}

  .box.form-bg-diff(v-if='options.rings.active')
    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.rings.count') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.count' min='1' max='20')
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.rings.ringWidth') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.ringWidth' min='0.5' max='10' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.rings.startRadius') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.startRadius' min='5' max='100')
              p.control
                a.button.is-static.is-small {{ unit }}

      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.rings.spacing') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.spacing' min='0.5' max='20' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.rings.height') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.depth' min='0.5' max='5' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(
                  type='color'
                  :value='options.rings.color || "#000000"'
                  @input='options.rings.color = $event.target.value'
                )
</template>
