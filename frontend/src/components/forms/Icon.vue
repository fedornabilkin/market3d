<script setup>

const props = defineProps(['options', 'unit'])

const activeChange = () => {
  props.options.icon.eventActive()
}

const onCustomSvgInput = () => {
  // Custom SVG has priority — just set src directly
  if (props.options.icon.srcCustom && props.options.icon.srcCustom.trim()) {
    props.options.icon.src = props.options.icon.srcCustom
  }
}

const selected = (name) => {
  props.options.icon.name = name
  props.options.icon.srcCustom = undefined

  const promise = new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, 1000)
  })

  promise.then(() => {
    // Don't override if custom SVG was entered in the meantime
    if (props.options.icon.srcCustom && props.options.icon.srcCustom.trim()) return
    const preview = document.querySelector('#' + props.options.icon.htmlId)
    if (preview && preview.contentDocument) {
      const svg = preview.contentDocument.querySelector('svg')
      if (svg) props.options.icon.src = svg.outerHTML
    }
  })
}

if (!props.options.icon.isNoneName()) {
  selected(props.options.icon.name)
}

const icons = [
  'wifi',
  'telegram',
  'user',
  'user-plus',
  'key',
  'mouse-pointer',
  'globe',
  'bookmark',
  'bubble',
  'marker',
  'map',
  'envelope',
  'facebook',
  'linkedin',
  'twitter',
  'paypal',
  'share',
  'share-alt',
  'calendar',
  'phone',
  'music',
  'play',
  'exclamation',
  'info',
  'home',
  'heart',
  'check',
  'lightbulb',
  'star',
  'thumbs-up',
  'thumbs-down',
  'bolt',
  'moon',
]
</script>

<template lang="pug">
.field.is-horizontal.form-bg-diff.form-bg--icon
  .field-label.is-small
    label.label {{$t('form.icon.active')}}

  .field-body
    .field
      .control
        label.checkbox
          input(type="checkbox" v-model="props.options.icon.active" @change="activeChange")
          span.is-size-7
            i.fa.fa-icons &nbsp;
            | {{$t('form.icon.activeLabel')}}

.box.form-bg-diff.form-bg--icon(v-if="props.options.icon.active")
  .icon-grid
    .icon-grid-item(
      v-for='icon in icons'
      :key='icon'
      :class="{ 'is-selected': props.options.icon.name === icon }"
      @click='selected(icon)'
      :title='icon'
    )
      img(:src="'/icons/' + icon + '.svg'" loading='lazy')

  object.icon-svg-loader(
    v-if="!props.options.icon.isNoneName()"
    :id="props.options.icon.htmlId"
    type='image/svg+xml'
    :data="'/icons/' + props.options.icon.name + '.svg'"
  )

  .field
    .control
      label.label.is-small {{$t('form.icon.custom')}}
      textarea.textarea.is-small(
        v-model='props.options.icon.srcCustom'
        @keyup="onCustomSvgInput"
        rows='3'
        placeholder="svg"
      )

  .columns
    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.size')}}
        .field-body
          .field.has-addons
            .control
              a.button.is-static.is-small %
            .control
              input.input.is-small(type='number' v-model.number='props.options.icon.ratio')
            .control(:title="$t('form.icon.sizeLabel')")
              .button.is-static.is-small
                span.has-text-info
                  i.fas.fa-info-circle

      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.icon.inverted')}}
        .field-body
          .field
            .control
              input(type="checkbox" v-model.number='props.options.icon.inverted')
      .field.is-horizontal
        .field-body
          .field
            .control
              input.gen-color-input(type='color' :value='props.options.icon.color || "#000000"' @input='props.options.icon.color = $event.target.value')

    .column
      .field.is-horizontal
        .field-body
          .field.has-addons
            p.control(:title="$t('form.icon.offsetX')")
              .button.is-static.is-small
                span
                  i.fa.fa-arrow-right
            .control
              input.input.is-small(type='number' v-model.number='props.options.icon.offsetX')
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
              input.input.is-small(type='number' v-model.number='props.options.icon.offsetY')
            p.control
              a.button.is-static.is-small {{unit}}

  .tag.is-light
    | {{$t('form.icon.title')}} Fontawesome&nbsp;
    a(href='https://fontawesome.com/license/free' target='_blank') CC BY 4.0
  p.is-size-7.has-text-warning(v-if="props.options.code.active") {{$t('form.errorCorrection')}}
</template>

<style scoped>
.icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 0.75rem;
}

.icon-grid-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #dbdbdb;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-grid-item img {
  width: 20px;
  height: 20px;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.icon-grid-item:hover {
  border-color: #3273dc;
  background: #f0f4ff;
}

.icon-grid-item:hover img {
  opacity: 1;
}

.icon-grid-item.is-selected {
  border-color: #3273dc;
  background: #3273dc;
}

.icon-grid-item.is-selected img {
  opacity: 1;
  filter: brightness(0) invert(1);
}

.icon-svg-loader {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
</style>
