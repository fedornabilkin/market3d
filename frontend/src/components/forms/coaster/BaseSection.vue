<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.coaster-section.coaster-section--base
  .field
    label.label {{ $t('form.coaster.base.title') }}
  .box
    .field.is-horizontal
      .field-label.is-small
        label.label {{ $t('form.coaster.base.shape') }}
      .field-body
        .field
          .control
            .buttons.has-addons
              button.button.is-small(:class="{ 'is-primary': options.base.shape === 'circle' }" @click="options.base.shape = 'circle'")
                span.icon.is-small
                  i.fa.fa-circle
                span {{ $t('form.coaster.base.shapeCircle') }}
              button.button.is-small(:class="{ 'is-primary': options.base.shape === 'roundedRectangle' }" @click="options.base.shape = 'roundedRectangle'")
                span.icon.is-small
                  i.fa.fa-square
                span {{ $t('form.coaster.base.shapeRect') }}

    .columns.is-multiline
      .column
        .field.is-horizontal(v-if="options.base.shape === 'circle'")
          .field-label.is-small
            label.label {{ $t('form.coaster.base.diameter') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.base.width' min='20' max='200')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal(v-if="options.base.shape === 'circle'")
          .field-label.is-small
            label.label {{ $t('form.coaster.base.segments') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.base.segments' min='8' max='128' step='4')
        template(v-else)
          .field.is-horizontal
            .field-label.is-small
              label.label {{ $t('form.width') }}
            .field-body
              .field.has-addons
                .control
                  input.input.is-small(type='number' v-model.number='options.base.width' min='20' max='200')
                p.control
                  a.button.is-static.is-small {{ unit }}
          .field.is-horizontal
            .field-label.is-small
              label.label {{ $t('form.height') }}
            .field-body
              .field.has-addons
                .control
                  input.input.is-small(type='number' v-model.number='options.base.height' min='20' max='200')
                p.control
                  a.button.is-static.is-small {{ unit }}
          .field.is-horizontal
            .field-label.is-small
              label.label {{ $t('form.coaster.base.cornerRadius') }}
            .field-body
              .field.has-addons
                .control
                  input.input.is-small(type='number' v-model.number='options.base.cornerRadius' min='0' max='50')
                p.control
                  a.button.is-static.is-small {{ unit }}

      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.base.thickness') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.base.depth' min='1' max='20' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(
                  type='color'
                  :value='options.base.color || "#ffffff"'
                  @input='options.base.color = $event.target.value'
                )
</template>
