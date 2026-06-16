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
            label.radio.mr-3(v-for="opt in securityOptions" :key="opt.value")
              input(type='radio' name='wifi-security' :value='opt.value' v-model='wifi.security')
              |  {{ opt.label }}
        .field
          .control
            label.checkbox
              input.is-small(type='checkbox' v-model='wifi.hidden')
              |  {{$t('form.qr.content.wifi.hiddenText')}}
</template>

<script>
export default {
  name: 'WifiForm',
  props: {
    wifi: Object,
  },
  data() {
    return {
      securityOptions: [
        { value: 'WPA', label: 'WPA' },
        { value: 'WEP', label: 'WEP' },
        { value: 'nopass', label: 'No password' },
      ],
    };
  },
};
</script>

<style>
</style>
