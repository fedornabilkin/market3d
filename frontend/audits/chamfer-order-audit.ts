import * as THREE from 'three';
import { FeatureDocument } from '../src/v3d/constructor/features/FeatureDocument';
import { compareChamferOrderMetrics } from '../src/v3d/constructor/features/csg/chamferOrderMetrics';
import { CHAMFER_AGGREGATE_PREFIX } from '../src/v3d/constructor/features/utils/chamferAggregates';
import type { FeatureDocumentJSON, FeatureJSON } from '../src/v3d/constructor/features/types';

const result = document.querySelector('#result')!;

try {
  const sceneUrl = new URLSearchParams(location.search).get('scene');
  const requestedTransformId = new URLSearchParams(location.search).get('transform');
  if (!sceneUrl) throw new Error('Pass ?scene=<URL to FeatureDocumentJSON>');
  const source = await fetch(sceneUrl).then((response) => {
    if (!response.ok) throw new Error(`Scene request failed: ${response.status}`);
    return response.json() as Promise<FeatureDocumentJSON>;
  });
  const reversed = structuredClone(source);
  const chain = reverseLargestChamferAggregate(reversed, requestedTransformId);
  if (!chain) throw new Error('Chamfer aggregate with at least two cutters was not found');

  const originalMetrics = evaluate(source, chain.transformId);
  const reversedMetrics = evaluate(reversed, chain.transformId);
  const comparison = compareChamferOrderMetrics(originalMetrics, reversedMetrics);
  result.textContent = JSON.stringify({
    chain,
    originalMetrics,
    reversedMetrics,
    ...comparison,
  }, null, 2);
} catch (error) {
  result.textContent = JSON.stringify({ error: error instanceof Error ? error.stack : String(error) });
}

function reverseLargestChamferAggregate(
  document: FeatureDocumentJSON,
  requestedTransformId: string | null,
): {
  transformId: string;
  chainIds: string[];
  originalCutters: string[];
  reversedCutters: string[];
} | null {
  const byId = new Map(document.features.map((feature) => [feature.id, feature]));
  let best: {
    transform: FeatureJSON;
    aggregate: FeatureJSON;
    chainIds: string[];
    baseId: string;
    cutters: string[];
  } | null = null;
  for (const feature of document.features) {
    if (feature.type !== 'transform' || feature.inputs?.length !== 1) continue;
    if (requestedTransformId && feature.id !== requestedTransformId) continue;
    const aggregate = readJsonChamferAggregate(byId, feature.inputs[0]);
    if (aggregate && aggregate.cutters.length >= 2 && (!best || aggregate.cutters.length > best.cutters.length)) {
      best = { transform: feature, ...aggregate };
    }
  }
  if (!best) return null;

  const reversedCutters = [...best.cutters].reverse();
  best.aggregate.inputs = [best.baseId, ...reversedCutters];
  return {
    transformId: best.transform.id,
    chainIds: best.chainIds,
    originalCutters: best.cutters,
    reversedCutters,
  };
}

function readJsonChamferAggregate(
  byId: ReadonlyMap<string, FeatureJSON>,
  aggregateId: string,
): {
  aggregate: FeatureJSON;
  chainIds: string[];
  baseId: string;
  cutters: string[];
} | null {
  const outermost = byId.get(aggregateId);
  if (!isJsonChamferAggregate(outermost)) return null;
  const cutterChunks: string[][] = [];
  const chainIds: string[] = [];
  const visited = new Set<string>();
  let currentId = aggregateId;

  while (true) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);
    const current = byId.get(currentId);
    if (!isJsonChamferAggregate(current)) break;
    if (!current.inputs || current.inputs.length < 2) return null;
    chainIds.unshift(current.id);
    cutterChunks.unshift(current.inputs.slice(1));
    currentId = current.inputs[0];
  }

  return {
    aggregate: outermost,
    chainIds,
    baseId: currentId,
    cutters: cutterChunks.flat(),
  };
}

function isJsonChamferAggregate(feature: FeatureJSON | undefined): feature is FeatureJSON {
  return feature?.type === 'boolean'
    && feature.id.startsWith(CHAMFER_AGGREGATE_PREFIX)
    && (feature.params as { operation?: unknown }).operation === 'union';
}

function evaluate(json: FeatureDocumentJSON, featureId: string): {
  triangles: number;
  volume: number;
  bounds: number[];
  failedFeatures: number;
} {
  const document = FeatureDocument.fromJSON(json);
  const output = document.getOutput(featureId);
  if (!output || output.kind !== 'leaf') throw new Error(`Leaf output not found for ${featureId}`);
  const geometry = output.geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  return {
    triangles: Math.floor((geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3),
    volume: geometryVolume(geometry),
    bounds: [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z],
    failedFeatures: [...document.graph.values()].filter((feature) => feature.error).length,
  };
}

function geometryVolume(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triangles = Math.floor((index?.count ?? position.count) / 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let volume = 0;
  for (let triangle = 0; triangle < triangles; triangle++) {
    const read = (corner: number, target: THREE.Vector3): void => {
      const offset = triangle * 3 + corner;
      target.fromBufferAttribute(position, index ? index.getX(offset) : offset);
    };
    read(0, a); read(1, b); read(2, c);
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  return Math.abs(volume);
}
