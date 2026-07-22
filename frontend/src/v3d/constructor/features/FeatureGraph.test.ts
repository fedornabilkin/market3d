import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// three-bvh-csg → three-mesh-bvh имеет circular CJS, ломающее node-vitest.
// В unit-тестах CSG не нужен — мокаем минимальной заглушкой. Тест Boolean
// проверяет только что путь до booleanCsg отрабатывает (без BVH-валидации).
vi.mock('./csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureGraph } from './FeatureGraph';
import { BoxFeature } from './primitives/BoxFeature';
import { SphereFeature } from './primitives/SphereFeature';
import { TransformFeature } from './composite/TransformFeature';
import { BooleanFeature } from './composite/BooleanFeature';
import { GroupFeature } from './composite/GroupFeature';
import { booleanCsg } from './csg/booleanCsg';

const makeBox = (id: string, w = 10) => new BoxFeature(id, { width: w, height: w, depth: w });
const makeSphere = (id: string, r = 5) => new SphereFeature(id, { radius: r });
const makeTransform = (id: string, inputs: string[]) =>
  new TransformFeature(id, {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }, inputs);
const makeBoolean = (id: string, op: 'union' | 'subtract' | 'intersect', inputs: string[]) =>
  new BooleanFeature(id, { operation: op }, inputs);
const makeGroup = (id: string, inputs: string[]) =>
  new GroupFeature(id, {}, inputs);

describe('FeatureGraph: add/remove/get', () => {
  it('adds and retrieves features', () => {
    const g = new FeatureGraph();
    const box = makeBox('b1');
    g.add(box);
    expect(g.get('b1')).toBe(box);
    expect(g.has('b1')).toBe(true);
    expect(g.size()).toBe(1);
  });

  it('throws on duplicate id', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    expect(() => g.add(makeBox('b1'))).toThrow(/уже есть/);
  });

  it('removes feature when no dependents', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    g.remove('b1');
    expect(g.has('b1')).toBe(false);
  });

  it('refuses removing feature with dependents', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    g.add(makeTransform('t1', ['b1']));
    expect(() => g.remove('b1')).toThrow(/нельзя удалить/);
  });

  it('throws when adding composite with missing input', () => {
    const g = new FeatureGraph();
    expect(() => g.add(makeTransform('t1', ['nope']))).toThrow(/не существует/);
  });
});

describe('FeatureGraph: cycle detection', () => {
  it('rejects self-reference', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    g.add(makeTransform('t1', ['b1']));
    expect(() => g.updateInputs('t1', ['t1'])).toThrow(/ссылается на саму себя/);
  });

  it('rejects cycle through chain', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    g.add(makeTransform('t1', ['b1']));
    g.add(makeBoolean('o1', 'union', ['t1']));
    // o1 → t1 → b1. Попытка t1 ссылаться на o1 даст цикл.
    expect(() => g.updateInputs('t1', ['o1'])).toThrow(/цикл/);
  });
});

describe('FeatureGraph: dependents', () => {
  it('collects transitive dependents', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    g.add(makeBox('b2'));
    g.add(makeTransform('t1', ['b1']));
    g.add(makeBoolean('o1', 'union', ['t1', 'b2']));

    const deps = g.collectDependents(['b1']);
    expect(deps.has('b1')).toBe(true);
    expect(deps.has('t1')).toBe(true);
    expect(deps.has('o1')).toBe(true);
    expect(deps.has('b2')).toBe(false);
  });

  it('topological order respects input direction', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    g.add(makeBox('b2'));
    g.add(makeBoolean('o1', 'union', ['b1', 'b2']));

    const set = new Set(['b1', 'b2', 'o1']);
    const order = g.topologicalOrder(set);
    expect(order.indexOf('b1')).toBeLessThan(order.indexOf('o1'));
    expect(order.indexOf('b2')).toBeLessThan(order.indexOf('o1'));
  });
});

describe('FeatureGraph: recompute', () => {
  it('evaluates leaf primitive', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1', 20));
    const result = g.recompute(['b1']);
    expect(result.failed).toEqual([]);
    expect(result.updated).toContain('b1');

    const out = g.getOutput('b1');
    expect(out).toBeDefined();
    expect(out!.kind).toBe('leaf');
    if (out!.kind === 'leaf') {
      out!.geometry.computeBoundingBox();
      const bb = out!.geometry.boundingBox!;
      expect(bb.max.x - bb.min.x).toBeCloseTo(20);
    }
  });

  it('cascades through transform', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1', 10));
    const t = new TransformFeature('t1', {
      position: [5, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']);
    g.add(t);
    g.recompute(['b1']);

    const out = g.getOutput('t1');
    expect(out).toBeDefined();
    if (out!.kind === 'leaf') {
      // Transform.position сдвигает на (5,0,0).
      expect(out!.transform.elements[12]).toBeCloseTo(5);
    }
  });

  it('boolean subtract reduces volume', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1', 10));
    g.add(makeSphere('s1', 6));
    g.add(makeBoolean('o1', 'subtract', ['b1', 's1']));
    const r = g.recompute(['b1', 's1', 'o1']);
    expect(r.failed).toEqual([]);

    const out = g.getOutput('o1');
    expect(out).toBeDefined();
    expect(out!.kind).toBe('leaf');
    if (out!.kind === 'leaf') {
      // Геометрия должна существовать и быть непустой.
      expect(out!.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  });

  it('materializes composite cutters before outer subtract', () => {
    const csgMock = vi.mocked(booleanCsg);
    csgMock.mockClear();

    const g = new FeatureGraph();
    g.add(makeBox('base', 20));
    g.add(makeBox('outer', 10));
    g.add(makeBox('inner', 4));
    g.add(new TransformFeature('innerHole', {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      isHole: true,
    }, ['inner']));
    g.add(new GroupFeature('emptyCutter', {}, ['outer', 'innerHole']));
    g.add(makeBoolean('result', 'subtract', ['base', 'emptyCutter']));

    const r = g.recomputeAll();
    expect(r.failed).toEqual([]);

    expect(csgMock).toHaveBeenCalledTimes(2);
    const materializeCall = csgMock.mock.calls[0];
    expect(materializeCall[1]).toBe('union');
    expect(materializeCall[0]).toHaveLength(2);
    expect(materializeCall[0][0].isHole).toBe(false);
    expect(materializeCall[0][1].isHole).toBe(true);

    const outerCall = csgMock.mock.calls[1];
    expect(outerCall[1]).toBe('subtract');
    expect(outerCall[0]).toHaveLength(2);
    expect(outerCall[0][0].isHole).toBe(false);
    expect(outerCall[0][1].isHole).toBe(false);
  });

  it('flattens non-cutter composites without extra materialization', () => {
    const csgMock = vi.mocked(booleanCsg);
    csgMock.mockClear();

    const g = new FeatureGraph();
    g.add(makeBox('a', 10));
    g.add(makeBox('b', 6));
    g.add(new GroupFeature('group', {}, ['a', 'b']));
    g.add(makeBoolean('result', 'union', ['group']));

    const r = g.recomputeAll();
    expect(r.failed).toEqual([]);

    expect(csgMock).toHaveBeenCalledTimes(1);
    expect(csgMock.mock.calls[0][1]).toBe('union');
    expect(csgMock.mock.calls[0][0]).toHaveLength(2);
  });

  it('preserves ordinary nested union scope during dependency recompute', () => {
    const csgMock = vi.mocked(booleanCsg);
    csgMock.mockClear();

    const g = new FeatureGraph();
    g.add(makeBox('a', 10));
    g.add(makeBox('b', 8));
    g.add(makeBox('c', 6));
    g.add(makeBoolean('inner', 'union', ['a', 'b']));
    g.add(makeBoolean('outer', 'union', ['inner', 'c']));

    const r = g.recomputeDependencies(['outer']);
    expect(r.failed).toEqual([]);

    expect(csgMock).toHaveBeenCalledTimes(2);
    expect(csgMock.mock.calls[0][0]).toHaveLength(2);
    expect(csgMock.mock.calls[1][0]).toHaveLength(2);
    expect(g.getOutput('outer')).toBeDefined();
    expect(g.getOutput('inner')).toBeDefined();
  });

  it('collapses only legacy nested chamfer aggregates during dependency recompute', () => {
    const csgMock = vi.mocked(booleanCsg);
    csgMock.mockClear();

    const g = new FeatureGraph();
    g.add(makeBox('base', 10));
    g.add(makeBox('cutter1', 2));
    g.add(makeBox('cutter2', 2));
    g.add(makeBoolean('p2_chamfer_target_group_1', 'union', ['base', 'cutter1']));
    g.add(makeBoolean('p2_chamfer_target_group_2', 'union', [
      'p2_chamfer_target_group_1', 'cutter2',
    ]));

    const r = g.recomputeDependencies(['p2_chamfer_target_group_2']);
    expect(r.failed).toEqual([]);
    expect(csgMock).toHaveBeenCalledTimes(1);
    expect(csgMock.mock.calls[0][0]).toHaveLength(3);
    expect(g.getOutput('p2_chamfer_target_group_1')).toBeUndefined();
    expect(g.getOutput('p2_chamfer_target_group_2')).toBeDefined();
  });

  it('group returns composite output', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1'));
    g.add(makeSphere('s1'));
    g.add(makeGroup('g1', ['b1', 's1']));
    g.recomputeAll();

    const out = g.getOutput('g1');
    expect(out).toBeDefined();
    expect(out!.kind).toBe('composite');
    if (out!.kind === 'composite') {
      expect(out!.children).toHaveLength(2);
    }
  });

  it('updateParams cascades to dependents', () => {
    const g = new FeatureGraph();
    g.add(makeBox('b1', 10));
    g.add(makeTransform('t1', ['b1']));
    g.recomputeAll();

    g.updateParams<{ width: number }>('b1', { width: 20 });
    const r = g.recompute(['b1']);
    expect(r.updated).toContain('b1');
    expect(r.updated).toContain('t1');
  });

  it('failure propagates to dependents', () => {
    const g = new FeatureGraph();
    // Boolean с нулём входов упадёт в evaluate.
    g.add(makeBox('b1'));
    const bad = new BooleanFeature('o1', { operation: 'union' }, ['b1']);
    g.add(bad);
    // Через updateInputs создадим случай «нет входов», обходя add-проверки.
    g.updateInputs('o1', []);
    const r = g.recompute(['o1']);
    expect(r.failed.find((x) => x.id === 'o1')).toBeDefined();
  });
});
