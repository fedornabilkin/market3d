import { formatDiscount, formatMoney } from './money';
import type { CalculatorResult, ResolvedCalculatorConfig } from './types';

export interface SummaryTextOptions {
  locale: string;
  currency: string;
  title: string;
  productName: (translationKey: string) => string;
  labels: {
    subtotal: string;
    discount: string;
    total: string;
    link: string;
    preliminary: string;
  };
  url?: string;
}

export function buildCalculatorSummary(
  result: CalculatorResult,
  config: ResolvedCalculatorConfig,
  options: SummaryTextOptions,
): string {
  const products = new Map(config.products.map(({ product }) => [product.slug, product]));
  const lines = result.lines.map((line) => {
    const product = products.get(line.productSlug)!;
    const discount = line.appliedDiscountBps > 0
      ? ` (−${formatDiscount(line.appliedDiscountBps, options.locale)})`
      : '';
    return `${options.productName(product.nameKey)} — ${line.quantity} × `
      + `${formatMoney(line.unitPriceKopecks, options.locale, options.currency)} = `
      + `${formatMoney(line.totalKopecks, options.locale, options.currency)}${discount}`;
  });

  const totals = [
    `${options.labels.subtotal}: ${formatMoney(result.subtotalKopecks, options.locale, options.currency)}`,
    `${options.labels.discount}: ${formatMoney(result.discountKopecks, options.locale, options.currency)}`,
    `${options.labels.total}: ${formatMoney(result.totalKopecks, options.locale, options.currency)}`,
  ];

  const blocks = [
    options.title,
    options.labels.preliminary,
    lines.join('\n'),
    totals.join('\n'),
  ];
  if (options.url) blocks.push(`${options.labels.link}: ${options.url}`);
  return blocks.filter(Boolean).join('\n\n');
}
