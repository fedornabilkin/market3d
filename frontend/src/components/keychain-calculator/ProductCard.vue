<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import DiscountProgress from './DiscountProgress.vue';
import KeychainPreview3D from './KeychainPreview3D.vue';
import phonePreviewConfig from '@/data/keychain-phone-preview.json';
import addressPreviewConfig from '@/data/keychain-address-preview.json';
import qrPreviewConfig from '@/data/keychain-qr-preview.json';
import windshieldPreviewConfig from '@/data/keychain-windshield-preview.json';
import callsignPreviewConfig from '@/data/keychain-callsign-preview.json';
import petPreviewConfig from '@/data/keychain-pet-preview.json';
import childPreviewConfig from '@/data/keychain-child-preview.json';
import { formatDiscount, formatMoney } from '@/features/keychain-calculator/money';
import type {
  ActiveProductPricing,
  CalculatedLine,
} from '@/features/keychain-calculator/types';

const props = defineProps<{
  pricing: ActiveProductPricing;
  quantity: number;
  line?: CalculatedLine;
  maxQuantity: number;
  currency: string;
}>();

const emit = defineEmits<{
  updateQuantity: [quantity: number];
}>();

const { locale, t } = useI18n();
const numberLocale = computed(() => locale.value === 'ru' ? 'ru-RU' : 'en-US');
const selected = computed(() => props.quantity > 0);
const currentPrice = computed(() => formatMoney(
  props.pricing.unitPriceKopecks,
  numberLocale.value,
  props.currency,
));
const basePrice = computed(() => formatMoney(
  props.pricing.product.basePriceKopecks,
  numberLocale.value,
  props.currency,
));
const lineTotal = computed(() => formatMoney(
  props.line?.totalKopecks ?? 0,
  numberLocale.value,
  props.currency,
));
const discountPoints = computed(() => props.pricing.discountTiers.map((tier) => ({
  threshold: tier.minQuantity,
  discountLabel: formatDiscount(tier.discountBps, numberLocale.value),
  thresholdLabel: t('keychainCalculator.quantityThreshold', { count: tier.minQuantity }),
})));
const appliedDiscountText = computed(() => (
  props.line && props.line.appliedDiscountBps > 0
    ? t('keychainCalculator.discountApplied', {
      discount: formatDiscount(props.line.appliedDiscountBps, numberLocale.value),
    })
    : ''
));
const nextDiscountText = computed(() => (
  props.line?.nextQuantityTier
    ? t('keychainCalculator.nextQuantityDiscount', {
      count: props.line.nextQuantityTier.missingQuantity,
      discount: formatDiscount(props.line.nextQuantityTier.discountBps, numberLocale.value),
    })
    : t('keychainCalculator.maxQuantityDiscount')
));

function changeQuantity(value: number | undefined): void {
  emit('updateQuantity', value ?? 0);
}
</script>

<template lang="pug">
article.product-card(:class="{ 'product-card--selected': selected }")
  .product-card__header
    .product-card__image
      KeychainPreview3D(
        v-if="pricing.product.slug === 'phone'"
        :config="phonePreviewConfig"
        :label="$t(pricing.product.nameKey)"
      )
      KeychainPreview3D(
        v-else-if="pricing.product.slug === 'address'"
        :config="addressPreviewConfig"
        :label="$t(pricing.product.nameKey)"
      )
      KeychainPreview3D(
        v-else-if="pricing.product.slug === 'qr'"
        :config="qrPreviewConfig"
        :label="$t(pricing.product.nameKey)"
      )
      KeychainPreview3D(
        v-else-if="pricing.product.slug === 'windshield'"
        :config="windshieldPreviewConfig"
        :label="$t(pricing.product.nameKey)"
      )
      KeychainPreview3D(
        v-else-if="pricing.product.slug === 'callsign'"
        :config="callsignPreviewConfig"
        :label="$t(pricing.product.nameKey)"
      )
      KeychainPreview3D(
        v-else-if="pricing.product.slug === 'pet'"
        :config="petPreviewConfig"
        :label="$t(pricing.product.nameKey)"
      )
      KeychainPreview3D(
        v-else-if="pricing.product.slug === 'child'"
        :config="childPreviewConfig"
        :label="$t(pricing.product.nameKey)"
      )
      img(
        v-else-if="pricing.product.image"
        :src="pricing.product.image"
        :alt="$t(pricing.product.nameKey)"
        loading="lazy"
      )
      .product-card__image-placeholder(v-else)
        i.fa.fa-image(aria-hidden="true")
        span {{ $t('keychainCalculator.imagePlaceholder') }}
    .product-card__heading
      h2.product-card__title {{ $t(pricing.product.nameKey) }}
      p.product-card__description(v-if="pricing.product.descriptionKey") {{ $t(pricing.product.descriptionKey) }}

  .product-card__order-row
    .product-card__price
      span.product-card__row-label {{ $t('keychainCalculator.perItem') }}
      span.product-card__current-price {{ currentPrice }}
      del.product-card__base-price(v-if="pricing.hasPromotionalPrice") {{ basePrice }}
    .product-card__controls
      label.product-card__row-label(:for="`quantity-${pricing.product.slug}`") {{ $t('keychainCalculator.quantity') }}
      el-input-number(
        :id="`quantity-${pricing.product.slug}`"
        :model-value="quantity"
        :min="0"
        :max="maxQuantity"
        :step="1"
        step-strictly
        controls-position="right"
        @change="changeQuantity"
      )
    .product-card__line-total
      span.product-card__row-label {{ $t('keychainCalculator.positionTotal') }}
      strong {{ lineTotal }}

  .product-card__calculation(v-if="selected && line")
    .product-card__discount(v-if="line.appliedDiscountBps > 0")
      i.fa.fa-tag(aria-hidden="true")
      span {{ appliedDiscountText }}
    .product-card__progress(:class="{ 'product-card__progress--complete': !line.nextQuantityTier }")
      .product-card__progress-note {{ nextDiscountText }}
      DiscountProgress(
        :current="quantity"
        :points="discountPoints"
      )
</template>

<style scoped>
.product-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 1.25rem;
  border: 1px solid var(--el-border-color);
  border-radius: 18px;
  background: var(--el-bg-color);
  box-shadow: 0 8px 28px rgba(31, 41, 55, 0.06);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 165, 164, 0.45);
  box-shadow: 0 12px 32px rgba(31, 41, 55, 0.1);
}

.product-card--selected {
  border-color: #00a5a4;
  box-shadow: 0 0 0 2px rgba(0, 165, 164, 0.14), 0 12px 32px rgba(31, 41, 55, 0.1);
}

.product-card__header {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  align-items: start;
  gap: 1rem;
}

.product-card__image {
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  place-items: center;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(0, 165, 164, 0.08), rgba(64, 158, 255, 0.08)),
    var(--el-fill-color-lighter);
}

.product-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-card__image-placeholder {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  color: #008a89;
}

.product-card__image-placeholder i {
  font-size: 1.8rem;
  opacity: 0.55;
}

.product-card__image-placeholder span {
  max-width: 90px;
  color: var(--el-text-color-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
}

.product-card__heading {
  min-width: 0;
}

.product-card__title {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
  font-weight: 800;
}

.product-card__description {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 0.9rem;
  line-height: 1.45;
}

.product-card__order-row {
  display: grid;
  grid-template-columns: minmax(105px, 1fr) 122px minmax(105px, 1fr);
  align-items: end;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--el-border-color-lighter);
}

.product-card__price,
.product-card__controls,
.product-card__line-total {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.product-card__current-price {
  font-size: 1.1rem;
  font-weight: 800;
}

.product-card__base-price {
  color: var(--el-text-color-secondary);
  font-size: 0.72rem;
}

.product-card__row-label {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 0.72rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-card__controls :deep(.el-input-number) {
  width: 100%;
}

.product-card__line-total {
  text-align: right;
}

.product-card__line-total strong {
  font-size: 1.1rem;
  line-height: 32px;
}

.product-card__calculation {
  margin-top: 1rem;
}

.product-card__discount {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.65rem;
  color: var(--el-color-success);
  font-size: 0.85rem;
  font-weight: 700;
}

.product-card__progress {
  margin-top: 0.65rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.product-card__progress-note {
  margin-bottom: 0.45rem;
  color: var(--el-text-color-secondary);
  font-size: 0.76rem;
  line-height: 1.35;
}

.product-card__progress--complete .product-card__progress-note {
  color: var(--el-color-success);
}

@media (max-width: 480px) {
  .product-card__header {
    grid-template-columns: 176px minmax(0, 1fr);
    align-items: start;
    gap: 0.8rem;
  }

  .product-card__image-placeholder span {
    display: none;
  }

  .product-card__description {
    font-size: 0.82rem;
  }

  .product-card__order-row {
    grid-template-columns: minmax(80px, 1fr) 108px minmax(80px, 1fr);
    gap: 0.5rem;
  }

  .product-card__current-price,
  .product-card__line-total strong {
    font-size: 0.95rem;
  }
}
</style>
