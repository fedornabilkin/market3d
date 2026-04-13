<script setup>
import Base from '@/components/forms/Base.vue'
import Keychain from '@/components/forms/Keychain.vue'

const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
Base(:options='options' :unit='unit')

.field
  label.label {{ $t('form.braille.title') }}
.box
  .columns.is-multiline
    .column
      .field
        label.label.is-small {{ $t('form.braille.text') }}
        .control
          textarea.textarea.is-small(v-model='options.text' :placeholder="$t('form.braille.textPlaceholder')" rows='3')

      .field
        label.label.is-small {{ $t('form.braille.mode') }}
        .control
          .buttons.has-addons
            button.button.is-small(
              :class="{ 'is-primary': options.dotMode === 6 }"
              @click="options.dotMode = 6"
            ) {{ $t('form.braille.mode6') }}
            button.button.is-small(
              :class="{ 'is-primary': options.dotMode === 8 }"
              @click="options.dotMode = 8"
            ) {{ $t('form.braille.mode8') }}

      .field.is-horizontal
        .field-body
          .control
            label.checkbox
              input(type='checkbox' v-model='options.showPlainText')
              span.is-size-7 &nbsp;{{ $t('form.braille.showPlainText') }}

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.braille.dotDiameter') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.dotDiameter' min='0.5' max='5' step='0.1')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.braille.dotHeight') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.dotHeight' min='0.3' max='5' step='0.1')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.braille.spacingX') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.dotSpacingX' min='1' max='10' step='0.1')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.braille.spacingY') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.dotSpacingY' min='1' max='10' step='0.1')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.braille.cellSpacing') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.cellSpacing' min='3' max='20' step='0.5')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.braille.lineSpacing') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.lineSpacing' min='3' max='30' step='0.5')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-body
          .field
            .control
              input.gen-color-input(type='color' v-model='options.dotColor')

  .box(v-if="options.showPlainText")
    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.braille.plainTextSize') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.plainTextSize' min='1' max='20' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
      .column
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(type='color' v-model='options.plainTextColor')

Keychain(:options='options' :unit='unit')
</template>
