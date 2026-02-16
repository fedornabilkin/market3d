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
.field.is-horizontal.form-bg-diff
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

.box.form-bg-diff(v-if="props.options.code.active")
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

.box.form-bg-diff(v-if="props.options.code.active")
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

      // Error Correction
      .field.is-horizontal
        .field-label.is-small
          label.label {{$t('form.qr.correction.title')}}
        .field-body
          .field
            .control
              .select.is-small
                select(v-model='props.options.code.errorCorrectionLevel')
                  option(value='L') {{$t('form.qr.correction.l')}}
                  option(value='M') {{$t('form.qr.correction.m')}}
                  option(value='Q') {{$t('form.qr.correction.q')}}
                  option(value='H') {{$t('form.qr.correction.h')}}
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
          .field.has-addons
            .control
              .select.is-small
                select(v-model='props.options.code.block.shape')
                  option(value='classic') {{$t('form.qr.blockShape.classic')}}
                  option(value='rotation') {{$t('form.qr.blockShape.rhombus')}}
                  option(value='round') {{$t('form.qr.blockShape.round')}}

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
.form-bg-diff {background: aliceblue;}
</style>
