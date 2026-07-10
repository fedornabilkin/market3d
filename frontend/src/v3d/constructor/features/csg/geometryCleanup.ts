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
  const welded = BufferGeometryUtils.mergeVertices(geom, 1e-4);
  const cleaned = removeDegenerateTriangles(welded);
  cleaned.computeVertexNormals();
  return cleaned;
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
  const kept: number[] = [];
  for (let i = 0; i < src.length; i += 3) {
    const a = src[i];
    const b = src[i + 1];
    const c = src[i + 2];
    if (a === b || b === c || a === c) continue;
    kept.push(a, b, c);
  }
  if (kept.length === src.length) return geom;
  geom.setIndex(kept);
  return geom;
}
