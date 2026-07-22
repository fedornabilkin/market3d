export function formatMoney(
  kopecks: number,
  locale = 'ru-RU',
  currency = 'RUB',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: kopecks % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(kopecks / 100);
}

export function formatDiscount(discountBps: number, locale = 'ru-RU'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: discountBps % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(discountBps / 10000);
}
