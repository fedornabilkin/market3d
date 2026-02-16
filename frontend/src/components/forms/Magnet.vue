<script setup>
const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
.field.is-horizontal
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
