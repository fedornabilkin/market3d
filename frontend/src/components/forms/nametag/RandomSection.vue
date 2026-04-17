<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.nametag-section.nametag-section--random
  .field.is-horizontal.form-bg-diff
    .field-label.is-small
      label.label {{ $t('form.nametag.random.active') }}
    .field-body
      .field
        .control
          label.checkbox
            input(type='checkbox' v-model='options.nametag.randomHeight.active')
            span.is-size-7
              i.fa.fa-random &nbsp;
              | {{ $t('form.nametag.random.activeLabel') }}

  .box.form-bg-diff(v-if='options.nametag.randomHeight.active')
    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.random.variance') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.randomHeight.variance' min='0' max='0.9' step='0.05')
              p.control
                a.button.is-static.is-small ×
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.nametag.random.seed') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.nametag.randomHeight.seed' min='0' max='99999' step='1')
              .control
                button.button.is-small(
                  @click='options.nametag.randomHeight.seed = Math.floor(Math.random() * 10000)'
                  :title="$t('form.nametag.random.randomSeedTitle')"
                )
                  span.icon
                    i.fa.fa-dice
</template>
