import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../features/csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from '../features/FeatureDocument';
import { BoxFeature } from '../features/primitives/BoxFeature';
import { TransformFeature } from '../features/composite/TransformFeature';
import { MirrorFeatureOperation } from './MirrorFeatureOperation';

describe('MirrorFeatureOperation: без world-meshes', () => {
  it('инвертирует scale[axis] на Transform-обёртке', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.setRootIds(['t1']);

    const op = new MirrorFeatureOperation({
      findObject3DByFeatureId: () => null,
      rootGroup: new THREE.Group(),
    });
    const ok = op.run(doc, 't1', 'x');
    expect(ok).toBe(true);

    const transform = doc.graph.get('t1') as TransformFeature;
    expect(transform.params.scale).toEqual([-1, 1, 1]);
  });

  it('создаёт Transform-обёртку у голого primitive', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);
    const before = doc.graph.size();

    const op = new MirrorFeatureOperation({
      findObject3DByFeatureId: () => null,
      rootGroup: new THREE.Group(),
    });
    const ok = op.run(doc, 'b1', 'y');
    expect(ok).toBe(true);
    expect(doc.graph.size()).toBe(before + 1);
    // root теперь Transform-обёртка.
    const rootId = doc.rootIds[0];
    const root = doc.graph.get(rootId);
    expect(root).toBeInstanceOf(TransformFeature);
    const params = (root as TransformFeature).params;
    expect(params.scale).toEqual([1, -1, 1]);
  });

  it('повторный mirror возвращает scale в исходное состояние', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [10, 20, 30],
      rotation: [0, 0, 0],
      scale: [2, 3, 4],
    }, ['b1']));
    doc.setRootIds(['t1']);

    const op = new MirrorFeatureOperation({
      findObject3DByFeatureId: () => null,
      rootGroup: new THREE.Group(),
    });
    op.run(doc, 't1', 'z');
    op.run(doc, 't1', 'z');
    const t = doc.graph.get('t1') as TransformFeature;
    expect(t.params.scale).toEqual([2, 3, 4]);
  });
});
