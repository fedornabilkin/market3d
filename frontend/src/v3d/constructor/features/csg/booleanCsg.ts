import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import type { BooleanOperation } from '../composite/BooleanFeature';
import { CUT_INFLATE_EPS, cleanupGeometry, inflateGeom } from './geometryCleanup';
import { groupByBoundsIntersection } from './intersectionGroups';
import { PreparedGeometryCache } from './PreparedGeometryCache';

const preparedGeometryCache = new PreparedGeometryCache();

export interface BooleanInput {
  geometry: THREE.BufferGeometry;
  /** Локальный transform; запекается в геометрию перед CSG. */
  transform: THREE.Matrix4;
  /** Если true — этот вход всегда вычитается, независимо от operation. */
  isHole: boolean;
  /** Intersecting holes in the same group are united before subtraction. */
  holeGroup?: string;
}

/**
 * Applies three-bvh-csg to prepared Boolean inputs.
 *
 * Pipeline:
 *  1. Clone each geometry and bake its matrix before CSG.
 *  2. Weld vertices with a small tolerance for indexed manifold input.
 *  3. Inflate subtract cutters and holes to avoid coplanar BVH pathologies.
 *  4. Combine solids and subtract inputs marked as holes.
 *  5. Cleanup the result: weld seams, remove degenerate triangles, recompute normals.
 */
export function booleanCsg(
  inputs: BooleanInput[],
  operation: BooleanOperation,
): THREE.BufferGeometry {
  if (inputs.length === 0) return new THREE.BufferGeometry();

  const solids = inputs.filter((i) => !i.isHole);
  const holes = inputs.filter((i) => i.isHole);

  if (solids.length === 0) return new THREE.BufferGeometry();

  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  const op = bvhOp(operation);
  let current: Brush = inputToBrush(solids[0], false);

  for (let i = 1; i < solids.length; i++) {
    const next = inputToBrush(solids[i], operation === 'subtract');
    current = evaluator.evaluate(current, next, op);
  }

  for (const hole of holes.filter((input) => !input.holeGroup)) {
    const holeBrush = inputToBrush(hole, true);
    current = evaluator.evaluate(current, holeBrush, SUBTRACTION);
  }

  const groupedHoles = new Map<string, BooleanInput[]>();
  for (const hole of holes) {
    if (!hole.holeGroup) continue;
    const group = groupedHoles.get(hole.holeGroup) ?? [];
    group.push(hole);
    groupedHoles.set(hole.holeGroup, group);
  }
  for (const group of groupedHoles.values()) {
    const prepared = group.map((input) => prepareHole(input)).sort(comparePreparedHoles);
    const components = groupByBoundsIntersection(prepared, (entry) => entry.bounds);
    for (const component of components) {
      const cutter = combineHoleBrushes(component.map((entry) => entry.brush), evaluator);
      current = evaluator.evaluate(current, cutter, SUBTRACTION);
    }
  }

  return cleanupGeometry(current.geometry);
}

function bvhOp(op: BooleanOperation): number {
  if (op === 'subtract') return SUBTRACTION;
  if (op === 'intersect') return INTERSECTION;
  return ADDITION;
}

function inputToBrush(input: BooleanInput, inflate: boolean): Brush {
  const geom = inputToGeometry(input, inflate);
  const brush = new Brush(geom);
  brush.updateMatrixWorld();
  return brush;
}

function comparePreparedHoles(
  left: { bounds: THREE.Box3 },
  right: { bounds: THREE.Box3 },
): number {
  const leftValues = [
    left.bounds.min.x, left.bounds.min.y, left.bounds.min.z,
    left.bounds.max.x, left.bounds.max.y, left.bounds.max.z,
  ];
  const rightValues = [
    right.bounds.min.x, right.bounds.min.y, right.bounds.min.z,
    right.bounds.max.x, right.bounds.max.y, right.bounds.max.z,
  ];
  for (let index = 0; index < leftValues.length; index++) {
    const difference = leftValues[index] - rightValues[index];
    if (Math.abs(difference) > 1e-9) return difference;
  }
  return 0;
}

function prepareHole(input: BooleanInput): { brush: Brush; bounds: THREE.Box3 } {
  const brush = inputToBrush(input, true);
  brush.geometry.computeBoundingBox();
  const bounds = brush.geometry.boundingBox?.clone() ?? new THREE.Box3();
  return { brush, bounds };
}

function combineHoleBrushes(brushes: readonly Brush[], evaluator: Evaluator): Brush {
  if (brushes.length === 1) return brushes[0];
  let combined = brushes[0];
  for (let index = 1; index < brushes.length; index++) {
    combined = evaluator.evaluate(combined, brushes[index], ADDITION);
  }
  const brush = new Brush(cleanupGeometry(combined.geometry));
  brush.updateMatrixWorld();
  return brush;
}

function inputToGeometry(input: BooleanInput, inflate: boolean): THREE.BufferGeometry {
  const cacheKey = `${inflate ? 1 : 0}|${input.transform.elements.join(',')}`;
  const cached = preparedGeometryCache.get(input.geometry, cacheKey);
  if (cached) return cached;

  const geom = prepGeometry(input.geometry);
  if (inflate) inflateGeom(geom, CUT_INFLATE_EPS);
  if (!isIdentity(input.transform)) {
    geom.applyMatrix4(input.transform);
    if (input.transform.determinant() < 0) flipWinding(geom);
    geom.computeVertexNormals();
  }
  preparedGeometryCache.set(input.geometry, cacheKey, geom);
  return geom;
}

function prepGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometry.clone();
  for (const key of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
  }
  g = BufferGeometryUtils.mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  return g;
}

function isIdentity(m: THREE.Matrix4): boolean {
  const e = m.elements;
  return (
    e[0] === 1 && e[5] === 1 && e[10] === 1 && e[15] === 1 &&
    e[1] === 0 && e[2] === 0 && e[3] === 0 &&
    e[4] === 0 && e[6] === 0 && e[7] === 0 &&
    e[8] === 0 && e[9] === 0 && e[11] === 0 &&
    e[12] === 0 && e[13] === 0 && e[14] === 0
  );
}

function flipWinding(geom: THREE.BufferGeometry): void {
  const idx = geom.getIndex();
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i];
      arr[i] = arr[i + 2];
      arr[i + 2] = t;
    }
    idx.needsUpdate = true;
  } else {
    const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (pos) {
      const a = pos.array as Float32Array;
      for (let i = 0; i < a.length; i += 9) {
        for (let j = 0; j < 3; j++) {
          const t = a[i + j];
          a[i + j] = a[i + 6 + j];
          a[i + 6 + j] = t;
        }
      }
      pos.needsUpdate = true;
    }
  }
}
