import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../features/csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from '../features/FeatureDocument';
import { BoxFeature } from '../features/primitives/BoxFeature';
import { TransformFeature } from '../features/composite/TransformFeature';
import { AlignmentFeatureOperation, type AlignMode } from './AlignmentFeatureOperation';

function makeDoc(): { doc: FeatureDocument; b1: string; b2: string; t1: string; t2: string } {
  const doc = new FeatureDocument();
  doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
  doc.addFeature(new TransformFeature('t1', {
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  }, ['b1']));
  doc.addFeature(new BoxFeature('b2', { width: 20, height: 20, depth: 20 }));
  doc.addFeature(new TransformFeature('t2', {
    position: [100, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  }, ['b2']));
  doc.setRootIds(['t1', 't2']);
  return { doc, b1: 'b1', b2: 'b2', t1: 't1', t2: 't2' };
}

describe('AlignmentFeatureOperation.computeAxisValue', () => {
  it('возвращает center/min/max по моду', () => {
    const box = new THREE.Box3(new THREE.Vector3(-5, -10, -2), new THREE.Vector3(5, 10, 8));
    expect(AlignmentFeatureOperation.computeAxisValue(box, 'minX')).toBe(-5);
    expect(AlignmentFeatureOperation.computeAxisValue(box, 'maxX')).toBe(5);
    expect(AlignmentFeatureOperation.computeAxisValue(box, 'centerY')).toBe(0);
    expect(AlignmentFeatureOperation.computeAxisValue(box, 'minZ')).toBe(-2);
  });
});

describe('AlignmentFeatureOperation.run', () => {
  it('сдвигает t2 так, чтобы centerX совпал с anchor (t1)', () => {
    const { doc, t1, t2 } = makeDoc();
    // bbox из mock: t1 центр X=0, t2 центр X=100. После centerX → t2.x = 0 (delta = -100).
    const ctx = {
      computeBboxByFeatureId: (id: string): THREE.Box3 | null => {
        if (id === t1) return new THREE.Box3(new THREE.Vector3(-5, -5, 0), new THREE.Vector3(5, 5, 10));
        if (id === t2) return new THREE.Box3(new THREE.Vector3(90, -10, 0), new THREE.Vector3(110, 10, 20));
        return null;
      },
    };
    const op = new AlignmentFeatureOperation(ctx);
    const ok = op.run(doc, [t1, t2], 'centerX' as AlignMode);
    expect(ok).toBe(true);
    const after = doc.graph.get(t2) as TransformFeature;
    expect(after.params.position[0]).toBeCloseTo(0, 5);
    expect(after.params.position[1]).toBe(0);
    expect(after.params.position[2]).toBe(0);
  });

  it('возвращает false при <2 фичах', () => {
    const { doc, t1 } = makeDoc();
    const op = new AlignmentFeatureOperation({ computeBboxByFeatureId: () => null });
    expect(op.run(doc, [t1], 'centerX')).toBe(false);
  });

  it('создаёт Transform-обёртку у leaf-фичи перед сдвигом', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new BoxFeature('b2', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1', 'b2']);
    const ctx = {
      computeBboxByFeatureId: (id: string): THREE.Box3 | null => {
        if (id === 'b1') return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));
        if (id === 'b2') return new THREE.Box3(new THREE.Vector3(50, 0, 0), new THREE.Vector3(60, 10, 10));
        return null;
      },
    };
    const op = new AlignmentFeatureOperation(ctx);
    const before = doc.graph.size();
    op.run(doc, ['b1', 'b2'], 'minX');
    expect(doc.graph.size()).toBe(before + 1);
  });
});
