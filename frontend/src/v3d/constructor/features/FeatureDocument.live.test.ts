import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('./csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument, type FeatureDocumentEvent } from './FeatureDocument';
import { BoxFeature } from './primitives/BoxFeature';
import { TransformFeature } from './composite/TransformFeature';

describe('FeatureDocument.updateParamsLive', () => {
  it('эмитит feature-updated, НЕ эмитит recompute-done', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.setRootIds(['t1']);

    const events: FeatureDocumentEvent[] = [];
    const unsub = doc.subscribe((e) => events.push(e));

    doc.updateParamsLive('t1', { position: [5, 0, 0] });

    unsub();
    const types = events.map((e) => e.type);
    expect(types).toContain('feature-updated');
    expect(types).not.toContain('recompute-done');
  });

  it('обновляет cachedOutput фичи (recomputeOne)', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new TransformFeature('t1', {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, ['b1']));
    doc.setRootIds(['t1']);

    const before = doc.getOutput('t1')!;
    const beforePos = new THREE.Vector3();
    before.transform.decompose(beforePos, new THREE.Quaternion(), new THREE.Vector3());
    expect(beforePos.x).toBeCloseTo(0);

    doc.updateParamsLive('t1', { position: [42, 0, 0] });

    const after = doc.getOutput('t1')!;
    const afterPos = new THREE.Vector3();
    after.transform.decompose(afterPos, new THREE.Quaternion(), new THREE.Vector3());
    expect(afterPos.x).toBeCloseTo(42);
  });

  it('идентичный примитивный patch — no-op (нет события)', () => {
    // Box: width — number. Тот же number проходит через `!==`-сравнение
    // как равный → no-op. (Для arrays будут разные ссылки → событие
    // отправится; это допустимо для live-drag-кадров.)
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    const events: FeatureDocumentEvent[] = [];
    doc.subscribe((e) => events.push(e));

    doc.updateParamsLive('b1', { width: 10 });
    expect(events).toHaveLength(0);

    doc.updateParamsLive('b1', { width: 25 });
    expect(events.map((e) => e.type)).toEqual(['feature-updated']);
  });
});
