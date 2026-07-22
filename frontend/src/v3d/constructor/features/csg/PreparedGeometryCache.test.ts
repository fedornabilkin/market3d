import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PreparedGeometryCache } from './PreparedGeometryCache';

describe('PreparedGeometryCache', () => {
  it('evicts and disposes the least recently used variant', () => {
    const cache = new PreparedGeometryCache(2);
    const source = new THREE.BufferGeometry();
    const first = new THREE.BufferGeometry();
    const second = new THREE.BufferGeometry();
    const third = new THREE.BufferGeometry();
    const disposeFirst = vi.spyOn(first, 'dispose');

    cache.set(source, 'first', first);
    cache.set(source, 'second', second);
    expect(cache.get(source, 'second')).toBe(second);
    cache.set(source, 'third', third);

    expect(cache.get(source, 'first')).toBeUndefined();
    expect(cache.get(source, 'second')).toBe(second);
    expect(cache.get(source, 'third')).toBe(third);
    expect(disposeFirst).toHaveBeenCalledOnce();
  });

  it('keeps variants for different source geometries independent', () => {
    const cache = new PreparedGeometryCache(1);
    const firstSource = new THREE.BufferGeometry();
    const secondSource = new THREE.BufferGeometry();
    const firstPrepared = new THREE.BufferGeometry();
    const secondPrepared = new THREE.BufferGeometry();

    cache.set(firstSource, 'same-key', firstPrepared);
    cache.set(secondSource, 'same-key', secondPrepared);

    expect(cache.get(firstSource, 'same-key')).toBe(firstPrepared);
    expect(cache.get(secondSource, 'same-key')).toBe(secondPrepared);
  });
});
