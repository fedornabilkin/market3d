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
            .control.has-icons-left
              .select.is-small
                select(v-model='props.options.magnet.shape')
                  option(value='round') {{$t('form.magnet.round')}}
                  option(value='square') {{$t('form.magnet.square')}}
                span.icon.is-small.is-left
                  i.fa.fa-shapes
</template>

<style scoped>

</style>
