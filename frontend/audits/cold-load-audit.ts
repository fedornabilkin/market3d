import * as THREE from 'three';
import sceneRaw from './scene-fail.audit.json?raw';
import { FeatureDocument } from '../src/v3d/constructor/features/FeatureDocument';
import type { FeatureDocumentJSON } from '../src/v3d/constructor/features/types';
import { FeatureRenderer } from '../src/v3d/constructor/features/rendering/FeatureRenderer';
import { BoxFeature } from '../src/v3d/constructor/features/primitives/BoxFeature';
import { TransformFeature } from '../src/v3d/constructor/features/composite/TransformFeature';
import { ChamferCommandService } from '../src/services/ChamferCommandService';
import { readChamferAggregateChain } from '../src/v3d/constructor/features/utils/chamferAggregates';

const result = document.querySelector('#result')!;
const scene = JSON.parse(sceneRaw) as FeatureDocumentJSON;
const elapsed = (startedAt: number) => Number((performance.now() - startedAt).toFixed(3));
const thresholds = {
  graphLoadMs: 1500,
  boundLoadMs: 2000,
  incrementalPrimitiveMs: 100,
  incrementalChamferMs: 1500,
};

try {
  let startedAt = performance.now();
  const document = new FeatureDocument();
  document.loadFromJSON(scene);
  const graphLoadMs = elapsed(startedAt);
  const failedGraphFeatures = [...document.graph.values()].filter((feature) => feature.error).length;

  const boundDocument = new FeatureDocument();
  const renderer = new FeatureRenderer(new THREE.Group());
  renderer.bindDocument(boundDocument);
  startedAt = performance.now();
  boundDocument.loadFromJSON(scene);
  const boundLoadMs = elapsed(startedAt);
  const failedBoundFeatures = [...boundDocument.graph.values()].filter((feature) => feature.error).length;
  renderer.dispose();

  const incrementalDocument = FeatureDocument.fromJSON(scene);
  const rootId = incrementalDocument.rootIds[0];
  const root = incrementalDocument.graph.get(rootId);
  if (!root || root.type !== 'group') throw new Error('Audit scene root must be a group');
  const unchangedSiblingId = root.getInputs()[1];
  const unchangedSiblingOutput = incrementalDocument.getOutput(unchangedSiblingId);

  startedAt = performance.now();
  incrementalDocument.batchMutate(() => {
    incrementalDocument.addFeature(new BoxFeature('audit_box', { width: 5, height: 5, depth: 5 }));
    incrementalDocument.addFeature(new TransformFeature('audit_xform', {
      position: [150, 150, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    }, ['audit_box']));
    incrementalDocument.updateInputs(rootId, [...root.getInputs(), 'audit_xform']);
  });
  const incrementalPrimitiveMs = elapsed(startedAt);
  const primitivePreservedSibling = incrementalDocument.getOutput(unchangedSiblingId) === unchangedSiblingOutput;

  const chamferTargetId = root.getInputs()[0];
  const chamferTarget = incrementalDocument.getOutput(chamferTargetId);
  if (!chamferTarget || chamferTarget.kind !== 'leaf') throw new Error('Chamfer audit target must be a leaf');
  chamferTarget.geometry.computeBoundingBox();
  const bounds = chamferTarget.geometry.boundingBox;
  if (!bounds) throw new Error('Chamfer audit target has no bounds');
  const edgeStart = new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z);
  const edgeEnd = new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z);
  const chamfer = new ChamferCommandService();
  const chamferEdges = [
    { axis: 'z' as const, start: edgeStart, end: edgeEnd, dx: -1, dz: -1 },
    {
      axis: 'z' as const,
      start: new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      end: new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z), dx: 1, dz: -1,
    },
    {
      axis: 'z' as const,
      start: new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      end: new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z), dx: -1, dz: 1,
    },
    {
      axis: 'z' as const,
      start: new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      end: new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z), dx: 1, dz: 1,
    },
    {
      axis: 'x' as const,
      start: new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      end: new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z), dx: -1, dz: -1,
    },
    {
      axis: 'x' as const,
      start: new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      end: new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z), dx: 1, dz: -1,
    },
    {
      axis: 'x' as const,
      start: new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      end: new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z), dx: -1, dz: 1,
    },
    {
      axis: 'x' as const,
      start: new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      end: new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z), dx: 1, dz: 1,
    },
  ];
  const incrementalChamferSeriesMs: number[] = [];
  for (const edge of chamferEdges) {
    startedAt = performance.now();
    incrementalDocument.batchMutate(() => {
      chamfer.apply(incrementalDocument, chamferTargetId, {
        kind: 'linear',
        axis: edge.axis,
        localStart: edge.start,
        localEnd: edge.end,
        localMid: edge.start.clone().lerp(edge.end, 0.5),
        perpDirX: edge.dx,
        perpDirZ: edge.dz,
      }, { radius: 1, profile: 'concave' });
    });
    incrementalChamferSeriesMs.push(elapsed(startedAt));
  }
  const incrementalChamferMs = Math.max(...incrementalChamferSeriesMs);
  const chamferPreservedSibling = incrementalDocument.getOutput(unchangedSiblingId) === unchangedSiblingOutput;
  const targetFeature = incrementalDocument.graph.get(chamferTargetId);
  const aggregateId = targetFeature?.type === 'transform' ? targetFeature.getInputs()[0] : chamferTargetId;
  const chamferAggregate = aggregateId
    ? readChamferAggregateChain(incrementalDocument.graph, aggregateId)
    : null;
  const chamferAggregateDepth = chamferAggregate?.aggregateIds.length ?? 0;
  const chamferCutterCount = chamferAggregate?.cutterIds.length ?? 0;

  const audit = {
    graphLoadMs,
    boundLoadMs,
    failedGraphFeatures,
    failedBoundFeatures,
    incrementalPrimitiveMs,
    incrementalChamferMs,
    incrementalChamferSeriesMs,
    primitivePreservedSibling,
    chamferPreservedSibling,
    chamferAggregateDepth,
    chamferCutterCount,
    thresholds,
    passed: graphLoadMs <= thresholds.graphLoadMs
      && boundLoadMs <= thresholds.boundLoadMs
      && incrementalPrimitiveMs <= thresholds.incrementalPrimitiveMs
      && incrementalChamferMs <= thresholds.incrementalChamferMs
      && primitivePreservedSibling
      && chamferPreservedSibling
      && chamferAggregateDepth === 1
      && chamferCutterCount === chamferEdges.length
      && failedGraphFeatures === 0
      && failedBoundFeatures === 0,
  };
  result.textContent = JSON.stringify(audit, null, 2);
} catch (error) {
  result.textContent = JSON.stringify({ error: error instanceof Error ? error.stack : String(error) });
}
