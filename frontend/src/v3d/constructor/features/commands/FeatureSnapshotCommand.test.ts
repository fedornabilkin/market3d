import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from '../FeatureDocument';
import { BoxFeature } from '../primitives/BoxFeature';
import { HistoryManager } from '../../HistoryManager';
import {
  FeatureSnapshotCommand,
  captureSnapshot,
} from './FeatureSnapshotCommand';

describe('FeatureSnapshotCommand', () => {
  it('undo restores before-snapshot, redo re-applies after', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    const before = doc.toJSON();
    doc.updateParams('b1', { width: 25 });
    const after = doc.toJSON();

    const cmd = new FeatureSnapshotCommand(before, after, doc);
    expect((doc.graph.get('b1')!.params as { width: number }).width).toBe(25);

    cmd.undo();
    expect((doc.graph.get('b1')!.params as { width: number }).width).toBe(10);

    cmd.redo();
    expect((doc.graph.get('b1')!.params as { width: number }).width).toBe(25);
  });

  it('captureSnapshot wraps a mutation and works with HistoryManager', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    const history = new HistoryManager();

    const cmd = captureSnapshot(doc, () => {
      doc.updateParams('b1', { width: 30 });
    });
    history.push(cmd);

    expect((doc.graph.get('b1')!.params as { width: number }).width).toBe(30);
    expect(history.canUndo()).toBe(true);

    history.undo();
    expect((doc.graph.get('b1')!.params as { width: number }).width).toBe(10);

    history.redo();
    expect((doc.graph.get('b1')!.params as { width: number }).width).toBe(30);
  });

  it('preserves subscribers across undo/redo (in-place restore)', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    const events: string[] = [];
    doc.subscribe((e) => events.push(e.type));

    const cmd = captureSnapshot(doc, () => {
      doc.updateParams('b1', { width: 50 });
    });
    events.length = 0;

    cmd.undo();
    expect(events).toContain('recompute-done');

    events.length = 0;
    cmd.redo();
    expect(events).toContain('recompute-done');
  });

  it('restores feature add/remove (not just params)', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);

    const cmd = captureSnapshot(doc, () => {
      doc.addFeature(new BoxFeature('b2', { width: 5, height: 5, depth: 5 }));
      doc.setRootIds(['b1', 'b2']);
    });

    expect(doc.graph.has('b2')).toBe(true);
    expect(doc.rootIds).toEqual(['b1', 'b2']);

    cmd.undo();
    expect(doc.graph.has('b2')).toBe(false);
    expect(doc.rootIds).toEqual(['b1']);

    cmd.redo();
    expect(doc.graph.has('b2')).toBe(true);
    expect(doc.rootIds).toEqual(['b1', 'b2']);
  });
});
