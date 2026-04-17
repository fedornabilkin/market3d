<script setup>
defineProps(['options', 'unit']);
</script>

<template lang="pug">
.coaster-section.coaster-section--text
  .field.is-horizontal.form-bg-diff.form-bg--text
    .field-label.is-small
      label.label {{ $t('form.coaster.text.active') }}
    .field-body
      .field
        .control
          label.checkbox
            input(type='checkbox' v-model='options.text.active')
            span.is-size-7
              i.fa.fa-font &nbsp;
              | {{ $t('form.coaster.text.activeLabel') }}

  .box.form-bg-diff.form-bg--text(v-if='options.text.active')
    .field.is-horizontal
      .field-label.is-small
        label.label {{ $t('form.coaster.text.mode') }}
      .field-body
        .field
          .control
            .buttons.has-addons
              button.button.is-small(:class="{ 'is-primary': options.text.mode === 'straight' }" @click="options.text.mode = 'straight'")
                span.icon.is-small
                  i.fa.fa-align-center
                span {{ $t('form.coaster.text.modeStraight') }}
              button.button.is-small(:class="{ 'is-primary': options.text.mode === 'circular' }" @click="options.text.mode = 'circular'")
                span.icon.is-small
                  i.fa.fa-redo
                span {{ $t('form.coaster.text.modeCircular') }}

    .field.is-horizontal
      .field-body
        .field
          .control
            textarea.textarea.is-small(rows='2' v-model='options.text.message' :placeholder="$t('form.coaster.text.placeholder')")

    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.text.size') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.text.size' min='1' max='30' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label {{ $t('form.coaster.text.depth') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.text.depth' min='0.5' max='5' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}

      .column
        .field.is-horizontal(v-if="options.text.mode === 'circular'")
          .field-label.is-small
            label.label {{ $t('form.coaster.text.circularRadius') }}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.text.circularRadius' min='10' max='100')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(
                  type='color'
                  :value='options.text.color || "#000000"'
                  @input='options.text.color = $event.target.value'
                )
</template>
