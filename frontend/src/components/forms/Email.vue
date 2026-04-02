<template lang="pug">
  div
    .field.is-horizontal
      .field-label.is-small
        label.label {{$t('form.qr.content.email.recipient')}}
      .field-body
        .field
          .control
            input.input.is-small(type='text' :placeholder="$t('form.qr.content.email.recipientPlaceholder')" v-model='email.recipient')
    .field.is-horizontal
      .field-label.is-small
        label.label {{$t('form.qr.content.email.subject')}}
      .field-body
        .field
          .control
            input.input.is-small(type='text' :placeholder="$t('form.qr.content.email.subjectPlaceholder')" v-model='email.subject')
    .field.is-horizontal
      .field-label.is-small
        label.label {{$t('form.qr.content.email.body')}}
      .field-body
        .field
          .control
            textarea.textarea.is-small(:placeholder="$t('form.qr.content.email.bodyPlaceholder')" v-model='email.body' style='width: 100%')

</template>

<script>
export default {
  name: 'EmailForm',
  props: {
    email: Object,
  },
};
</script>

<style>
</style>
