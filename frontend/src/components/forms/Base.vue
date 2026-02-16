<script setup>
const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
.field
  label.label {{ $t("form.base.title") }}
.box
  .columns.is-multiline
    .column
      //.field.is-horizontal
      //  .field-label.is-small
      //    label.label {{ $t("shape") }}
      //  .field-body
      //    .field
      //      .control.has-icons-left
      //        .select.is-small
      //          select(v-model='options.base.shape')
      //            option(value='rectangle') {{ $t("rectangle") }}
      //            option(value='roundedRectangle') {{ $t("roundedRectangle") }}
      //          span.icon.is-small.is-left
      //            i.fa.fa-shapes
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.width') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.base.width')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.height') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.base.height')
            p.control
              a.button.is-static.is-small {{ unit }}

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.depth') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.base.depth')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal(v-if="options.base.shape === 'roundedRectangle'")
        .field-label.is-small
          label.label {{ $t('form.base.cornerRadius') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='options.base.cornerRadius')
            p.control
              a.button.is-static.is-small {{ unit }}


  .field.is-horizontal
    .field-label.is-small
      label.label {{ $t('form.base.active') }}
    .field-body
      .control
        label.checkbox
          input(type="checkbox" v-model="props.options.base.active")
          span.is-size-7
            i.fa.fa-cube &nbsp;
            | {{ $t('form.base.activeLabel') }}

</template>

<style scoped>

</style>
