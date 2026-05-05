import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Indexed BufferGeometry for a box with rounded (beveled) edges.
 * Builds a subdivided unit box, deforms vertices onto a rounded-box surface,
 * then merges duplicate vertices to produce clean indexed geometry
 * compatible with CSG (three-csg-ts) boolean operations.
 */
export class RoundedBoxBufferGeometry extends THREE.BufferGeometry {
  constructor(
    width = 1,
    height = 1,
    depth = 1,
    segments = 2,
    radius = 0.1,
  ) {
    super();

    segments = Math.max(1, Math.round(segments));
    // ensure segments is odd so we have a plane connecting the rounded corners
    segments = segments * 2 + 1;

    // ensure radius isn't bigger than shortest side
    radius = Math.min(width / 2, height / 2, depth / 2, radius);
    if (radius <= 0) {
      // No rounding — just copy a plain box
      const plain = new THREE.BoxGeometry(width, height, depth);
      this.index = plain.index;
      this.attributes = plain.attributes;
      this.groups = plain.groups.slice();
      return;
    }

    // Build a subdivided unit box, then deform it
    const srcBox = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
    const srcNonIndexed = srcBox.toNonIndexed();

    const positions = new Float32Array(srcNonIndexed.attributes.position.array);
    const normals = new Float32Array(srcNonIndexed.attributes.normal.array);
    const uvs = new Float32Array(srcNonIndexed.attributes.uv.array);

    const box = new THREE.Vector3(width, height, depth)
      .divideScalar(2)
      .subScalar(radius);

    const halfSegmentSize = 0.5 / segments;
    const pos = new THREE.Vector3();
    const nrm = new THREE.Vector3();

    for (let i = 0; i < positions.length; i += 3) {
      pos.fromArray(positions, i);
      nrm.copy(pos);
      nrm.x -= Math.sign(nrm.x) * halfSegmentSize;
      nrm.y -= Math.sign(nrm.y) * halfSegmentSize;
      nrm.z -= Math.sign(nrm.z) * halfSegmentSize;
      nrm.normalize();

      positions[i + 0] = box.x * Math.sign(pos.x) + nrm.x * radius;
      positions[i + 1] = box.y * Math.sign(pos.y) + nrm.y * radius;
      positions[i + 2] = box.z * Math.sign(pos.z) + nrm.z * radius;

      normals[i + 0] = nrm.x;
      normals[i + 1] = nrm.y;
      normals[i + 2] = nrm.z;
    }

    // Build non-indexed geometry, then merge duplicates to create indexed version
    const tmpGeom = new THREE.BufferGeometry();
    tmpGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tmpGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    tmpGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const merged = BufferGeometryUtils.mergeVertices(tmpGeom, 0.001);

    this.index = merged.index;
    this.attributes = merged.attributes;

    this.computeBoundingSphere();
    this.computeBoundingBox();
  }
}
