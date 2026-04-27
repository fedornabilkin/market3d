import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import type { FeatureDocumentJSON } from '../types';
import { loadFeatureDocument } from './loadFeatureDocument';

describe('loadFeatureDocument: v2-only', () => {
  it('loads native v2 JSON', async () => {
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

  it('parses string JSON input', async () => {
    const json: FeatureDocumentJSON = {
      version: 2,
      features: [
        { id: 'b1', type: 'box', params: { width: 5, height: 5, depth: 5 } },
      ],
      rootIds: ['b1'],
    };
    const doc = await loadFeatureDocument(JSON.stringify(json));
    expect(doc.graph.size()).toBe(1);
    const root = [...doc.graph.values()][0];
    expect(root.type).toBe('box');
  });

  it('throws on legacy v1 ModelTreeJSON (no version field)', async () => {
    const legacy = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10, height: 10, depth: 10 },
    } as unknown as FeatureDocumentJSON;
    await expect(loadFeatureDocument(legacy)).rejects.toThrow();
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
