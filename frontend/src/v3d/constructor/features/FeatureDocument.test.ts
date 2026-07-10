import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// См. FeatureGraph.test.ts — мокаем CSG, чтобы не тянуть BVH в node.
vi.mock('./csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from './FeatureDocument';
import { booleanCsg } from './csg/booleanCsg';
import { BoxFeature } from './primitives/BoxFeature';
import { SphereFeature } from './primitives/SphereFeature';
import { TransformFeature } from './composite/TransformFeature';
import { BooleanFeature } from './composite/BooleanFeature';
import { GroupFeature } from './composite/GroupFeature';

describe('FeatureDocument: events', () => {
  it('fires events on add/update/remove', () => {
    const doc = new FeatureDocument();
    const events: string[] = [];
    doc.subscribe((e) => events.push(e.type));

    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    expect(events).toContain('feature-added');
    expect(events).toContain('recompute-done');

    doc.updateParams<{ width: number }>('b1', { width: 20 });
    expect(events.filter((t) => t === 'feature-updated')).toHaveLength(1);

    doc.removeFeature('b1');
    expect(events).toContain('feature-removed');
  });

  it('skips emit when params not changed', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    const fn = vi.fn();
    doc.subscribe(fn);
    doc.updateParams('b1', { width: 10 }); // тот же width — не должно эмитить
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('FeatureDocument: serialization', () => {
  it('round-trips a complex graph', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [5, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.addFeature(new BooleanFeature('o1', { operation: 'subtract' }, ['t1', 's1']));
    doc.setRootIds(['o1']);

    const json = doc.toJSON();
    expect(json.version).toBe(2);
    expect(json.features).toHaveLength(4);
    expect(json.rootIds).toEqual(['o1']);

    const restored = FeatureDocument.fromJSON(json);
    expect(restored.graph.size()).toBe(4);
    expect(restored.rootIds).toEqual(['o1']);
    expect(restored.graph.get('o1')!.getInputs()).toEqual(['t1', 's1']);
    // После fromJSON должен быть выполнен recomputeAll.
    expect(restored.getOutput('o1')).toBeDefined();
  });

  it('preserves feature order in json topologically', () => {
    const doc = new FeatureDocument();
    // Добавляем в произвольном порядке (зависимости создаём через композиты).
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new GroupFeature('g1', {}, ['b1']));
    doc.setRootIds(['g1']);
    const json = doc.toJSON();
    // SerializeVisitor обходит graph.values() — порядок Map'а вставки.
    // fromJSON сортирует по inputs, поэтому ребёнок раньше родителя:
    const restored = FeatureDocument.fromJSON(json);
    expect(restored.graph.has('b1')).toBe(true);
    expect(restored.graph.has('g1')).toBe(true);
    expect(restored.graph.get('g1')!.getInputs()).toEqual(['b1']);
  });

  it('loads only root-reachable outputs from json', () => {
    const csgMock = vi.mocked(booleanCsg);
    csgMock.mockClear();

    const restored = FeatureDocument.fromJSON({
      version: 2,
      features: [
        { id: 'root_box', type: 'box', params: { width: 10, height: 10, depth: 10 } },
        { id: 'unused_a', type: 'box', params: { width: 10, height: 10, depth: 10 } },
        { id: 'unused_b', type: 'box', params: { width: 5, height: 5, depth: 5 } },
        { id: 'unused_boolean', type: 'boolean', params: { operation: 'union' }, inputs: ['unused_a', 'unused_b'] },
      ],
      rootIds: ['root_box'],
    });

    expect(restored.graph.has('unused_boolean')).toBe(true);
    expect(restored.getOutput('root_box')).toBeDefined();
    expect(restored.getOutput('unused_boolean')).toBeUndefined();
    expect(csgMock).not.toHaveBeenCalled();
  });

  it('serializes only root-reachable features', () => {
    const restored = FeatureDocument.fromJSON({
      version: 2,
      features: [
        { id: 'root_box', type: 'box', params: { width: 10, height: 10, depth: 10 } },
        { id: 'unused_box', type: 'box', params: { width: 5, height: 5, depth: 5 } },
      ],
      rootIds: ['root_box'],
    });

    expect(restored.graph.has('unused_box')).toBe(true);
    expect(restored.toJSON().features.map((f) => f.id)).toEqual(['root_box']);
  });

  it('prunes unreachable features from the graph', () => {
    const restored = FeatureDocument.fromJSON({
      version: 2,
      features: [
        { id: 'root_box', type: 'box', params: { width: 10, height: 10, depth: 10 } },
        { id: 'unused_a', type: 'box', params: { width: 10, height: 10, depth: 10 } },
        { id: 'unused_b', type: 'box', params: { width: 5, height: 5, depth: 5 } },
        { id: 'unused_group', type: 'group', params: {}, inputs: ['unused_a', 'unused_b'] },
      ],
      rootIds: ['root_box'],
    });

    const removed = restored.pruneUnreachable();
    expect(removed).toEqual(expect.arrayContaining(['unused_a', 'unused_b', 'unused_group']));
    expect(restored.graph.size()).toBe(1);
    expect(restored.graph.has('root_box')).toBe(true);
  });
});

describe('FeatureDocument: validate', () => {
  it('reports missing transform input', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new BoxFeature('b2', { width: 10, height: 10, depth: 10 }));
    // TransformFeature ожидает 1 вход, дадим 2.
    doc.addFeature(new TransformFeature('t1', {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1', 'b2']));

    const issues = doc.validate();
    expect(issues.find((i) => i.featureId === 't1')).toBeDefined();
  });
});
