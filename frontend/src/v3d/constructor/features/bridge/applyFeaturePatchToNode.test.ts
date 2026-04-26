import { describe, it, expect } from 'vitest';
import type { ModelNode } from '../../nodes/ModelNode';
import { applyFeaturePatchToNode } from './applyFeaturePatchToNode';

// duck-типизированные mock'и ModelNode-подклассов. Bridge использует
// duck-checks (см. applyFeaturePatchToNode.ts), поэтому реальные классы
// nodes/* не нужны и тест не тянет three-bvh-csg.

function makePrimitiveLike(type: string, geomParams: Record<string, unknown> = {}): ModelNode {
  return {
    children: [],
    operation: 'union',
    params: {},
    primitives: [],
    uuidMesh: '',
    name: '',
    type,
    geometryParams: { ...geomParams },
  } as unknown as ModelNode;
}

function makeImportedLike(filename: string): ModelNode {
  return {
    children: [],
    operation: 'union',
    params: {},
    primitives: [],
    uuidMesh: '',
    name: '',
    filename,
    geometry: {} as never,
  } as unknown as ModelNode;
}

function makeGroupLike(operation: 'union' | 'subtract' | 'intersect' = 'union'): ModelNode {
  return {
    children: [],
    operation,
    params: {},
    primitives: [],
    uuidMesh: '',
    name: '',
  } as unknown as ModelNode;
}

describe('applyFeaturePatchToNode: primitives', () => {
  it('записывает size-поля в geometryParams', () => {
    const node = makePrimitiveLike('box', { width: 10, height: 10, depth: 10 });
    const changed = applyFeaturePatchToNode(node, 'box', { width: 25 });
    expect(changed).toBe(true);
    expect((node as { geometryParams: { width: number } }).geometryParams.width).toBe(25);
    expect((node as { geometryParams: { height: number } }).geometryParams.height).toBe(10);
  });

  it('color уезжает в node.params, не в geometryParams', () => {
    const node = makePrimitiveLike('sphere', { radius: 5 });
    const changed = applyFeaturePatchToNode(node, 'sphere', { color: '#ff0000' });
    expect(changed).toBe(true);
    expect((node as { params: { color?: string } }).params.color).toBe('#ff0000');
    expect((node as { geometryParams: Record<string, unknown> }).geometryParams.color).toBeUndefined();
  });

  it('thread: profile → threadProfile (legacy rename)', () => {
    const node = makePrimitiveLike('thread', {});
    applyFeaturePatchToNode(node, 'thread', { profile: 'trapezoid' });
    expect((node as { geometryParams: { threadProfile?: string } }).geometryParams.threadProfile).toBe('trapezoid');
  });

  it('knurl: pattern/angle → knurlPattern/knurlAngle', () => {
    const node = makePrimitiveLike('knurl', {});
    applyFeaturePatchToNode(node, 'knurl', { pattern: 'diamond', angle: 45 });
    const gp = (node as { geometryParams: { knurlPattern?: string; knurlAngle?: number } }).geometryParams;
    expect(gp.knurlPattern).toBe('diamond');
    expect(gp.knurlAngle).toBe(45);
  });

  it('возвращает false если ничего не изменилось', () => {
    const node = makePrimitiveLike('box', { width: 10 });
    const changed = applyFeaturePatchToNode(node, 'box', { width: 10 });
    expect(changed).toBe(false);
  });

  it('undefined-значение очищает поле', () => {
    const node = makePrimitiveLike('box', { width: 10, bevelRadius: 0.5 });
    applyFeaturePatchToNode(node, 'box', { bevelRadius: undefined });
    expect((node as { geometryParams: { bevelRadius?: number } }).geometryParams.bevelRadius).toBeUndefined();
  });
});

describe('applyFeaturePatchToNode: transform', () => {
  it('position 3-tuple → node.params.position {x,y,z}', () => {
    const node = makePrimitiveLike('box');
    applyFeaturePatchToNode(node, 'transform', { position: [10, 20, 30] });
    expect((node as { params: { position?: { x: number; y: number; z: number } } })
      .params.position).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('rotation/scale аналогично', () => {
    const node = makePrimitiveLike('box');
    applyFeaturePatchToNode(node, 'transform', {
      rotation: [0, Math.PI / 2, 0],
      scale: [2, 1, 1],
    });
    const params = (node as { params: { rotation?: { y: number }; scale?: { x: number } } }).params;
    expect(params.rotation?.y).toBeCloseTo(Math.PI / 2);
    expect(params.scale?.x).toBe(2);
  });

  it('isHole → node.params.isHole', () => {
    const node = makePrimitiveLike('box');
    applyFeaturePatchToNode(node, 'transform', { isHole: true });
    expect((node as { params: { isHole?: boolean } }).params.isHole).toBe(true);
  });

  it('isHole=false → false (явное «не отверстие»), undefined → удаление', () => {
    const node = makePrimitiveLike('box');
    (node as { params: Record<string, unknown> }).params.isHole = true;
    applyFeaturePatchToNode(node, 'transform', { isHole: false });
    expect((node as { params: { isHole?: boolean } }).params.isHole).toBe(false);

    applyFeaturePatchToNode(node, 'transform', { isHole: undefined });
    expect((node as { params: { isHole?: boolean } }).params.isHole).toBeUndefined();
  });
});

describe('applyFeaturePatchToNode: boolean / group', () => {
  it('boolean.operation → node.operation', () => {
    const node = makeGroupLike('union');
    applyFeaturePatchToNode(node, 'boolean', { operation: 'subtract' });
    expect((node as { operation: string }).operation).toBe('subtract');
  });

  it('boolean.color → node.params.color', () => {
    const node = makeGroupLike('union');
    applyFeaturePatchToNode(node, 'boolean', { color: '#0000ff' });
    expect((node as { params: { color?: string } }).params.color).toBe('#0000ff');
  });

  it('group.color/isHole → node.params', () => {
    const node = makeGroupLike();
    applyFeaturePatchToNode(node, 'group', { color: '#00ff00', isHole: true });
    const p = (node as { params: { color?: string; isHole?: boolean } }).params;
    expect(p.color).toBe('#00ff00');
    expect(p.isHole).toBe(true);
  });
});

describe('applyFeaturePatchToNode: imported', () => {
  it('filename → node.filename', () => {
    const node = makeImportedLike('old.stl');
    const changed = applyFeaturePatchToNode(node, 'imported', { filename: 'new.stl' });
    expect(changed).toBe(true);
    expect((node as { filename: string }).filename).toBe('new.stl');
  });

  it('color → node.params.color', () => {
    const node = makeImportedLike('mesh.stl');
    applyFeaturePatchToNode(node, 'imported', { color: '#abcdef' });
    expect((node as { params: { color?: string } }).params.color).toBe('#abcdef');
  });

  it('binaryRef/geometry в patch — игнорируются (не меняем бинарь через форму)', () => {
    const node = makeImportedLike('mesh.stl');
    applyFeaturePatchToNode(node, 'imported', { binaryRef: 'newRef', stlBase64: 'data' });
    // Никаких side-effects на node.
    expect((node as { params: Record<string, unknown> }).params.binaryRef).toBeUndefined();
  });
});

describe('applyFeaturePatchToNode: edge cases', () => {
  it('игнорирует несовместимые комбинации type/node без падения', () => {
    const node = makeGroupLike();
    // Try применить primitive patch на group-like — функция должна вернуть false.
    const changed = applyFeaturePatchToNode(node, 'box', { width: 99 });
    expect(changed).toBe(false);
  });

  it('игнорирует unknown featureType с warn-логом (но не падает)', () => {
    const node = makePrimitiveLike('box');
    const changed = applyFeaturePatchToNode(node, 'something-unknown' as never, { x: 1 });
    expect(changed).toBe(false);
  });
});
