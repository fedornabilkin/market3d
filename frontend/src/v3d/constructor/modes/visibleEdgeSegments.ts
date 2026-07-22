import * as THREE from 'three';

export type VisibleEdgeSegment = {
  start: THREE.Vector3;
  end: THREE.Vector3;
};

/**
 * Restores short terminal portions removed by an earlier perpendicular
 * chamfer. Internal CSG gaps are deliberately left untouched.
 */
export function extendTerminalEdgeSegments(
  segments: readonly VisibleEdgeSegment[],
  lineStart: THREE.Vector3,
  lineEnd: THREE.Vector3,
  maximumGap: number,
): VisibleEdgeSegment[] {
  const extended = segments.map((segment) => ({
    start: segment.start.clone(),
    end: segment.end.clone(),
  }));
  if (extended.length === 0 || maximumGap <= 0) return extended;

  const first = extended[0];
  if (first.start.distanceTo(lineStart) <= maximumGap) first.start.copy(lineStart);
  const last = extended[extended.length - 1];
  if (last.end.distanceTo(lineEnd) <= maximumGap) last.end.copy(lineEnd);
  return extended;
}

/**
 * Returns the portions of a candidate bbox edge that are present in the
 * triangle topology of the evaluated geometry. Adjacent triangle intervals
 * are merged, while gaps created by CSG cuts stay as separate segments.
 */
export function extractVisibleEdgeSegments(
  geometry: THREE.BufferGeometry,
  lineStart: THREE.Vector3,
  lineEnd: THREE.Vector3,
): VisibleEdgeSegment[] {
  const position = geometry.getAttribute('position');
  if (!(position instanceof THREE.BufferAttribute) || position.count === 0) return [];

  const delta = lineEnd.clone().sub(lineStart);
  const length = delta.length();
  if (length < 1e-9) return [];
  const direction = delta.multiplyScalar(1 / length);
  // BVH-CSG introduces small coordinate drift after several operations. The
  // candidate line comes from stable pre-chamfer bounds, so tolerate that
  // drift without making genuinely removed edge portions visible again.
  const tolerance = Math.max(1e-4, length * 5e-5);
  const normalizedTolerance = tolerance / length;
  const intervals: Array<[number, number]> = [];
  const index = geometry.getIndex();
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  const readVertex = (triangle: number, corner: number, target: THREE.Vector3): void => {
    const offset = triangle * 3 + corner;
    const vertexIndex = index ? index.getX(offset) : offset;
    target.fromBufferAttribute(position, vertexIndex);
  };

  const projectToCandidate = (point: THREE.Vector3): number | null => {
    const offsetX = point.x - lineStart.x;
    const offsetY = point.y - lineStart.y;
    const offsetZ = point.z - lineStart.z;
    const distanceAlongLine = offsetX * direction.x
      + offsetY * direction.y
      + offsetZ * direction.z;
    const t = distanceAlongLine / length;
    if (t < -normalizedTolerance || t > 1 + normalizedTolerance) return null;
    const distanceX = lineStart.x + direction.x * distanceAlongLine - point.x;
    const distanceY = lineStart.y + direction.y * distanceAlongLine - point.y;
    const distanceZ = lineStart.z + direction.z * distanceAlongLine - point.z;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ;
    return distanceSquared <= tolerance * tolerance
      ? THREE.MathUtils.clamp(t, 0, 1)
      : null;
  };

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    for (let corner = 0; corner < 3; corner++) readVertex(triangle, corner, vertices[corner]);
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as const) {
      const start = projectToCandidate(vertices[a]);
      const end = projectToCandidate(vertices[b]);
      if (start == null || end == null || Math.abs(end - start) <= normalizedTolerance) continue;
      intervals.push(start < end ? [start, end] : [end, start]);
    }
  }

  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && interval[0] <= previous[1] + normalizedTolerance) {
      previous[1] = Math.max(previous[1], interval[1]);
    } else {
      merged.push([...interval]);
    }
  }

  return merged.map(([start, end]) => ({
    start: lineStart.clone().lerp(lineEnd, start),
    end: lineStart.clone().lerp(lineEnd, end),
  }));
}
