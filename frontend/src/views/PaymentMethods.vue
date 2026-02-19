<template lang="pug">
.container
  Breadcrumbs
  .payment-methods-page
    h2.payment-methods-page__title {{ $t('m.paymentMethodsPageTitle') }}
    el-row(:gutter="20")
      el-col(v-for="item in paymentMethods" :key="item.id" :xs="24" :sm="12" :md="12" :lg="6")
        a.no-decoration(:href="item.url" target="_blank")
          el-card.payment-methods-tile(shadow="hover")
            .payment-methods-tile__logo
              img(:src="item.logoPath" :alt="$t(item.nameKey)" loading="lazy")
            h3.payment-methods-tile__name {{ $t(item.nameKey) }}
            p.payment-methods-tile__description {{ $t(item.descriptionKey) }}
            .mt-2
              span.logo-method.mr-1(v-for="tag in item.logoMethods" )
                img(:src="tag" :alt="$t(item.nameKey)" loading="lazy")
    
    .sponsors-section(v-if="sponsorsStore.hasSponsors || sponsorsStore.loading")
      h2.sponsors-section__title {{ $t('m.sponsorList') }}
      .sponsors-loading(v-if="sponsorsStore.loading")
        el-skeleton(:rows="1" animated)
      .sponsors-list(v-else-if="sponsorsStore.hasSponsors")
        el-tag.sponsor-tag(
          v-for="sponsor in sponsorsStore.list"
          :key="sponsor.id"
          type="info"
          size="large"
        )
          | {{ sponsor.name }}
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import Breadcrumbs from '../components/registry/Breadcrumbs.vue';
import { useSponsorsStore } from '../store/sponsors';

const sponsorsStore = useSponsorsStore();

onMounted(() => {
  sponsorsStore.fetchSponsors();
});

const paymentMethods = computed(() => [
  // {
  //   id: 'sbp',
  //   url: '',
  //   nameKey: 'm.sbp',
  //   descriptionKey: 'm.sbpDescription',
  //   logoPath: '/monetisation/payment-logos/sbp.svg',
  // },
  {
    id: 'yookassa',
    url: 'https://yookassa.ru/my/i/aXfBfUfSRQlk/l',
    nameKey: 'm.yookassa',
    descriptionKey: 'm.yookassaDescription',
    logoPath: '/monetisation/payment-logos/yookassa.svg',
    logoMethods: [
      '/monetisation/payment-logos/sbp.svg',
      '/monetisation/payment-logos/yoomoney.svg',
      '/monetisation/payment-logos/sberpay.svg',
      '/monetisation/payment-logos/card.svg',
    ],
  },
  {
    id: 'yoomoney',
    url: 'https://yoomoney.ru/fundraise/1ET4AORVPH6.251226',
    nameKey: 'm.yoomoney',
    descriptionKey: 'm.yoomoneyDescription',
    logoPath: '/monetisation/payment-logos/yoomoney.svg',
    logoMethods: [
      '/monetisation/payment-logos/yoomoney.svg',
      '/monetisation/payment-logos/sberpay.svg',
      '/monetisation/payment-logos/card.svg',
    ],
  },
  // {
  //   id: 'sberpay',
  //   url: '',
  //   nameKey: 'm.sberpay',
  //   descriptionKey: 'm.sberpayDescription',
  //   logoPath: '/monetisation/payment-logos/sberpay.svg',
  // },
  // {
  //   id: 'other',
  //   url: '',
  //   nameKey: 'm.otherMethods',
  //   descriptionKey: 'm.otherMethodsDescription',
  //   logoPath: '/monetisation/payment-logos/other.svg',
  // },
]);
</script>

<style scoped>
.payment-methods-page {
  margin-top: 1rem;
}

.payment-methods-page__title {
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.payment-methods-tile {
  height: 100%;
  margin-bottom: 20px;
}

.payment-methods-tile__logo {
  margin-bottom: 1rem;
  min-height: 48px;
  display: flex;
  align-items: center;
}

.payment-methods-tile__logo img {
  max-height: 48px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

.payment-methods-tile__name {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.payment-methods-tile__description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.sponsors-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--el-border-color-light);
}

.sponsors-section__title {
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.sponsors-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.sponsor-tag {
  margin: 0;
}
</style>
