import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import {
  CUT_INFLATE_EPS,
  inflateGeom,
  removeDegenerateTriangles,
} from './geometryCleanup';

describe('inflateGeom', () => {
  it('expands cutter bounds while preserving its center', () => {
    const geometry = new THREE.BoxGeometry(20, 8, 8);
    geometry.translate(5, -3, 2);
    geometry.computeBoundingBox();
    const before = geometry.boundingBox!.clone();

    inflateGeom(geometry, CUT_INFLATE_EPS);
    geometry.computeBoundingBox();
    const after = geometry.boundingBox!;

    expect(after.getCenter(new THREE.Vector3())).toEqual(before.getCenter(new THREE.Vector3()));
    const beforeSize = before.getSize(new THREE.Vector3());
    const afterSize = after.getSize(new THREE.Vector3());
    expect(afterSize.x).toBeCloseTo(beforeSize.x + 2 * CUT_INFLATE_EPS, 5);
    expect(afterSize.y).toBeCloseTo(beforeSize.y + 2 * CUT_INFLATE_EPS, 5);
    expect(afterSize.z).toBeCloseTo(beforeSize.z + 2 * CUT_INFLATE_EPS, 5);
  });
});

describe('removeDegenerateTriangles', () => {
  it('выбрасывает схлопнувшиеся грани с повторяющимся индексом, сохраняя валидные', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 2, 0],
        3,
      ),
    );
    // Триангл 0 валидный (0,1,2); триангл 1 схлопнут (3,3,4).
    geom.setIndex([0, 1, 2, 3, 3, 4]);

    const out = removeDegenerateTriangles(geom);
    const idx = out.getIndex();

    expect(idx).not.toBeNull();
    expect(idx!.count).toBe(3);
    expect(Array.from(idx!.array)).toEqual([0, 1, 2]);
  });

  it('ловит схлопывание в любой из трёх позиций треугольника', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
        3,
      ),
    );
    // (0,0,1) a==b, (2,3,2) a==c, (3,1,1) b==c — все вырожденные.
    geom.setIndex([0, 0, 1, 2, 3, 2, 3, 1, 1]);

    const out = removeDegenerateTriangles(geom);
    expect(out.getIndex()!.count).toBe(0);
  });

  it('не трогает геометрию без вырожденных граней (возвращает её же)', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    geom.setIndex([0, 1, 2]);

    const out = removeDegenerateTriangles(geom);
    expect(out).toBe(geom);
    expect(out.getIndex()!.count).toBe(3);
  });

  it('возвращает неиндексированную геометрию без изменений', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const out = removeDegenerateTriangles(geom);
    expect(out).toBe(geom);
    expect(out.getIndex()).toBeNull();
  });
});
