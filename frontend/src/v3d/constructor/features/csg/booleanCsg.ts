import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import type { BooleanOperation } from '../composite/BooleanFeature';
import { CUT_INFLATE_EPS, cleanupGeometry, inflateGeom } from './geometryCleanup';

export interface BooleanInput {
  geometry: THREE.BufferGeometry;
  /** Локальный transform; запекается в геометрию перед CSG. */
  transform: THREE.Matrix4;
  /** Если true — этот вход всегда вычитается, независимо от operation. */
  isHole: boolean;
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

  for (const hole of holes) {
    const holeBrush = inputToBrush(hole, true);
    current = evaluator.evaluate(current, holeBrush, SUBTRACTION);
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

function inputToGeometry(input: BooleanInput, inflate: boolean): THREE.BufferGeometry {
  const geom = prepGeometry(input.geometry);
  if (inflate) inflateGeom(geom, CUT_INFLATE_EPS);
  if (!isIdentity(input.transform)) {
    geom.applyMatrix4(input.transform);
    if (input.transform.determinant() < 0) flipWinding(geom);
    geom.computeVertexNormals();
  }
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
