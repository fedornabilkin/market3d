<template lang="pug">
div
  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.qr.content.contact.yourName')}}:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.firstname')" v-model='contact.firstName')
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.lastname')" v-model='contact.lastName')
  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.qr.content.contact.organization')}}:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.organizationPlaceHolder')" v-model='contact.organization')
  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.qr.content.contact.role')}}:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.rolePlaceHolder')" v-model='contact.role')

  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.qr.content.contact.numbers')}}:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.cellphone')" v-model='contact.cell')
  .field.is-horizontal
    .field-label.is-small
      label.label(for='')
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.phone')" v-model='contact.phone')
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.faxPlaceHolder')" v-model='contact.fax')
  .field.is-horizontal
    .field-label.is-small
      label.label E-Mail:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' placeholder='email@email.ru' v-model='contact.email')

  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.qr.content.contact.street')}}:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.streetPlaceHolder')" v-model='contact.street')
  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.qr.content.contact.city')}}:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.postcodePlaceHolder')" v-model='contact.postcode')
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.cityPlaceHolder')" v-model='contact.city')
  .field.is-horizontal
    .field-label.is-small
      label.label {{$t('form.qr.content.contact.state')}}:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.statePlaceHolder')" v-model='contact.state')
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.countryPlaceHolder')" v-model='contact.country')
  .field.is-horizontal
    .field-label.is-small
      label.label Website:
    .field-body
      .field
        p.control
          input.input.is-small(type='text' :placeholder="$t('form.qr.content.contact.sitePlaceHolder')" v-model='contact.website')

</template>

<script>
export default {
  name: 'ContactForm',
  props: {
    contact: Object,
  },
};
</script>

<style>
</style>
