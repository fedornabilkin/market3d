<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.nametag-section.nametag-section--backing
  .field.is-horizontal.form-bg-diff
    .field-label.is-small
      label.label {{ $t('form.nametag.backing.active') }}
    .field-body
      .field
        .control
          label.checkbox
            input(type='checkbox' v-model='options.nametag.backing.active')
            span.is-size-7
              i.fa.fa-layer-group &nbsp;
              | {{ $t('form.nametag.backing.activeLabel') }}

  .box.form-bg-diff(v-if='options.nametag.backing.active')
    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.backing.padding') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.backing.padding' min='0' max='20' step='1')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.backing.depth') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.backing.depth' min='1' max='10' step='1')
              p.control
                a.button.is-static.is-small {{ unit }}
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.backing.curveSegments') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.backing.curveSegments' min='2' max='16' step='1')
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(
                  type='color'
                  :value='options.nametag.backing.color || "#ffffff"'
                  @input='options.nametag.backing.color = $event.target.value'
                )
</template>
