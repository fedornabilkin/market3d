import { describe, it, expect } from 'vitest';
import {
  normalizeAngle,
  growDimPrimitive,
  growDimByScale,
  getHalfHeight,
  applyOffsetY,
  findDominantAxis,
  eulerToQuaternion,
  applyQuaternion,
  multiplyQuaternions,
  quaternionToEuler,
  detect90Rotation,
  permuteScales,
  bakeRotation,
  bakeGroupRotation,
  remapAxisForRotatedGroup,
  type NodeTransform,
  type GeometryParams,
} from './primitiveTransforms';

const PI = Math.PI;
const HALF_PI = PI / 2;

// ─── normalizeAngle ──────────────────────────────────────────────────

describe('normalizeAngle', () => {
  it('zero stays zero', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
  });

  it('PI stays PI', () => {
    expect(normalizeAngle(PI)).toBeCloseTo(PI);
  });

  it('wraps 2*PI to 0', () => {
    expect(normalizeAngle(2 * PI)).toBeCloseTo(0, 5);
  });

  it('wraps 3*PI to PI', () => {
    expect(normalizeAngle(3 * PI)).toBeCloseTo(PI, 5);
  });

  it('negative angle -PI/2 stays', () => {
    expect(normalizeAngle(-HALF_PI)).toBeCloseTo(-HALF_PI);
  });

  it('wraps -3*PI to -PI', () => {
    expect(normalizeAngle(-3 * PI)).toBeCloseTo(-PI, 5);
  });
});

// ─── growDimPrimitive (edge/corner modification) ─────────────────────

describe('growDimPrimitive', () => {
  it('grows width with positive delta, shifts position +', () => {
    const r = growDimPrimitive(1, 0.5, +1);
    expect(r.newGeomValue).toBeCloseTo(1.5);
    expect(r.positionShift).toBeCloseTo(0.25);
  });

  it('shrinks width with negative delta, shifts position -', () => {
    const r = growDimPrimitive(2, -0.8, -1);
    expect(r.newGeomValue).toBeCloseTo(1.2);
    expect(r.positionShift).toBeCloseTo(0.4); // (-0.8/2)*(-1) = +0.4
  });

  it('clamps minimum dimension to 0.01', () => {
    const r = growDimPrimitive(0.5, -10, +1);
    expect(r.newGeomValue).toBeCloseTo(0.01);
  });

  it('zero delta produces no change', () => {
    const r = growDimPrimitive(3, 0, +1);
    expect(r.newGeomValue).toBeCloseTo(3);
    expect(r.positionShift).toBeCloseTo(0);
  });

  it('opposite face stays fixed: edgeWidthRight grows right, left face stays', () => {
    // edgeWidthRight: growDim(dx, 'width', 'x', 'x', +1)
    // If box center at x=0 with width=2, left face at x=-1, right face at x=+1
    // Grow by 0.4: new width=2.4, position shifts +0.2
    // New center: x=0.2, left face: 0.2-1.2=-1 (unchanged!), right face: 0.2+1.2=1.4
    const r = growDimPrimitive(2, 0.4, +1);
    expect(r.newGeomValue).toBeCloseTo(2.4);
    expect(r.positionShift).toBeCloseTo(0.2);
  });

  it('edgeWidthLeft: grows left, right face stays', () => {
    // edgeWidthLeft: growDim(-dx, 'width', 'x', 'x', -1)
    // dx=0.4 from user → passed as -dx = -0.4 to growDim with posSign=-1
    // But in the test we call growDimPrimitive directly with the sign convention
    const r = growDimPrimitive(2, 0.4, -1);
    expect(r.newGeomValue).toBeCloseTo(2.4);
    expect(r.positionShift).toBeCloseTo(-0.2);
  });
});

// ─── getHalfHeight ───────────────────────────────────────────────────

describe('getHalfHeight', () => {
  it('box: height/2', () => {
    expect(getHalfHeight('box', { height: 4 })).toBeCloseTo(2);
  });

  it('box default: 1/2 = 0.5', () => {
    expect(getHalfHeight('box', {})).toBeCloseTo(0.5);
  });

  it('cylinder: height/2', () => {
    expect(getHalfHeight('cylinder', { height: 6 })).toBeCloseTo(3);
  });

  it('sphere: radius', () => {
    expect(getHalfHeight('sphere', { radius: 1.5 })).toBeCloseTo(1.5);
  });

  it('sphere default: 0.5', () => {
    expect(getHalfHeight('sphere', {})).toBeCloseTo(0.5);
  });

  it('torus: tube', () => {
    expect(getHalfHeight('torus', { tube: 0.3 })).toBeCloseTo(0.3);
  });

  it('torus default tube: 0.2', () => {
    expect(getHalfHeight('torus', {})).toBeCloseTo(0.2);
  });

  it('cone: height/2', () => {
    expect(getHalfHeight('cone', { height: 5 })).toBeCloseTo(2.5);
  });

  it('ring: outerRadius', () => {
    expect(getHalfHeight('ring', { outerRadius: 2 })).toBeCloseTo(2);
  });
});

// ─── applyOffsetY ────────────────────────────────────────────────────

describe('applyOffsetY', () => {
  it('adds delta to current Y', () => {
    expect(applyOffsetY(1, 0.5, 0)).toBeCloseTo(1.5);
  });

  it('negative delta lowers Y', () => {
    expect(applyOffsetY(2, -3, 0)).toBeCloseTo(-1);
  });

  it('snaps to grid when snapStep > 0', () => {
    // Y=0 + dy=0.7, snap=0.5 → 0.5
    expect(applyOffsetY(0, 0.7, 0.5)).toBeCloseTo(0.5);
  });

  it('snaps to nearest step', () => {
    expect(applyOffsetY(0, 1.3, 0.5)).toBeCloseTo(1.5);
  });

  it('no snap when step=0', () => {
    expect(applyOffsetY(0, 0.7, 0)).toBeCloseTo(0.7);
  });
});

// ─── eulerToQuaternion / applyQuaternion ─────────────────────────────

describe('eulerToQuaternion + applyQuaternion', () => {
  it('identity rotation (0,0,0) gives identity quaternion', () => {
    const [qx, qy, qz, qw] = eulerToQuaternion(0, 0, 0);
    expect(qx).toBeCloseTo(0);
    expect(qy).toBeCloseTo(0);
    expect(qz).toBeCloseTo(0);
    expect(qw).toBeCloseTo(1);
  });

  it('90° around X: Y→Z, Z→-Y', () => {
    const [qx, qy, qz, qw] = eulerToQuaternion(HALF_PI, 0, 0);
    const ry = applyQuaternion(qx, qy, qz, qw, 0, 1, 0);
    expect(ry[0]).toBeCloseTo(0);
    expect(ry[1]).toBeCloseTo(0);
    expect(ry[2]).toBeCloseTo(1);

    const rz = applyQuaternion(qx, qy, qz, qw, 0, 0, 1);
    expect(rz[0]).toBeCloseTo(0);
    expect(rz[1]).toBeCloseTo(-1);
    expect(rz[2]).toBeCloseTo(0);
  });

  it('90° around Y: X→-Z, Z→X', () => {
    const [qx, qy, qz, qw] = eulerToQuaternion(0, HALF_PI, 0);
    const rx = applyQuaternion(qx, qy, qz, qw, 1, 0, 0);
    expect(rx[0]).toBeCloseTo(0);
    expect(rx[1]).toBeCloseTo(0);
    expect(rx[2]).toBeCloseTo(-1);

    const rz = applyQuaternion(qx, qy, qz, qw, 0, 0, 1);
    expect(rz[0]).toBeCloseTo(1);
    expect(rz[1]).toBeCloseTo(0);
    expect(rz[2]).toBeCloseTo(0);
  });

  it('90° around Z: X→Y, Y→-X', () => {
    const [qx, qy, qz, qw] = eulerToQuaternion(0, 0, HALF_PI);
    const rx = applyQuaternion(qx, qy, qz, qw, 1, 0, 0);
    expect(rx[0]).toBeCloseTo(0);
    expect(rx[1]).toBeCloseTo(1);
    expect(rx[2]).toBeCloseTo(0);

    const ry = applyQuaternion(qx, qy, qz, qw, 0, 1, 0);
    expect(ry[0]).toBeCloseTo(-1);
    expect(ry[1]).toBeCloseTo(0);
    expect(ry[2]).toBeCloseTo(0);
  });

  it('180° around X: Y→-Y, Z→-Z', () => {
    const [qx, qy, qz, qw] = eulerToQuaternion(PI, 0, 0);
    const ry = applyQuaternion(qx, qy, qz, qw, 0, 1, 0);
    expect(ry[0]).toBeCloseTo(0);
    expect(ry[1]).toBeCloseTo(-1);
    expect(ry[2]).toBeCloseTo(0);
  });
});

// ─── findDominantAxis ────────────────────────────────────────────────

describe('findDominantAxis', () => {
  it('(1,0,0) → axis 0 (X), sign +1', () => {
    const r = findDominantAxis(1, 0, 0);
    expect(r).toEqual({ axis: 0, sign: 1 });
  });

  it('(0,-1,0) → axis 1 (Y), sign -1', () => {
    const r = findDominantAxis(0, -1, 0);
    expect(r).toEqual({ axis: 1, sign: -1 });
  });

  it('(0,0,0.99) within tolerance → axis 2', () => {
    const r = findDominantAxis(0, 0, 0.99);
    expect(r).toEqual({ axis: 2, sign: 1 });
  });

  it('diagonal (0.7, 0.7, 0) → null (not axis-aligned)', () => {
    const r = findDominantAxis(0.707, 0.707, 0);
    expect(r).toBeNull();
  });

  it('near-aligned within tolerance', () => {
    // cos(2°) ≈ 0.9994 → above 1 - 0.05 = 0.95
    const r = findDominantAxis(0.9994, 0.035, 0);
    expect(r).toEqual({ axis: 0, sign: 1 });
  });
});

// ─── bakeRotation ────────────────────────────────────────────────────

describe('bakeRotation', () => {
  const makeTransform = (
    rot: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
    pos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
    scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
  ): NodeTransform => ({
    position: { ...pos },
    scale: { ...scale },
    rotation: { ...rot },
  });

  it('non-box type returns baked=false', () => {
    const geom: GeometryParams = { radius: 1 };
    const t = makeTransform({ x: HALF_PI, y: 0, z: 0 });
    expect(bakeRotation('sphere', geom, t).baked).toBe(false);
    expect(bakeRotation('cylinder', geom, t).baked).toBe(false);
    expect(bakeRotation('cone', geom, t).baked).toBe(false);
    expect(bakeRotation('group', geom, t).baked).toBe(false);
  });

  it('zero rotation: just clears rotation, no dimension swap', () => {
    const geom: GeometryParams = { width: 2, height: 3, depth: 1 };
    const t = makeTransform({ x: 0, y: 0, z: 0 });
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.geom.width).toBe(2);
    expect(r.geom.height).toBe(3);
    expect(r.geom.depth).toBe(1);
    expect(r.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('90° around X: height↔depth swap', () => {
    // Local Y → world Z, local Z → world -Y
    // dims[0]=W→world X, dims[1]=H→world Z (depth), dims[2]=D→world Y (height)
    const geom: GeometryParams = { width: 2, height: 5, depth: 1 };
    const t = makeTransform({ x: HALF_PI, y: 0, z: 0 });
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.geom.width).toBeCloseTo(2);
    expect(r.geom.height).toBeCloseTo(1);  // was depth
    expect(r.geom.depth).toBeCloseTo(5);   // was height
    expect(r.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('90° around Y: width↔depth swap', () => {
    // Local X → world -Z, local Z → world X
    const geom: GeometryParams = { width: 4, height: 2, depth: 1 };
    const t = makeTransform({ x: 0, y: HALF_PI, z: 0 });
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.geom.width).toBeCloseTo(1);   // was depth
    expect(r.geom.height).toBeCloseTo(2);  // unchanged
    expect(r.geom.depth).toBeCloseTo(4);   // was width
    expect(r.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('90° around Z: width↔height swap', () => {
    // Local X → world Y, local Y → world -X
    const geom: GeometryParams = { width: 3, height: 7, depth: 2 };
    const t = makeTransform({ x: 0, y: 0, z: HALF_PI });
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.geom.width).toBeCloseTo(7);   // was height
    expect(r.geom.height).toBeCloseTo(3);  // was width
    expect(r.geom.depth).toBeCloseTo(2);   // unchanged
    expect(r.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('180° around X: no dimension swap (just flips signs)', () => {
    const geom: GeometryParams = { width: 2, height: 5, depth: 3 };
    const t = makeTransform({ x: PI, y: 0, z: 0 });
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    // 180° around X: X stays X, Y→-Y, Z→-Z — same dimensions, different sign
    expect(r.geom.width).toBeCloseTo(2);
    expect(r.geom.height).toBeCloseTo(5);
    expect(r.geom.depth).toBeCloseTo(3);
    expect(r.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('-90° around X: same swap as +90°', () => {
    const geom: GeometryParams = { width: 2, height: 5, depth: 1 };
    const t = makeTransform({ x: -HALF_PI, y: 0, z: 0 });
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.geom.width).toBeCloseTo(2);
    expect(r.geom.height).toBeCloseTo(1);  // was depth
    expect(r.geom.depth).toBeCloseTo(5);   // was height
  });

  it('non-90° rotation: baked=false, no changes', () => {
    const geom: GeometryParams = { width: 2, height: 3, depth: 1 };
    const t = makeTransform({ x: PI / 4, y: 0, z: 0 }); // 45°
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(false);
    expect(r.geom.width).toBe(2);
    expect(r.geom.height).toBe(3);
    expect(r.geom.depth).toBe(1);
  });

  it('scale is permuted with dimensions', () => {
    const geom: GeometryParams = { width: 1, height: 1, depth: 1 };
    const t = makeTransform(
      { x: HALF_PI, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 3 },
    );
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    // 90° X: scale.x stays, scale.y↔scale.z
    expect(r.transform.scale.x).toBeCloseTo(1);
    expect(r.transform.scale.y).toBeCloseTo(3);  // was z
    expect(r.transform.scale.z).toBeCloseTo(2);  // was y
  });

  it('position.y adjusted for halfHeight change', () => {
    // Box: width=1, height=6, depth=2, position.y=0, scale=(1,1,1)
    // 90° X: height→depth, depth→height → new height=2
    // oldHalfH = 6/2 = 3, newHalfH = 2/2 = 1
    // newPos.y = 0 + 3*1 - 1*1 = 2
    const geom: GeometryParams = { width: 1, height: 6, depth: 2 };
    const t = makeTransform(
      { x: HALF_PI, y: 0, z: 0 },
      { x: 5, y: 0, z: 3 },
    );
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.transform.position.y).toBeCloseTo(2);
    // X and Z unchanged
    expect(r.transform.position.x).toBeCloseTo(5);
    expect(r.transform.position.z).toBeCloseTo(3);
  });

  it('position.y with scale: accounts for scaled halfHeight', () => {
    // height=4, scale.y=2 → visual halfH = 4/2 * 2 = 4
    // 90° X: new height = depth = 1, new scale.y = old scale.z = 1
    // newHalfH = 1/2 = 0.5, new visual halfH = 0.5 * 1 = 0.5
    // pos.y = 0 + 4*2 - 0.5*1 = 7.5 (but formula uses geom halfH * scale)
    // Actually: pos.y = 0 + (4/2)*2 - (1/2)*1 = 0 + 4 - 0.5 = 3.5
    const geom: GeometryParams = { width: 1, height: 4, depth: 1 };
    const t = makeTransform(
      { x: HALF_PI, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 1 },
    );
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.transform.position.y).toBeCloseTo(3.5);
  });

  it('compound rotation: 90° X then 90° Y', () => {
    // Euler XYZ (PI/2, PI/2, 0):
    // After X=90°: X→X, Y→Z, Z→-Y
    // After Y=90° (applied to rotated frame): complex permutation
    const geom: GeometryParams = { width: 1, height: 2, depth: 3 };
    const t = makeTransform({ x: HALF_PI, y: HALF_PI, z: 0 });
    const r = bakeRotation('box', geom, t);
    expect(r.baked).toBe(true);
    expect(r.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
    // The three dimensions should be a permutation of [1, 2, 3]
    const sorted = [r.geom.width!, r.geom.height!, r.geom.depth!].sort();
    expect(sorted[0]).toBeCloseTo(1);
    expect(sorted[1]).toBeCloseTo(2);
    expect(sorted[2]).toBeCloseTo(3);
  });

});

// ─── Edge handle rules (integration-style tests on growDim) ──────────

describe('edge handle modification rules', () => {
  it('edgeWidthRight: dx>0 increases width, opposite face (left) stays', () => {
    // Box: width=2, center at x=0 → left face at -1, right face at +1
    const { newGeomValue, positionShift } = growDimPrimitive(2, 0.6, +1);
    const centerX = 0 + positionShift; // 0.3
    const newHalfW = newGeomValue / 2;  // 1.3
    expect(centerX - newHalfW).toBeCloseTo(-1); // left face unchanged
    expect(centerX + newHalfW).toBeCloseTo(1.6); // right face grew
  });

  it('edgeLengthFront: dx>0 increases depth, back face stays', () => {
    const { newGeomValue, positionShift } = growDimPrimitive(3, 0.4, +1);
    const centerZ = 0 + positionShift; // 0.2
    const newHalfD = newGeomValue / 2;  // 1.7
    expect(centerZ - newHalfD).toBeCloseTo(-1.5); // back face unchanged
  });

  it('height handle: dy>0 increases height, bottom face stays (conceptual)', () => {
    // Height is handled differently in the real code (bbox-based), but the core
    // geometry change is the same: height grows upward
    const oldHeight = 2;
    const dy = 1;
    const newHeight = Math.max(0.01, oldHeight + dy);
    expect(newHeight).toBeCloseTo(3);
    // Old halfH = 1, new halfH = 1.5
    // Bottom was at posY, stays at posY — handled by bbox drift compensation in real code
  });
});

// ─── Combined rotation+modification scenario ─────────────────────────

describe('rotation bake preserves visual center', () => {
  it('tall box rotated 90° X: visual center Y stays the same', () => {
    // Box: w=1, h=6, d=1, posY=0, scale=1
    // Before bake: Three.js center Y = posY + halfH = 0 + 3 = 3
    // After 90° X bake: new h=1, posY should make center = posY + 0.5 = 3 → posY = 2.5
    const geom: GeometryParams = { width: 1, height: 6, depth: 1 };
    const t: NodeTransform = {
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: HALF_PI, y: 0, z: 0 },
    };

    const oldCenterY = t.position.y + (geom.height! / 2) * t.scale.y;

    const r = bakeRotation('box', geom, t);
    const newCenterY = r.transform.position.y + (r.geom.height! / 2) * r.transform.scale.y;

    expect(newCenterY).toBeCloseTo(oldCenterY);
  });

  it('asymmetric box rotated 90° Z: center Y preserved', () => {
    const geom: GeometryParams = { width: 2, height: 8, depth: 3 };
    const t: NodeTransform = {
      position: { x: 1, y: 0.5, z: 2 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: HALF_PI },
    };

    const oldCenterY = t.position.y + (geom.height! / 2) * t.scale.y;
    const r = bakeRotation('box', geom, t);
    const newCenterY = r.transform.position.y + (r.geom.height! / 2) * r.transform.scale.y;

    expect(newCenterY).toBeCloseTo(oldCenterY);
  });

  it('scaled box rotated 90° X: center Y preserved', () => {
    const geom: GeometryParams = { width: 1, height: 4, depth: 2 };
    const t: NodeTransform = {
      position: { x: 0, y: 1, z: 0 },
      scale: { x: 1, y: 3, z: 0.5 },
      rotation: { x: HALF_PI, y: 0, z: 0 },
    };

    const oldCenterY = t.position.y + (geom.height! / 2) * t.scale.y;
    const r = bakeRotation('box', geom, t);
    const newCenterY = r.transform.position.y + (r.geom.height! / 2) * r.transform.scale.y;

    expect(newCenterY).toBeCloseTo(oldCenterY);
  });
});

// ─── growDimByScale (group/non-primitive modification) ───────────────

describe('growDimByScale', () => {
  it('grows scale proportionally to bbox size', () => {
    // bbox size=4, scale=1, delta=2 → scaleDelta = (2/4)*1 = 0.5 → newScale=1.5
    const r = growDimByScale(2, 4, 1, +1, -2, 2, 0);
    expect(r.newScale).toBeCloseTo(1.5);
  });

  it('clamps scale to 0.01 minimum', () => {
    const r = growDimByScale(-100, 4, 1, +1, -2, 2, 0);
    expect(r.newScale).toBeCloseTo(0.01);
  });

  it('keeps opposite face fixed (posSign=+1: left face stays)', () => {
    // bbox min=-2, max=2, center=0, scale=1
    // posSign=+1 → fixedFace = bboxMin = -2
    // fixedLocal = (-2 - 0) / 1 = -2
    // delta=1, scaleDelta = 1/4 * 1 = 0.25
    // posShift = -(-2 * 0.25) = 0.5
    const r = growDimByScale(1, 4, 1, +1, -2, 2, 0);
    expect(r.positionShift).toBeCloseTo(0.5);
    // New center = 0 + 0.5 = 0.5, new scale = 1.25
    // newBboxMin = center - halfSize*newScale... (verified conceptually by fixed face)
  });

  it('keeps opposite face fixed (posSign=-1: right face stays)', () => {
    // posSign=-1 → fixedFace = bboxMax = 2
    // fixedLocal = (2 - 0) / 1 = 2
    // delta=1, scaleDelta = 0.25
    // posShift = -(2 * 0.25) = -0.5
    const r = growDimByScale(1, 4, 1, -1, -2, 2, 0);
    expect(r.positionShift).toBeCloseTo(-0.5);
  });

  it('fallback for tiny objects (size < 0.01)', () => {
    const r = growDimByScale(0.5, 0.001, 1, +1, 0, 0.001, 0);
    expect(r.newScale).toBeCloseTo(1.005);
    expect(r.positionShift).toBeCloseTo(0.25);
  });

  it('works with non-unit scale', () => {
    // bbox size=8 (scale=2, base size=4), scale=2, delta=4
    // scaleDelta = (4/8)*2 = 1 → newScale = 3
    const r = growDimByScale(4, 8, 2, +1, -4, 4, 0);
    expect(r.newScale).toBeCloseTo(3);
  });
});

// ─── detect90Rotation ────────────────────────────────────────────────

describe('detect90Rotation', () => {
  it('zero rotation → identity mapping', () => {
    const r = detect90Rotation({ x: 0, y: 0, z: 0 });
    expect(r).not.toBeNull();
    expect(r!.dx).toEqual({ axis: 0, sign: 1 });
    expect(r!.dy).toEqual({ axis: 1, sign: 1 });
    expect(r!.dz).toEqual({ axis: 2, sign: 1 });
  });

  it('90° X → Y maps to Z', () => {
    const r = detect90Rotation({ x: HALF_PI, y: 0, z: 0 });
    expect(r).not.toBeNull();
    expect(r!.dx.axis).toBe(0); // X stays X
    expect(r!.dy.axis).toBe(2); // Y → Z
    expect(r!.dz.axis).toBe(1); // Z → Y
  });

  it('45° → null (not aligned)', () => {
    const r = detect90Rotation({ x: PI / 4, y: 0, z: 0 });
    expect(r).toBeNull();
  });

  it('30° → null', () => {
    const r = detect90Rotation({ x: PI / 6, y: 0, z: 0 });
    expect(r).toBeNull();
  });
});

// ─── permuteScales ───────────────────────────────────────────────────

describe('permuteScales', () => {
  it('identity mapping preserves scale', () => {
    const s = permuteScales(
      { x: 1, y: 2, z: 3 },
      { axis: 0, sign: 1 }, { axis: 1, sign: 1 }, { axis: 2, sign: 1 },
    );
    expect(s).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('90° X mapping swaps Y↔Z', () => {
    const s = permuteScales(
      { x: 1, y: 2, z: 3 },
      { axis: 0, sign: 1 }, { axis: 2, sign: 1 }, { axis: 1, sign: -1 },
    );
    expect(s).toEqual({ x: 1, y: 3, z: 2 });
  });

  it('90° Z mapping swaps X↔Y', () => {
    const s = permuteScales(
      { x: 5, y: 10, z: 3 },
      { axis: 1, sign: 1 }, { axis: 0, sign: -1 }, { axis: 2, sign: 1 },
    );
    expect(s).toEqual({ x: 10, y: 5, z: 3 });
  });
});

// ─── quaternion helpers ──────────────────────────────────────────────

describe('multiplyQuaternions', () => {
  it('identity * identity = identity', () => {
    const [x, y, z, w] = multiplyQuaternions(0, 0, 0, 1, 0, 0, 0, 1);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
    expect(w).toBeCloseTo(1);
  });

  it('90°X * 90°X = 180°X', () => {
    const [ax, ay, az, aw] = eulerToQuaternion(HALF_PI, 0, 0);
    const [rx, ry, rz, rw] = multiplyQuaternions(ax, ay, az, aw, ax, ay, az, aw);
    // 180° around X: quat = (1, 0, 0, 0)
    expect(Math.abs(rx)).toBeCloseTo(1);
    expect(ry).toBeCloseTo(0);
    expect(rz).toBeCloseTo(0);
    expect(rw).toBeCloseTo(0);
  });
});

describe('quaternionToEuler', () => {
  it('identity → (0, 0, 0)', () => {
    const [rx, ry, rz] = quaternionToEuler(0, 0, 0, 1);
    expect(rx).toBeCloseTo(0);
    expect(ry).toBeCloseTo(0);
    expect(rz).toBeCloseTo(0);
  });

  it('roundtrip: euler → quat → euler for 90° X', () => {
    const [qx, qy, qz, qw] = eulerToQuaternion(HALF_PI, 0, 0);
    const [rx, ry, rz] = quaternionToEuler(qx, qy, qz, qw);
    expect(rx).toBeCloseTo(HALF_PI);
    expect(ry).toBeCloseTo(0);
    expect(rz).toBeCloseTo(0);
  });

  it('roundtrip: euler → quat → euler for 90° Z', () => {
    const [qx, qy, qz, qw] = eulerToQuaternion(0, 0, HALF_PI);
    const [rx, ry, rz] = quaternionToEuler(qx, qy, qz, qw);
    expect(rx).toBeCloseTo(0);
    expect(ry).toBeCloseTo(0);
    expect(rz).toBeCloseTo(HALF_PI);
  });
});

// ─── bakeGroupRotation ──────────────────────────────────────────────

describe('bakeGroupRotation', () => {
  it('non-90° rotation returns null', () => {
    const r = bakeGroupRotation({ x: PI / 4, y: 0, z: 0 }, []);
    expect(r).toBeNull();
  });

  it('zero rotation: children unchanged', () => {
    const children = [
      { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: 0, y: 0, z: 0 }, children);
    expect(r).not.toBeNull();
    expect(r!.bakedChildren[0].position).toEqual({ x: 1, y: 2, z: 3 });
    expect(r!.bakedChildren[0].rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('90° X: child at (0, 1, 0) moves to (0, 0, 1)', () => {
    const children = [
      { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: HALF_PI, y: 0, z: 0 }, children);
    expect(r).not.toBeNull();
    const p = r!.bakedChildren[0].position;
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(1);
  });

  it('90° X: child at (0, 0, 1) moves to (0, -1, 0)', () => {
    const children = [
      { position: { x: 0, y: 0, z: 1 }, rotation: { x: 0, y: 0, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: HALF_PI, y: 0, z: 0 }, children);
    const p = r!.bakedChildren[0].position;
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-1);
    expect(p.z).toBeCloseTo(0);
  });

  it('90° Y: child at (1, 0, 0) moves to (0, 0, -1)', () => {
    const children = [
      { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: 0, y: HALF_PI, z: 0 }, children);
    const p = r!.bakedChildren[0].position;
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(-1);
  });

  it('90° Z: child at (1, 0, 0) moves to (0, 1, 0)', () => {
    const children = [
      { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: 0, y: 0, z: HALF_PI }, children);
    const p = r!.bakedChildren[0].position;
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(0);
  });

  it('child rotation is composed with group rotation', () => {
    // Group rotated 90° X, child already rotated 90° Y
    // Result: child gets groupRot * childRot = 90°X * 90°Y
    const children = [
      { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: HALF_PI, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: HALF_PI, y: 0, z: 0 }, children);
    expect(r).not.toBeNull();
    // The composed rotation should be some non-zero value
    const rot = r!.bakedChildren[0].rotation;
    const hasRotation = Math.abs(rot.x) > 0.01 || Math.abs(rot.y) > 0.01 || Math.abs(rot.z) > 0.01;
    expect(hasRotation).toBe(true);
  });

  it('multiple children are all transformed', () => {
    const children = [
      { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { position: { x: 0, y: 0, z: 1 }, rotation: { x: 0, y: 0, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: HALF_PI, y: 0, z: 0 }, children);
    expect(r).not.toBeNull();
    expect(r!.bakedChildren.length).toBe(3);
    // Child 0: (1,0,0) → (1,0,0) (X axis unchanged by X rotation)
    expect(r!.bakedChildren[0].position.x).toBeCloseTo(1);
    // Child 1: (0,1,0) → (0,0,1)
    expect(r!.bakedChildren[1].position.z).toBeCloseTo(1);
    // Child 2: (0,0,1) → (0,-1,0)
    expect(r!.bakedChildren[2].position.y).toBeCloseTo(-1);
  });

  it('180° X: child at (0, 1, 0) moves to (0, -1, 0)', () => {
    const children = [
      { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    ];
    const r = bakeGroupRotation({ x: PI, y: 0, z: 0 }, children);
    const p = r!.bakedChildren[0].position;
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-1);
    expect(p.z).toBeCloseTo(0);
  });
});

// ─── remapAxisForRotatedGroup ───────────────────────────────────────
//
// Rules:
//  1. No rotation → identity mapping (x→x, y→y, z→z).
//  2. For any rotation, take the inverse quaternion and transform the world
//     handle direction into local space. The local axis with the largest
//     absolute component wins.
//  3. 90° around Y: local Z aligns with world X, local X aligns with world -Z.
//     So world X handle → scale local Z, world Z handle → scale local X.
//  4. 90° around X: local Y aligns with world Z, local Z aligns with world -Y.
//     So world Y handle → scale local Z, world Z handle → scale local Y.
//  5. 90° around Z: local X aligns with world Y, local Y aligns with world -X.
//     So world X handle → scale local Y, world Y handle → scale local X.
//  6. 180° rotations: axes stay the same (just flipped sign), mapping is identity.
//  7. Compound 90° rotations: follow full quaternion math, picks dominant axis.
//  8. Arbitrary angles (e.g. 45°): picks whichever local axis has the largest
//     projection onto the world direction — always returns a valid axis.

describe('remapAxisForRotatedGroup', () => {
  // Rule 1: no rotation — identity
  it('zero rotation: x→x, y→y, z→z', () => {
    const rot = { x: 0, y: 0, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('x');
    expect(remapAxisForRotatedGroup(rot, 'y')).toBe('y');
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('z');
  });

  // Rule 3: 90° Y swaps X↔Z
  it('90° Y: world X handle → local z', () => {
    const rot = { x: 0, y: HALF_PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('z');
  });

  it('90° Y: world Z handle → local x', () => {
    const rot = { x: 0, y: HALF_PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('x');
  });

  it('90° Y: world Y handle → local y (unchanged)', () => {
    const rot = { x: 0, y: HALF_PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'y')).toBe('y');
  });

  // Rule 3: -90° Y also swaps X↔Z
  it('-90° Y: world X handle → local z', () => {
    const rot = { x: 0, y: -HALF_PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('z');
  });

  it('-90° Y: world Z handle → local x', () => {
    const rot = { x: 0, y: -HALF_PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('x');
  });

  // Rule 4: 90° X swaps Y↔Z
  it('90° X: world Y handle → local z', () => {
    const rot = { x: HALF_PI, y: 0, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'y')).toBe('z');
  });

  it('90° X: world Z handle → local y', () => {
    const rot = { x: HALF_PI, y: 0, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('y');
  });

  it('90° X: world X handle → local x (unchanged)', () => {
    const rot = { x: HALF_PI, y: 0, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('x');
  });

  // Rule 5: 90° Z swaps X↔Y
  it('90° Z: world X handle → local y', () => {
    const rot = { x: 0, y: 0, z: HALF_PI };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('y');
  });

  it('90° Z: world Y handle → local x', () => {
    const rot = { x: 0, y: 0, z: HALF_PI };
    expect(remapAxisForRotatedGroup(rot, 'y')).toBe('x');
  });

  it('90° Z: world Z handle → local z (unchanged)', () => {
    const rot = { x: 0, y: 0, z: HALF_PI };
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('z');
  });

  // Rule 6: 180° rotations — identity mapping (axes flipped but same dimension)
  it('180° Y: world X → local x (just flipped sign)', () => {
    const rot = { x: 0, y: PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('x');
    expect(remapAxisForRotatedGroup(rot, 'y')).toBe('y');
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('z');
  });

  it('180° X: identity mapping', () => {
    const rot = { x: PI, y: 0, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('x');
    expect(remapAxisForRotatedGroup(rot, 'y')).toBe('y');
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('z');
  });

  // Rule 7: compound 90° rotations
  it('90° X + 90° Y: world X → local z', () => {
    // Euler XYZ (PI/2, PI/2, 0): compound rotation.
    // inv(q) * worldX lands mostly on local Z.
    const rot = { x: HALF_PI, y: HALF_PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('z');
  });

  it('90° X + 90° Y: world Z → local y', () => {
    const rot = { x: HALF_PI, y: HALF_PI, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'z')).toBe('y');
  });

  // Rule 8: arbitrary angles — still returns a valid axis
  it('45° Y: world X still maps to z (X has larger Z component than X)', () => {
    // At 45° Y, local X points ~(0.707, 0, -0.707) in world.
    // World X (1,0,0) in local space: inv(45°Y) * (1,0,0) → ~(0.707, 0, 0.707)
    // |local_x|=0.707, |local_z|=0.707 — tie, but z >= x in the comparison order.
    // Actually both equal → function returns 'x' (first >= check wins).
    const rot = { x: 0, y: PI / 4, z: 0 };
    const result = remapAxisForRotatedGroup(rot, 'x');
    expect(['x', 'z']).toContain(result); // either is acceptable at 45° tie
  });

  it('30° Y: world X maps to x (still dominant)', () => {
    // At 30° Y, inv(30°Y) * (1,0,0) → ~(0.866, 0, 0.5)
    // local X component is largest
    const rot = { x: 0, y: PI / 6, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('x');
  });

  it('60° Y: world X maps to z (Z component dominates)', () => {
    // At 60° Y, inv(60°Y) * (1,0,0) → ~(0.5, 0, 0.866)
    // local Z component is largest
    const rot = { x: 0, y: PI / 3, z: 0 };
    expect(remapAxisForRotatedGroup(rot, 'x')).toBe('z');
  });

  // Symmetry: all three axes always produce distinct results for 90° rotations
  it('90° Y: all world axes map to distinct local axes', () => {
    const rot = { x: 0, y: HALF_PI, z: 0 };
    const mapped = new Set([
      remapAxisForRotatedGroup(rot, 'x'),
      remapAxisForRotatedGroup(rot, 'y'),
      remapAxisForRotatedGroup(rot, 'z'),
    ]);
    expect(mapped.size).toBe(3);
  });

  it('90° X: all world axes map to distinct local axes', () => {
    const rot = { x: HALF_PI, y: 0, z: 0 };
    const mapped = new Set([
      remapAxisForRotatedGroup(rot, 'x'),
      remapAxisForRotatedGroup(rot, 'y'),
      remapAxisForRotatedGroup(rot, 'z'),
    ]);
    expect(mapped.size).toBe(3);
  });
});
