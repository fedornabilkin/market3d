import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import type { ModelTreeJSON } from '../../types';
import type { FeatureDocumentJSON } from '../types';
import { loadFeatureDocument } from './loadFeatureDocument';

describe('loadFeatureDocument: version routing', () => {
  it('loads native v2 JSON without migration', async () => {
    const json: FeatureDocumentJSON = {
      version: 2,
      features: [
        { id: 'b1', type: 'box', params: { width: 10, height: 10, depth: 10 } },
      ],
      rootIds: ['b1'],
    };
    const doc = await loadFeatureDocument(json);
    expect(doc.graph.has('b1')).toBe(true);
    expect(doc.rootIds).toEqual(['b1']);
    expect(doc.getOutput('b1')).toBeTruthy();
  });

  it('migrates legacy v1 ModelTreeJSON to v2 then loads', async () => {
    const legacy: ModelTreeJSON = {
      kind: 'group',
      operation: 'union',
      children: [
        { kind: 'primitive', type: 'box', params: { width: 10, height: 10, depth: 10 } },
        {
          kind: 'primitive',
          type: 'sphere',
          params: { radius: 5 },
          nodeParams: { position: { x: 5, y: 0, z: 0 } },
        },
      ],
      // coordsConvention отсутствует → должна сработать Y↔Z миграция
    };
    const doc = await loadFeatureDocument(legacy);

    // После миграции должны появиться: BoxFeature, SphereFeature, Transform
    // (для sphere), GroupFeature (root, т.к. union без hole-детей).
    expect(doc.graph.size()).toBeGreaterThanOrEqual(4);
    expect(doc.rootIds).toHaveLength(1);

    // Ровно 1 group — это новый корень (union без holes → GroupFeature).
    const types = [...doc.graph.values()].map((f) => f.type);
    expect(types.filter((t) => t === 'group')).toHaveLength(1);
    expect(types.filter((t) => t === 'boolean')).toHaveLength(0);
  });

  it('parses string JSON input', async () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 5, height: 5, depth: 5 },
    };
    const doc = await loadFeatureDocument(JSON.stringify(legacy));
    expect(doc.graph.size()).toBe(1);
    const root = [...doc.graph.values()][0];
    expect(root.type).toBe('box');
  });

  it('applies Y↔Z swap on legacy without coordsConvention', async () => {
    // Legacy Y-up: position.y был «вверх».
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10, height: 10, depth: 10 },
      nodeParams: { position: { x: 0, y: 7, z: 3 } },
    };
    const doc = await loadFeatureDocument(legacy);

    // После Y↔Z миграции y=7 уехал в z, z=3 в y → position в Transform: [0, 3, 7].
    const xf = [...doc.graph.values()].find((f) => f.type === 'transform')!;
    expect((xf.params as { position: number[] }).position).toEqual([0, 3, 7]);
  });

  it('does not swap coords if coordsConvention is already zup', async () => {
    const legacy = {
      kind: 'primitive',
      type: 'box',
      params: { width: 1, height: 1, depth: 1 },
      nodeParams: { position: { x: 0, y: 5, z: 9 } },
      coordsConvention: 'zup',
    } as unknown as ModelTreeJSON;

    const doc = await loadFeatureDocument(legacy);
    const xf = [...doc.graph.values()].find((f) => f.type === 'transform')!;
    expect((xf.params as { position: number[] }).position).toEqual([0, 5, 9]);
  });

  it('throws on unknown future version', async () => {
    const json = {
      version: 999,
      features: [],
      rootIds: [],
    } as unknown as FeatureDocumentJSON;
    await expect(loadFeatureDocument(json)).rejects.toThrow();
  });
});
