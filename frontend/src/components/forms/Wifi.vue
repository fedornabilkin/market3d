<template lang="pug">
  div
    .field.is-horizontal
      .field-label.is-small
        label.label SSID
      .field-body
        .field
          .control
            input.input.is-small(type='text' :placeholder="$t('form.qr.content.wifi.ssid')" v-model='wifi.ssid')
    .field.is-horizontal(v-if="wifi.security !== 'nopass'")
      .field-label.is-small
        label.label {{$t('form.qr.content.wifi.password')}}
      .field-body
        .field
          .control
            input.input.is-small(type='text' :placeholder="$t('form.qr.content.wifi.passwordPlaceholder')" v-model='wifi.password')
    .field.is-horizontal
      .field-label.is-small
        label.label {{$t('form.qr.content.wifi.security')}}
      .field-body
        .field
          .control
            .select.is-small
              select(v-model='wifi.security')
                option(value='WPA') WPA
                option(value='WEP') WEP
                option(value='nopass') No password
    .field.is-horizontal
      .field-label.is-small
        label.label {{$t('form.qr.content.wifi.hidden')}}?
      .field-body
        .field
          .control
            label.checkbox
              input.is-small(type='checkbox' v-model='wifi.hidden')
              | {{$t('form.qr.content.wifi.hiddenText')}}
</template>

<script>
export default {
  name: 'WifiForm',
  props: {
    wifi: Object,
  },
};
</script>

<style>
</style>
