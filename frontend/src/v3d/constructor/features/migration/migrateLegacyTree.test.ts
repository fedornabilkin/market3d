import { describe, it, expect } from 'vitest';
import type {
  PrimitiveNodeJSON,
  GroupNodeJSON,
  ImportedMeshNodeJSON,
} from '../../types';
import { migrateLegacyTreeToDocument } from './migrateLegacyTree';

describe('migrateLegacyTreeToDocument: primitives', () => {
  it('migrates a primitive without nodeParams to a single feature', () => {
    const legacy: PrimitiveNodeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10, height: 20, depth: 30 },
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    expect(doc.version).toBe(2);
    expect(doc.features).toHaveLength(1);
    expect(doc.rootIds).toEqual([doc.features[0].id]);
    const f = doc.features[0];
    expect(f.type).toBe('box');
    expect(f.params).toEqual({ width: 10, height: 20, depth: 30 });
    expect(f.inputs).toBeUndefined();
  });

  it('wraps primitive in transform when nodeParams non-trivial', () => {
    const legacy: PrimitiveNodeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10, height: 10, depth: 10 },
      nodeParams: {
        position: { x: 5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        isHole: true,
        color: '#ff0000',
      },
    };
    const doc = migrateLegacyTreeToDocument(legacy);
    expect(doc.features).toHaveLength(2);

    const box = doc.features.find((f) => f.type === 'box')!;
    const xf = doc.features.find((f) => f.type === 'transform')!;
    expect(box.params).toMatchObject({ width: 10, color: '#ff0000' });
    expect(xf.inputs).toEqual([box.id]);
    expect(xf.params).toMatchObject({
      position: [5, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      isHole: true,
    });
    expect(doc.rootIds).toEqual([xf.id]);
  });

  it('renames thread/knurl legacy fields', () => {
    const thread: PrimitiveNodeJSON = {
      kind: 'primitive',
      type: 'thread',
      params: {
        outerDiameter: 10,
        innerDiameter: 8,
        pitch: 1,
        turns: 5,
        threadProfile: 'trapezoid',
      },
    };
    const knurl: PrimitiveNodeJSON = {
      kind: 'primitive',
      type: 'knurl',
      params: {
        outerDiameter: 10,
        innerDiameter: 9,
        height: 5,
        notchCount: 24,
        knurlPattern: 'diamond',
        knurlAngle: 45,
      },
    };
    const dThread = migrateLegacyTreeToDocument(thread);
    const dKnurl = migrateLegacyTreeToDocument(knurl);

    expect(dThread.features[0].params).toMatchObject({ profile: 'trapezoid' });
    expect(dThread.features[0].params).not.toHaveProperty('threadProfile');

    expect(dKnurl.features[0].params).toMatchObject({
      pattern: 'diamond',
      angle: 45,
    });
    expect(dKnurl.features[0].params).not.toHaveProperty('knurlPattern');
    expect(dKnurl.features[0].params).not.toHaveProperty('knurlAngle');
  });

  it('preserves legacy name on the primitive feature', () => {
    const legacy: PrimitiveNodeJSON = {
      kind: 'primitive',
      type: 'sphere',
      params: { radius: 5 },
      name: 'My Sphere',
      nodeParams: { position: { x: 1, y: 2, z: 3 } },
    };
    const doc = migrateLegacyTreeToDocument(legacy);
    const sphere = doc.features.find((f) => f.type === 'sphere')!;
    const xf = doc.features.find((f) => f.type === 'transform')!;
    expect(sphere.name).toBe('My Sphere');
    expect(xf.name).toBeUndefined();
  });
});

describe('migrateLegacyTreeToDocument: imported', () => {
  it('migrates imported mesh with binaryRef', () => {
    const legacy: ImportedMeshNodeJSON = {
      kind: 'imported',
      filename: 'part.stl',
      stlBase64: '',
      binaryRef: 'idb-key-1',
    };
    const doc = migrateLegacyTreeToDocument(legacy);
    expect(doc.features).toHaveLength(1);
    const f = doc.features[0];
    expect(f.type).toBe('imported');
    expect(f.params).toMatchObject({
      filename: 'part.stl',
      binaryRef: 'idb-key-1',
    });
    expect(f.params).not.toHaveProperty('stlBase64');
  });

  it('keeps stlBase64 for legacy imports without binaryRef', () => {
    const legacy: ImportedMeshNodeJSON = {
      kind: 'imported',
      filename: 'old.stl',
      stlBase64: 'AAAA',
    };
    const doc = migrateLegacyTreeToDocument(legacy);
    expect(doc.features[0].params).toMatchObject({
      filename: 'old.stl',
      stlBase64: 'AAAA',
    });
  });
});

describe('migrateLegacyTreeToDocument: groups', () => {
  it('maps GroupNode to BooleanFeature with operation', () => {
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'subtract',
      children: [
        { kind: 'primitive', type: 'box', params: { width: 10 } },
        { kind: 'primitive', type: 'sphere', params: { radius: 4 } },
      ],
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    const bool = doc.features.find((f) => f.type === 'boolean')!;
    expect(bool.params).toMatchObject({ operation: 'subtract' });
    expect(bool.inputs).toHaveLength(2);

    const childTypes = bool.inputs!.map(
      (id) => doc.features.find((f) => f.id === id)!.type,
    );
    expect(childTypes).toEqual(['box', 'sphere']);
    expect(doc.rootIds).toEqual([bool.id]);
  });

  it('wraps group in transform when group has nodeParams', () => {
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [{ kind: 'primitive', type: 'box', params: { width: 5 } }],
      nodeParams: { position: { x: 10, y: 0, z: 0 } },
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    const bool = doc.features.find((f) => f.type === 'boolean')!;
    const xf = doc.features.find((f) => f.type === 'transform')!;
    expect(xf.inputs).toEqual([bool.id]);
    expect(xf.params).toMatchObject({ position: [10, 0, 0] });
    expect(doc.rootIds).toEqual([xf.id]);
  });

  it('emits features in topo order (children before parents)', () => {
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [
        {
          kind: 'group',
          operation: 'subtract',
          children: [
            { kind: 'primitive', type: 'box', params: { width: 1 } },
            { kind: 'primitive', type: 'sphere', params: { radius: 1 } },
          ],
        },
        { kind: 'primitive', type: 'cylinder', params: { radiusTop: 1 } },
      ],
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    const idx = new Map(doc.features.map((f, i) => [f.id, i]));
    for (const f of doc.features) {
      for (const inp of f.inputs ?? []) {
        expect(idx.get(inp)!).toBeLessThan(idx.get(f.id)!);
      }
    }
  });
});
