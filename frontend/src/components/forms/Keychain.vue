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
                  option(value='topRight') {{ $t('form.top') }}-{{ $t('form.right') }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.keychain.height') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.keychain.height')
            p.control
              a.button.is-static.is-small {{ unit }}
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
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.keychain.borderWidth') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.keychain.borderWidth')
            p.control
              a.button.is-static.is-small {{ unit }}

      .field.is-horizontal
        .field-body
          .field.has-addons
            p.control(:title="$t('form.icon.offsetX')")
              .button.is-static.is-small
                span
                  i.fa.fa-arrow-right
            .control
              input.input.is-small(type='number' v-model.number='props.options.keychain.offsetX')
            p.control
              a.button.is-static.is-small {{unit}}

      .field.is-horizontal
        .field-body
          .field.has-addons
            p.control(:title="$t('form.icon.offsetY')")
              .button.is-static.is-small
                span
                  i.fa.fa-arrow-up
            .control
              input.input.is-small(type='number' v-model.number='props.options.keychain.offsetY')
            p.control
              a.button.is-static.is-small {{unit}}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.color') }}
        .field-body
          .field
            .control
              input.input.is-small(type='color' :value='props.options.keychain.color || "#ffffff"' @input='props.options.keychain.color = $event.target.value')
</template>

<style scoped>
.form-bg-diff {background: ghostwhite;}
</style>
