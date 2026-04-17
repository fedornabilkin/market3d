import * as THREE from 'three';

/**
 * Thread (screw) generator settings.
 */
export interface ThreadSettings {
  /** Outer diameter of the thread (mm). */
  outerDiameter: number;
  /** Inner diameter (root diameter, mm). */
  innerDiameter: number;
  /** Thread pitch — axial distance per full turn (mm). */
  pitch: number;
  /** Number of full turns. */
  turns: number;
  /** Thread profile: 'trapezoid' for now. */
  profile: 'trapezoid';
  /** Segments per turn (helix resolution). */
  segmentsPerTurn: number;
  /** Left-hand thread when true; right-hand (default) when false/omitted. */
  leftHand?: boolean;
}

export const DEFAULT_THREAD_SETTINGS: ThreadSettings = {
  outerDiameter: 10,
  innerDiameter: 8,
  pitch: 2,
  turns: 5,
  profile: 'trapezoid',
  segmentsPerTurn: 64,
  leftHand: false,
};

/**
 * Generates a closed (watertight) solid cylinder with a helical thread ridge.
 *
 * Structure:
 *   1. Outer surface — grid where r = profileRadius(θ, y) ∈ [innerR … outerR].
 *      Root sections (r=innerR) form the bare cylinder; peak sections (r=outerR)
 *      form the thread ridge.
 *   2. Bottom / top "tooth-flange" annuli at y=0 and y=H — flat rings between
 *      the outer surface (varying r) and the cap-edge ring (constant r=innerR).
 *   3. Bottom / top caps — plain disks of radius innerR (clean cylindrical ends,
 *      no thread-shaped jags).
 *
 * Because both caps are circular disks at r=innerR, CSG unions with any external
 * cylinder are clean and do not produce voids regardless of cylinder height.
 *
 * The helix runs along the Y axis.
 */
export function generateThreadGeometry(settings: ThreadSettings): THREE.BufferGeometry {
  const {
    outerDiameter,
    innerDiameter,
    pitch,
    turns,
    segmentsPerTurn,
    leftHand,
  } = settings;
  const handSign = leftHand ? 1 : -1;

  const outerR = outerDiameter / 2;
  const innerR = innerDiameter / 2;
  const depth = outerR - innerR;
  const totalHeight = pitch * turns;

  // ── Trapezoidal profile parameters ─────────────────────────────────
  const flatTop = depth * 0.25;
  const flankWidth = pitch * 0.25 - flatTop / 2;
  const toothEnd = flankWidth * 2 + flatTop; // ≈ pitch * 0.5

  /** Returns outer radius at a given thread phase (periodic, period = pitch). */
  function profileRadius(phase: number): number {
    const p = ((phase % pitch) + pitch) % pitch;
    if (p < flankWidth) {
      return innerR + depth * (p / flankWidth);
    } else if (p < flankWidth + flatTop) {
      return outerR;
    } else if (p < toothEnd) {
      return innerR + depth * (1 - (p - flankWidth - flatTop) / flankWidth);
    }
    return innerR;
  }

  // ── Grid resolution ────────────────────────────────────────────────
  const aSegs = segmentsPerTurn;
  const heightSegsPerPitch = Math.max(8, Math.round(segmentsPerTurn / 4));
  const hSegs = heightSegsPerPitch * turns;
  const hSteps = hSegs + 1;

  const positions: number[] = [];
  const indices: number[] = [];

  // ── 1. Outer surface: (aSegs+1) × hSteps grid ─────────────────────
  for (let ai = 0; ai <= aSegs; ai++) {
    const theta = (ai / aSegs) * Math.PI * 2;
    const helixShift = (theta / (Math.PI * 2)) * pitch * handSign;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    for (let hi = 0; hi < hSteps; hi++) {
      const y = (hi / hSegs) * totalHeight;
      const r = profileRadius(y - helixShift);
      positions.push(r * ct, y, r * st);
    }
  }

  // Outer surface indices (outward winding)
  for (let ai = 0; ai < aSegs; ai++) {
    for (let hi = 0; hi < hSteps - 1; hi++) {
      const a = ai * hSteps + hi;
      const b = a + 1;
      const c = (ai + 1) * hSteps + hi;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // ── Cap-edge rings at r = innerR (one vertex per angular segment) ─
  const bottomRingOff = positions.length / 3;
  for (let ai = 0; ai <= aSegs; ai++) {
    const theta = (ai / aSegs) * Math.PI * 2;
    positions.push(innerR * Math.cos(theta), 0, innerR * Math.sin(theta));
  }
  const topRingOff = positions.length / 3;
  for (let ai = 0; ai <= aSegs; ai++) {
    const theta = (ai / aSegs) * Math.PI * 2;
    positions.push(innerR * Math.cos(theta), totalHeight, innerR * Math.sin(theta));
  }

  // ── Axis center vertices for cap triangle fans ────────────────────
  const bottomCenterIdx = positions.length / 3;
  positions.push(0, 0, 0);
  const topCenterIdx = positions.length / 3;
  positions.push(0, totalHeight, 0);

  // ── 2. Bottom tooth-flange annulus (y = 0, −Y normal) ─────────────
  // Thin flat ring between outer (varying r) and cap-edge ring (r=innerR).
  // Collapses to zero area where outer r == innerR (root sections).
  for (let ai = 0; ai < aSegs; ai++) {
    const oA = ai * hSteps;
    const oB = (ai + 1) * hSteps;
    const cA = bottomRingOff + ai;
    const cB = bottomRingOff + (ai + 1);
    indices.push(oA, oB, cA);
    indices.push(oB, cB, cA);
  }

  // ── 3. Top tooth-flange annulus (y = totalHeight, +Y normal) ──────
  for (let ai = 0; ai < aSegs; ai++) {
    const oA = ai * hSteps + (hSteps - 1);
    const oB = (ai + 1) * hSteps + (hSteps - 1);
    const cA = topRingOff + ai;
    const cB = topRingOff + (ai + 1);
    indices.push(oA, cA, oB);
    indices.push(oB, cA, cB);
  }

  // ── 4. Bottom cap disk (y = 0, −Y normal) ─────────────────────────
  for (let ai = 0; ai < aSegs; ai++) {
    const cA = bottomRingOff + ai;
    const cB = bottomRingOff + (ai + 1);
    indices.push(bottomCenterIdx, cA, cB);
  }

  // ── 5. Top cap disk (y = totalHeight, +Y normal) ──────────────────
  for (let ai = 0; ai < aSegs; ai++) {
    const cA = topRingOff + ai;
    const cB = topRingOff + (ai + 1);
    indices.push(topCenterIdx, cB, cA);
  }

  // ── Assemble ───────────────────────────────────────────────────────
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
