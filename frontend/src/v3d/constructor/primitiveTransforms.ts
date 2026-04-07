/**
 * Pure functions for primitive modification, displacement, and rotation baking.
 * Extracted from ConstructorSceneService for testability.
 */

/** Normalize angle to [-PI, PI] range. */
export function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number }

export interface GeometryParams {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  tube?: number;
  innerRadius?: number;
  outerRadius?: number;
  radiusTop?: number;
  radiusBottom?: number;
  [key: string]: unknown;
}

export interface NodeTransform {
  position: Vec3;
  scale: Vec3;
  rotation: Vec3;
}

// ─── Modification (growDim) ──────────────────────────────────────────

export interface GrowDimResult {
  newGeomValue: number;
  positionShift: number;
}

/**
 * Compute new geometry dimension value and position shift when dragging an edge handle.
 * The opposite face stays fixed: position shifts by half the delta.
 *
 * @param currentValue  Current geometry param value (e.g., width)
 * @param delta         World-space drag delta (positive = grow in handle direction)
 * @param posSign       +1 or -1: direction position shifts to keep opposite face fixed
 * @returns New geometry value (min 0.01) and position shift along the axis
 */
export function growDimPrimitive(
  currentValue: number,
  delta: number,
  posSign: number,
): GrowDimResult {
  const newGeomValue = Math.max(0.01, currentValue + delta);
  const positionShift = (delta / 2) * posSign;
  return { newGeomValue, positionShift };
}

// ─── Height modification ─────────────────────────────────────────────

/**
 * Half-height from center to the bottom face.
 * Used to convert between "bottom-on-grid" position semantics and Three.js center semantics.
 */
export function getHalfHeight(
  type: string,
  geom: GeometryParams,
): number {
  const h = geom.height ?? 1;
  const r = geom.radius ?? 0.5;
  switch (type) {
    case 'box':
    case 'cylinder':
    case 'cone':
    case 'plane':
      return h / 2;
    case 'sphere':
      return r;
    case 'torus':
      return geom.tube ?? 0.2;
    case 'ring':
      return geom.outerRadius ?? r;
    default:
      return h / 2;
  }
}

// ─── Vertical offset ─────────────────────────────────────────────────

/**
 * Apply vertical offset (offsetY handle). Pure translation along Y.
 * With optional snap to grid.
 */
export function applyOffsetY(
  currentY: number,
  dy: number,
  snapStep: number,
): number {
  let y = currentY + dy;
  if (snapStep > 0) {
    y = Math.round(y / snapStep) * snapStep;
  }
  return y;
}

// ─── Rotation baking ─────────────────────────────────────────────────

export interface DominantAxis {
  axis: number;   // 0=X, 1=Y, 2=Z
  sign: number;   // +1 or -1
}

/**
 * For a given 3D vector, find which world axis (X, Y, Z) it most closely
 * aligns with. Returns null if not within tolerance of any axis.
 */
export function findDominantAxis(
  vx: number,
  vy: number,
  vz: number,
  tolerance = 0.05,
): DominantAxis | null {
  const abs = [Math.abs(vx), Math.abs(vy), Math.abs(vz)];
  const maxIdx = abs.indexOf(Math.max(...abs));
  if (abs[maxIdx] < 1 - tolerance) return null;
  const vals = [vx, vy, vz];
  return { axis: maxIdx, sign: vals[maxIdx] > 0 ? 1 : -1 };
}

/**
 * Apply a quaternion rotation to a unit vector.
 * q = (x, y, z, w), v = (vx, vy, vz).
 * Returns the rotated vector as [x, y, z].
 */
export function applyQuaternion(
  qx: number, qy: number, qz: number, qw: number,
  vx: number, vy: number, vz: number,
): [number, number, number] {
  // q * v * q^-1, expanded:
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

/**
 * Convert Euler XYZ angles to quaternion (x, y, z, w).
 */
export function eulerToQuaternion(
  rx: number, ry: number, rz: number,
): [number, number, number, number] {
  const c1 = Math.cos(rx / 2), s1 = Math.sin(rx / 2);
  const c2 = Math.cos(ry / 2), s2 = Math.sin(ry / 2);
  const c3 = Math.cos(rz / 2), s3 = Math.sin(rz / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,  // qx
    c1 * s2 * c3 - s1 * c2 * s3,  // qy
    c1 * c2 * s3 + s1 * s2 * c3,  // qz
    c1 * c2 * c3 - s1 * s2 * s3,  // qw
  ];
}

// ─── Axis remapping for rotated groups ──────────────────────────────

/**
 * For a rotated group, determine which local axis most closely aligns
 * with a given world axis direction.
 *
 * Takes Euler XYZ rotation of the group and a world axis ('x', 'y', 'z').
 * Computes the inverse rotation, transforms the world direction into local space,
 * and returns whichever local axis has the largest absolute component.
 *
 * This ensures that when dragging a world-space handle (e.g. edgeWidthRight
 * moves along world X), the scale change is applied to the correct local axis
 * (which may be Z if the group is rotated 90° around Y).
 */
export function remapAxisForRotatedGroup(
  rotation: Vec3,
  worldAxis: 'x' | 'y' | 'z',
): 'x' | 'y' | 'z' {
  // No rotation — identity mapping
  if (Math.abs(rotation.x) < 0.001 && Math.abs(rotation.y) < 0.001 && Math.abs(rotation.z) < 0.001) {
    return worldAxis;
  }

  // Build quaternion from group rotation, then invert it
  const [qx, qy, qz, qw] = eulerToQuaternion(rotation.x, rotation.y, rotation.z);
  // Inverse of unit quaternion: conjugate = (-x, -y, -z, w)
  const iqx = -qx, iqy = -qy, iqz = -qz, iqw = qw;

  // World direction vector
  const wx = worldAxis === 'x' ? 1 : 0;
  const wy = worldAxis === 'y' ? 1 : 0;
  const wz = worldAxis === 'z' ? 1 : 0;

  // Transform world direction into local space
  const [lx, ly, lz] = applyQuaternion(iqx, iqy, iqz, iqw, wx, wy, wz);

  // Pick the local axis with the largest absolute component
  const ax = Math.abs(lx);
  const ay = Math.abs(ly);
  const az = Math.abs(lz);
  if (ax >= ay && ax >= az) return 'x';
  if (ay >= ax && ay >= az) return 'y';
  return 'z';
}

// ─── Scale-based modification (groups / non-primitives) ──────────────

export interface GrowDimByScaleResult {
  newScale: number;
  positionShift: number;
}

/**
 * Compute new scale and position shift when resizing a group via an edge/corner handle.
 * Groups have no geometryParams — size changes go through scale.
 *
 * @param delta         World-space drag delta (mm)
 * @param currentSize   Current bounding box size along this axis (world units)
 * @param currentScale  Current scale value on this axis
 * @param posSign       +1 or -1: direction position shifts to keep opposite face fixed
 * @param bboxMin       Bounding box min along the position axis (for fixed-face calculation)
 * @param bboxMax       Bounding box max along the position axis
 * @param posValue      Current position value on this axis
 */
export function growDimByScale(
  delta: number,
  currentSize: number,
  currentScale: number,
  posSign: number,
  bboxMin: number,
  bboxMax: number,
  posValue: number,
): GrowDimByScaleResult {
  if (currentSize < 0.01) {
    // Fallback for tiny objects
    return {
      newScale: Math.max(0.01, currentScale + delta * 0.01),
      positionShift: (delta / 2) * posSign,
    };
  }

  const scaleDelta = (delta / currentSize) * currentScale;
  const newScale = Math.max(0.01, currentScale + scaleDelta);

  // Keep the opposite face fixed
  const fixedFaceWorld = posSign > 0 ? bboxMin : bboxMax;
  const fixedLocal = (fixedFaceWorld - posValue) / currentScale;
  const positionShift = -(fixedLocal * scaleDelta);

  return { newScale, positionShift };
}

// ─── Rotation baking ─────────────────────────────────────────────────

export interface BakeResult {
  /** Whether baking was applied (rotation was 90°-aligned). */
  baked: boolean;
  /** New geometry params (only width/height/depth changed, for boxes). */
  geom: GeometryParams;
  /** New transform after baking. */
  transform: NodeTransform;
}

/**
 * Detect if rotation is aligned to 90° increments and compute the axis permutation.
 * Returns null if not aligned. Otherwise returns dominant axis mapping for each local axis.
 */
export function detect90Rotation(
  rotation: Vec3,
  tolerance = 0.05,
): { dx: DominantAxis; dy: DominantAxis; dz: DominantAxis } | null {
  const isZero =
    Math.abs(rotation.x) < 0.001 &&
    Math.abs(rotation.y) < 0.001 &&
    Math.abs(rotation.z) < 0.001;
  if (isZero) {
    return {
      dx: { axis: 0, sign: 1 },
      dy: { axis: 1, sign: 1 },
      dz: { axis: 2, sign: 1 },
    };
  }

  const [qx, qy, qz, qw] = eulerToQuaternion(rotation.x, rotation.y, rotation.z);
  const lx = applyQuaternion(qx, qy, qz, qw, 1, 0, 0);
  const ly = applyQuaternion(qx, qy, qz, qw, 0, 1, 0);
  const lz = applyQuaternion(qx, qy, qz, qw, 0, 0, 1);

  const dx = findDominantAxis(lx[0], lx[1], lx[2], tolerance);
  const dy = findDominantAxis(ly[0], ly[1], ly[2], tolerance);
  const dz = findDominantAxis(lz[0], lz[1], lz[2], tolerance);

  if (!dx || !dy || !dz) return null;
  if (dx.axis === dy.axis || dx.axis === dz.axis || dy.axis === dz.axis) return null;

  return { dx, dy, dz };
}

/**
 * Permute scale components according to the 90°-rotation axis mapping.
 */
export function permuteScales(
  scale: Vec3,
  dx: DominantAxis,
  dy: DominantAxis,
  dz: DominantAxis,
): Vec3 {
  const scales = [scale.x, scale.y, scale.z];
  const newScales = [0, 0, 0];
  newScales[dx.axis] = scales[0];
  newScales[dy.axis] = scales[1];
  newScales[dz.axis] = scales[2];
  return { x: newScales[0], y: newScales[1], z: newScales[2] };
}

// ─── Quaternion multiplication ────────────────────────────────────────

/**
 * Multiply two quaternions: result = a * b.
 */
export function multiplyQuaternions(
  ax: number, ay: number, az: number, aw: number,
  bx: number, by: number, bz: number, bw: number,
): [number, number, number, number] {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/**
 * Convert quaternion (x, y, z, w) to Euler XYZ angles.
 */
export function quaternionToEuler(
  qx: number, qy: number, qz: number, qw: number,
): [number, number, number] {
  // Roll (X)
  const sinr = 2 * (qw * qx + qy * qz);
  const cosr = 1 - 2 * (qx * qx + qy * qy);
  const rx = Math.atan2(sinr, cosr);

  // Pitch (Y)
  const sinp = 2 * (qw * qy - qz * qx);
  const ry = Math.abs(sinp) >= 1
    ? (Math.PI / 2) * Math.sign(sinp)
    : Math.asin(sinp);

  // Yaw (Z)
  const siny = 2 * (qw * qz + qx * qy);
  const cosy = 1 - 2 * (qy * qy + qz * qz);
  const rz = Math.atan2(siny, cosy);

  return [rx, ry, rz];
}

// ─── Group rotation baking ───────────────────────────────────────────

export interface ChildTransform {
  position: Vec3;
  rotation: Vec3;
}

/**
 * Bake a group's rotation into its children's transforms.
 *
 * For each child:
 *  - position is rotated by the group's quaternion
 *  - rotation is composed: childNewRot = groupRot * childOldRot
 *
 * Group's own rotation is then reset to 0.
 * Only works for 90°-aligned rotations.
 *
 * @returns null if rotation is not 90°-aligned; otherwise the new child transforms.
 */
export function bakeGroupRotation(
  groupRotation: Vec3,
  children: ChildTransform[],
  tolerance = 0.05,
): { bakedChildren: ChildTransform[] } | null {
  const mapping = detect90Rotation(groupRotation, tolerance);
  if (!mapping) return null;

  const { dx, dy, dz } = mapping;
  const isIdentity = dx.axis === 0 && dy.axis === 1 && dz.axis === 2;

  if (isIdentity) {
    // Just return copies, no changes needed
    return { bakedChildren: children.map(c => ({
      position: { ...c.position },
      rotation: { ...c.rotation },
    })) };
  }

  const [gqx, gqy, gqz, gqw] = eulerToQuaternion(
    groupRotation.x, groupRotation.y, groupRotation.z,
  );

  const bakedChildren = children.map(c => {
    // Rotate child position by group quaternion
    const [px, py, pz] = applyQuaternion(gqx, gqy, gqz, gqw, c.position.x, c.position.y, c.position.z);

    // Compose rotations: groupQuat * childQuat
    const [cqx, cqy, cqz, cqw] = eulerToQuaternion(c.rotation.x, c.rotation.y, c.rotation.z);
    const [nqx, nqy, nqz, nqw] = multiplyQuaternions(gqx, gqy, gqz, gqw, cqx, cqy, cqz, cqw);
    const [rx, ry, rz] = quaternionToEuler(nqx, nqy, nqz, nqw);

    return {
      position: { x: px, y: py, z: pz },
      rotation: { x: normalizeAngle(rx), y: normalizeAngle(ry), z: normalizeAngle(rz) },
    };
  });

  return { bakedChildren };
}

/**
 * If the rotation is aligned to 90° increments, bake it into box dimensions:
 * swap width/height/depth and scale, adjust position.y, reset rotation to 0.
 *
 * Only works for 'box' type. Groups cannot be baked because swapping scale
 * doesn't account for children's individual positions — it would distort the layout.
 * Other primitive types (sphere, cylinder, etc.) are left as-is.
 */
export function bakeRotation(
  type: string,
  geom: GeometryParams,
  transform: NodeTransform,
  tolerance = 0.05,
): BakeResult {
  const rot = transform.rotation;
  const result: BakeResult = {
    baked: false,
    geom: { ...geom },
    transform: {
      position: { ...transform.position },
      scale: { ...transform.scale },
      rotation: { ...transform.rotation },
    },
  };

  // Only box supports baking (dimension swap preserves visual shape).
  // Cylinder/cone can't be baked: geometry is always along local Y,
  // so permuting scale alone doesn't preserve the rotated orientation.
  if (type !== 'box') return result;

  const mapping = detect90Rotation(rot, tolerance);
  if (!mapping) return result;

  const { dx, dy, dz } = mapping;

  // Identity mapping — just zero rotation
  const isIdentity = dx.axis === 0 && dy.axis === 1 && dz.axis === 2;
  if (isIdentity) {
    result.transform.rotation = { x: 0, y: 0, z: 0 };
    result.baked = true;
    return result;
  }

  // Permute scale
  const newScale = permuteScales(transform.scale, dx, dy, dz);
  const s = transform.scale;

  const dims = [geom.width ?? 1, geom.height ?? 1, geom.depth ?? 1];
  const newDims = [0, 0, 0];
  newDims[dx.axis] = dims[0];
  newDims[dy.axis] = dims[1];
  newDims[dz.axis] = dims[2];

  const oldHalfH = (geom.height ?? 1) / 2;
  const newHalfH = newDims[1] / 2;

  result.geom.width = newDims[0];
  result.geom.height = newDims[1];
  result.geom.depth = newDims[2];

  result.transform.position = {
    x: transform.position.x,
    y: transform.position.y + oldHalfH * (s.y ?? 1) - newHalfH * newScale.y,
    z: transform.position.z,
  };

  result.transform.scale = newScale;
  result.transform.rotation = { x: 0, y: 0, z: 0 };
  result.baked = true;

  return result;
}
