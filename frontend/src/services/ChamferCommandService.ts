import * as THREE from 'three';
import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureId } from '@/v3d/constructor/features/types';
import { BooleanFeature } from '@/v3d/constructor/features/composite/BooleanFeature';
import { ensureTransformWrapper, nextP2FeatureId } from '@/v3d/constructor/features/utils/dagMutations';
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
    if (target.type === 'group' || target.type === 'boolean') {
      document.updateInputs(featureId, [...target.getInputs(), chamfer.rootId]);
      return true;
    }
    if (target.type === 'transform') {
      const inner = target.getInputs();
      if (inner.length !== 1) return false;
      this.wrapWithBoolean(document, featureId, inner[0], chamfer.rootId);
      return true;
    }

    const transformId = ensureTransformWrapper(document, featureId);
    this.wrapWithBoolean(document, transformId, featureId, chamfer.rootId);
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

  private wrapWithBoolean(
    document: FeatureDocument,
    transformId: FeatureId,
    targetId: FeatureId,
    chamferId: FeatureId,
  ): void {
    const booleanId = nextP2FeatureId('chamfer_target_group');
    document.addFeature(new BooleanFeature(booleanId, { operation: 'union' }, [targetId, chamferId]));
    document.updateInputs(transformId, [booleanId]);
  }
}
