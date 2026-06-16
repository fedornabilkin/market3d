<script setup>
import { watch } from 'vue'
import Base from '@/components/forms/Base.vue'
import Border from '@/components/forms/Border.vue'
import Keychain from '@/components/forms/Keychain.vue'

const props = defineProps(['options', 'unit'])

const ALLOWED_LETTERS = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']

// Базовые параметры форматов. Для квадрата высота и шрифт меняются
// пропорционально ширине, сохраняя эти соотношения.
const SQUARE_DEFAULTS = { width: 27, height: 19, fontSize: 5 }
const STANDARD_DEFAULTS = { width: 60, height: 14, fontSize: 8 }

const setFormat = (fmt) => {
  if (props.options.format === fmt) return
  props.options.format = fmt
  const d = fmt === 'square' ? SQUARE_DEFAULTS : STANDARD_DEFAULTS
  props.options.base.width = d.width
  props.options.base.height = d.height
  props.options.fontSize = d.fontSize
}

// В квадратном формате высота и шрифт пропорциональны ширине.
watch(() => props.options.base.width, (w) => {
  if (props.options.format !== 'square' || !w) return
  props.options.base.height =
    Math.round(w * (SQUARE_DEFAULTS.height / SQUARE_DEFAULTS.width) * 10) / 10
  props.options.fontSize =
    Math.round(w * (SQUARE_DEFAULTS.fontSize / SQUARE_DEFAULTS.width) * 100) / 100
})

const clampDigits = () => {
  let d = props.options.digits.replace(/\D/g, '')
  if (d.length > 3) d = d.slice(0, 3)
  props.options.digits = d
}

const clampRegion = () => {
  let r = props.options.region.replace(/\D/g, '')
  if (r.length > 3) r = r.slice(0, 3)
  props.options.region = r
}
</script>

<template lang="pug">
Base(:options='options' :unit='unit')

.field
  label.label {{ $t('form.licensePlate.title') }}

.box
  .columns.is-multiline
    .column
      //- Формат знака: стандартный (520×112) | квадратный (290×170)
      label.label.is-small {{ $t('form.licensePlate.format') }}
      .buttons.has-addons.mb-2.lp-format-buttons
        button.button.is-small(
          type='button'
          :class="{ 'is-selected': (options.format || 'standard') === 'standard' }"
          @click="setFormat('standard')"
        ) {{ $t('form.licensePlate.formatStandard') }}
        button.button.is-small(
          type='button'
          :class="{ 'is-selected': options.format === 'square' }"
          @click="setFormat('square')"
        ) {{ $t('form.licensePlate.formatSquare') }}

      //- Формат номера: X 000 XX | 00(0)
      label.label.is-small {{ $t('form.licensePlate.number') }}
      .lp-number-row
        .lp-number-field
          .select.is-small
            select(v-model='options.letter1')
              option(v-for='l in ALLOWED_LETTERS' :key='l' :value='l') {{ l }}
        .lp-number-field.lp-number-digits
          input.input.is-small(
            type='text'
            v-model='options.digits'
            maxlength='3'
            placeholder='001'
            @input='clampDigits'
          )
        .lp-number-field
          .select.is-small
            select(v-model='options.letter2')
              option(v-for='l in ALLOWED_LETTERS' :key='l' :value='l') {{ l }}
        .lp-number-field
          .select.is-small
            select(v-model='options.letter3')
              option(v-for='l in ALLOWED_LETTERS' :key='l' :value='l') {{ l }}
        .lp-number-sep |
        .lp-number-field.lp-number-region
          input.input.is-small(
            type='text'
            v-model='options.region'
            maxlength='3'
            placeholder='77'
            @input='clampRegion'
          )

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.licensePlate.fontSize') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.fontSize' min='1' max='20' step='0.5')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.licensePlate.textDepth') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.textDepth' min='0.5' max='10' step='0.5')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.licensePlate.textColor') }}
        .field-body
          .field
            .control
              input.gen-color-input(type='color' v-model='options.textColor')

      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.licensePlate.flag') }}
        .field-body
          .control
            label.checkbox
              input(type='checkbox' v-model='options.flagEnabled')
              span.is-size-7 &nbsp;{{ $t('form.licensePlate.flagLabel') }}

Border(:options='options' :unit='unit')
Keychain(:options='options' :unit='unit')
</template>

<style scoped>
.lp-format-buttons .button {
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}
.lp-format-buttons .button.is-selected {
  background-color: #2b6cb0;
  border-color: #1e4e8c;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.35), inset 0 -2px 0 rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
  z-index: 2;
}
.lp-format-buttons .button:not(.is-selected):hover {
  background-color: #edf2f7;
  color: #1a202c;
}
.lp-number-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}
.lp-number-digits input {
  width: 60px;
  text-align: center;
  font-weight: 700;
  letter-spacing: 2px;
}
.lp-number-region input {
  width: 55px;
  text-align: center;
  font-weight: 700;
}
.lp-number-sep {
  font-size: 1.2rem;
  font-weight: 700;
  color: #363636;
  padding: 0 0.15rem;
}
</style>
