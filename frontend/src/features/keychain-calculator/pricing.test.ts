import { describe, expect, it } from 'vitest';
import rawConfig from '@/data/keychain-calculator.json';
import { resolveCalculatorConfig } from './config';
import { calculateKeychainOrder, normalizeSelections } from './pricing';
import { validateKeychainCalculatorConfig } from './validation';

const config = validateKeychainCalculatorConfig(rawConfig);
const baseResolved = resolveCalculatorConfig(config, new Date('2026-10-01T12:00:00+03:00'));
const promoResolved = resolveCalculatorConfig(config, new Date('2026-07-16T12:00:00+03:00'));

describe('keychain calculator pricing', () => {
  it('returns a zero result for an empty order', () => {
    expect(calculateKeychainOrder([], baseResolved)).toEqual({
      lines: [],
      subtotalKopecks: 0,
      discountKopecks: 0,
      totalKopecks: 0,
      totalQuantity: 0,
      orderDiscountBps: 0,
      activePromotionCode: null,
      nextOrderTier: {
        minSubtotalKopecks: 150000,
        missingSubtotalKopecks: 150000,
        discountBps: 300,
      },
    });
  });

  it('normalizes duplicates and ignores hidden or unknown products', () => {
    const hiddenConfig = {
      ...baseResolved,
      products: baseResolved.products.filter(({ product }) => product.slug !== 'pet'),
    };

    expect(normalizeSelections([
      { productSlug: 'phone', quantity: 1.9 },
      { productSlug: 'phone', quantity: 2 },
      { productSlug: 'pet', quantity: 5 },
      { productSlug: 'unknown', quantity: 10 },
      { productSlug: 'qr', quantity: -3 },
    ], hiddenConfig)).toEqual([
      { productSlug: 'phone', quantity: 3 },
    ]);
  });

  it('applies a quantity discount at the exact threshold', () => {
    const result = calculateKeychainOrder([
      { productSlug: 'phone', quantity: 3 },
    ], baseResolved);

    expect(result.lines[0]).toMatchObject({
      subtotalKopecks: 105000,
      quantityDiscountBps: 300,
      orderDiscountBps: 0,
      appliedDiscountBps: 300,
      discountKopecks: 3150,
      totalKopecks: 101850,
    });
  });

  it('uses the larger discount in max mode', () => {
    const result = calculateKeychainOrder([
      { productSlug: 'phone', quantity: 5 },
    ], baseResolved);

    expect(result.orderDiscountBps).toBe(300);
    expect(result.lines[0].quantityDiscountBps).toBe(500);
    expect(result.lines[0].appliedDiscountBps).toBe(500);
  });

  it('caps summed discounts', () => {
    const resolved = {
      ...baseResolved,
      discountMode: 'sum' as const,
      maxDiscountBps: 1200,
    };
    const result = calculateKeychainOrder([
      { productSlug: 'phone', quantity: 10 },
    ], resolved);

    expect(result.lines[0].quantityDiscountBps).toBe(1000);
    expect(result.orderDiscountBps).toBe(700);
    expect(result.lines[0].appliedDiscountBps).toBe(1200);
  });

  it('uses promotional prices and promotional order tiers', () => {
    const result = calculateKeychainOrder([
      { productSlug: 'phone', quantity: 5 },
    ], promoResolved);

    expect(result.activePromotionCode).toBe('summer-2026');
    expect(result.lines[0].unitPriceKopecks).toBe(32000);
    expect(result.lines[0].hasPromotionalPrice).toBe(true);
    expect(result.orderDiscountBps).toBe(500);
  });

  it('reports the next quantity and order thresholds', () => {
    const result = calculateKeychainOrder([
      { productSlug: 'pet', quantity: 2 },
    ], baseResolved);

    expect(result.lines[0].nextQuantityTier).toEqual({
      minQuantity: 3,
      missingQuantity: 1,
      discountBps: 300,
    });
    expect(result.nextOrderTier).toEqual({
      minSubtotalKopecks: 150000,
      missingSubtotalKopecks: 90000,
      discountBps: 300,
    });
  });
});
