<template lang="pug">
  div
    .field.is-horizontal
      .field-label.is-small
        label.label {{$t('form.qr.content.sms.phone')}}
      .field-body
        .field
          .control
            input.input.is-small(type='text' :placeholder="$t('form.qr.content.sms.phonePlaceholder')" v-model='sms.recipient')
    .field.is-horizontal
      .field-label.is-small
        label.label {{$t('form.qr.content.sms.message')}}
      .field-body
        .field
          .control
            textarea.textarea.is-small(:placeholder="$t('form.qr.content.sms.messagePlaceholder')" v-model='sms.message' rows="2" style='width: 100%')

</template>

<script>
export default {
  name: 'SMSForm',
  props: {
    sms: Object,
  },
};
</script>

<style>
</style>
