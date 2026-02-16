<script setup>

const props = defineProps(['options', 'unit'])

const activeChange = () => {
  props.options.icon.eventActive()
}

const change = () => {
  selected('none')
  props.options.icon.src = props.options.icon.srcCustom
}

const selected = (name) => {
  props.options.icon.name = name

  if (name !== 'none') {
    props.options.icon.clearSrcCustom()

    const promise = new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 1000)
    })

    promise.then(() => {
      const preview = document.querySelector('#' + props.options.icon.htmlId)
      props.options.icon.src = preview.contentDocument.querySelector('svg').outerHTML
    })
  }
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
.field.is-horizontal.form-bg-diff
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

.box.form-bg-diff(v-if="props.options.icon.active")
  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.icon.select')}}
    .field-body
      .field
        .control
          .dropdown.is-hoverable.mr-2
            .dropdown-trigger
              button.button.is-small(aria-haspopup='true' aria-controls='dropdown-menu2')
                span.icon.is-small
                  i.fa.fa-icons(aria-hidden='true')
                span {{props.options.icon.name}}
                span.icon.is-small
                  i.fas.fa-angle-down(aria-hidden='true')
            #dropdown-menu2.dropdown-menu(role='menu')
              #dropdown-content2.dropdown-content
                .columns.is-multiline
                  .column.is-12
                    .no-icon.icon-item.dropdown-item.is-vcentered(@click="selected('none')")
                      span.title.is-size-7 {{$t('form.icon.noIcon')}}
                  .column.is-4(v-for='icon in icons' :key='icon')
                    .icon-item.dropdown-item.is-vcentered(@click='selected(icon)')
                      img(width='18' height='18' :src="'/icons/' + icon + '.svg'" loading='lazy')

          object(
            v-if="!props.options.icon.isNoneName()"
            :id="props.options.icon.htmlId"
            type='image/svg+xml'
            width='32'
            height='32'
            :data="'/icons/' + props.options.icon.name + '.svg'"
          )

  .field
    .control
      label.label.is-small {{$t('form.icon.custom')}}
      textarea.textarea.is-small(
        v-model='props.options.icon.srcCustom'
        @keyup="change"
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
.form-bg-diff {background: lightyellow;}
</style>
