import type { Feature } from '../Feature';
import type { FeatureId } from '../types';
import { BooleanFeature } from '../composite/BooleanFeature';

export const CHAMFER_AGGREGATE_PREFIX = 'p2_chamfer_target_group_';

type FeatureLookup = {
  get(id: FeatureId): Feature | undefined;
};

export type ChamferAggregateChain = {
  aggregateId: FeatureId;
  baseId: FeatureId;
  cutterIds: FeatureId[];
  aggregateIds: FeatureId[];
};

export function isChamferAggregate(feature: Feature | undefined): feature is BooleanFeature {
  return feature instanceof BooleanFeature
    && feature.id.startsWith(CHAMFER_AGGREGATE_PREFIX)
    && feature.params.operation === 'union';
}

/** Reads both the new flat aggregate and legacy nested chamfer chains. */
export function readChamferAggregateChain(
  graph: FeatureLookup,
  aggregateId: FeatureId,
): ChamferAggregateChain | null {
  const cutterChunks: FeatureId[][] = [];
  const aggregateIds: FeatureId[] = [];
  const visited = new Set<FeatureId>();
  let currentId = aggregateId;

  while (true) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);
    const feature = graph.get(currentId);
    if (!isChamferAggregate(feature)) break;
    const inputs = feature.getInputs();
    if (inputs.length < 2) return null;
    aggregateIds.unshift(currentId);
    cutterChunks.unshift(inputs.slice(1));
    currentId = inputs[0];
  }

  if (aggregateIds.length === 0) return null;
  return {
    aggregateId,
    baseId: currentId,
    cutterIds: cutterChunks.flat(),
    aggregateIds,
  };
}
