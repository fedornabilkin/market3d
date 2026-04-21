<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  axis: { type: String, default: 'x' },
  step: { type: Number, default: 1 },
  title: { type: String, default: '' },
  resetTitle: { type: String, default: 'Сброс' },
})
const emit = defineEmits(['update:modelValue'])

const isY = computed(() => props.axis === 'y')
const decIcon = computed(() => (isY.value ? 'fa-arrow-down' : 'fa-arrow-left'))
const incIcon = computed(() => (isY.value ? 'fa-arrow-up' : 'fa-arrow-right'))

const onInput = (e) => {
  const v = Number(e.target.value)
  emit('update:modelValue', Number.isFinite(v) ? v : 0)
}
const adjust = (delta) => {
  const v = (Number(props.modelValue) || 0) + delta
  emit('update:modelValue', Math.round(v * 1000) / 1000)
}
const reset = () => emit('update:modelValue', 0)
</script>

<template lang="pug">
.field.has-addons.mb-0.offset-field(:title='title')
  p.control
    button.button.is-small.offset-field__btn(type='button' @click='adjust(-step)')
      span.icon.is-small
        i.fa(:class='decIcon')
  p.control
    button.button.is-small.offset-field__btn(type='button' @click='adjust(step)')
      span.icon.is-small
        i.fa(:class='incIcon')
  .control
    input.input.is-small.offset-field__input(type='number' :value='modelValue' @input='onInput')
  p.control
    button.button.is-small.offset-field__btn(type='button' @click='reset' :title='resetTitle' :aria-label='resetTitle')
      span.icon.is-small
        i.fa.fa-undo
</template>

<style scoped>
.offset-field {
  flex-wrap: nowrap;
  width: fit-content;
}
.offset-field__input {
  width: 64px;
  text-align: right;
  padding-left: 4px;
  padding-right: 4px;
}
.offset-field__btn .icon {
  font-size: 0.72rem;
}
</style>
