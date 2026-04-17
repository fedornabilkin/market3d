<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.nametag-section.nametag-section--text
  .field
    label.label {{ $t('form.nametag.text.title') }}
  .box
    .field.is-horizontal
      .field-body
        .field
          .control
            input.input.is-small(
              type='text'
              v-model='options.nametag.message'
              :placeholder="$t('form.nametag.text.placeholder')"
              maxlength='40'
            )

    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.text.size') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.size' min='6' max='60' step='1')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.text.letterHeight') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.depth' min='0.5' max='20' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.text.spacing') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.letterSpacing' min='0' max='10' step='0.1')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(
                  type='color'
                  :value='options.nametag.color || "#2b6cb0"'
                  @input='options.nametag.color = $event.target.value'
                )
</template>
