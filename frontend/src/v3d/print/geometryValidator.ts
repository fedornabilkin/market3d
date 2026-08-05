import * as THREE from 'three';

export type PrintDiagnosticCode =
  | 'missing-position'
  | 'non-finite-position'
  | 'non-triangle-geometry'
  | 'index-out-of-range'
  | 'degenerate-triangle'
  | 'open-edge'
  | 'non-manifold-edge'
  | 'inconsistent-winding'
  | 'non-manifold-vertex'
  | 'disconnected-components';

export interface PrintDiagnostic {
  code: PrintDiagnosticCode;
  count: number;
}

export interface PrintValidationOptions {
  weldEpsilon?: number;
  areaEpsilon?: number;
  allowDisconnected?: boolean;
}

export interface PrintValidationResult {
  valid: boolean;
  triangleCount: number;
  componentCount: number;
  diagnostics: PrintDiagnostic[];
}

type Triangle = readonly [number, number, number];

const DEFAULT_WELD_EPSILON = 1e-5;
const DEFAULT_AREA_EPSILON = 1e-10;

export function validatePrintableGeometry(
  geometry: THREE.BufferGeometry,
  options: PrintValidationOptions = {},
): PrintValidationResult {
  const weldEpsilon = options.weldEpsilon ?? DEFAULT_WELD_EPSILON;
  const areaEpsilon = options.areaEpsilon ?? DEFAULT_AREA_EPSILON;
  const diagnostics = new Map<PrintDiagnosticCode, number>();
  const addDiagnostic = (code: PrintDiagnosticCode, count = 1): void => {
    diagnostics.set(code, (diagnostics.get(code) ?? 0) + count);
  };

  const position = geometry.getAttribute('position');
  if (!position) {
    addDiagnostic('missing-position');
    return result(diagnostics, 0, 0);
  }

  const sourceIndices = getSourceIndices(geometry, position.count, addDiagnostic);
  if (!sourceIndices) return result(diagnostics, 0, 0);

  const canonicalBySource = new Map<number, number>();
  const canonicalPositions: THREE.Vector3[] = [];
  const canonicalByPosition = new Map<string, number>();
  for (const sourceIndex of sourceIndices) {
    if (canonicalBySource.has(sourceIndex)) continue;
    const vertex = new THREE.Vector3().fromBufferAttribute(position, sourceIndex);
    if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y) || !Number.isFinite(vertex.z)) {
      addDiagnostic('non-finite-position');
      continue;
    }
    const key = weldEpsilon > 0 ? vertexKey(vertex, weldEpsilon) : `source:${sourceIndex}`;
    let canonicalIndex = canonicalByPosition.get(key);
    if (canonicalIndex === undefined) {
      canonicalIndex = canonicalPositions.length;
      canonicalPositions.push(vertex);
      canonicalByPosition.set(key, canonicalIndex);
    }
    canonicalBySource.set(sourceIndex, canonicalIndex);
  }

  const triangles: Triangle[] = [];
  for (let offset = 0; offset < sourceIndices.length; offset += 3) {
    const sourceTriangle = sourceIndices.slice(offset, offset + 3);
    const triangle = sourceTriangle.map((sourceIndex) => canonicalBySource.get(sourceIndex));
    if (triangle.some((index) => index === undefined)) continue;
    const [a, b, c] = triangle as [number, number, number];
    if (isDegenerate(a, b, c, canonicalPositions, areaEpsilon)) {
      addDiagnostic('degenerate-triangle');
      continue;
    }
    triangles.push([a, b, c]);
  }

  const edgeTriangles = new Map<string, Array<{ triangleIndex: number; forward: boolean }>>();
  const vertexTriangles = new Map<number, number[]>();
  triangles.forEach((triangle, triangleIndex) => {
    triangle.forEach((vertex) => {
      const entries = vertexTriangles.get(vertex) ?? [];
      entries.push(triangleIndex);
      vertexTriangles.set(vertex, entries);
    });
    addEdge(edgeTriangles, triangle[0], triangle[1], triangleIndex);
    addEdge(edgeTriangles, triangle[1], triangle[2], triangleIndex);
    addEdge(edgeTriangles, triangle[2], triangle[0], triangleIndex);
  });

  for (const entries of edgeTriangles.values()) {
    if (entries.length === 1) addDiagnostic('open-edge');
    else if (entries.length > 2) addDiagnostic('non-manifold-edge');
    else if (entries[0].forward === entries[1].forward) addDiagnostic('inconsistent-winding');
  }

  for (const [vertex, incident] of vertexTriangles) {
    if (countVertexFans(vertex, incident, triangles, edgeTriangles) > 1) {
      addDiagnostic('non-manifold-vertex');
    }
  }

  const components = findComponents(triangles, edgeTriangles);
  const componentCount = components.length;
  const solidComponentCount = countSolidComponents(components, triangles, canonicalPositions);
  if (solidComponentCount > 1 && !options.allowDisconnected) {
    addDiagnostic('disconnected-components', solidComponentCount);
  }

  return result(diagnostics, triangles.length, componentCount);
}

function getSourceIndices(
  geometry: THREE.BufferGeometry,
  positionCount: number,
  addDiagnostic: (code: PrintDiagnosticCode, count?: number) => void,
): number[] | undefined {
  const index = geometry.getIndex();
  const values = index ? Array.from(index.array) : Array.from({ length: positionCount }, (_, value) => value);
  if (values.length % 3 !== 0) {
    addDiagnostic('non-triangle-geometry');
    return undefined;
  }
  if (values.some((value) => value < 0 || value >= positionCount)) {
    addDiagnostic('index-out-of-range');
    return undefined;
  }
  return values;
}

function vertexKey(vertex: THREE.Vector3, epsilon: number): string {
  return [vertex.x, vertex.y, vertex.z]
    .map((value) => Math.round(value / epsilon))
    .join(':');
}

function isDegenerate(
  a: number,
  b: number,
  c: number,
  positions: THREE.Vector3[],
  areaEpsilon: number,
): boolean {
  if (a === b || b === c || a === c) return true;
  const ab = positions[b].clone().sub(positions[a]);
  const ac = positions[c].clone().sub(positions[a]);
  return ab.cross(ac).lengthSq() <= areaEpsilon * areaEpsilon;
}

function addEdge(
  edgeTriangles: Map<string, Array<{ triangleIndex: number; forward: boolean }>>,
  from: number,
  to: number,
  triangleIndex: number,
): void {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const key = `${low}:${high}`;
  const entries = edgeTriangles.get(key) ?? [];
  entries.push({ triangleIndex, forward: from === low });
  edgeTriangles.set(key, entries);
}

function countVertexFans(
  vertex: number,
  incident: number[],
  triangles: Triangle[],
  edgeTriangles: Map<string, Array<{ triangleIndex: number; forward: boolean }>>,
): number {
  const connected = new Map<number, Set<number>>();
  for (const triangleIndex of incident) connected.set(triangleIndex, new Set());
  for (const triangleIndex of incident) {
    const triangle = triangles[triangleIndex];
    for (const neighbour of triangle) {
      if (neighbour === vertex) continue;
      const entries = edgeTriangles.get(`${Math.min(vertex, neighbour)}:${Math.max(vertex, neighbour)}`) ?? [];
      for (const entry of entries) {
        if (entry.triangleIndex !== triangleIndex && connected.has(entry.triangleIndex)) {
          connected.get(triangleIndex)!.add(entry.triangleIndex);
        }
      }
    }
  }
  return countGraphComponents(connected);
}

function findComponents(
  triangles: Triangle[],
  edgeTriangles: Map<string, Array<{ triangleIndex: number; forward: boolean }>>,
): number[][] {
  const connected = new Map<number, Set<number>>();
  triangles.forEach((_, triangleIndex) => connected.set(triangleIndex, new Set()));
  for (const entries of edgeTriangles.values()) {
    for (let index = 0; index < entries.length; index += 1) {
      for (let other = index + 1; other < entries.length; other += 1) {
        connected.get(entries[index].triangleIndex)!.add(entries[other].triangleIndex);
        connected.get(entries[other].triangleIndex)!.add(entries[index].triangleIndex);
      }
    }
  }
  return collectGraphComponents(connected);
}

/**
 * A valid solid with sealed cavities has several disconnected boundary shells.
 * Inner shells have the opposite winding (and signed volume) to the largest
 * outer shell. Separate physical solids have the same sign as that outer shell.
 */
function countSolidComponents(
  components: number[][],
  triangles: Triangle[],
  positions: THREE.Vector3[],
): number {
  if (components.length <= 1) return components.length;
  const volumes = components.map((component) => component.reduce((volume, triangleIndex) => {
    const [a, b, c] = triangles[triangleIndex].map((vertex) => positions[vertex]) as [
      THREE.Vector3,
      THREE.Vector3,
      THREE.Vector3,
    ];
    return volume + (
      a.x * (b.y * c.z - b.z * c.y)
      + a.y * (b.z * c.x - b.x * c.z)
      + a.z * (b.x * c.y - b.y * c.x)
    ) / 6;
  }, 0));
  const reference = volumes.reduce((largest, volume) => (
    Math.abs(volume) > Math.abs(largest) ? volume : largest
  ), 0);
  if (Math.abs(reference) <= Number.EPSILON) return components.length;
  const outerSign = Math.sign(reference);
  return volumes.filter((volume) => Math.abs(volume) <= Number.EPSILON || Math.sign(volume) === outerSign).length;
}

function countGraphComponents(graph: Map<number, Set<number>>): number {
  return collectGraphComponents(graph).length;
}

function collectGraphComponents(graph: Map<number, Set<number>>): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];
  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    const component: number[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.pop()!;
      component.push(current);
      for (const neighbour of graph.get(current) ?? []) {
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        queue.push(neighbour);
      }
    }
    components.push(component);
  }
  return components;
}

function result(
  diagnosticsMap: Map<PrintDiagnosticCode, number>,
  triangleCount: number,
  componentCount: number,
): PrintValidationResult {
  const diagnostics = Array.from(diagnosticsMap, ([code, count]) => ({ code, count }));
  return {
    valid: diagnostics.length === 0,
    triangleCount,
    componentCount,
    diagnostics,
  };
}
