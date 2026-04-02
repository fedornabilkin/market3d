<script setup>
import ShareButtons from './ShareButtons.vue';
import Yoomoney from "@/components/monetisation/Yoomoney.vue";
import LanguageSelector from "@/components/template/LanguageSelector.vue";
import PaymentMethodsButton from "@/components/monetisation/PaymentMethodsButton.vue";
</script>

<template lang="pug">
footer.footer
  .container
    .columns.is-vcentered.is-multiline
      .column.is-narrow
        PaymentMethodsButton
      .column.is-narrow
        a.button.is-info(href="/examples") {{ $t('t.exampleButton') }}
      .column.is-narrow
        ShareButtons
      .column.is-narrow
        LanguageSelector

    .footer-bottom
      .footer-left
        a.button.is-light(href="https://t.me/+dSgck2GM29syZTQ6" target="_blank")
          i.fab.fa-telegram
          | &nbsp;{{ $t('t.discussionButton') }}
      .footer-right
        a(href="/") vsqr.ru
        | &nbsp;&copy; {{ (new Date()).getFullYear() }}
</template>

<style scoped>
footer.footer {
  padding: 1.5rem 1.5rem 1rem;
}
.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}
.footer-right {
  font-size: 0.9rem;
}
</style>
