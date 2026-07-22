import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { loadKeychainCalculatorConfig, resolveCalculatorConfig } from '@/features/keychain-calculator/config';
import { calculateKeychainOrder } from '@/features/keychain-calculator/pricing';
import type { CalculatorSelection, KeychainCalculatorConfig } from '@/features/keychain-calculator/types';
import {
  parseCalculatorUrlState,
  serializeCalculatorUrlState,
} from '@/features/keychain-calculator/urlState';

export function useKeychainCalculator() {
  const route = useRoute();
  const router = useRouter();
  const config = ref<KeychainCalculatorConfig | null>(null);
  const quantities = ref<Record<string, number>>({});
  const loading = ref(true);
  const error = ref<Error | null>(null);
  const now = ref(Date.now());
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  let initialized = false;

  const resolvedConfig = computed(() => (
    config.value ? resolveCalculatorConfig(config.value, new Date(now.value)) : null
  ));
  const selections = computed<CalculatorSelection[]>(() => (
    Object.entries(quantities.value)
      .filter(([, quantity]) => quantity > 0)
      .map(([productSlug, quantity]) => ({ productSlug, quantity }))
  ));
  const result = computed(() => (
    resolvedConfig.value
      ? calculateKeychainOrder(selections.value, resolvedConfig.value)
      : null
  ));
  const shareUrl = computed(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    const state = serializeCalculatorUrlState(selections.value);
    url.searchParams.set('v', state.v);
    if (state.items) url.searchParams.set('items', state.items);
    else url.searchParams.delete('items');
    return url.toString();
  });

  function setQuantity(productSlug: string, value: number): void {
    if (!config.value) return;
    const quantity = Math.min(
      config.value.maxQuantityPerProduct,
      Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)),
    );
    const next = { ...quantities.value };
    if (quantity > 0) next[productSlug] = quantity;
    else delete next[productSlug];
    quantities.value = next;
  }

  function reset(): void {
    quantities.value = {};
  }

  function restoreFromUrl(): void {
    if (!config.value) return;
    const allowedSlugs = config.value.products
      .filter((product) => product.state === 'active')
      .map((product) => product.slug);
    const restored = parseCalculatorUrlState(
      route.query,
      allowedSlugs,
      config.value.maxQuantityPerProduct,
    );
    quantities.value = Object.fromEntries(
      restored.map((selection) => [selection.productSlug, selection.quantity]),
    );
  }

  async function syncUrl(): Promise<void> {
    const state = serializeCalculatorUrlState(selections.value);
    const query = { ...route.query };
    query.v = state.v;
    if (state.items) query.items = state.items;
    else delete query.items;
    await router.replace({ query });
  }

  watch(selections, () => {
    if (!initialized) return;
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      void syncUrl();
    }, 200);
  }, { deep: true });

  onMounted(async () => {
    try {
      config.value = await loadKeychainCalculatorConfig();
      restoreFromUrl();
      initialized = true;
      clockTimer = setInterval(() => {
        now.value = Date.now();
      }, 1000);
    } catch (reason) {
      error.value = reason instanceof Error ? reason : new Error(String(reason));
      if (import.meta.env.DEV) console.error(error.value);
    } finally {
      loading.value = false;
    }
  });

  onBeforeUnmount(() => {
    if (clockTimer) clearInterval(clockTimer);
    if (urlTimer) clearTimeout(urlTimer);
  });

  return {
    config,
    resolvedConfig,
    quantities,
    selections,
    result,
    shareUrl,
    loading,
    error,
    now,
    setQuantity,
    reset,
  };
}
