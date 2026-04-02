<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const paymentLogos = [
  { id: 'sbp', logoPath: '/monetisation/payment-logos/sbp.svg', nameKey: 'm.sbp' },
  { id: 'yoomoney', logoPath: '/monetisation/payment-logos/yoomoney.svg', nameKey: 'm.yoomoney' },
  { id: 'sberpay', logoPath: '/monetisation/payment-logos/sberpay.svg', nameKey: 'm.sberpay' },
  { id: 'card', logoPath: '/monetisation/payment-logos/card.svg', nameKey: 'm.card' },
  //{ id: 'other', logoPath: '/monetisation/payment-logos/other.svg', nameKey: 'm.otherMethods' },
];
</script>

<template lang="pug">
  .boxb.b
    router-link.payment-methods-button.button(to="/payment-methods")
      //span.payment-methods-button__label {{ $t('m.paymentMethods') }}
      .payment-methods-button__icons
        img(
          v-for="item in paymentLogos"
          :key="item.id"
          :src="item.logoPath"
          :alt="t(item.nameKey)"
          class="payment-methods-button__icon"
        )
</template>

<style scoped>
.payment-methods-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  text-decoration: none;
  color: inherit;
}

.payment-methods-button__label {
  margin-right: 0.25rem;
}

.payment-methods-button__icons {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.payment-methods-button__icon {
  height: 24px;
  width: auto;
  max-width: 56px;
  object-fit: contain;
  vertical-align: middle;
}
</style>
