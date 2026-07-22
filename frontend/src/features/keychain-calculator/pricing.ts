import type {
  CalculatorResult,
  CalculatorSelection,
  DiscountMode,
  NextOrderTier,
  NextQuantityTier,
  OrderDiscountTier,
  PriorityScope,
  QuantityDiscountTier,
  ResolvedCalculatorConfig,
} from './types';

function sanitizeQuantity(value: number, maxQuantity: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maxQuantity, Math.max(0, Math.trunc(value)));
}

export function normalizeSelections(
  selections: CalculatorSelection[],
  config: ResolvedCalculatorConfig,
): CalculatorSelection[] {
  const activeSlugs = new Set(config.products.map(({ product }) => product.slug));
  const quantities = new Map<string, number>();
  const maxQuantity = config.source.maxQuantityPerProduct;

  for (const selection of selections) {
    if (!activeSlugs.has(selection.productSlug)) continue;
    const quantity = sanitizeQuantity(selection.quantity, maxQuantity);
    if (quantity === 0) continue;
    const nextQuantity = Math.min(
      maxQuantity,
      (quantities.get(selection.productSlug) ?? 0) + quantity,
    );
    quantities.set(selection.productSlug, nextQuantity);
  }

  return [...quantities.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([productSlug, quantity]) => ({ productSlug, quantity }));
}

function reachedDiscount(
  value: number,
  tiers: Array<{ threshold: number; discountBps: number }>,
): number {
  let result = 0;
  for (const tier of tiers) {
    if (value < tier.threshold) break;
    result = tier.discountBps;
  }
  return result;
}

function quantityDiscount(quantity: number, tiers: QuantityDiscountTier[]): number {
  return reachedDiscount(
    quantity,
    tiers.map((tier) => ({ threshold: tier.minQuantity, discountBps: tier.discountBps })),
  );
}

function orderDiscount(subtotalKopecks: number, tiers: OrderDiscountTier[]): number {
  return reachedDiscount(
    subtotalKopecks,
    tiers.map((tier) => ({
      threshold: tier.minSubtotalKopecks,
      discountBps: tier.discountBps,
    })),
  );
}

function combineDiscounts(
  itemDiscountBps: number,
  orderDiscountBps: number,
  mode: DiscountMode,
  priorityScope: PriorityScope,
  maxDiscountBps: number,
): number {
  let combined: number;
  if (mode === 'sum') {
    combined = itemDiscountBps + orderDiscountBps;
  } else if (mode === 'priority') {
    combined = priorityScope === 'item'
      ? itemDiscountBps || orderDiscountBps
      : orderDiscountBps || itemDiscountBps;
  } else {
    combined = Math.max(itemDiscountBps, orderDiscountBps);
  }
  return Math.min(maxDiscountBps, combined);
}

function nextQuantityTier(quantity: number, tiers: QuantityDiscountTier[]): NextQuantityTier | null {
  const next = tiers.find((tier) => tier.minQuantity > quantity);
  if (!next) return null;
  return {
    minQuantity: next.minQuantity,
    missingQuantity: next.minQuantity - quantity,
    discountBps: next.discountBps,
  };
}

function nextOrderTier(subtotalKopecks: number, tiers: OrderDiscountTier[]): NextOrderTier | null {
  const next = tiers.find((tier) => tier.minSubtotalKopecks > subtotalKopecks);
  if (!next) return null;
  return {
    minSubtotalKopecks: next.minSubtotalKopecks,
    missingSubtotalKopecks: next.minSubtotalKopecks - subtotalKopecks,
    discountBps: next.discountBps,
  };
}

export function calculateKeychainOrder(
  selections: CalculatorSelection[],
  config: ResolvedCalculatorConfig,
): CalculatorResult {
  const normalized = normalizeSelections(selections, config);
  const productsBySlug = new Map(config.products.map((product) => [product.product.slug, product]));
  const subtotalKopecks = normalized.reduce((total, selection) => {
    const product = productsBySlug.get(selection.productSlug)!;
    return total + product.unitPriceKopecks * selection.quantity;
  }, 0);
  const appliedOrderDiscountBps = orderDiscount(subtotalKopecks, config.orderDiscountTiers);

  const lines = normalized.map((selection) => {
    const pricing = productsBySlug.get(selection.productSlug)!;
    const lineSubtotalKopecks = pricing.unitPriceKopecks * selection.quantity;
    const quantityDiscountBps = quantityDiscount(selection.quantity, pricing.discountTiers);
    const appliedDiscountBps = combineDiscounts(
      quantityDiscountBps,
      appliedOrderDiscountBps,
      config.discountMode,
      config.priorityScope,
      config.maxDiscountBps,
    );
    const discountKopecks = Math.round(lineSubtotalKopecks * appliedDiscountBps / 10000);

    return {
      productSlug: selection.productSlug,
      quantity: selection.quantity,
      baseUnitPriceKopecks: pricing.product.basePriceKopecks,
      unitPriceKopecks: pricing.unitPriceKopecks,
      hasPromotionalPrice: pricing.hasPromotionalPrice,
      subtotalKopecks: lineSubtotalKopecks,
      quantityDiscountBps,
      orderDiscountBps: appliedOrderDiscountBps,
      appliedDiscountBps,
      discountKopecks,
      totalKopecks: lineSubtotalKopecks - discountKopecks,
      nextQuantityTier: nextQuantityTier(selection.quantity, pricing.discountTiers),
    };
  });

  const discountKopecks = lines.reduce((total, line) => total + line.discountKopecks, 0);
  return {
    lines,
    subtotalKopecks,
    discountKopecks,
    totalKopecks: subtotalKopecks - discountKopecks,
    totalQuantity: normalized.reduce((total, selection) => total + selection.quantity, 0),
    orderDiscountBps: appliedOrderDiscountBps,
    activePromotionCode: config.activePromotion?.code ?? null,
    nextOrderTier: nextOrderTier(subtotalKopecks, config.orderDiscountTiers),
  };
}
