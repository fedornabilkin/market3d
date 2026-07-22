import { describe, expect, it } from 'vitest';
import rawConfig from '@/data/keychain-calculator.json';
import { findActivePromotion, resolveCalculatorConfig } from './config';
import { CalculatorConfigError, validateKeychainCalculatorConfig } from './validation';

describe('keychain calculator config', () => {
  it('validates the bundled config', () => {
    const config = validateKeychainCalculatorConfig(rawConfig);

    expect(config.version).toBe(1);
    expect(config.products).toHaveLength(8);
    expect(config.products[0].slug).toBe('phone');
  });

  it('selects the highest-priority active promotion deterministically', () => {
    const config = validateKeychainCalculatorConfig(rawConfig);
    const promotions = [
      ...config.promotions,
      {
        ...config.promotions[0],
        code: 'lower-priority',
        priority: 10,
      },
    ];

    expect(findActivePromotion(promotions, new Date('2026-07-16T12:00:00+03:00'))?.code)
      .toBe('summer-2026');
    expect(findActivePromotion(promotions, new Date('2026-10-01T12:00:00+03:00')))
      .toBeNull();
  });

  it('applies promotion overrides without mutating the base product', () => {
    const config = validateKeychainCalculatorConfig(rawConfig);
    const resolved = resolveCalculatorConfig(config, new Date('2026-07-16T12:00:00+03:00'));
    const phone = resolved.products.find(({ product }) => product.slug === 'phone')!;

    expect(phone.product.basePriceKopecks).toBe(35000);
    expect(phone.unitPriceKopecks).toBe(32000);
    expect(phone.hasPromotionalPrice).toBe(true);
  });

  it('rejects duplicate slugs and invalid checkout protocols', () => {
    const invalid = structuredClone(rawConfig);
    invalid.products[1].slug = invalid.products[0].slug;
    invalid.checkout.url = 'javascript:alert(1)';

    expect(() => validateKeychainCalculatorConfig(invalid)).toThrow(CalculatorConfigError);
  });
});
