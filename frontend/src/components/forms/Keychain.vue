<script setup>
const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
.field.is-horizontal.form-bg-diff
  .field-label.is-small
    label.label {{ $t('form.keychain.active') }}
  .field-body
    .control
      label.checkbox
        .field
          input(type='checkbox' v-model='props.options.keychain.active')
          span.is-size-7
            i.fa.fa-key &nbsp;
            | {{ $t('form.keychain.activeLabel') }}
.box.form-bg-diff(v-if='props.options.keychain.active')
  .columns.is-multiline
    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.keychain.placement') }}
        .field-body
          .field
            .control
              .select.is-small
                select(v-model='props.options.keychain.placement')
                  option(value='top') {{ $t('form.top') }}
                  option(value='left') {{ $t('form.left') }}
                  option(value='topLeft') {{ $t('form.top') }}-{{ $t('form.left') }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.keychain.mirror') }}
        .field-body
          .control
            label.checkbox
              .field
                input(type='checkbox' v-model='props.options.keychain.mirror')
                span.is-size-7 {{ $t('form.keychain.mirrorLabel') }}

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.keychain.holeDiameter') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.keychain.holeDiameter')
            p.control
              a.button.is-static.is-small {{ unit }}
    //.field.is-horizontal
    //  .field-label.is-small
    //    label.label {{ $t("color") }}
    //  .field-body
    //    .field
    //      .control.has-icons-left
    //        input.input.is-small(type='color' v-model='props.options.keychain.color')
    //        span.icon.is-small.is-left
    //          i.fas.fa-palette
</template>

<style scoped>
.form-bg-diff {background: ghostwhite;}
</style>
