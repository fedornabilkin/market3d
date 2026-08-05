import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import Module, { type ManifoldToplevel } from 'manifold-3d';
import { removeDegenerateTriangles } from '../constructor/features/csg/geometryCleanup';
import type { PrintablePart } from './PrintableModelBuilder';

const INPUT_TOLERANCE = 1e-5;
const OUTPUT_TOLERANCE = 0.005;
const JOIN_OVERLAP = 0.05;
const PLANAR_JOIN_OVERLAP = 0.005;

let modulePromise: Promise<ManifoldToplevel> | undefined;
type KernelSolid = InstanceType<ManifoldToplevel['Manifold']>;

export function initManifoldKernel(): Promise<ManifoldToplevel> {
  modulePromise ??= Module().then((module) => {
    module.setup();
    return module;
  });
  return modulePromise;
}

/**
 * Converts arbitrary closed Three.js meshes to Manifold solids and performs a
 * single robust n-ary union. This is the common print path for generators,
 * constructor output, and future solid-producing features.
 */
export async function unionPrintableParts(parts: readonly PrintablePart[]): Promise<THREE.BufferGeometry> {
  const module = await initManifoldKernel();
  const solids: KernelSolid[] = [];
  try {
    for (const part of parts) {
      part.object.updateMatrixWorld(true);
      part.object.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !object.geometry?.getAttribute('position')) return;
        try {
          const transform = object.matrixWorld.clone();
          if (!part.isBase) {
            transform.premultiply(new THREE.Matrix4().makeTranslation(0, 0, -JOIN_OVERLAP));
          }
          const solid = createKernelSolid(
            module,
            object.geometry,
            transform,
            (part.applyPlanarOverlap ?? !part.isBase) ? PLANAR_JOIN_OVERLAP : 0,
          );
          const status = solid.status();
          if (status !== 'NoError') {
            solid.delete();
            throw new Error(status);
          }
          solids.push(solid);
        } catch (error) {
          const meshName = object.name ? ` (${object.name})` : '';
          throw new Error(
            `Входная деталь «${part.id}»${meshName} не является замкнутым телом: `
            + `${error instanceof Error ? error.message : String(error)}.`,
          );
        }
      });
    }
    if (solids.length === 0) throw new Error('Нет геометрии для экспорта STL.');

    const result = module.Manifold.union(solids);
    const status = result.status();
    if (status !== 'NoError') {
      result.delete();
      throw new Error(`CAD-ядро не смогло объединить модель: ${status}.`);
    }
    try {
      const simplified = result.simplify(OUTPUT_TOLERANCE);
      try {
        const baked = simplified.asOriginal();
        try {
          const geometry = fromKernelMesh(baked.getMesh());
          return normalizeKernelOutput(module, geometry);
        } finally {
          baked.delete();
        }
      } finally {
        simplified.delete();
      }
    } finally {
      result.delete();
    }
  } finally {
    solids.forEach((solid) => solid.delete());
  }
}

/**
 * Normalizes the GL/STL representation, not the CAD solid. Manifold may emit
 * epsilon-valid sliver triangles along boolean seams; STL has no tolerance or
 * merge metadata, so they are removed and the resulting triangle soup is
 * round-tripped through the kernel once more before download.
 */
function normalizeKernelOutput(
  module: ManifoldToplevel,
  geometry: THREE.BufferGeometry,
): THREE.BufferGeometry {
  try {
    const mesh = toKernelMesh(module, geometry, new THREE.Matrix4());
    mesh.merge();
    const normalized = module.Manifold.ofMesh(mesh);
    const status = normalized.status();
    if (status !== 'NoError') {
      normalized.delete();
      throw new Error(`Нормализация STL завершилась с ошибкой: ${status}.`);
    }
    try {
      const baked = normalized.asOriginal();
      try {
        return fromKernelMesh(baked.getMesh());
      } finally {
        baked.delete();
      }
    } finally {
      normalized.delete();
    }
  } finally {
    geometry.dispose();
  }
}

function createKernelSolid(
  module: ManifoldToplevel,
  geometry: THREE.BufferGeometry,
  transform: THREE.Matrix4,
  planarOffset: number,
): KernelSolid {
  const sourceExtrusion = rebuildExtrusion(module, geometry, transform, planarOffset);
  if (sourceExtrusion) return sourceExtrusion;
  const planarExtrusion = rebuildPlanarExtrusion(module, geometry, transform, planarOffset);
  if (planarExtrusion) return planarExtrusion;
  const mesh = toKernelMesh(module, geometry, transform);
  mesh.merge();
  return module.Manifold.ofMesh(mesh);
}

/**
 * Reconstructs any two-level XY prism from its bottom triangles. This covers
 * merged QR/barcode blocks as well as ordinary extrusions: touching triangles
 * become one exact 2D region before extrusion, so edge- and point-contacts
 * cannot survive as separate shells in STL.
 */
function rebuildPlanarExtrusion(
  module: ManifoldToplevel,
  geometry: THREE.BufferGeometry,
  transform: THREE.Matrix4,
  planarOffset: number,
): KernelSolid | undefined {
  const position = geometry.getAttribute('position');
  if (!position) return undefined;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    minZ = Math.min(minZ, position.getZ(vertex));
    maxZ = Math.max(maxZ, position.getZ(vertex));
  }
  const height = maxZ - minZ;
  if (!Number.isFinite(height) || height <= INPUT_TOLERANCE) return undefined;
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const z = position.getZ(vertex);
    if (Math.abs(z - minZ) > INPUT_TOLERANCE && Math.abs(z - maxZ) > INPUT_TOLERANCE) return undefined;
  }

  const sourceIndices = geometry.getIndex()
    ? Array.from(geometry.getIndex()!.array)
    : Array.from({ length: position.count }, (_, vertex) => vertex);
  const triangles: Array<Array<[number, number]>> = [];
  for (let offset = 0; offset < sourceIndices.length; offset += 3) {
    const indices = sourceIndices.slice(offset, offset + 3);
    if (!indices.every((vertex) => Math.abs(position.getZ(vertex) - minZ) <= INPUT_TOLERANCE)) continue;
    const triangle = indices.map((vertex): [number, number] => [position.getX(vertex), position.getY(vertex)]);
    const signedArea = triangle.reduce((area, point, index) => {
      const next = triangle[(index + 1) % triangle.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0);
    if (Math.abs(signedArea) <= INPUT_TOLERANCE * INPUT_TOLERANCE) continue;
    if (signedArea < 0) triangle.reverse();
    triangles.push(triangle);
  }
  if (triangles.length === 0) return undefined;
  return extrudeContours(module, triangles, 'Positive', minZ, height, transform, planarOffset);
}

/**
 * Three.js extrusion triangulation can contain open seams around holes even
 * though its source Shape is a valid solid. Rebuilding from those source
 * contours lets the CAD kernel triangulate and extrude the exact region.
 */
function rebuildExtrusion(
  module: ManifoldToplevel,
  geometry: THREE.BufferGeometry,
  transform: THREE.Matrix4,
  planarOffset: number,
): KernelSolid | undefined {
  const sourceShapes = geometry.parameters?.shapes;
  if (!sourceShapes) return undefined;
  const shapes = Array.isArray(sourceShapes) ? sourceShapes : [sourceShapes];
  if (shapes.length === 0 || shapes.some((shape) => !(shape instanceof THREE.Shape))) return undefined;

  const position = geometry.getAttribute('position');
  if (!position) return undefined;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    minZ = Math.min(minZ, position.getZ(vertex));
    maxZ = Math.max(maxZ, position.getZ(vertex));
  }
  const height = maxZ - minZ;
  if (!Number.isFinite(height) || height <= INPUT_TOLERANCE) return undefined;

  const contours: Array<Array<[number, number]>> = [];
  for (const shape of shapes as THREE.Shape[]) {
    const points = shape.extractPoints(geometry.parameters?.options?.curveSegments ?? 12);
    contours.push(toKernelContour(points.shape));
    for (const hole of points.holes) contours.push(toKernelContour(hole));
  }
  const usableContours = contours.filter((contour) => contour.length >= 3);
  if (usableContours.length === 0) return undefined;

  const options = geometry.parameters?.options ?? {};
  if (options.bevelEnabled && options.bevelThickness > 0 && options.bevelSize > 0) {
    return extrudeBeveledContours(
      module,
      usableContours,
      minZ,
      maxZ,
      options.bevelThickness,
      options.bevelSize,
      options.bevelSegments ?? 1,
      transform,
      planarOffset,
    );
  }
  return extrudeContours(module, usableContours, 'EvenOdd', minZ, height, transform, planarOffset);
}

function extrudeBeveledContours(
  module: ManifoldToplevel,
  contours: Array<Array<[number, number]>>,
  minZ: number,
  maxZ: number,
  bevelThickness: number,
  bevelSize: number,
  bevelSegments: number,
  transform: THREE.Matrix4,
  planarOffset: number,
): KernelSolid {
  const section = module.CrossSection.ofPolygons(contours, 'EvenOdd');
  const printableSection = planarOffset > 0 ? section.offset(planarOffset, 'Miter') : section;
  const solids: KernelSolid[] = [];
  const segments = Math.max(1, Math.round(bevelSegments));
  const thickness = Math.min(bevelThickness, (maxZ - minZ) / 2);
  const coreBottom = minZ + thickness;
  const coreTop = maxZ - thickness;
  const layerOverlap = PLANAR_JOIN_OVERLAP;
  try {
    for (let index = 0; index < segments; index += 1) {
      const bottom = minZ + index * thickness / segments;
      const top = minZ + (index + 1) * thickness / segments + layerOverlap;
      const inset = -bevelSize * (1 - index / segments);
      solids.push(extrudeOffsetSection(printableSection, inset, bottom, top));
    }
    if (coreTop > coreBottom) {
      solids.push(extrudeSection(
        printableSection,
        coreBottom - layerOverlap,
        coreTop + layerOverlap,
      ));
    }
    for (let index = 0; index < segments; index += 1) {
      const bottom = coreTop + index * thickness / segments - layerOverlap;
      const top = coreTop + (index + 1) * thickness / segments;
      const inset = -bevelSize * ((index + 1) / segments);
      solids.push(extrudeOffsetSection(printableSection, inset, bottom, top));
    }
    const local = module.Manifold.union(solids);
    try {
      return local.transform(transform.elements as unknown as Parameters<KernelSolid['transform']>[0]);
    } finally {
      local.delete();
    }
  } finally {
    solids.forEach((solid) => solid.delete());
    if (printableSection !== section) printableSection.delete();
    section.delete();
  }
}

function extrudeOffsetSection(
  section: InstanceType<ManifoldToplevel['CrossSection']>,
  offset: number,
  bottom: number,
  top: number,
): KernelSolid {
  const layer = section.offset(offset, 'Miter');
  try {
    return extrudeSection(layer, bottom, top);
  } finally {
    layer.delete();
  }
}

function extrudeSection(
  section: InstanceType<ManifoldToplevel['CrossSection']>,
  bottom: number,
  top: number,
): KernelSolid {
  const extruded = section.extrude(top - bottom);
  try {
    return extruded.translate(0, 0, bottom);
  } finally {
    extruded.delete();
  }
}

function extrudeContours(
  module: ManifoldToplevel,
  contours: Array<Array<[number, number]>>,
  fillRule: 'EvenOdd' | 'Positive',
  minZ: number,
  height: number,
  transform: THREE.Matrix4,
  planarOffset: number,
): KernelSolid {
  const crossSection = module.CrossSection.ofPolygons(contours, fillRule);
  const offsetSection = planarOffset > 0 ? crossSection.offset(planarOffset, 'Miter') : undefined;
  const printableSection = offsetSection?.simplify(INPUT_TOLERANCE) ?? crossSection;
  try {
    const localSolid = extrudeSection(printableSection, minZ, minZ + height);
    try {
      return localSolid.transform(transform.elements as unknown as Parameters<KernelSolid['transform']>[0]);
    } finally {
      localSolid.delete();
    }
  } finally {
    if (printableSection !== crossSection) printableSection.delete();
    offsetSection?.delete();
    crossSection.delete();
  }
}

function toKernelContour(points: THREE.Vector2[]): Array<[number, number]> {
  const contour = points.map(({ x, y }): [number, number] => [x, y]);
  const first = contour[0];
  const last = contour[contour.length - 1];
  if (first && last && Math.abs(first[0] - last[0]) <= INPUT_TOLERANCE
    && Math.abs(first[1] - last[1]) <= INPUT_TOLERANCE) {
    contour.pop();
  }
  return contour;
}

function toKernelMesh(
  module: ManifoldToplevel,
  source: THREE.BufferGeometry,
  transform: THREE.Matrix4,
): InstanceType<ManifoldToplevel['Mesh']> {
  let geometry = source.clone();
  for (const attribute of Object.keys(geometry.attributes)) {
    if (attribute !== 'position') geometry.deleteAttribute(attribute);
  }
  geometry = BufferGeometryUtils.mergeVertices(geometry, INPUT_TOLERANCE);
  geometry.applyMatrix4(transform);
  if (transform.determinant() < 0) flipWinding(geometry);
  removeDegenerateTriangles(geometry);

  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!position || !index) {
    geometry.dispose();
    throw new Error('Деталь не содержит индексированной треугольной геометрии.');
  }
  const vertProperties = new Float32Array(position.count * 3);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    vertProperties[vertex * 3] = position.getX(vertex);
    vertProperties[vertex * 3 + 1] = position.getY(vertex);
    vertProperties[vertex * 3 + 2] = position.getZ(vertex);
  }
  const triVerts = new Uint32Array(index.array);
  geometry.dispose();
  return new module.Mesh({ numProp: 3, vertProperties, triVerts, tolerance: INPUT_TOLERANCE });
}

function fromKernelMesh(mesh: InstanceType<ManifoldToplevel['Mesh']>): THREE.BufferGeometry {
  // Property vertices are stored in each original mesh's local frame; every
  // triangle run carries the matrix that places it in the result. Expanding
  // the corners here is intentional: STL is triangle soup, so this is the
  // exact coordinate representation the slicer will receive.
  const positions = new Float32Array(mesh.triVerts.length * 3);
  const point = new THREE.Vector3();
  for (let run = 0; run < mesh.numRun; run += 1) {
    const start = mesh.runIndex[run];
    const end = mesh.runIndex[run + 1] ?? mesh.triVerts.length;
    const transform = new THREE.Matrix4();
    if (mesh.runTransform.length >= (run + 1) * 12) {
      const offset = run * 12;
      const source = mesh.runTransform;
      transform.set(
        source[offset], source[offset + 3], source[offset + 6], source[offset + 9],
        source[offset + 1], source[offset + 4], source[offset + 7], source[offset + 10],
        source[offset + 2], source[offset + 5], source[offset + 8], source[offset + 11],
        0, 0, 0, 1,
      );
    }
    for (let corner = start; corner < end; corner += 1) {
      const vertex = mesh.triVerts[corner];
      point.set(
        mesh.vertProperties[vertex * mesh.numProp],
        mesh.vertProperties[vertex * mesh.numProp + 1],
        mesh.vertProperties[vertex * mesh.numProp + 2],
      ).applyMatrix4(transform);
      positions[corner * 3] = point.x;
      positions[corner * 3 + 1] = point.y;
      positions[corner * 3 + 2] = point.z;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function flipWinding(geometry: THREE.BufferGeometry): void {
  const index = geometry.getIndex();
  if (!index) return;
  for (let offset = 0; offset < index.count; offset += 3) {
    const first = index.getX(offset);
    index.setX(offset, index.getX(offset + 2));
    index.setX(offset + 2, first);
  }
  index.needsUpdate = true;
}
