<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import DiscountProgress from './DiscountProgress.vue';
import { formatDiscount, formatMoney } from '@/features/keychain-calculator/money';
import type { CalculatorResult, OrderDiscountTier } from '@/features/keychain-calculator/types';

const props = defineProps<{
  result: CalculatorResult;
  currency: string;
  discountTiers: OrderDiscountTier[];
}>();

defineEmits<{
  reset: [];
  copySummary: [];
  copyLink: [];
  checkout: [];
}>();

const { locale, t } = useI18n();
const numberLocale = computed(() => locale.value === 'ru' ? 'ru-RU' : 'en-US');
const money = (value: number) => formatMoney(value, numberLocale.value, props.currency);
const nextOrderDiscountText = computed(() => (
  props.result.nextOrderTier
    ? t('keychainCalculator.nextOrderDiscount', {
      amount: money(props.result.nextOrderTier.missingSubtotalKopecks),
      discount: formatDiscount(props.result.nextOrderTier.discountBps, numberLocale.value),
    })
    : t('keychainCalculator.maxOrderDiscount')
));
const discountPoints = computed(() => props.discountTiers.map((tier) => ({
  threshold: tier.minSubtotalKopecks,
  discountLabel: formatDiscount(tier.discountBps, numberLocale.value),
  thresholdLabel: money(tier.minSubtotalKopecks),
})));
</script>

<template lang="pug">
aside.calculator-summary
  .calculator-summary__eyebrow {{ $t('keychainCalculator.summaryTitle') }}
  h2.calculator-summary__title {{ money(result.totalKopecks) }}
  p.calculator-summary__caption {{ $t('keychainCalculator.preliminaryNotice') }}

  .calculator-summary__rows
    .calculator-summary__row
      span {{ $t('keychainCalculator.totalQuantity') }}
      strong {{ result.totalQuantity }}
    .calculator-summary__row
      span {{ $t('keychainCalculator.subtotal') }}
      strong {{ money(result.subtotalKopecks) }}
    .calculator-summary__row.calculator-summary__row--discount
      span {{ $t('keychainCalculator.discount') }}
      strong −{{ money(result.discountKopecks) }}
    .calculator-summary__row.calculator-summary__row--total
      span {{ $t('keychainCalculator.total') }}
      strong {{ money(result.totalKopecks) }}

  .calculator-summary__progress(v-if="result.totalQuantity > 0")
    .calculator-summary__progress-note(
      :class="{ 'calculator-summary__progress-note--complete': !result.nextOrderTier }"
    ) {{ nextOrderDiscountText }}
    DiscountProgress(
      :current="result.subtotalKopecks"
      :points="discountPoints"
    )

  .calculator-summary__actions
    el-button(type="primary" size="large" :disabled="result.totalQuantity === 0" @click="$emit('checkout')")
      i.fab.fa-telegram.mr-2(aria-hidden="true")
      | {{ $t('keychainCalculator.leaveRequest') }}
    .calculator-summary__secondary
      el-button(:disabled="result.totalQuantity === 0" @click="$emit('copySummary')") {{ $t('keychainCalculator.copyCalculation') }}
      el-button(@click="$emit('copyLink')") {{ $t('keychainCalculator.copyLink') }}
    el-button(text :disabled="result.totalQuantity === 0" @click="$emit('reset')") {{ $t('keychainCalculator.reset') }}
</template>

<style scoped>
.calculator-summary {
  position: sticky;
  top: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--el-border-color);
  border-radius: 20px;
  background: var(--el-bg-color);
  box-shadow: 0 14px 40px rgba(31, 41, 55, 0.1);
}

.calculator-summary__eyebrow {
  color: #008a89;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.calculator-summary__title {
  margin: 0.3rem 0 0;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 900;
  line-height: 1;
}

.calculator-summary__caption {
  margin: 0.75rem 0 0;
  color: var(--el-text-color-secondary);
  font-size: 0.8rem;
  line-height: 1.4;
}

.calculator-summary__rows {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--el-border-color-lighter);
}

.calculator-summary__row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0;
}

.calculator-summary__row--discount {
  color: var(--el-color-success);
}

.calculator-summary__row--total {
  margin-top: 0.35rem;
  padding-top: 0.8rem;
  border-top: 1px dashed var(--el-border-color);
  font-size: 1.05rem;
}

.calculator-summary__progress {
  margin-top: 1rem;
  padding: 0.8rem;
  border-radius: 12px;
  background: rgba(64, 158, 255, 0.1);
}

.calculator-summary__progress-note {
  margin-bottom: 0.5rem;
  color: var(--el-text-color-secondary);
  font-size: 0.78rem;
  line-height: 1.4;
}

.calculator-summary__progress-note--complete {
  color: var(--el-color-success);
}

.calculator-summary__actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.calculator-summary__actions > :deep(.el-button) {
  width: 100%;
  margin-left: 0;
}

.calculator-summary__secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.calculator-summary__secondary :deep(.el-button) {
  min-width: 0;
  margin-left: 0;
}

@media (max-width: 1023px) {
  .calculator-summary {
    position: static;
  }
}

@media (max-width: 480px) {
  .calculator-summary__secondary {
    grid-template-columns: 1fr;
  }
}
</style>
