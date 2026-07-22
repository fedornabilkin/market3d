import { describe, expect, it } from 'vitest';
import type { Feature } from '../Feature';
import { BoxFeature } from '../primitives/BoxFeature';
import { BooleanFeature } from '../composite/BooleanFeature';
import { readChamferAggregateChain } from './chamferAggregates';

describe('readChamferAggregateChain', () => {
  it('reads a flat aggregate', () => {
    const graph = new Map<string, Feature>();
    const add = (feature: Feature): void => { graph.set(feature.id, feature); };
    add(new BoxFeature('base', { width: 10, height: 10, depth: 10 }));
    add(new BoxFeature('cutter1', { width: 1, height: 1, depth: 1 }));
    add(new BoxFeature('cutter2', { width: 1, height: 1, depth: 1 }));
    add(new BooleanFeature('p2_chamfer_target_group_1', { operation: 'union' }, [
      'base', 'cutter1', 'cutter2',
    ]));

    expect(readChamferAggregateChain(graph, 'p2_chamfer_target_group_1')).toEqual({
      aggregateId: 'p2_chamfer_target_group_1',
      baseId: 'base',
      cutterIds: ['cutter1', 'cutter2'],
      aggregateIds: ['p2_chamfer_target_group_1'],
    });
  });

  it('restores cutter order from a legacy nested chain', () => {
    const graph = new Map<string, Feature>();
    const add = (feature: Feature): void => { graph.set(feature.id, feature); };
    add(new BoxFeature('base', { width: 10, height: 10, depth: 10 }));
    for (const id of ['cutter1', 'cutter2', 'cutter3']) {
      add(new BoxFeature(id, { width: 1, height: 1, depth: 1 }));
    }
    add(new BooleanFeature('p2_chamfer_target_group_1', { operation: 'union' }, [
      'base', 'cutter1',
    ]));
    add(new BooleanFeature('p2_chamfer_target_group_2', { operation: 'union' }, [
      'p2_chamfer_target_group_1', 'cutter2',
    ]));
    add(new BooleanFeature('p2_chamfer_target_group_3', { operation: 'union' }, [
      'p2_chamfer_target_group_2', 'cutter3',
    ]));

    expect(readChamferAggregateChain(graph, 'p2_chamfer_target_group_3')).toEqual({
      aggregateId: 'p2_chamfer_target_group_3',
      baseId: 'base',
      cutterIds: ['cutter1', 'cutter2', 'cutter3'],
      aggregateIds: [
        'p2_chamfer_target_group_1',
        'p2_chamfer_target_group_2',
        'p2_chamfer_target_group_3',
      ],
    });
  });
});
