import type { CalculatorSelection } from './types';

export const CALCULATOR_URL_VERSION = '1';

type QueryValue = string | null | undefined | Array<string | null>;

export interface CalculatorUrlQuery {
  v?: QueryValue;
  items?: QueryValue;
}

function firstQueryValue(value: QueryValue): string | undefined {
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? value : undefined;
}

export function parseCalculatorUrlState(
  query: CalculatorUrlQuery,
  allowedSlugs: Iterable<string>,
  maxQuantity: number,
): CalculatorSelection[] {
  const version = firstQueryValue(query.v);
  if (version !== undefined && version !== CALCULATOR_URL_VERSION) return [];

  const items = firstQueryValue(query.items);
  if (!items) return [];

  const allowed = new Set(allowedSlugs);
  const quantities = new Map<string, number>();
  for (const token of items.split(',')) {
    const separator = token.lastIndexOf(':');
    if (separator <= 0) continue;
    const productSlug = token.slice(0, separator);
    const rawQuantity = token.slice(separator + 1);
    if (!/^[a-z0-9-]+$/i.test(productSlug) || !allowed.has(productSlug)) continue;
    if (!/^\d+$/.test(rawQuantity)) continue;
    const quantity = Math.min(maxQuantity, Number(rawQuantity));
    if (!Number.isSafeInteger(quantity) || quantity < 1) continue;
    quantities.set(
      productSlug,
      Math.min(maxQuantity, (quantities.get(productSlug) ?? 0) + quantity),
    );
  }

  return [...quantities.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([productSlug, quantity]) => ({ productSlug, quantity }));
}

export function serializeCalculatorUrlState(
  selections: CalculatorSelection[],
): { v: string; items?: string } {
  const items = selections
    .filter((selection) => (
      /^[a-z0-9-]+$/i.test(selection.productSlug)
      && Number.isSafeInteger(selection.quantity)
      && selection.quantity > 0
    ))
    .sort((left, right) => left.productSlug.localeCompare(right.productSlug))
    .map((selection) => `${selection.productSlug}:${selection.quantity}`)
    .join(',');

  return items
    ? { v: CALCULATOR_URL_VERSION, items }
    : { v: CALCULATOR_URL_VERSION };
}
