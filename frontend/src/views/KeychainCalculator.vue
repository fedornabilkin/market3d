<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import CalculatorSummary from '@/components/keychain-calculator/CalculatorSummary.vue';
import ProductCard from '@/components/keychain-calculator/ProductCard.vue';
import PromotionBanner from '@/components/keychain-calculator/PromotionBanner.vue';
import { useKeychainCalculator } from '@/composables/useKeychainCalculator';
import { useSeoHeadI18n } from '@/composables/useSeoHead';
import { buildCalculatorSummary } from '@/features/keychain-calculator/summary';

const { t, locale } = useI18n();
const calculator = useKeychainCalculator();
const canonicalUrl = typeof window === 'undefined'
  ? 'https://vsqr.ru/calculator/keychains'
  : `${window.location.origin}/calculator/keychains`;

useSeoHeadI18n('seo.keychainCalculator', { url: canonicalUrl });

const linesBySlug = computed(() => new Map(
  calculator.result.value?.lines.map((line) => [line.productSlug, line]) ?? [],
));

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard is unavailable');
}

function currentSummary(): string {
  if (!calculator.result.value || !calculator.resolvedConfig.value || !calculator.config.value) return '';
  return buildCalculatorSummary(calculator.result.value, calculator.resolvedConfig.value, {
    locale: locale.value === 'ru' ? 'ru-RU' : 'en-US',
    currency: calculator.config.value.currency,
    title: t('keychainCalculator.summaryShareTitle'),
    productName: (key) => t(key),
    labels: {
      subtotal: t('keychainCalculator.subtotal'),
      discount: t('keychainCalculator.discount'),
      total: t('keychainCalculator.total'),
      link: t('keychainCalculator.linkLabel'),
      preliminary: t('keychainCalculator.preliminaryNotice'),
    },
    url: calculator.shareUrl.value,
  });
}

async function copySummary(): Promise<void> {
  try {
    await copyText(currentSummary());
    ElMessage.success(t('keychainCalculator.calculationCopied'));
  } catch {
    ElMessage.error(t('keychainCalculator.copyError'));
  }
}

async function copyLink(): Promise<void> {
  try {
    await copyText(calculator.shareUrl.value);
    ElMessage.success(t('keychainCalculator.linkCopied'));
  } catch {
    ElMessage.error(t('keychainCalculator.copyError'));
  }
}

async function checkout(): Promise<void> {
  const checkoutConfig = calculator.config.value?.checkout;
  if (!checkoutConfig) return;
  if (checkoutConfig.copySummaryBeforeOpen) {
    try {
      await copyText(currentSummary());
      ElMessage.success(t('keychainCalculator.calculationCopiedBeforeRequest'));
    } catch {
      ElMessage.warning(t('keychainCalculator.copyBeforeRequestError'));
    }
  }
  const opened = window.open(checkoutConfig.url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
}
</script>

<template lang="pug">
main.keychain-calculator
  .container
    el-skeleton(v-if="calculator.loading.value" :rows="8" animated)

    el-result(
      v-else-if="calculator.error.value"
      icon="error"
      :title="$t('keychainCalculator.unavailableTitle')"
      :sub-title="$t('keychainCalculator.unavailableDescription')"
    )

    template(v-else-if="calculator.config.value && calculator.resolvedConfig.value && calculator.result.value")
      .keychain-calculator__layout
        section.keychain-calculator__catalog(aria-labelledby="keychain-products-title")
          .keychain-calculator__section-heading
            div
              h2#keychain-products-title.title.is-4 {{ $t('keychainCalculator.productsTitle') }}
              p {{ $t('keychainCalculator.productsDescription') }}
            el-tag(type="info" effect="plain")
              | {{ $t('keychainCalculator.selectedCount', { count: calculator.result.value.lines.length }) }}

          .keychain-calculator__grid
            ProductCard(
              v-for="pricing in calculator.resolvedConfig.value.products"
              :key="pricing.product.slug"
              :pricing="pricing"
              :quantity="calculator.quantities.value[pricing.product.slug] || 0"
              :line="linesBySlug.get(pricing.product.slug)"
              :max-quantity="calculator.config.value.maxQuantityPerProduct"
              :currency="calculator.config.value.currency"
              @update-quantity="calculator.setQuantity(pricing.product.slug, $event)"
            )

        aside.keychain-calculator__sidebar
          PromotionBanner(
            v-if="calculator.resolvedConfig.value.activePromotion"
            :promotion="calculator.resolvedConfig.value.activePromotion"
            :now="calculator.now.value"
            compact
          )
          CalculatorSummary(
            :result="calculator.result.value"
            :currency="calculator.config.value.currency"
            :discount-tiers="calculator.resolvedConfig.value.orderDiscountTiers"
            @reset="calculator.reset"
            @copy-summary="copySummary"
            @copy-link="copyLink"
            @checkout="checkout"
          )
</template>

<style scoped>
.keychain-calculator {
  padding: 1rem 0 3rem;
}

.keychain-calculator__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  align-items: start;
  gap: 1.5rem;
  margin-top: 1rem;
}

.keychain-calculator__sidebar {
  display: grid;
  gap: 0.75rem;
  position: sticky;
  top: 1rem;
  align-self: start;
}

.keychain-calculator__sidebar :deep(.calculator-summary) {
  position: static;
}

.keychain-calculator__section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.keychain-calculator__section-heading .title {
  margin-bottom: 0.35rem;
}

.keychain-calculator__section-heading p {
  margin: 0;
  color: var(--el-text-color-regular);
}

.keychain-calculator__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 1199px) {
  .keychain-calculator__layout {
    grid-template-columns: 1fr;
  }

  .keychain-calculator__sidebar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    position: static;
  }
}

@media (max-width: 700px) {
  .keychain-calculator {
    padding-top: 0;
  }

  .keychain-calculator__grid {
    grid-template-columns: 1fr;
  }

  .keychain-calculator__sidebar {
    grid-template-columns: 1fr;
  }

  .keychain-calculator__section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
