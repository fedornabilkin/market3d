import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../features/csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { ChamferFeatureBuilder } from './ChamferFeatureBuilder';
import { TransformFeature } from '../features/composite/TransformFeature';
import { GroupFeature } from '../features/composite/GroupFeature';

describe('ChamferFeatureBuilder.build (linear)', () => {
  it('строит набор фич для linear ребра по оси Z', () => {
    const result = ChamferFeatureBuilder.build({
      kind: 'linear',
      axis: 'z',
      localMid: new THREE.Vector3(5, 5, 5),
      length: 10,
      perpDirX: 1,
      perpDirZ: -1,
    }, 0.5);

    expect(result.features.length).toBe(6);
    const root = result.features.find((f) => f.id === result.rootId);
    expect(root).toBeInstanceOf(TransformFeature);
    expect((root as TransformFeature).params.position).toEqual([5, 5, 5]);
    // axis === 'z' → нет вращения root'а.
    expect((root as TransformFeature).params.rotation).toEqual([0, 0, 0]);
    expect((root as TransformFeature).params.isHole).toBe(true);
  });

  it('axis=x задаёт вращение Y=π/2 у root', () => {
    const result = ChamferFeatureBuilder.build({
      kind: 'linear',
      axis: 'x',
      localMid: new THREE.Vector3(0, 0, 0),
      length: 10,
      perpDirX: 1,
      perpDirZ: 1,
    }, 0.5);
    const root = result.features.find((f) => f.id === result.rootId) as TransformFeature;
    expect(root.params.rotation).toEqual([0, Math.PI / 2, 0]);
  });
});

describe('ChamferFeatureBuilder.build (circular)', () => {
  it('строит набор фич для нижнего ободка', () => {
    const result = ChamferFeatureBuilder.build({
      kind: 'circular',
      localMid: new THREE.Vector3(0, 0, 0),
      radius: 10,
      isTopRim: false,
    }, 1);
    expect(result.features.length).toBe(7);
    const root = result.features.find((f) => f.id === result.rootId) as TransformFeature;
    expect(root.params.rotation).toEqual([0, 0, 0]);
    // GroupFeature имеет 3 inputs (outer/inner_xform/torus_xform).
    const group = result.features.find((f) => f instanceof GroupFeature) as GroupFeature;
    expect(group.getInputs().length).toBe(3);
  });

  it('верхний ободок имеет ротацию X=π', () => {
    const result = ChamferFeatureBuilder.build({
      kind: 'circular',
      localMid: new THREE.Vector3(0, 0, 0),
      radius: 10,
      isTopRim: true,
    }, 1);
    const root = result.features.find((f) => f.id === result.rootId) as TransformFeature;
    expect(root.params.rotation).toEqual([Math.PI, 0, 0]);
  });
});
