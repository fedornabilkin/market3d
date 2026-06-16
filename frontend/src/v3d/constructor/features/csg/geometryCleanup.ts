import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Чистые (без three-bvh-csg) утилиты пост-обработки геометрии для CSG.
 * Вынесены отдельно, чтобы их можно было юнит-тестировать без UMD-сборки
 * three-bvh-csg / three-mesh-bvh, которая не грузится в node-окружении vitest.
 */

/**
 * Cut-оверсайз: typical CSG-проблема — копланарные грани режущего тела и базы
 * (когда оба сидят на сетке Z=0 либо вплотную друг к другу) дают неустойчивый
 * результат: остаётся тонкий срез ~0.001 мм. Раздуваем bbox режущего тела на ε
 * вокруг центра — гарантируем, что грани не совпадают точно, CSG срезает чисто.
 * Применяется к holes и к режущим solid'ам при subtract.
 */
export const CUT_INFLATE_EPS = 0.005;

/** Раздувает геометрию на 2·epsilon по каждой оси вокруг её bbox-центра. */
export function inflateGeom(geom: THREE.BufferGeometry, epsilon: number): void {
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return;
  const cx = (bb.min.x + bb.max.x) * 0.5;
  const cy = (bb.min.y + bb.max.y) * 0.5;
  const cz = (bb.min.z + bb.max.z) * 0.5;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  const fx = sx > 1e-9 ? (sx + 2 * epsilon) / sx : 1;
  const fy = sy > 1e-9 ? (sy + 2 * epsilon) / sy : 1;
  const fz = sz > 1e-9 ? (sz + 2 * epsilon) / sz : 1;
  geom.translate(-cx, -cy, -cz);
  geom.scale(fx, fy, fz);
  geom.translate(cx, cy, cz);
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
