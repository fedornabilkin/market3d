import { computed, shallowRef } from 'vue';

export type ConstructorSelectionOptions = {
  apply: (ids: readonly string[], primaryId: string | null) => void;
  onCleared?: () => void;
};

/** Stable FeatureId-based single/multi selection state. */
export function useConstructorSelection(options: ConstructorSelectionOptions) {
  const primaryId = shallowRef<string | null>(null);
  const rawIds = shallowRef<string[]>([]);
  const selectedIds = computed<readonly string[]>(() => rawIds.value);

  function set(ids: readonly string[]): void {
    rawIds.value = ids.length ? [...new Set(ids)] : [];
    primaryId.value = rawIds.value.length ? rawIds.value[rawIds.value.length - 1] : null;
    if (rawIds.value.length === 0) options.onCleared?.();
    options.apply(rawIds.value, primaryId.value);
  }

  function select(featureId: string, additive = false): void {
    if (!additive) {
      set([featureId]);
      return;
    }
    set(rawIds.value.includes(featureId)
      ? rawIds.value.filter((id) => id !== featureId)
      : [...rawIds.value, featureId]);
  }

  function clear(): void { set([]); }

  return { primaryId, rawIds, selectedIds, set, select, clear };
}
