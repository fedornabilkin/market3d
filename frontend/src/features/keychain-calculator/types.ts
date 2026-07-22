export type DiscountMode = 'max' | 'sum' | 'priority';
export type PriorityScope = 'item' | 'order';
export type ProductState = 'active' | 'hidden';
export type PromotionState = 'active' | 'paused';

export interface QuantityDiscountTier {
  minQuantity: number;
  discountBps: number;
}

export interface OrderDiscountTier {
  minSubtotalKopecks: number;
  discountBps: number;
}

export interface KeychainProduct {
  slug: string;
  nameKey: string;
  descriptionKey?: string;
  image?: string;
  basePriceKopecks: number;
  state: ProductState;
  sortOrder: number;
  discountTiers: QuantityDiscountTier[];
}

export interface PromotionProductOverride {
  priceKopecks?: number;
  discountTiers?: QuantityDiscountTier[];
}

export interface KeychainPromotion {
  code: string;
  titleKey: string;
  descriptionKey?: string;
  state: PromotionState;
  priority: number;
  startsAt: string;
  endsAt: string;
  discountMode?: DiscountMode;
  priorityScope?: PriorityScope;
  maxDiscountBps?: number;
  productOverrides?: Record<string, PromotionProductOverride>;
  orderDiscountTiers?: OrderDiscountTier[];
}

export interface CalculatorCheckout {
  mode: 'link';
  url: string;
  copySummaryBeforeOpen: boolean;
}

export interface KeychainCalculatorConfig {
  version: number;
  currency: string;
  locale: string;
  timezone: string;
  discountMode: DiscountMode;
  priorityScope: PriorityScope;
  maxDiscountBps: number;
  maxQuantityPerProduct: number;
  checkout: CalculatorCheckout;
  products: KeychainProduct[];
  orderDiscountTiers: OrderDiscountTier[];
  promotions: KeychainPromotion[];
}

export interface CalculatorSelection {
  productSlug: string;
  quantity: number;
}

export interface ActiveProductPricing {
  product: KeychainProduct;
  unitPriceKopecks: number;
  discountTiers: QuantityDiscountTier[];
  hasPromotionalPrice: boolean;
}

export interface ResolvedCalculatorConfig {
  source: KeychainCalculatorConfig;
  activePromotion: KeychainPromotion | null;
  discountMode: DiscountMode;
  priorityScope: PriorityScope;
  maxDiscountBps: number;
  orderDiscountTiers: OrderDiscountTier[];
  products: ActiveProductPricing[];
}

export interface NextQuantityTier {
  minQuantity: number;
  missingQuantity: number;
  discountBps: number;
}

export interface NextOrderTier {
  minSubtotalKopecks: number;
  missingSubtotalKopecks: number;
  discountBps: number;
}

export interface CalculatedLine {
  productSlug: string;
  quantity: number;
  baseUnitPriceKopecks: number;
  unitPriceKopecks: number;
  hasPromotionalPrice: boolean;
  subtotalKopecks: number;
  quantityDiscountBps: number;
  orderDiscountBps: number;
  appliedDiscountBps: number;
  discountKopecks: number;
  totalKopecks: number;
  nextQuantityTier: NextQuantityTier | null;
}

export interface CalculatorResult {
  lines: CalculatedLine[];
  subtotalKopecks: number;
  discountKopecks: number;
  totalKopecks: number;
  totalQuantity: number;
  orderDiscountBps: number;
  activePromotionCode: string | null;
  nextOrderTier: NextOrderTier | null;
}
