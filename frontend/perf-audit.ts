import * as THREE from 'three';
import sceneRaw from './scene-fail.audit.json?raw';
import { FeatureDocument } from './src/v3d/constructor/features/FeatureDocument';
import type { FeatureDocumentJSON } from './src/v3d/constructor/features/types';
import { FeatureRenderer } from './src/v3d/constructor/features/rendering/FeatureRenderer';
import { GroupingFeatureOperations } from './src/v3d/constructor/modes/GroupingFeatureOperations';
import { FeatureSnapshotCommand } from './src/v3d/constructor/features/commands/FeatureSnapshotCommand';

const result = document.querySelector('#result')!;

function elapsed(start: number): number {
  return Number((performance.now() - start).toFixed(3));
}

try {
  const rows: Record<string, unknown>[] = [];
  let start = performance.now();
  const graphDoc = new FeatureDocument();
  graphDoc.loadFromJSON(JSON.parse(sceneRaw) as FeatureDocumentJSON);
  rows.push({ label: 'graph-load', elapsedMs: elapsed(start) });

  const doc = new FeatureDocument();
  const renderer = new FeatureRenderer(new THREE.Group());
  renderer.bindDocument(doc);
  start = performance.now();
  doc.loadFromJSON(JSON.parse(sceneRaw) as FeatureDocumentJSON);
  rows.push({ label: 'bound-load', elapsedMs: elapsed(start) });

  const root = doc.graph.get(doc.rootIds[0]);
  const mergeIds = [...(root?.getInputs() ?? [])].slice(0, 2);
  start = performance.now();
  const groupId = GroupingFeatureOperations.merge(doc, mergeIds);
  rows.push({ label: 'merge-first-two', elapsedMs: elapsed(start), mergeIds, groupId });

  if (groupId) {
    const beforeMove = doc.toJSON();
    doc.updateParams(groupId, { position: [10, 0, 0] });
    const afterMove = doc.toJSON();
    const command = new FeatureSnapshotCommand(beforeMove, afterMove, doc);
    start = performance.now();
    command.undo();
    command.redo();
    rows.push({ label: 'undo-redo-after-merge-move', elapsedMs: elapsed(start) });

    start = performance.now();
    GroupingFeatureOperations.ungroup(doc, groupId);
    rows.push({ label: 'ungroup', elapsedMs: elapsed(start) });
  }

  renderer.dispose();
  result.textContent = JSON.stringify(rows);
} catch (error) {
  result.textContent = JSON.stringify({ error: error instanceof Error ? error.stack : String(error) });
}
