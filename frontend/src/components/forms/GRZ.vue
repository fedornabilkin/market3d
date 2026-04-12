<script setup>
import Base from '@/components/forms/Base.vue'
import Border from '@/components/forms/Border.vue'
import Keychain from '@/components/forms/Keychain.vue'

const props = defineProps(['options', 'unit'])

const ALLOWED_LETTERS = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']

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
