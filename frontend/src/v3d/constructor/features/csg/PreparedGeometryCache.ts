import type * as THREE from 'three';

export const MAX_PREPARED_GEOMETRY_VARIANTS = 32;

/** Per-source LRU cache for transformed CSG input geometry. */
export class PreparedGeometryCache {
  private readonly variantsBySource = new WeakMap<
    THREE.BufferGeometry,
    Map<string, THREE.BufferGeometry>
  >();

  constructor(
    private readonly maximumVariantsPerSource = MAX_PREPARED_GEOMETRY_VARIANTS,
  ) {
    if (!Number.isInteger(maximumVariantsPerSource) || maximumVariantsPerSource < 1) {
      throw new Error('maximumVariantsPerSource must be a positive integer');
    }
  }

  get(source: THREE.BufferGeometry, key: string): THREE.BufferGeometry | undefined {
    const variants = this.variantsBySource.get(source);
    const cached = variants?.get(key);
    if (!variants || !cached) return undefined;

    variants.delete(key);
    variants.set(key, cached);
    return cached;
  }

  set(
    source: THREE.BufferGeometry,
    key: string,
    prepared: THREE.BufferGeometry,
  ): void {
    let variants = this.variantsBySource.get(source);
    if (!variants) {
      variants = new Map();
      this.variantsBySource.set(source, variants);
    }

    const previous = variants.get(key);
    if (previous) {
      variants.delete(key);
      if (previous !== prepared) previous.dispose();
    }

    while (variants.size >= this.maximumVariantsPerSource) {
      const oldestKey = variants.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const evicted = variants.get(oldestKey);
      variants.delete(oldestKey);
      evicted?.dispose();
    }
    variants.set(key, prepared);
  }
}
