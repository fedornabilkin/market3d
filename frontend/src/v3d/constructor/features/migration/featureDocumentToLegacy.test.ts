import { describe, it, expect } from 'vitest';
import type { ModelTreeJSON } from '../../types';
import { migrateLegacyTreeToDocument } from './migrateLegacyTree';
import { featureDocumentToLegacy } from './featureDocumentToLegacy';

/**
 * Round-trip identity: legacy → migrate → reverse → должен совпадать с
 * исходным legacy. Это инвариант для всех документов, происходящих из
 * легаси-миграции.
 */
function roundTrip(legacy: ModelTreeJSON): ModelTreeJSON {
  const v2 = migrateLegacyTreeToDocument(legacy);
  return featureDocumentToLegacy(v2);
}

describe('featureDocumentToLegacy: primitives', () => {
  it('round-trips a primitive without nodeParams', () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10, height: 20, depth: 30 },
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips a primitive with nodeParams (transform-wrapped)', () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'box',
      params: { width: 10, height: 10, depth: 10 },
      nodeParams: {
        position: { x: 5, y: 0, z: 0 },
        isHole: true,
        color: '#ff0000',
      },
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips thread with profile rename', () => {
    const legacy: ModelTreeJSON = {
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
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips knurl with pattern/angle renames', () => {
    const legacy: ModelTreeJSON = {
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
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips primitive with name', () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'sphere',
      params: { radius: 5 },
      name: 'My Sphere',
      nodeParams: { position: { x: 1, y: 2, z: 3 } },
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips primitive with full transform (position+rotation+scale)', () => {
    const legacy: ModelTreeJSON = {
      kind: 'primitive',
      type: 'cylinder',
      params: { radiusTop: 5, radiusBottom: 5, height: 20 },
      nodeParams: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.5, y: 0, z: 1.5 },
        scale: { x: 1, y: 2, z: 1 },
      },
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });
});

describe('featureDocumentToLegacy: imported', () => {
  it('round-trips imported with binaryRef', () => {
    const legacy: ModelTreeJSON = {
      kind: 'imported',
      filename: 'part.stl',
      stlBase64: '',
      binaryRef: 'idb-key-1',
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips imported with stlBase64 (legacy)', () => {
    const legacy: ModelTreeJSON = {
      kind: 'imported',
      filename: 'old.stl',
      stlBase64: 'AAAA',
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips imported with name and color', () => {
    const legacy: ModelTreeJSON = {
      kind: 'imported',
      filename: 'mesh.stl',
      stlBase64: '',
      binaryRef: 'k1',
      name: 'Imported part',
      nodeParams: { color: '#00ff00', position: { x: 10, y: 0, z: 0 } },
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });
});

describe('featureDocumentToLegacy: groups', () => {
  it('round-trips a CSG group of primitives', () => {
    const legacy: ModelTreeJSON = {
      kind: 'group',
      operation: 'subtract',
      children: [
        { kind: 'primitive', type: 'box', params: { width: 10 } },
        { kind: 'primitive', type: 'sphere', params: { radius: 4 } },
      ],
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips group with nodeParams (wrapped transform)', () => {
    const legacy: ModelTreeJSON = {
      kind: 'group',
      operation: 'union',
      children: [{ kind: 'primitive', type: 'box', params: { width: 5 } }],
      nodeParams: { position: { x: 10, y: 0, z: 0 } },
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('round-trips deeply nested groups', () => {
    const legacy: ModelTreeJSON = {
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
    expect(roundTrip(legacy)).toEqual(legacy);
  });

  it('preserves group operation: intersect', () => {
    const legacy: ModelTreeJSON = {
      kind: 'group',
      operation: 'intersect',
      children: [
        { kind: 'primitive', type: 'box', params: { width: 10 } },
        { kind: 'primitive', type: 'box', params: { width: 5 } },
      ],
    };
    expect(roundTrip(legacy)).toEqual(legacy);
  });
});

describe('featureDocumentToLegacy: error cases', () => {
  it('throws on wrong version', () => {
    expect(() =>
      featureDocumentToLegacy({ version: 1 as 2, features: [], rootIds: ['x'] }),
    ).toThrow();
  });

  it('throws on missing rootId', () => {
    expect(() =>
      featureDocumentToLegacy({
        version: 2,
        features: [{ id: 'a', type: 'box', params: { width: 1 } }],
        rootIds: [],
      }),
    ).toThrow();
  });

  it('throws on referenced feature missing', () => {
    expect(() =>
      featureDocumentToLegacy({
        version: 2,
        features: [
          {
            id: 't',
            type: 'transform',
            params: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            inputs: ['ghost'],
          },
        ],
        rootIds: ['t'],
      }),
    ).toThrow();
  });
});
