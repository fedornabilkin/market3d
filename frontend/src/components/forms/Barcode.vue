<script setup>
const props = defineProps(['options', 'unit'])

const activeChange = () => {
  props.options.barcode.eventActive()
}
</script>

<template lang="pug">
.field.is-horizontal.form-bg-diff.form-bg--barcode
  .field-label.is-small
    label.label {{ $t('form.barcode.active') }}

  .field-body
    .field
      .control
        label.checkbox
          input(type="checkbox" v-model="props.options.barcode.active" @change="activeChange")
          span.is-size-7
            i.fa.fa-barcode &nbsp;
            | {{ $t('form.barcode.activeLabel') }}

.box.form-bg-diff.form-bg--barcode(v-if="props.options.barcode.active")
  .columns.is-multiline
    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.barcode.content') }}
        .field-body
          .field
            .control
              input.input.is-small(type="text" v-model="props.options.barcode.content" :placeholder="$t('form.barcode.placeholder')")
            p.help {{ $t('form.barcode.asciiHelp') }}

      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.barcode.format') }}
        .field-body
          .field
            .control
              .select.is-small
                select(v-model="props.options.barcode.format")
                  option(value="CODE128") CODE128

      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.depth') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type="number" min="0.1" step="0.1" v-model.number="props.options.barcode.depth")
            p.control
              a.button.is-static.is-small {{ unit }}

      .field.is-horizontal
        .field-body
          .field
            .control
              input.gen-color-input(type="color" :value="props.options.barcode.color || '#000000'" @input="props.options.barcode.color = $event.target.value")

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.height') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type="number" min="1" step="1" v-model.number="props.options.barcode.height")
            p.control
              a.button.is-static.is-small {{ unit }}

      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.margin') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type="number" min="0" step="0.5" v-model.number="props.options.barcode.margin")
            p.control
              a.button.is-static.is-small {{ unit }}

      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.barcode.barRatio') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type="number" min="25" max="150" step="1" v-model.number="props.options.barcode.barRatio")
            p.control
              a.button.is-static.is-small %

  .mt-1(style="width: fit-content")
    figure.image.barcode-preview(:class="{'is-skeleton': !props.options.barcode.preview.src}")
      img(:src="props.options.barcode.preview.src")
</template>

<style scoped>
.barcode-preview {
  width: 180px;
  height: 72px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
}

.barcode-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
