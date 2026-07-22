import rawConfig from '@/data/keychain-calculator.json';
import type {
  ActiveProductPricing,
  KeychainCalculatorConfig,
  KeychainPromotion,
  ResolvedCalculatorConfig,
} from './types';
import { validateKeychainCalculatorConfig } from './validation';

export async function loadKeychainCalculatorConfig(): Promise<KeychainCalculatorConfig> {
  return validateKeychainCalculatorConfig(rawConfig);
}

export function findActivePromotion(
  promotions: KeychainPromotion[],
  now: Date = new Date(),
): KeychainPromotion | null {
  const nowTime = now.getTime();
  return promotions
    .filter((promotion) => (
      promotion.state === 'active'
      && Date.parse(promotion.startsAt) <= nowTime
      && nowTime < Date.parse(promotion.endsAt)
    ))
    .sort((left, right) => (
      right.priority - left.priority
      || Date.parse(right.startsAt) - Date.parse(left.startsAt)
      || left.code.localeCompare(right.code)
    ))[0] ?? null;
}

export function resolveCalculatorConfig(
  config: KeychainCalculatorConfig,
  now: Date = new Date(),
): ResolvedCalculatorConfig {
  const activePromotion = findActivePromotion(config.promotions, now);
  const products: ActiveProductPricing[] = config.products
    .filter((product) => product.state === 'active')
    .map((product) => {
      const override = activePromotion?.productOverrides?.[product.slug];
      return {
        product,
        unitPriceKopecks: override?.priceKopecks ?? product.basePriceKopecks,
        discountTiers: override?.discountTiers ?? product.discountTiers,
        hasPromotionalPrice: override?.priceKopecks !== undefined
          && override.priceKopecks !== product.basePriceKopecks,
      };
    });

  return {
    source: config,
    activePromotion,
    discountMode: activePromotion?.discountMode ?? config.discountMode,
    priorityScope: activePromotion?.priorityScope ?? config.priorityScope,
    maxDiscountBps: activePromotion?.maxDiscountBps ?? config.maxDiscountBps,
    orderDiscountTiers: activePromotion?.orderDiscountTiers ?? config.orderDiscountTiers,
    products,
  };
}
