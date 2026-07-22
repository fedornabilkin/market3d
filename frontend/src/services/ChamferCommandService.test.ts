import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('@/v3d/constructor/features/csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { ChamferCommandService, type ChamferEdge } from './ChamferCommandService';
import { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import { BoxFeature } from '@/v3d/constructor/features/primitives/BoxFeature';
import { TransformFeature } from '@/v3d/constructor/features/composite/TransformFeature';
import { BooleanFeature } from '@/v3d/constructor/features/composite/BooleanFeature';
import { GroupFeature } from '@/v3d/constructor/features/composite/GroupFeature';
import { readChamferAggregateChain } from '@/v3d/constructor/features/utils/chamferAggregates';

const edge: ChamferEdge = {
  kind: 'linear',
  axis: 'z',
  localStart: new THREE.Vector3(5, 5, 0),
  localEnd: new THREE.Vector3(5, 5, 10),
  localMid: new THREE.Vector3(5, 5, 5),
  perpDirX: -1,
  perpDirZ: -1,
};

function addScene(document: FeatureDocument, targetInput = 'base'): void {
  document.addFeature(new TransformFeature('target', {
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  }, [targetInput]));
  document.addFeature(new GroupFeature('scene', {}, ['target']));
  document.setRootIds(['scene']);
}

describe('ChamferCommandService', () => {
  it('keeps repeated chamfers in one flat aggregate', () => {
    const document = new FeatureDocument();
    document.addFeature(new BoxFeature('base', { width: 10, height: 10, depth: 10 }));
    addScene(document);
    const service = new ChamferCommandService();

    document.batchMutate(() => {
      expect(service.apply(document, 'target', edge, { radius: 1, profile: 'concave' })).toBe(true);
      expect(service.apply(document, 'target', edge, { radius: 1, profile: 'concave' })).toBe(true);
    });

    const aggregateId = document.graph.get('target')!.getInputs()[0];
    const aggregate = readChamferAggregateChain(document.graph, aggregateId);
    expect(aggregate?.aggregateIds).toEqual([aggregateId]);
    expect(aggregate?.baseId).toBe('base');
    expect(aggregate?.cutterIds).toHaveLength(2);
    expect(document.graph.get(aggregateId)?.getInputs()).toEqual([
      'base',
      ...aggregate!.cutterIds,
    ]);
  });

  it('collapses a legacy nested chain when another chamfer is added', () => {
    const document = new FeatureDocument();
    document.addFeature(new BoxFeature('base', { width: 10, height: 10, depth: 10 }));
    document.addFeature(new BoxFeature('legacyCutter1', { width: 1, height: 1, depth: 1 }));
    document.addFeature(new BoxFeature('legacyCutter2', { width: 1, height: 1, depth: 1 }));
    document.addFeature(new BooleanFeature('p2_chamfer_target_group_legacy_inner', {
      operation: 'union',
    }, ['base', 'legacyCutter1']));
    document.addFeature(new BooleanFeature('p2_chamfer_target_group_legacy_outer', {
      operation: 'union',
    }, ['p2_chamfer_target_group_legacy_inner', 'legacyCutter2']));
    addScene(document, 'p2_chamfer_target_group_legacy_outer');
    const service = new ChamferCommandService();

    document.batchMutate(() => {
      expect(service.apply(document, 'target', edge, { radius: 1, profile: 'concave' })).toBe(true);
    });

    const inputs = document.graph.get('p2_chamfer_target_group_legacy_outer')!.getInputs();
    expect(inputs[0]).toBe('base');
    expect(inputs.slice(1, 3)).toEqual(['legacyCutter1', 'legacyCutter2']);
    expect(inputs).toHaveLength(4);
    expect(document.pruneUnreachable()).toContain('p2_chamfer_target_group_legacy_inner');
  });
});
