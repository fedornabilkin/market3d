import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { groupByBoundsIntersection } from './intersectionGroups';

type Item = { id: string; bounds: THREE.Box3 };
const item = (id: string, minX: number, maxX: number): Item => ({
  id,
  bounds: new THREE.Box3(
    new THREE.Vector3(minX, 0, 0),
    new THREE.Vector3(maxX, 1, 1),
  ),
});

describe('groupByBoundsIntersection', () => {
  it('combines transitively intersecting cutters', () => {
    const groups = groupByBoundsIntersection([
      item('top', 0, 2),
      item('vertical', 1, 4),
      item('bottom', 3, 5),
    ], (entry) => entry.bounds);

    expect(groups.map((group) => group.map((entry) => entry.id))).toEqual([
      ['top', 'vertical', 'bottom'],
    ]);
  });

  it('keeps independent cutters in separate groups', () => {
    const groups = groupByBoundsIntersection([
      item('left', 0, 1),
      item('right', 5, 6),
    ], (entry) => entry.bounds);

    expect(groups).toHaveLength(2);
  });
});
