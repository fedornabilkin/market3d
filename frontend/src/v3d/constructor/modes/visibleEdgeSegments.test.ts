import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  extendTerminalEdgeSegments,
  extractVisibleEdgeSegments,
} from './visibleEdgeSegments';

describe('extractVisibleEdgeSegments', () => {
  it('returns a complete edge of a box', () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const segments = extractVisibleEdgeSegments(
      geometry,
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(1, -1, -1),
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].start.x).toBeCloseTo(-1);
    expect(segments[0].end.x).toBeCloseTo(1);
  });

  it('keeps CSG gaps as separate visible portions', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 0.25, 0, 0, 0, 1, 0,
      0.5, 0, 0, 1, 0, 0, 1, 1, 0,
    ], 3));

    const segments = extractVisibleEdgeSegments(
      geometry,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    );

    expect(segments).toHaveLength(2);
    expect(segments[0].start.x).toBeCloseTo(0);
    expect(segments[0].end.x).toBeCloseTo(0.25);
    expect(segments[1].start.x).toBeCloseTo(0.5);
    expect(segments[1].end.x).toBeCloseTo(1);
  });

  it('does not invent an edge absent from the topology', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 1, 0, 1, 1, 0, 0, 1, 1,
    ], 3));

    expect(extractVisibleEdgeSegments(
      geometry,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    )).toEqual([]);
  });

  it('matches an edge after small accumulated CSG coordinate drift', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0.0003, 0, 10, 0.0003, 0, 0, 1, 0,
    ], 3));

    const segments = extractVisibleEdgeSegments(
      geometry,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(10, 0, 0),
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].start.x).toBe(0);
    expect(segments[0].end.x).toBe(10);
  });
});

describe('extendTerminalEdgeSegments', () => {
  const lineStart = new THREE.Vector3(0, 0, 0);
  const lineEnd = new THREE.Vector3(0, 0, 20);

  it('restores ends shortened by existing perpendicular chamfers', () => {
    const extended = extendTerminalEdgeSegments([
      { start: new THREE.Vector3(0, 0, 2), end: new THREE.Vector3(0, 0, 18) },
    ], lineStart, lineEnd, 2.25);

    expect(extended[0].start.z).toBe(0);
    expect(extended[0].end.z).toBe(20);
  });

  it('does not bridge an internal CSG cut', () => {
    const extended = extendTerminalEdgeSegments([
      { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(0, 0, 5) },
      { start: new THREE.Vector3(0, 0, 10), end: new THREE.Vector3(0, 0, 20) },
    ], lineStart, lineEnd, 2.25);

    expect(extended).toHaveLength(2);
    expect(extended[0].end.z).toBe(5);
    expect(extended[1].start.z).toBe(10);
  });

  it('does not restore a terminal gap larger than a chamfer radius', () => {
    const extended = extendTerminalEdgeSegments([
      { start: new THREE.Vector3(0, 0, 5), end: new THREE.Vector3(0, 0, 20) },
    ], lineStart, lineEnd, 2.25);

    expect(extended[0].start.z).toBe(5);
  });
});
