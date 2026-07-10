import * as THREE from 'three';
import sceneRaw from './scene-fail.audit.json?raw';
import { FeatureDocument } from './src/v3d/constructor/features/FeatureDocument';
import type { FeatureDocumentJSON } from './src/v3d/constructor/features/types';
import { FeatureRenderer } from './src/v3d/constructor/features/rendering/FeatureRenderer';

const result = document.querySelector('#result')!;
const scene = JSON.parse(sceneRaw) as FeatureDocumentJSON;
const elapsed = (startedAt: number) => Number((performance.now() - startedAt).toFixed(3));
const thresholds = { graphLoadMs: 1500, boundLoadMs: 2000 };

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

  const audit = {
    graphLoadMs,
    boundLoadMs,
    failedGraphFeatures,
    failedBoundFeatures,
    thresholds,
    passed: graphLoadMs <= thresholds.graphLoadMs
      && boundLoadMs <= thresholds.boundLoadMs
      && failedGraphFeatures === 0
      && failedBoundFeatures === 0,
  };
  result.textContent = JSON.stringify(audit, null, 2);
} catch (error) {
  result.textContent = JSON.stringify({ error: error instanceof Error ? error.stack : String(error) });
}
