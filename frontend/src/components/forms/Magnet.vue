<script setup>
import {computed, watch} from 'vue'
import {Magnet} from '@/v3d/entity'

const props = defineProps(['options', 'unit'])

const maxCount = computed(() => {
  const {maxTotal} = Magnet.computeLayout(
    props.options.base.width,
    props.options.base.height,
    props.options.magnet.size,
    props.options.magnet.gap,
  )
  return maxTotal
})

// Автоматически клампим значение, если пользователь вводит больше, чем помещается.
watch(
  [maxCount, () => props.options.magnet.count],
  ([max, current]) => {
    if (!props.options.magnet.active) return
    if (max <= 0) return
    if (!Number.isFinite(current) || current < 1) {
      props.options.magnet.count = 1
      return
    }
    if (current > max) {
      props.options.magnet.count = max
    }
  },
  {immediate: true},
)
</script>

<template lang="pug">
.field.is-horizontal.gen-activation
  .field-label.is-small
    label.label {{$t('form.magnet.active')}}
  .field-body
    .control
      label.checkbox
        .field
          input(type='checkbox' v-model='props.options.magnet.active')
          span.is-size-7
            |  {{$t('form.magnet.activeLabel')}}

.box(v-if='props.options.magnet.active')
  .columns.is-multiline
    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.size')}}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.magnet.size')
            p.control
              a.button.is-static.is-small {{unit}}
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.depth')}}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.magnet.depth')
            p.control
              a.button.is-static.is-small {{props.unit}}
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.magnet.count')}}
        .field-body
          .field
            .control
              input.input.is-small(
                type='number'
                min='1'
                :max='maxCount > 0 ? maxCount : 1'
                :disabled='maxCount <= 0'
                step='1'
                v-model.number='props.options.magnet.count'
              )
            p.help.is-size-7(v-if='maxCount <= 0') {{$t('form.magnet.noFit')}}
            p.help.is-size-7(v-else) {{$t('form.magnet.maxHint')}}: {{maxCount}}
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.magnet.gap')}}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' min='0' step='0.1' v-model.number='props.options.magnet.gap')
            p.control
              a.button.is-static.is-small {{unit}}
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.magnet.hidden')}}
        .field-body
          .control
            label.checkbox
              .field
                input(type='checkbox' v-model='props.options.magnet.hidden')
                span.is-size-7
                  i.fa.fa-layer-group
                  |  {{$t('form.magnet.hiddenHelp')}}

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.magnet.shape')}}
        .field-body
          .field
            .control
              .buttons.has-addons.mb-0.pick-buttons
                button.button.is-small(
                  type='button'
                  :class="{ 'is-link is-selected': props.options.magnet.shape === 'round' }"
                  :title="$t('form.magnet.round')"
                  :aria-label="$t('form.magnet.round')"
                  @click="props.options.magnet.shape = 'round'"
                )
                  span.icon.is-small
                    svg(viewBox='0 0 10 10' width='14' height='14' aria-hidden='true')
                      circle(cx='5' cy='5' r='3.8' fill='currentColor')
                button.button.is-small(
                  type='button'
                  :class="{ 'is-link is-selected': props.options.magnet.shape === 'square' }"
                  :title="$t('form.magnet.square')"
                  :aria-label="$t('form.magnet.square')"
                  @click="props.options.magnet.shape = 'square'"
                )
                  span.icon.is-small
                    svg(viewBox='0 0 10 10' width='14' height='14' aria-hidden='true')
                      rect(x='1.5' y='1.5' width='7' height='7' fill='currentColor')
</template>

<style scoped>
.pick-buttons .button {
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}
.pick-buttons .button.is-selected {
  background-color: #2b6cb0;
  border-color: #1e4e8c;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.35), inset 0 -2px 0 rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
  z-index: 2;
}
.pick-buttons .button:not(.is-selected):hover {
  background-color: #edf2f7;
  color: #1a202c;
}
</style>
