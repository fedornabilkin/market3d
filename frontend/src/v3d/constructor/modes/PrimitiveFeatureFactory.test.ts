import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../features/csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { PrimitiveFeatureFactory } from './PrimitiveFeatureFactory';
import { BoxFeature } from '../features/primitives/BoxFeature';
import { SphereFeature } from '../features/primitives/SphereFeature';

describe('PrimitiveFeatureFactory', () => {
  it('создаёт BoxFeature с дефолтными параметрами', () => {
    const factory = new PrimitiveFeatureFactory();
    const { feature, id } = factory.create('box');
    expect(feature).toBeInstanceOf(BoxFeature);
    expect(feature.id).toBe(id);
    expect((feature as BoxFeature).params).toMatchObject({
      width: 20, height: 20, depth: 20,
    });
  });

  it('применяет paramsOverride поверх defaults', () => {
    const factory = new PrimitiveFeatureFactory();
    const { feature } = factory.create('sphere', { radius: 50 });
    expect(feature).toBeInstanceOf(SphereFeature);
    expect((feature as SphereFeature).params.radius).toBe(50);
    expect((feature as SphereFeature).params.widthSegments).toBe(32);
  });

  it('генерирует уникальные id для каждого create', () => {
    const factory = new PrimitiveFeatureFactory();
    const { id: id1 } = factory.create('box');
    const { id: id2 } = factory.create('box');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^p2_box_\d+$/);
  });
});
