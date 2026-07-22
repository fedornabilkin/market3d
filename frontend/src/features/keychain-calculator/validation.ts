import type {
  CalculatorCheckout,
  DiscountMode,
  KeychainCalculatorConfig,
  KeychainProduct,
  KeychainPromotion,
  OrderDiscountTier,
  PriorityScope,
  PromotionProductOverride,
  QuantityDiscountTier,
} from './types';

const SUPPORTED_CONFIG_VERSION = 1;
const DISCOUNT_MODES = new Set<DiscountMode>(['max', 'sum', 'priority']);
const PRIORITY_SCOPES = new Set<PriorityScope>(['item', 'order']);

export class CalculatorConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid keychain calculator config:\n${issues.join('\n')}`);
    this.name = 'CalculatorConfigError';
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: UnknownRecord, key: string, path: string, issues: string[]): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`${path}.${key} must be a non-empty string`);
    return '';
  }
  return value;
}

function optionalStringField(record: UnknownRecord, key: string, path: string, issues: string[]): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`${path}.${key} must be a non-empty string`);
    return undefined;
  }
  return value;
}

function integerField(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: string[],
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    issues.push(`${path}.${key} must be an integer between ${min} and ${max}`);
    return min > Number.MIN_SAFE_INTEGER ? min : 0;
  }
  return value as number;
}

function booleanField(record: UnknownRecord, key: string, path: string, issues: string[]): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    issues.push(`${path}.${key} must be a boolean`);
    return false;
  }
  return value;
}

function discountModeField(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: string[],
  optional = false,
): DiscountMode | undefined {
  const value = record[key];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !DISCOUNT_MODES.has(value as DiscountMode)) {
    issues.push(`${path}.${key} must be max, sum or priority`);
    return optional ? undefined : 'max';
  }
  return value as DiscountMode;
}

function priorityScopeField(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: string[],
  optional = false,
): PriorityScope | undefined {
  const value = record[key];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !PRIORITY_SCOPES.has(value as PriorityScope)) {
    issues.push(`${path}.${key} must be item or order`);
    return optional ? undefined : 'item';
  }
  return value as PriorityScope;
}

function parseQuantityTiers(value: unknown, path: string, issues: string[]): QuantityDiscountTier[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`);
    return [];
  }

  let previousThreshold = 0;
  return value.map((raw, index) => {
    const tierPath = `${path}[${index}]`;
    if (!isRecord(raw)) {
      issues.push(`${tierPath} must be an object`);
      return { minQuantity: previousThreshold + 1, discountBps: 0 };
    }
    const minQuantity = integerField(raw, 'minQuantity', tierPath, issues, 1);
    const discountBps = integerField(raw, 'discountBps', tierPath, issues, 0, 10000);
    if (minQuantity <= previousThreshold) {
      issues.push(`${tierPath}.minQuantity must be greater than the previous threshold`);
    }
    previousThreshold = Math.max(previousThreshold, minQuantity);
    return { minQuantity, discountBps };
  });
}

function parseOrderTiers(value: unknown, path: string, issues: string[]): OrderDiscountTier[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`);
    return [];
  }

  let previousThreshold = 0;
  return value.map((raw, index) => {
    const tierPath = `${path}[${index}]`;
    if (!isRecord(raw)) {
      issues.push(`${tierPath} must be an object`);
      return { minSubtotalKopecks: previousThreshold + 1, discountBps: 0 };
    }
    const minSubtotalKopecks = integerField(raw, 'minSubtotalKopecks', tierPath, issues, 1);
    const discountBps = integerField(raw, 'discountBps', tierPath, issues, 0, 10000);
    if (minSubtotalKopecks <= previousThreshold) {
      issues.push(`${tierPath}.minSubtotalKopecks must be greater than the previous threshold`);
    }
    previousThreshold = Math.max(previousThreshold, minSubtotalKopecks);
    return { minSubtotalKopecks, discountBps };
  });
}

function parseProduct(raw: unknown, index: number, issues: string[]): KeychainProduct {
  const path = `products[${index}]`;
  if (!isRecord(raw)) {
    issues.push(`${path} must be an object`);
    raw = {};
  }
  const record = raw as UnknownRecord;
  const state = record.state;
  if (state !== 'active' && state !== 'hidden') {
    issues.push(`${path}.state must be active or hidden`);
  }

  return {
    slug: stringField(record, 'slug', path, issues),
    nameKey: stringField(record, 'nameKey', path, issues),
    descriptionKey: optionalStringField(record, 'descriptionKey', path, issues),
    image: optionalStringField(record, 'image', path, issues),
    basePriceKopecks: integerField(record, 'basePriceKopecks', path, issues, 0),
    state: state === 'hidden' ? 'hidden' : 'active',
    sortOrder: integerField(record, 'sortOrder', path, issues),
    discountTiers: parseQuantityTiers(record.discountTiers, `${path}.discountTiers`, issues),
  };
}

function parseProductOverride(
  raw: unknown,
  path: string,
  issues: string[],
): PromotionProductOverride {
  if (!isRecord(raw)) {
    issues.push(`${path} must be an object`);
    return {};
  }

  const result: PromotionProductOverride = {};
  if (raw.priceKopecks !== undefined) {
    result.priceKopecks = integerField(raw, 'priceKopecks', path, issues, 0);
  }
  if (raw.discountTiers !== undefined) {
    result.discountTiers = parseQuantityTiers(raw.discountTiers, `${path}.discountTiers`, issues);
  }
  if (result.priceKopecks === undefined && result.discountTiers === undefined) {
    issues.push(`${path} must override priceKopecks or discountTiers`);
  }
  return result;
}

function parsePromotion(raw: unknown, index: number, productSlugs: Set<string>, issues: string[]): KeychainPromotion {
  const path = `promotions[${index}]`;
  if (!isRecord(raw)) {
    issues.push(`${path} must be an object`);
    raw = {};
  }
  const record = raw as UnknownRecord;
  const state = record.state;
  if (state !== 'active' && state !== 'paused') {
    issues.push(`${path}.state must be active or paused`);
  }

  const startsAt = stringField(record, 'startsAt', path, issues);
  const endsAt = stringField(record, 'endsAt', path, issues);
  const startsAtTime = Date.parse(startsAt);
  const endsAtTime = Date.parse(endsAt);
  if (!Number.isFinite(startsAtTime)) issues.push(`${path}.startsAt must be a valid ISO date`);
  if (!Number.isFinite(endsAtTime)) issues.push(`${path}.endsAt must be a valid ISO date`);
  if (Number.isFinite(startsAtTime) && Number.isFinite(endsAtTime) && startsAtTime >= endsAtTime) {
    issues.push(`${path}.startsAt must be earlier than endsAt`);
  }

  let productOverrides: Record<string, PromotionProductOverride> | undefined;
  if (record.productOverrides !== undefined) {
    if (!isRecord(record.productOverrides)) {
      issues.push(`${path}.productOverrides must be an object`);
    } else {
      productOverrides = {};
      for (const [slug, override] of Object.entries(record.productOverrides)) {
        if (!productSlugs.has(slug)) {
          issues.push(`${path}.productOverrides.${slug} references an unknown product`);
        }
        productOverrides[slug] = parseProductOverride(
          override,
          `${path}.productOverrides.${slug}`,
          issues,
        );
      }
    }
  }

  return {
    code: stringField(record, 'code', path, issues),
    titleKey: stringField(record, 'titleKey', path, issues),
    descriptionKey: optionalStringField(record, 'descriptionKey', path, issues),
    state: state === 'paused' ? 'paused' : 'active',
    priority: integerField(record, 'priority', path, issues),
    startsAt,
    endsAt,
    discountMode: discountModeField(record, 'discountMode', path, issues, true),
    priorityScope: priorityScopeField(record, 'priorityScope', path, issues, true),
    maxDiscountBps: record.maxDiscountBps === undefined
      ? undefined
      : integerField(record, 'maxDiscountBps', path, issues, 0, 10000),
    productOverrides,
    orderDiscountTiers: record.orderDiscountTiers === undefined
      ? undefined
      : parseOrderTiers(record.orderDiscountTiers, `${path}.orderDiscountTiers`, issues),
  };
}

function parseCheckout(raw: unknown, issues: string[]): CalculatorCheckout {
  const path = 'checkout';
  if (!isRecord(raw)) {
    issues.push(`${path} must be an object`);
    raw = {};
  }
  const record = raw as UnknownRecord;
  const mode = record.mode;
  if (mode !== 'link') issues.push(`${path}.mode must be link`);
  const url = stringField(record, 'url', path, issues);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') issues.push(`${path}.url must use https`);
  } catch {
    issues.push(`${path}.url must be a valid URL`);
  }
  return {
    mode: 'link',
    url,
    copySummaryBeforeOpen: booleanField(record, 'copySummaryBeforeOpen', path, issues),
  };
}

export function validateKeychainCalculatorConfig(input: unknown): KeychainCalculatorConfig {
  const issues: string[] = [];
  if (!isRecord(input)) {
    throw new CalculatorConfigError(['config must be an object']);
  }

  const version = integerField(input, 'version', 'config', issues, 1);
  if (version !== SUPPORTED_CONFIG_VERSION) {
    issues.push(`config.version ${version} is not supported`);
  }

  const rawProducts = input.products;
  if (!Array.isArray(rawProducts)) issues.push('products must be an array');
  const products = Array.isArray(rawProducts)
    ? rawProducts.map((product, index) => parseProduct(product, index, issues))
    : [];
  const productSlugs = new Set<string>();
  for (const product of products) {
    if (productSlugs.has(product.slug)) issues.push(`product slug "${product.slug}" is duplicated`);
    productSlugs.add(product.slug);
  }

  const rawPromotions = input.promotions;
  if (!Array.isArray(rawPromotions)) issues.push('promotions must be an array');
  const promotions = Array.isArray(rawPromotions)
    ? rawPromotions.map((promotion, index) => parsePromotion(promotion, index, productSlugs, issues))
    : [];
  const promotionCodes = new Set<string>();
  for (const promotion of promotions) {
    if (promotionCodes.has(promotion.code)) issues.push(`promotion code "${promotion.code}" is duplicated`);
    promotionCodes.add(promotion.code);
  }

  const config: KeychainCalculatorConfig = {
    version,
    currency: stringField(input, 'currency', 'config', issues),
    locale: stringField(input, 'locale', 'config', issues),
    timezone: stringField(input, 'timezone', 'config', issues),
    discountMode: discountModeField(input, 'discountMode', 'config', issues) ?? 'max',
    priorityScope: priorityScopeField(input, 'priorityScope', 'config', issues) ?? 'item',
    maxDiscountBps: integerField(input, 'maxDiscountBps', 'config', issues, 0, 10000),
    maxQuantityPerProduct: integerField(input, 'maxQuantityPerProduct', 'config', issues, 1, 999999),
    checkout: parseCheckout(input.checkout, issues),
    products: products.sort((left, right) => left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug)),
    orderDiscountTiers: parseOrderTiers(input.orderDiscountTiers, 'orderDiscountTiers', issues),
    promotions,
  };

  if (issues.length > 0) throw new CalculatorConfigError(issues);
  return config;
}
