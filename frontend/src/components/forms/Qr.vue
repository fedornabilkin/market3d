<script setup>
import QRCodeTabs from "@/components/forms/QRCodeTabs.vue";
import Wifi from "@/components/forms/Wifi.vue";
import Email from "@/components/forms/Email.vue";
import Contact from "@/components/forms/Contact.vue";
import SMS from "@/components/forms/SMS.vue";

const props = defineProps(['options', 'unit'])

const activeChange = () => {
  props.options.code.eventActive()
}

const setActiveTab = (idx) => {
  props.options.activeTabIndex = idx
}
</script>

<template lang="pug">
.field.is-horizontal.form-bg-diff.form-bg--qr
  .field-label.is-small
    label.label {{ $t('form.qr.active') }}

  .field-body
    .field
      .control
        label.checkbox
          input(type="checkbox" v-model="props.options.code.active" @change="activeChange")
          span.is-size-7
            i.fa.fa-qrcode &nbsp;
            | {{ $t('form.qr.activeLabel') }}

.box.form-bg-diff.form-bg--qr(v-if="props.options.code.active")
  QRCodeTabs(:active-tab-index='options.activeTabIndex' @change='setActiveTab')
  // Text
  .option-pane(v-if='options.activeTabIndex === 0')
    textarea.textarea(:placeholder="$t('form.qr.placeholder')" v-model='options.content' rows="2" style='width: 100%')
  // Wifi
  .option-pane(v-if='options.activeTabIndex === 1')
    Wifi(:wifi='options.wifi')
  // E-Mail
  .option-pane(v-if='options.activeTabIndex === 2')
    Email(:email='options.email')
  // Contact
  .option-pane(v-if='options.activeTabIndex === 3')
    Contact(:contact='options.contact')
  // SMS
  .option-pane(v-if='options.activeTabIndex === 4')
    SMS(:sms='options.sms')

.box.form-bg-diff.form-bg--qr(v-if="props.options.code.active")
  .columns.is-multiline
    .column
      // Download
      //.field.is-horizontal
        .field-label.is-small
          label.label {{$t('invert')}}
        .field-body
          .field
            .control
              label.checkbox
                input(type='checkbox' v-model='props.options.code.invert')
                span.is-size-7
                  i.fa.fa-retweet
                  |  {{$t('invertText')}}
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.depth')}}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.code.depth')
            p.control
              a.button.is-static.is-small {{unit}}
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.margin')}}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.code.margin')
            p.control
              a.button.is-static.is-small {{unit}}
      .field.is-horizontal
        .field-body
          .field
            .control
              input.gen-color-input(type='color' :value='props.options.code.color || "#000000"' @input='props.options.code.color = $event.target.value')

      // Error Correction
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.qr.correction.title')}}
        .field-body
          .field
            .control
              .buttons.has-addons.mb-0.qr-pick-buttons
                button.button.is-small(
                  v-for="lvl in ['L','M','Q','H']"
                  :key="lvl"
                  type='button'
                  :class="{ 'is-link is-selected': props.options.code.errorCorrectionLevel === lvl }"
                  :title="$t(`form.qr.correction.${lvl.toLowerCase()}`)"
                  :aria-label="$t(`form.qr.correction.${lvl.toLowerCase()}`)"
                  @click="props.options.code.errorCorrectionLevel = lvl"
                ) {{ { L: '7%', M: '15%', Q: '25%', H: '30%' }[lvl] }}
              p.help {{$t('form.qr.correction.label')}}

      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.qr.emptyCenter')}}
        .field-body
          .field
            .control
              label.checkbox
                input(type='checkbox' v-model='props.options.code.emptyCenter')
                span.is-size-7
                  |  {{$t('form.qr.emptyCenterHelp')}}

    .column
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.qr.blockSize')}}
        .field-body
          .field.has-addons
            .control
              input.input.is-small(type='number' v-model.number='props.options.code.block.ratio')
            p.control
              a.button.is-static.is-small %
            span.help-icon.icon.has-text-info(:title="$t('form.qr.blockSizeLabel')")
              i.fas.fa-info-circle

      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.qr.blockShape.title')}}
        .field-body
          .field
            .control
              .buttons.has-addons.mb-0.qr-pick-buttons
                button.button.is-small(
                  type='button'
                  :class="{ 'is-link is-selected': props.options.code.block.shape === 'classic' }"
                  :title="$t('form.qr.blockShape.classic')"
                  :aria-label="$t('form.qr.blockShape.classic')"
                  @click="props.options.code.block.shape = 'classic'"
                )
                  span.icon.is-small
                    svg(viewBox='0 0 10 10' width='14' height='14' aria-hidden='true')
                      rect(x='1.5' y='1.5' width='7' height='7' fill='currentColor')
                button.button.is-small(
                  type='button'
                  :class="{ 'is-link is-selected': props.options.code.block.shape === 'rotation' }"
                  :title="$t('form.qr.blockShape.rhombus')"
                  :aria-label="$t('form.qr.blockShape.rhombus')"
                  @click="props.options.code.block.shape = 'rotation'"
                )
                  span.icon.is-small
                    svg(viewBox='0 0 10 10' width='14' height='14' aria-hidden='true')
                      polygon(points='5,1 9,5 5,9 1,5' fill='currentColor')
                button.button.is-small(
                  type='button'
                  :class="{ 'is-link is-selected': props.options.code.block.shape === 'round' }"
                  :title="$t('form.qr.blockShape.round')"
                  :aria-label="$t('form.qr.blockShape.round')"
                  @click="props.options.code.block.shape = 'round'"
                )
                  span.icon.is-small
                    svg(viewBox='0 0 10 10' width='14' height='14' aria-hidden='true')
                      circle(cx='5' cy='5' r='3.8' fill='currentColor')

      // Skyscraper Mode
      .field.is-horizontal(v-if='!props.options.code.invert')
        .field-label.is-small
          label.label {{$t('form.qr.cityMode')}}
        .field-body
          .field
            .control
              label.checkbox
                input(type='checkbox' v-model='props.options.code.block.cityMode')
                span.is-size-7
                  i.fa.fa-city
                  |  {{$t('form.qr.cityModeLabel')}}

      div(v-if='props.options.code.block.cityMode')
        .field.is-horizontal
          .field-label.is-small
            label.label {{$t('form.depth')}} {{$t('form.min')}}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='props.options.code.depth')
              p.control
                a.button.is-static.is-small {{unit}}
        .field.is-horizontal
          .field-label.is-small
            label.label {{$t('form.depth')}} {{$t('form.max')}}
          .field-body
            .field.has-addons
              .control
                input.input.is-small(type='number' v-model.number='props.options.code.block.depth')
              p.control
                a.button.is-static.is-small {{unit}}

  .mt-1(style="width: fit-content")
    figure.image.is-64x64(:class="{'is-skeleton': !props.options.code.preview.src}")
      img(:src="props.options.code.preview.src")

</template>

<style scoped>
.qr-pick-buttons .button {
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}
.qr-pick-buttons .button.is-selected {
  background-color: #2b6cb0;
  border-color: #1e4e8c;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.35), inset 0 -2px 0 rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
  z-index: 2;
}
.qr-pick-buttons .button:not(.is-selected):hover {
  background-color: #edf2f7;
  color: #1a202c;
}
</style>

