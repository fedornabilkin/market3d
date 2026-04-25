import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// см. FeatureGraph.test.ts — мокаем CSG, чтобы не тянуть BVH в node.
vi.mock('../csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from '../FeatureDocument';
import { BoxFeature } from '../primitives/BoxFeature';
import { SphereFeature } from '../primitives/SphereFeature';
import { TransformFeature } from '../composite/TransformFeature';
import { GroupFeature } from '../composite/GroupFeature';
import { FeatureRenderer } from './FeatureRenderer';

describe('FeatureRenderer: bind/unbind', () => {
  it('builds objects for root features on bind', () => {
    const root = new THREE.Group();
    const renderer = new FeatureRenderer(root);
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    renderer.bindDocument(doc);

    expect(root.children).toHaveLength(1);
    expect(renderer.getObject3D('b1')).toBeDefined();
    renderer.dispose();
  });

  it('unbind removes objects from scene', () => {
    const root = new THREE.Group();
    const renderer = new FeatureRenderer(root);
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    renderer.bindDocument(doc);
    expect(root.children).toHaveLength(1);

    renderer.unbindDocument();
    expect(root.children).toHaveLength(0);
    renderer.dispose();
  });
});

describe('FeatureRenderer: live updates', () => {
  it('rebuilds on recompute-done event', () => {
    const root = new THREE.Group();
    const renderer = new FeatureRenderer(root);
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    renderer.bindDocument(doc);
    const obj1 = renderer.getObject3D('b1');

    doc.updateParams<{ width: number }>('b1', { width: 20 });
    const obj2 = renderer.getObject3D('b1');

    // После recompute-done: пересобрали → новый объект.
    expect(obj2).toBeDefined();
    expect(obj2).not.toBe(obj1);
    renderer.dispose();
  });

  it('removes object on feature-removed', () => {
    const root = new THREE.Group();
    const renderer = new FeatureRenderer(root);
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.setRootIds(['b1', 's1']);

    renderer.bindDocument(doc);
    expect(root.children).toHaveLength(2);

    doc.removeFeature('s1');
    expect(renderer.getObject3D('s1')).toBeUndefined();
    renderer.dispose();
  });
});

describe('FeatureRenderer: composite output', () => {
  it('builds THREE.Group for GroupFeature output', () => {
    const root = new THREE.Group();
    const renderer = new FeatureRenderer(root);
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('g1', {}, ['b1', 's1']));
    doc.setRootIds(['g1']);

    renderer.bindDocument(doc);
    const groupObj = renderer.getObject3D('g1');

    expect(groupObj).toBeInstanceOf(THREE.Group);
    expect(groupObj!.children).toHaveLength(2);
    expect(groupObj!.userData.selectAsUnit).toBe(true);
    renderer.dispose();
  });
});

describe('FeatureRenderer: transform', () => {
  it('applies position from TransformFeature to mesh', () => {
    const root = new THREE.Group();
    const renderer = new FeatureRenderer(root);
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [5, 7, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.setRootIds(['t1']);

    renderer.bindDocument(doc);
    const obj = renderer.getObject3D('t1');

    expect(obj!.position.x).toBeCloseTo(5);
    expect(obj!.position.y).toBeCloseTo(7);
    expect(obj!.position.z).toBeCloseTo(3);
    renderer.dispose();
  });
});

describe('FeatureRenderer: lookup', () => {
  it('findFeatureIdByObject walks up to find featureId', () => {
    const root = new THREE.Group();
    const renderer = new FeatureRenderer(root);
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('g1', {}, ['b1', 's1']));
    doc.setRootIds(['g1']);
    renderer.bindDocument(doc);

    const groupObj = renderer.getObject3D('g1')!;
    const childMesh = groupObj.children[0]; // первый ребёнок (box)

    // Хотя у childMesh свой синтетический id, walk-up найдёт g1.
    expect(renderer.findFeatureIdByObject(childMesh)).toBe('g1:0');
    expect(renderer.findFeatureIdByObject(groupObj)).toBe('g1');
    renderer.dispose();
  });
});
