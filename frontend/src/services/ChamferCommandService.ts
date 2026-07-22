import * as THREE from 'three';
import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureId } from '@/v3d/constructor/features/types';
import { BooleanFeature } from '@/v3d/constructor/features/composite/BooleanFeature';
import { ensureTransformWrapper, nextP2FeatureId } from '@/v3d/constructor/features/utils/dagMutations';
import {
  isChamferAggregate,
  readChamferAggregateChain,
} from '@/v3d/constructor/features/utils/chamferAggregates';
import { ChamferFeatureBuilder, type EdgeSpec } from '@/v3d/constructor/modes/ChamferFeatureBuilder';

export type ChamferSettings = {
  radius: number;
  profile: 'convex' | 'concave' | 'flat';
};

export type ChamferEdge = {
  kind: 'circular' | 'linear';
  localMid: THREE.Vector3;
  radius?: number;
  isTopRim?: boolean;
  axis?: 'x' | 'y' | 'z';
  localStart?: THREE.Vector3;
  localEnd?: THREE.Vector3;
  perpDirX?: number;
  perpDirZ?: number;
};

/** Builds a chamfer feature subgraph and connects it to its target feature. */
export class ChamferCommandService {
  apply(
    document: FeatureDocument,
    featureId: FeatureId,
    edge: ChamferEdge,
    settings: ChamferSettings,
  ): boolean {
    if (!document.graph.has(featureId)) return false;
    const spec = this.toEdgeSpec(document, featureId, edge);
    if (!spec) return false;
    const chamfer = ChamferFeatureBuilder.build(spec, settings.radius);
    for (const feature of chamfer.features) document.addFeature(feature);

    const target = document.graph.get(featureId);
    if (!target) return false;
    if (isChamferAggregate(target)) {
      return this.appendToAggregate(document, featureId, chamfer.rootId);
    }
    if (target.type === 'group' || target.type === 'boolean') {
      document.updateInputs(featureId, [...target.getInputs(), chamfer.rootId]);
      return true;
    }
    if (target.type === 'transform') {
      const inner = target.getInputs();
      if (inner.length !== 1) return false;
      this.attachToTransform(document, featureId, inner[0], chamfer.rootId);
      return true;
    }

    const transformId = ensureTransformWrapper(document, featureId);
    this.attachToTransform(document, transformId, featureId, chamfer.rootId);
    return true;
  }

  private toEdgeSpec(
    document: FeatureDocument,
    featureId: FeatureId,
    edge: ChamferEdge,
  ): EdgeSpec | null {
    const localMid = edge.localMid.clone();
    localMid.z += this.bottomAnchorOffset(document, featureId);
    if (edge.kind === 'circular') {
      if (edge.radius == null) return null;
      return { kind: 'circular', localMid, radius: edge.radius, isTopRim: edge.isTopRim === true };
    }
    if (!edge.axis || !edge.localStart || !edge.localEnd || edge.perpDirX == null || edge.perpDirZ == null) {
      return null;
    }
    return {
      kind: 'linear',
      axis: edge.axis,
      localMid,
      length: edge.localStart.distanceTo(edge.localEnd),
      perpDirX: edge.perpDirX,
      perpDirZ: edge.perpDirZ,
    };
  }

  private bottomAnchorOffset(document: FeatureDocument, featureId: FeatureId): number {
    const target = document.graph.get(featureId);
    if (!target) return 0;
    const outputId = target.type === 'transform' ? target.getInputs()[0] : featureId;
    if (!outputId) return 0;
    const output = document.getOutput(outputId);
    return output?.kind === 'leaf' ? (output.bottomAnchorOffsetZ ?? 0) : 0;
  }

  private attachToTransform(
    document: FeatureDocument,
    transformId: FeatureId,
    targetId: FeatureId,
    chamferId: FeatureId,
  ): void {
    if (this.appendToAggregate(document, targetId, chamferId)) return;
    const booleanId = nextP2FeatureId('chamfer_target_group');
    const aggregate = new BooleanFeature(booleanId, { operation: 'union' }, [targetId, chamferId]);
    aggregate.name = 'Фаски';
    document.addFeature(aggregate);
    document.updateInputs(transformId, [booleanId]);
  }

  private appendToAggregate(
    document: FeatureDocument,
    aggregateId: FeatureId,
    chamferId: FeatureId,
  ): boolean {
    const chain = readChamferAggregateChain(document.graph, aggregateId);
    if (!chain) return false;
    const aggregate = document.graph.get(chain.aggregateId);
    if (!isChamferAggregate(aggregate)) return false;
    aggregate.name = 'Фаски';
    document.updateInputs(chain.aggregateId, [chain.baseId, ...chain.cutterIds, chamferId]);
    return true;
  }
}
