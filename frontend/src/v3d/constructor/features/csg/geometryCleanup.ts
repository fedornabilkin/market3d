import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Чистые (без three-bvh-csg) утилиты пост-обработки геометрии для CSG.
 * Вынесены отдельно, чтобы их можно было юнит-тестировать без UMD-сборки
 * three-bvh-csg / three-mesh-bvh, которая не грузится в node-окружении vitest.
 */

/** Prevents coplanar cutter faces from triggering pathological BVH-CSG work. */
export const CUT_INFLATE_EPS = 0.005;

/** Expands a cutter around its bounding-box center by epsilon on each side. */
export function inflateGeom(geom: THREE.BufferGeometry, epsilon: number): void {
  geom.computeBoundingBox();
  const bounds = geom.boundingBox;
  if (!bounds) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = new THREE.Vector3(
    size.x > 1e-9 ? (size.x + 2 * epsilon) / size.x : 1,
    size.y > 1e-9 ? (size.y + 2 * epsilon) / size.y : 1,
    size.z > 1e-9 ? (size.z + 2 * epsilon) / size.z : 1,
  );
  geom.translate(-center.x, -center.y, -center.z);
  geom.scale(scale.x, scale.y, scale.z);
  geom.translate(center.x, center.y, center.z);
}

/**
 * Пост-обработка результата CSG для манифолдности.
 *  1. mergeVertices(1e-4) сшивает совпадающие вершины вдоль швов реза
 *     (three-bvh-csg отдаёт неиндексированный «суп» треугольников).
 *  2. После сшивки две вершины иглы-треугольника могут слиться в один индекс —
 *     получается грань нулевой площади с неманифолдным (двойным) ребром.
 *     Удаление таких граней — стандартный спутник mergeVertices.
 *  3. computeVertexNormals по чистой геометрии.
 */
export function cleanupGeometry(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const topologyGeometry = geom.clone();
  for (const key of Object.keys(topologyGeometry.attributes)) {
    if (key !== 'position') topologyGeometry.deleteAttribute(key);
  }
  const welded = BufferGeometryUtils.mergeVertices(topologyGeometry, 1e-4);
  const cleaned = removeDuplicateTriangles(removeDegenerateTriangles(splitTJunctions(welded)));
  cleaned.computeVertexNormals();
  return cleaned;
}

/** Removes coincident faces left after splitting CSG or Earcut bridge seams. */
export function removeDuplicateTriangles(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const index = geom.getIndex();
  if (!index) return geom;
  const source = Array.from(index.array);
  const seen = new Set<string>();
  const kept: number[] = [];
  for (let offset = 0; offset < source.length; offset += 3) {
    const triangle = [source[offset], source[offset + 1], source[offset + 2]];
    const key = triangle.slice().sort((left, right) => left - right).join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(...triangle);
  }
  if (kept.length !== source.length) geom.setIndex(kept);
  return geom;
}

/**
 * Splits triangle edges at already present vertices. Boolean kernels often
 * leave T-junctions where a short cut edge ends in the middle of a larger
 * coplanar triangle edge. Such a surface looks closed but is not a valid STL
 * topology until both faces use the same edge segments.
 */
export function splitTJunctions(geom: THREE.BufferGeometry, epsilon = 1e-5): THREE.BufferGeometry {
  const index = geom.getIndex();
  const positions = geom.getAttribute('position');
  if (!index || !positions) return geom;

  const source = Array.from(index.array);
  const vertexCount = positions.count;
  const point = new THREE.Vector3();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const segment = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const output: number[] = [];
  const addedPositions: number[] = [];
  const cellSize = 2;
  const cellKey = (x: number, y: number, z: number) => `${x}:${y}:${z}`;
  const cells = new Map<string, number[]>();
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    point.fromBufferAttribute(positions, vertexIndex);
    const key = cellKey(
      Math.floor(point.x / cellSize),
      Math.floor(point.y / cellSize),
      Math.floor(point.z / cellSize),
    );
    const entries = cells.get(key) ?? [];
    entries.push(vertexIndex);
    cells.set(key, entries);
  }

  const pointsOnEdge = (from: number, to: number): number[] => {
    start.fromBufferAttribute(positions, from);
    end.fromBufferAttribute(positions, to);
    segment.subVectors(end, start);
    const lengthSq = segment.lengthSq();
    if (lengthSq <= epsilon * epsilon) return [from, to];
    const entries: Array<{ index: number; t: number }> = [{ index: from, t: 0 }, { index: to, t: 1 }];
    const candidates = new Set<number>();
    const steps = Math.max(1, Math.ceil(Math.sqrt(lengthSq) / cellSize * 2));
    for (let step = 0; step <= steps; step += 1) {
      point.copy(start).addScaledVector(segment, step / steps);
      const x = Math.floor(point.x / cellSize);
      const y = Math.floor(point.y / cellSize);
      const z = Math.floor(point.z / cellSize);
      // A vertex exactly on a cell border can be stored in a neighbouring cell.
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            for (const candidate of cells.get(cellKey(x + dx, y + dy, z + dz)) ?? []) candidates.add(candidate);
          }
        }
      }
    }
    for (const candidate of candidates) {
      if (candidate === from || candidate === to) continue;
      point.fromBufferAttribute(positions, candidate);
      delta.subVectors(point, start);
      const t = delta.dot(segment) / lengthSq;
      if (t <= epsilon || t >= 1 - epsilon) continue;
      const distanceSq = delta.addScaledVector(segment, -t).lengthSq();
      if (distanceSq <= epsilon * epsilon) entries.push({ index: candidate, t });
    }
    entries.sort((left, right) => left.t - right.t);
    return entries.map(({ index: entryIndex }) => entryIndex);
  };

  for (let offset = 0; offset < source.length; offset += 3) {
    const a = source[offset];
    const b = source[offset + 1];
    const c = source[offset + 2];
    const boundary = [
      ...pointsOnEdge(a, b).slice(0, -1),
      ...pointsOnEdge(b, c).slice(0, -1),
      ...pointsOnEdge(c, a).slice(0, -1),
    ];
    if (boundary.length === 3) {
      output.push(a, b, c);
      continue;
    }

    const centroid = new THREE.Vector3();
    for (const vertexIndex of boundary) centroid.add(new THREE.Vector3().fromBufferAttribute(positions, vertexIndex));
    centroid.multiplyScalar(1 / boundary.length);
    const centroidIndex = vertexCount + addedPositions.length / 3;
    addedPositions.push(centroid.x, centroid.y, centroid.z);
    for (let boundaryIndex = 0; boundaryIndex < boundary.length; boundaryIndex += 1) {
      output.push(boundary[boundaryIndex], boundary[(boundaryIndex + 1) % boundary.length], centroidIndex);
    }
  }

  if (addedPositions.length > 0) {
    const extended = new Float32Array((vertexCount + addedPositions.length / 3) * 3);
    extended.set(positions.array as Float32Array);
    extended.set(addedPositions, vertexCount * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(extended, 3));
  }
  geom.setIndex(output);
  return geom;
}

/**
 * Выбрасывает схлопнувшиеся треугольники (с повторяющимся индексом вершины) —
 * они имеют нулевую площадь и создают неманифолдные рёбра. Удаляются только
 * заведомо вырожденные грани, поэтому дыр в поверхности не возникает.
 */
export function removeDegenerateTriangles(
  geom: THREE.BufferGeometry,
): THREE.BufferGeometry {
  const index = geom.getIndex();
  if (!index) return geom;
  const src = index.array;
  const positions = geom.getAttribute('position');
  if (!positions) return geom;
  const kept: number[] = [];
  const aPosition = new THREE.Vector3();
  const bPosition = new THREE.Vector3();
  const cPosition = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (let i = 0; i < src.length; i += 3) {
    const a = src[i];
    const b = src[i + 1];
    const c = src[i + 2];
    if (a === b || b === c || a === c) continue;
    aPosition.fromBufferAttribute(positions, a);
    bPosition.fromBufferAttribute(positions, b);
    cPosition.fromBufferAttribute(positions, c);
    ab.subVectors(bPosition, aPosition);
    ac.subVectors(cPosition, aPosition);
    if (ab.cross(ac).lengthSq() <= 1e-20) continue;
    kept.push(a, b, c);
  }
  if (kept.length === src.length) return geom;
  geom.setIndex(kept);
  return geom;
}
