<script setup>
import Icon from '@/components/forms/Icon.vue';
import Keychain from '@/components/forms/Keychain.vue';

const props = defineProps(['options', 'unit'])
</script>

<template lang="pug">
//- ─── Форма подставки ────────────────────────────────────
.coaster-section.coaster-section--base
  .field
    label.label Форма подставки
  .box
    .field.is-horizontal
      .field-label.is-small
        label.label Форма
      .field-body
        .field
          .control
            .buttons.has-addons
              button.button.is-small(:class="{ 'is-primary': options.base.shape === 'circle' }" @click="options.base.shape = 'circle'")
                span.icon.is-small
                  i.fa.fa-circle
                span Круглая
              button.button.is-small(:class="{ 'is-primary': options.base.shape === 'roundedRectangle' }" @click="options.base.shape = 'roundedRectangle'")
                span.icon.is-small
                  i.fa.fa-square
                span Квадратная

    .columns.is-multiline
      .column
        .field.is-horizontal(v-if="options.base.shape === 'circle'")
          .field-label.is-small
            label.label Диаметр
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.base.width' min='20' max='200')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal(v-if="options.base.shape === 'circle'")
          .field-label.is-small
            label.label Сегменты
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.base.segments' min='8' max='128' step='4')
        template(v-else)
          .field.is-horizontal
            .field-label.is-small
              label.label Ширина
            .field-body
              .field.has-addons
                .control
                  input.input.is-small(type='number' v-model.number='options.base.width' min='20' max='200')
                p.control
                  a.button.is-static.is-small {{ unit }}
          .field.is-horizontal
            .field-label.is-small
              label.label Высота
            .field-body
              .field.has-addons
                .control
                  input.input.is-small(type='number' v-model.number='options.base.height' min='20' max='200')
                p.control
                  a.button.is-static.is-small {{ unit }}
          .field.is-horizontal
            .field-label.is-small
              label.label Скругление
            .field-body
              .field.has-addons
                .control
                  input.input.is-small(type='number' v-model.number='options.base.cornerRadius' min='0' max='50')
                p.control
                  a.button.is-static.is-small {{ unit }}

      .column
        .field.is-horizontal
          .field-label.is-small
            label.label Толщина
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.base.depth' min='1' max='20' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(type='color' :value='options.base.color || "#ffffff"' @input='options.base.color = $event.target.value')

//- ─── Кольца (мишень) ───────────────────────────────────
.coaster-section.coaster-section--rings
  .field.is-horizontal.form-bg-diff
    .field-label.is-small
      label.label Кольца
    .field-body
      .field
        .control
          label.checkbox
            input(type="checkbox" v-model="options.rings.active")
            span.is-size-7
              i.fa.fa-bullseye &nbsp;
              | Концентрические кольца (мишень)

  .box.form-bg-diff(v-if="options.rings.active")
    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label Количество
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.count' min='1' max='20')
        .field.is-horizontal
          .field-label.is-small
            label.label Ширина кольца
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.ringWidth' min='0.5' max='10' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label Начальный радиус
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.startRadius' min='5' max='100')
              p.control
                a.button.is-static.is-small {{ unit }}

      .column
        .field.is-horizontal
          .field-label.is-small
            label.label Расстояние
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.spacing' min='0.5' max='20' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label Высота
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.rings.depth' min='0.5' max='5' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-body
            .field
              .control
                input.gen-color-input(type='color' :value='options.rings.color || "#000000"' @input='options.rings.color = $event.target.value')

//- ─── Текст ─────────────────────────────────────────────
.coaster-section.coaster-section--text
  .field.is-horizontal.form-bg-diff.form-bg--text
    .field-label.is-small
      label.label Текст
    .field-body
      .field
        .control
          label.checkbox
            input(type="checkbox" v-model="options.text.active")
            span.is-size-7
              i.fa.fa-font &nbsp;
              | Надпись на подставке

  .box.form-bg-diff.form-bg--text(v-if="options.text.active")
    .field.is-horizontal
      .field-label.is-small
        label.label Режим
      .field-body
        .field
          .control
            .buttons.has-addons
              button.button.is-small(:class="{ 'is-primary': options.text.mode === 'straight' }" @click="options.text.mode = 'straight'")
                span.icon.is-small
                  i.fa.fa-align-center
                span Прямой
              button.button.is-small(:class="{ 'is-primary': options.text.mode === 'circular' }" @click="options.text.mode = 'circular'")
                span.icon.is-small
                  i.fa.fa-redo
                span По кругу

    .field.is-horizontal
      .field-body
        .field
          .control
            textarea.textarea.is-small(rows='2' v-model='options.text.message' placeholder='Введите текст')

    .columns.is-multiline
      .column
        .field.is-horizontal
          .field-label.is-small
            label.label Размер
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.text.size' min='1' max='30' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}
        .field.is-horizontal
          .field-label.is-small
            label.label Глубина
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='options.text.depth' min='0.5' max='5' step='0.5')
              p.control
                a.button.is-static.is-small {{ unit }}

      .column
        .field.is-horizontal(v-if="options.text.mode === 'circular'")
          .field-label.is-small
            label.label Радиус текста
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
                input.gen-color-input(type='color' :value='options.text.color || "#000000"' @input='options.text.color = $event.target.value')

//- ─── Иконка ────────────────────────────────────────────
.coaster-section.coaster-section--icon
  Icon(:options='options' :unit='unit')

//- ─── Брелок ────────────────────────────────────────────
.coaster-section.coaster-section--keychain
  Keychain(:options='options' :unit='unit')
</template>
