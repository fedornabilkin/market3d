import { describe, it, expect } from 'vitest';
import type {
  ModelTreeJSON,
  PrimitiveNodeJSON,
  GroupNodeJSON,
  ImportedMeshNodeJSON,
} from '../../types';
import { migrateLegacyTreeToDocument, type MigrationTrace } from './migrateLegacyTree';

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
  it('maps non-root GroupNode to BooleanFeature with operation', () => {
    // Non-root subtract: оборачиваем в root union, чтобы попало в realistic
    // сценарий (корень в Constructor.vue всегда — root union).
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [{
        kind: 'group',
        operation: 'subtract',
        children: [
          { kind: 'primitive', type: 'box', params: { width: 10 } },
          { kind: 'primitive', type: 'sphere', params: { radius: 4 } },
        ],
      }],
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    const bool = doc.features.find((f) => f.type === 'boolean')!;
    expect(bool.params).toMatchObject({ operation: 'subtract' });
    expect(bool.inputs).toHaveLength(2);

    const childTypes = bool.inputs!.map(
      (id) => doc.features.find((f) => f.id === id)!.type,
    );
    expect(childTypes).toEqual(['box', 'sphere']);
    // Root — это GroupFeature (logical container), а не Boolean.
    const rootFeature = doc.features.find((f) => f.id === doc.rootIds[0])!;
    expect(rootFeature.type).toBe('group');
  });

  it('wraps NON-ROOT group in transform when it has nodeParams', () => {
    // 'union' без hole-детей → GroupFeature (logical container). Не-корневая
    // группа с nodeParams ОБОРАЧИВАЕТСЯ в Transform.
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [{
        kind: 'group',
        operation: 'union',
        children: [{ kind: 'primitive', type: 'box', params: { width: 5 } }],
        nodeParams: { position: { x: 10, y: 0, z: 0 } },
      }],
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    const xf = doc.features.find((f) => f.type === 'transform')!;
    expect(xf).toBeDefined();
    expect(xf.params).toMatchObject({ position: [10, 0, 0] });
  });

  it('union без hole-детей → GroupFeature (logical container)', () => {
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [
        { kind: 'primitive', type: 'box', params: { width: 1 } },
        { kind: 'primitive', type: 'sphere', params: { radius: 1 } },
      ],
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    const types = doc.features.map((f) => f.type);
    expect(types).toContain('group');
    expect(types).not.toContain('boolean');
    const grp = doc.features.find((f) => f.type === 'group')!;
    expect(grp.inputs).toHaveLength(2);
    expect(doc.rootIds).toEqual([grp.id]);
  });

  it('non-root union с hole-ребёнком → BooleanFeature (нужен CSG)', () => {
    // Non-root union с hole-ребёнком: оборачиваем во внешний root.
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [{
        kind: 'group',
        operation: 'union',
        children: [
          { kind: 'primitive', type: 'box', params: { width: 10 } },
          {
            kind: 'primitive', type: 'cylinder',
            params: { radiusTop: 2, radiusBottom: 2, height: 12 },
            nodeParams: { isHole: true },
          },
        ],
      }],
    };
    const doc = migrateLegacyTreeToDocument(legacy);

    const bool = doc.features.find((f) => f.type === 'boolean')!;
    expect(bool.params).toMatchObject({ operation: 'union' });
    expect(bool.inputs).toHaveLength(2);
  });

  it('non-root subtract/intersect всегда → BooleanFeature', () => {
    for (const op of ['subtract', 'intersect'] as const) {
      const legacy: GroupNodeJSON = {
        kind: 'group',
        operation: 'union',
        children: [{
          kind: 'group',
          operation: op,
          children: [
            { kind: 'primitive', type: 'box', params: { width: 5 } },
            { kind: 'primitive', type: 'sphere', params: { radius: 3 } },
          ],
        }],
      };
      const doc = migrateLegacyTreeToDocument(legacy);
      const bool = doc.features.find((f) => f.type === 'boolean')!;
      expect(bool.params).toMatchObject({ operation: op });
    }
  });

  it('root nodeParams (position/rotation/scale) ИГНОРИРУЮТСЯ при миграции', () => {
    // Случайно выставленные на корне трансформации (могли «протечь» от
    // mirror/rotate с выделенным root) НЕ должны рендериться через Transform —
    // иначе вся сцена едет/крутится. Migrator выкидывает root.nodeParams.
    const legacy: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [{ kind: 'primitive', type: 'box', params: { width: 10 } }],
      nodeParams: {
        position: { x: 209, y: 29, z: 9 },
        rotation: { x: -Math.PI, y: 0, z: -Math.PI },
      },
    };
    const doc = migrateLegacyTreeToDocument(legacy);
    // Никаких Transform-фич: root → GroupFeature, его дети — без Transform-обёртки.
    const transforms = doc.features.filter((f) => f.type === 'transform');
    expect(transforms).toHaveLength(0);
    const root = doc.features.find((f) => f.id === doc.rootIds[0])!;
    expect(root.type).toBe('group');
  });

  it('root group ВСЕГДА → GroupFeature (как legacy isRoot=true container)', () => {
    // Hole-ребёнок в корне — НЕ должен запускать CSG: легси `isRoot=true`
    // вынуждает renderAsContainer=true. Иначе одиночный hole-примитив
    // моментально вычитался бы из ничего и исчезал.
    const legacyWithHole: GroupNodeJSON = {
      kind: 'group',
      operation: 'union',
      children: [{
        kind: 'primitive',
        type: 'cylinder',
        params: { radiusTop: 5, radiusBottom: 5, height: 10 },
        nodeParams: { isHole: true },
      }],
    };
    const doc = migrateLegacyTreeToDocument(legacyWithHole);
    const root = doc.features.find((f) => f.id === doc.rootIds[0])!;
    expect(root.type).toBe('group');
    expect(doc.features.find((f) => f.type === 'boolean')).toBeUndefined();
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

describe('migrateLegacyTreeToDocument: trace', () => {
  it('записывает featureId → source ModelTreeJSON для одиночного примитива', () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10 },
    };
    const trace: MigrationTrace = new Map();
    const doc = migrateLegacyTreeToDocument(legacy, trace);

    expect(trace.size).toBe(1);
    const featureId = doc.features[0].id;
    expect(trace.get(featureId)).toBe(legacy);
  });

  it('обе фичи (semantic + Transform) указывают на один legacy-узел', () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10 },
      nodeParams: { position: { x: 5, y: 0, z: 0 } },
    };
    const trace: MigrationTrace = new Map();
    const doc = migrateLegacyTreeToDocument(legacy, trace);

    expect(doc.features).toHaveLength(2);
    expect(trace.size).toBe(2);
    for (const f of doc.features) {
      expect(trace.get(f.id)).toBe(legacy);
    }
  });

  it('каждый легаси-узел вложенного дерева обнаруживается в trace', () => {
    const inner1: ModelTreeJSON = { kind: 'primitive', type: 'box', params: { width: 1 } };
    const inner2: ModelTreeJSON = {
      kind: 'primitive',
      type: 'sphere',
      params: { radius: 1 },
      nodeParams: { position: { x: 0, y: 1, z: 0 } },
    };
    const grp: ModelTreeJSON = {
      kind: 'group',
      operation: 'subtract',
      children: [inner1, inner2],
    };
    const trace: MigrationTrace = new Map();
    migrateLegacyTreeToDocument(grp, trace);

    // У каждого легаси-узла должна быть хотя бы одна фича в trace.
    const traceSources = new Set(trace.values());
    expect(traceSources.has(inner1)).toBe(true);
    expect(traceSources.has(inner2)).toBe(true);
    expect(traceSources.has(grp)).toBe(true);
  });

  it('trace опционален — без него миграция работает как раньше', () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'sphere',
      params: { radius: 5 },
    };
    const doc = migrateLegacyTreeToDocument(legacy);
    expect(doc.features).toHaveLength(1);
  });
});
