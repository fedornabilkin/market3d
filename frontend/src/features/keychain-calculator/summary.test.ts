import { describe, expect, it } from 'vitest';
import rawConfig from '@/data/keychain-calculator.json';
import { resolveCalculatorConfig } from './config';
import { calculateKeychainOrder } from './pricing';
import { buildCalculatorSummary } from './summary';
import { validateKeychainCalculatorConfig } from './validation';

describe('keychain calculator summary', () => {
  it('builds a shareable text from calculated data', () => {
    const config = validateKeychainCalculatorConfig(rawConfig);
    const resolved = resolveCalculatorConfig(config, new Date('2026-10-01T00:00:00Z'));
    const result = calculateKeychainOrder([{ productSlug: 'phone', quantity: 3 }], resolved);
    const summary = buildCalculatorSummary(result, resolved, {
      locale: 'ru-RU',
      currency: 'RUB',
      title: 'Расчёт брелоков',
      productName: () => 'Брелок с телефоном',
      labels: {
        subtotal: 'Без скидки',
        discount: 'Скидка',
        total: 'Итого',
        link: 'Ссылка',
        preliminary: 'Предварительный расчёт',
      },
      url: 'https://example.test/calculator/keychains?v=1&items=phone:3',
    });

    const normalized = summary.replace(/\u00a0/g, ' ');
    expect(normalized).toContain('Брелок с телефоном — 3 × 350 ₽ = 1 018,50 ₽ (−3 %)');
    expect(normalized).toContain('Итого: 1 018,50 ₽');
    expect(normalized).toContain('items=phone:3');
  });
});
