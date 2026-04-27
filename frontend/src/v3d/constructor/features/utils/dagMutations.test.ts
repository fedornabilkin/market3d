import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from '../FeatureDocument';
import { BoxFeature } from '../primitives/BoxFeature';
import { SphereFeature } from '../primitives/SphereFeature';
import { TransformFeature } from '../composite/TransformFeature';
import { BooleanFeature } from '../composite/BooleanFeature';
import { GroupFeature } from '../composite/GroupFeature';
import {
  findParent,
  replaceFeatureInParent,
  ensureTransformWrapper,
  computeFeatureBbox,
  computeFeatureBboxRecursive,
  cloneFeatureSubgraph,
} from './dagMutations';

describe('findParent', () => {
  it('возвращает null если у фичи нет parent (она в rootIds)', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);
    expect(findParent(doc, 'b1')).toBeNull();
  });

  it('находит parent через inputs у composite', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new BooleanFeature('o1', { operation: 'subtract' }, ['b1', 's1']));
    doc.setRootIds(['o1']);

    expect(findParent(doc, 'b1')).toEqual({ parentId: 'o1', index: 0 });
    expect(findParent(doc, 's1')).toEqual({ parentId: 'o1', index: 1 });
    expect(findParent(doc, 'o1')).toBeNull();
  });
});

describe('replaceFeatureInParent', () => {
  it('заменяет id в parent.inputs', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new BooleanFeature('o1', { operation: 'subtract' }, ['b1', 's1']));
    doc.setRootIds(['o1']);
    doc.addFeature(new BoxFeature('b2', { width: 5, height: 5, depth: 5 }));

    const result = replaceFeatureInParent(doc, 'b1', 'b2');
    expect(result).toEqual({ kind: 'parent', parentId: 'o1' });
    expect(doc.graph.get('o1')!.getInputs()).toEqual(['b2', 's1']);
  });

  it('заменяет id в rootIds', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.setRootIds(['b1']);

    const result = replaceFeatureInParent(doc, 'b1', 's1');
    expect(result).toEqual({ kind: 'root', index: 0 });
    expect(doc.rootIds).toEqual(['s1']);
  });

  it('бросает если фича нигде не найдена', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);
    expect(() => replaceFeatureInParent(doc, 'b1', 'unknown')).toThrow();
  });
});

describe('ensureTransformWrapper', () => {
  it('возвращает тот же id если фича уже Transform', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.setRootIds(['t1']);

    expect(ensureTransformWrapper(doc, 't1')).toBe('t1');
  });

  it('возвращает существующий Transform-родитель (не создаёт двойную обёртку)', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [5, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.setRootIds(['t1']);

    const before = doc.graph.size();
    expect(ensureTransformWrapper(doc, 'b1')).toBe('t1');
    expect(doc.graph.size()).toBe(before);
  });

  it('создаёт обёртку и переподключает rootIds', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    const wrapperId = ensureTransformWrapper(doc, 'b1');
    expect(wrapperId).not.toBe('b1');
    const wrapper = doc.graph.get(wrapperId);
    expect(wrapper).toBeDefined();
    expect(wrapper!.type).toBe('transform');
    expect(wrapper!.getInputs()).toEqual(['b1']);
    expect(doc.rootIds).toEqual([wrapperId]);
  });

  it('создаёт обёртку и переподключает parent.inputs', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('g1', {}, ['b1', 's1']));
    doc.setRootIds(['g1']);

    const wrapperId = ensureTransformWrapper(doc, 'b1');
    expect(doc.graph.get('g1')!.getInputs()).toEqual([wrapperId, 's1']);
    expect(doc.graph.get(wrapperId)!.getInputs()).toEqual(['b1']);
  });
});

describe('computeFeatureBbox', () => {
  it('возвращает AABB c учётом halfHeight для box', () => {
    const doc = new FeatureDocument();
    // В Z-up Box: width=X, depth=Y, height=Z (вертикальная) → halfHeight = height/2.
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 30, depth: 20 }));
    doc.setRootIds(['b1']);

    const bbox = computeFeatureBbox(doc, 'b1');
    expect(bbox).not.toBeNull();
    expect(bbox!.min.z).toBeCloseTo(0, 5);
    expect(bbox!.max.z).toBeCloseTo(30, 5);
  });

  it('применяет transform-position', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [100, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.setRootIds(['t1']);

    const bbox = computeFeatureBbox(doc, 't1');
    expect(bbox).not.toBeNull();
    expect(bbox!.min.x).toBeCloseTo(95, 5);
    expect(bbox!.max.x).toBeCloseTo(105, 5);
  });
});

describe('cloneFeatureSubgraph', () => {
  it('клонирует одиночный примитив с новым id', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    const { rootId, addedIds } = cloneFeatureSubgraph(doc, 'b1');
    expect(rootId).not.toBe('b1');
    expect(addedIds).toEqual([rootId]);
    expect(doc.graph.size()).toBe(2);
    const cloned = doc.graph.get(rootId);
    expect(cloned).toBeInstanceOf(BoxFeature);
    expect((cloned as BoxFeature).params.width).toBe(10);
  });

  it('клонирует Transform-обёртку c inner Box и переподключает inputs', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [10, 20, 30], rotation: [0, 0, 0], scale: [2, 2, 2],
    }, ['b1']));
    doc.setRootIds(['t1']);

    const { rootId, addedIds } = cloneFeatureSubgraph(doc, 't1');
    expect(addedIds.length).toBe(2);
    expect(doc.graph.size()).toBe(4);

    const clonedTransform = doc.graph.get(rootId) as TransformFeature;
    expect(clonedTransform.type).toBe('transform');
    expect(clonedTransform.params.position).toEqual([10, 20, 30]);
    // inputs переподключены на клонированный Box, не на оригинал.
    const clonedInner = clonedTransform.getInputs()[0];
    expect(clonedInner).not.toBe('b1');
    expect(addedIds).toContain(clonedInner);
  });

  it('клонированные фичи не имеют ссылок на оригиналы', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('g1', {}, ['b1', 's1']));
    doc.setRootIds(['g1']);

    const { rootId, addedIds } = cloneFeatureSubgraph(doc, 'g1');
    const cloned = doc.graph.get(rootId) as GroupFeature;
    const inputs = cloned.getInputs();
    expect(inputs.length).toBe(2);
    expect(inputs[0]).not.toBe('b1');
    expect(inputs[1]).not.toBe('s1');
    for (const id of inputs) expect(addedIds).toContain(id);
  });
});

describe('computeFeatureBboxRecursive', () => {
  it('возвращает union AABB всех детей у GroupFeature', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [-50, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.addFeature(new BoxFeature('b2', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t2', {
      position: [50, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b2']));
    doc.addFeature(new GroupFeature('g1', {}, ['t1', 't2']));
    doc.setRootIds(['g1']);

    const bbox = computeFeatureBboxRecursive(doc, 'g1');
    expect(bbox).not.toBeNull();
    expect(bbox!.min.x).toBeCloseTo(-55, 5);
    expect(bbox!.max.x).toBeCloseTo(55, 5);
  });
});
