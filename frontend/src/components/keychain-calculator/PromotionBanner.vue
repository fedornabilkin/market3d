<script setup lang="ts">
import { computed } from 'vue';
import type { KeychainPromotion } from '@/features/keychain-calculator/types';

const props = defineProps<{
  promotion: KeychainPromotion;
  now: number;
  compact?: boolean;
}>();

const remaining = computed(() => {
  const seconds = Math.max(0, Math.floor((Date.parse(props.promotion.endsAt) - props.now) / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds % 86400 / 3600),
    minutes: Math.floor(seconds % 3600 / 60),
    seconds: seconds % 60,
  };
});
</script>

<template lang="pug">
.promotion-banner(:class="{ 'promotion-banner--compact': compact }" role="status")
  .promotion-banner__content
    .promotion-banner__eyebrow {{ $t('keychainCalculator.promotionEyebrow') }}
    h2.promotion-banner__title {{ $t(promotion.titleKey) }}
    p.promotion-banner__description(v-if="promotion.descriptionKey") {{ $t(promotion.descriptionKey) }}
  .promotion-banner__timer(:aria-label="$t('keychainCalculator.countdownLabel')")
    .promotion-banner__time
      strong {{ remaining.days }}
      span {{ $t('keychainCalculator.time.days') }}
    .promotion-banner__time
      strong {{ String(remaining.hours).padStart(2, '0') }}
      span {{ $t('keychainCalculator.time.hours') }}
    .promotion-banner__time
      strong {{ String(remaining.minutes).padStart(2, '0') }}
      span {{ $t('keychainCalculator.time.minutes') }}
    .promotion-banner__time
      strong {{ String(remaining.seconds).padStart(2, '0') }}
      span {{ $t('keychainCalculator.time.seconds') }}
</template>

<style scoped>
.promotion-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(0, 165, 164, 0.3);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(0, 165, 164, 0.14), rgba(64, 158, 255, 0.09));
}

.promotion-banner__eyebrow {
  margin-bottom: 0.25rem;
  color: #008a89;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.promotion-banner__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
}

.promotion-banner__description {
  margin: 0.35rem 0 0;
  color: var(--el-text-color-regular);
}

.promotion-banner__timer {
  display: grid;
  grid-template-columns: repeat(4, minmax(58px, 1fr));
  gap: 0.5rem;
  flex-shrink: 0;
}

.promotion-banner__time {
  min-width: 58px;
  padding: 0.55rem 0.45rem;
  border-radius: 12px;
  background: var(--el-bg-color);
  text-align: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}

.promotion-banner__time strong,
.promotion-banner__time span {
  display: block;
}

.promotion-banner__time strong {
  font-size: 1.15rem;
}

.promotion-banner__time span {
  color: var(--el-text-color-secondary);
  font-size: 0.7rem;
}

.promotion-banner--compact {
  display: block;
  padding: 0.9rem;
  border-radius: 14px;
}

.promotion-banner--compact .promotion-banner__eyebrow {
  font-size: 0.66rem;
}

.promotion-banner--compact .promotion-banner__title {
  font-size: 1.05rem;
  line-height: 1.2;
}

.promotion-banner--compact .promotion-banner__description {
  margin-top: 0.25rem;
  font-size: 0.82rem;
  line-height: 1.35;
}

.promotion-banner--compact .promotion-banner__timer {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  margin-top: 0.75rem;
}

.promotion-banner--compact .promotion-banner__time {
  min-width: 0;
  padding: 0.35rem 0.2rem;
  border-radius: 8px;
}

.promotion-banner--compact .promotion-banner__time strong {
  font-size: 0.95rem;
}

.promotion-banner--compact .promotion-banner__time span {
  font-size: 0.6rem;
}

@media (max-width: 700px) {
  .promotion-banner {
    align-items: stretch;
    flex-direction: column;
  }

  .promotion-banner__timer {
    width: 100%;
  }
}
</style>
