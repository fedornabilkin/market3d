<template lang="pug">
.gen-donate-card
  .gen-donate-inner
    .gen-donate-text
      | Скинь на кофе разработчику
      br
      PaymentMethodsButton
    .gen-donate-sponsors.is-hidden-mobile
      SponsorList
</template>

<script>
import PaymentMethodsButton from "@/components/monetisation/PaymentMethodsButton.vue";
import SponsorList from "@/components/monetisation/SponsorList.vue";

export default {
  name: 'DonateCard',
  components: {
    PaymentMethodsButton,
    SponsorList,
  },
}
</script>

<style scoped>
.gen-donate-card {
  margin-bottom: 1rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%);
  border: 1px solid #f0d98c;
  overflow: hidden;
}

.gen-donate-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  gap: 1rem;
}

.gen-donate-text {
  font-size: 0.9rem;
  line-height: 1.6;
}
</style>
