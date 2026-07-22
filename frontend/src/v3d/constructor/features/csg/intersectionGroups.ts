import type * as THREE from 'three';

/** Groups items into transitive connected components of intersecting bounds. */
export function groupByBoundsIntersection<T>(
  items: readonly T[],
  getBounds: (item: T) => THREE.Box3,
): T[][] {
  const groups: T[][] = [];
  const visited = new Set<number>();

  for (let start = 0; start < items.length; start++) {
    if (visited.has(start)) continue;
    const group: T[] = [];
    const pending = [start];
    visited.add(start);

    while (pending.length > 0) {
      const index = pending.pop()!;
      const item = items[index];
      group.push(item);
      const bounds = getBounds(item);
      for (let candidate = 0; candidate < items.length; candidate++) {
        if (visited.has(candidate)) continue;
        if (!bounds.intersectsBox(getBounds(items[candidate]))) continue;
        visited.add(candidate);
        pending.push(candidate);
      }
    }
    groups.push(group);
  }
  return groups;
}
