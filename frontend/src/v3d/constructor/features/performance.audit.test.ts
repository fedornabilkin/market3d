import { describe, it, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('./csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from './FeatureDocument';
import type { FeatureDocumentJSON } from './types';
import { FeatureRenderer } from './rendering/FeatureRenderer';
import { GroupingFeatureOperations } from '../modes/GroupingFeatureOperations';
import { FeatureSnapshotCommand } from './commands/FeatureSnapshotCommand';

function makeScene(count: number): FeatureDocumentJSON {
  const features: FeatureDocumentJSON['features'] = [];
  const inputs: string[] = [];
  for (let index = 0; index < count; index++) {
    const boxId = `box-${index}`;
    const transformId = `transform-${index}`;
    features.push({
      id: boxId,
      type: 'box',
      params: { width: 10, height: 10, depth: 10 },
      inputs: [],
    });
    features.push({
      id: transformId,
      type: 'transform',
      params: { position: [index, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      inputs: [boxId],
    });
    inputs.push(transformId);
  }
  features.push({ id: 'scene', type: 'group', params: {}, inputs });
  return { version: 2, features, rootIds: ['scene'] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function timed(rounds: number, fn: () => void): number {
  const values: number[] = [];
  for (let index = 0; index < rounds; index++) {
    const start = performance.now();
    fn();
    values.push(performance.now() - start);
  }
  return median(values);
}

function loadedDocument(json: FeatureDocumentJSON): FeatureDocument {
  const doc = new FeatureDocument();
  doc.loadFromJSON(json);
  return doc;
}

describe('performance audit', () => {
  it('prints load, merge, ungroup and history timings', () => {
    const scene = makeScene(300);

    const graphLoad = timed(7, () => {
      const doc = new FeatureDocument();
      doc.loadFromJSON(scene);
    });

    const boundLoad = timed(7, () => {
      const doc = new FeatureDocument();
      const renderer = new FeatureRenderer(new THREE.Group());
      renderer.bindDocument(doc);
      doc.loadFromJSON(scene);
      renderer.dispose();
    });

    const doc = loadedDocument(scene);
    const renderer = new FeatureRenderer(new THREE.Group());
    renderer.bindDocument(doc);
    const selected = Array.from({ length: 60 }, (_, index) => `transform-${index}`);

    const mergeStart = performance.now();
    const groupId = GroupingFeatureOperations.merge(doc, selected);
    const merge = performance.now() - mergeStart;
    if (!groupId) throw new Error('merge failed');

    const beforeMove = doc.toJSON();
    doc.updateParams(groupId, { position: [25, 0, 0] });
    const afterMove = doc.toJSON();
    const command = new FeatureSnapshotCommand(beforeMove, afterMove, doc);
    const history = timed(15, () => {
      command.undo();
      command.redo();
    });

    const ungroupStart = performance.now();
    GroupingFeatureOperations.ungroup(doc, groupId);
    const ungroup = performance.now() - ungroupStart;
    renderer.dispose();

    console.log(JSON.stringify({
      graphLoadMs: Number(graphLoad.toFixed(3)),
      boundLoadMs: Number(boundLoad.toFixed(3)),
      merge60of300Ms: Number(merge.toFixed(3)),
      undoRedoAfterMergeMoveMs: Number(history.toFixed(3)),
      ungroup60of300Ms: Number(ungroup.toFixed(3)),
    }));
  }, 60_000);
});
