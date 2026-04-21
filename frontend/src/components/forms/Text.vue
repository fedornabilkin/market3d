<script setup>
import OffsetField from '@/components/forms/OffsetField.vue'

const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
.field.is-horizontal.form-bg-diff.form-bg--text
  .field-label.is-small
    label.label {{ $t('form.text.active') }}

  .field-body
    .field
      .control
        label.checkbox
          input(type="checkbox" v-model="props.options.text.active")
          span.is-size-7
            i.fa.fa-font &nbsp;
            | {{ $t('form.text.activeLabel') }}

.box.form-bg-diff.form-bg--text(v-if="props.options.text.active")
  .columns.is-multiline
    .column
      .field.is-horizontal
        .field-body
          .field
            .control
              textarea.textarea.is-small(rows='3' v-model='props.options.text.message' :placeholder="$t('form.text.placeholder')")
              //.buttons.are-small.mt-2.is-pulled-right
                button(:class="{button: true, 'is-primary': props.options.text.align === 'left'}" @click="props.options.text.align = 'left'")
                  span.icon.is-small
                    i.fas.fa-align-left
                button(:class="{ button: true, 'is-primary': props.options.text.align === 'center'}" @click="props.options.text.align = 'center'")
                  span.icon.is-small
                    i.fas.fa-align-center
                button(:class="{ button: true, 'is-primary': props.options.text.align === 'right'}" @click="props.options.text.align = 'right'")
                  span.icon.is-small
                    i.fas.fa-align-right
              p.help.content
                | {{ $t('form.text.textLabel') }}
                br
                .tags.is-multiline
                  .tag.is-light {{ $t('form.text.italic') }}
                  .tag.is-light {{ $t('form.text.bold') }}
      .field.is-horizontal
        .field-body
          .field
            .control
              input.gen-color-input(type='color' :value='props.options.text.color || "#000000"' @input='props.options.text.color = $event.target.value')

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.size') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.text.size')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{ $t('form.depth') }}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.text.depth')
            p.control
              a.button.is-static.is-small {{ unit }}
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.margin')}}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.text.margin')
            p.control
              a.button.is-static.is-small {{unit}}
      .field.is-horizontal
        .field-body
          OffsetField(
            axis='x'
            :title="$t('form.icon.offsetX')"
            :modelValue='props.options.text.offsetX'
            @update:modelValue='props.options.text.offsetX = $event'
          )

      .field.is-horizontal
        .field-body
          OffsetField(
            axis='y'
            :title="$t('form.icon.offsetY')"
            :modelValue='props.options.text.offsetY'
            @update:modelValue='props.options.text.offsetY = $event'
          )

</template>

