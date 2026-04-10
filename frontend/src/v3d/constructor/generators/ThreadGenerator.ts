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
}

export const DEFAULT_THREAD_SETTINGS: ThreadSettings = {
  outerDiameter: 10,
  innerDiameter: 8,
  pitch: 2,
  turns: 5,
  profile: 'trapezoid',
  segmentsPerTurn: 64,
};

/**
 * Generates a closed (watertight) thread tube using a cylindrical grid.
 *
 * The mesh is a hollow tube whose outer surface follows the thread profile
 * and whose inner surface is a plain cylinder at (innerR − ε).  The small
 * overlap ensures clean CSG union with a matching cylinder (no coplanar faces).
 *
 * Structure:
 *   1. Outer surface — radius varies with thread profile (innerR … outerR)
 *   2. Inner surface — constant radius (innerR − ε), reversed winding
 *   3. Bottom annular cap connecting outer → inner at y = 0
 *   4. Top annular cap connecting outer → inner at y = totalHeight
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
  } = settings;

  const outerR = outerDiameter / 2;
  const innerR = innerDiameter / 2;
  const depth = outerR - innerR;
  const totalHeight = pitch * turns;

  // Small inward overlap so the inner wall penetrates a matching cylinder,
  // avoiding coplanar-face issues during CSG union.
  const CSG_OVERLAP = 0.01;
  const innerWallR = innerR - CSG_OVERLAP;

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
    const helixShift = (theta / (Math.PI * 2)) * pitch;
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

  // ── 2. Inner surface: same angular/height grid at innerWallR ───────
  const innerOff = (aSegs + 1) * hSteps;
  for (let ai = 0; ai <= aSegs; ai++) {
    const theta = (ai / aSegs) * Math.PI * 2;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    for (let hi = 0; hi < hSteps; hi++) {
      const y = (hi / hSegs) * totalHeight;
      positions.push(innerWallR * ct, y, innerWallR * st);
    }
  }

  // Inner surface indices (reversed winding → normals point inward)
  for (let ai = 0; ai < aSegs; ai++) {
    for (let hi = 0; hi < hSteps - 1; hi++) {
      const a = innerOff + ai * hSteps + hi;
      const b = a + 1;
      const c = innerOff + (ai + 1) * hSteps + hi;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // ── 3. Bottom annular cap (y = 0) ──────────────────────────────────
  for (let ai = 0; ai < aSegs; ai++) {
    const oA = ai * hSteps;            // outer, this angle
    const oB = (ai + 1) * hSteps;      // outer, next angle
    const iA = innerOff + ai * hSteps;  // inner, this angle
    const iB = innerOff + (ai + 1) * hSteps;
    // Downward (−Y) normal
    indices.push(oA, iA, oB);
    indices.push(oB, iA, iB);
  }

  // ── 4. Top annular cap (y = totalHeight) ───────────────────────────
  for (let ai = 0; ai < aSegs; ai++) {
    const oA = ai * hSteps + (hSteps - 1);
    const oB = (ai + 1) * hSteps + (hSteps - 1);
    const iA = innerOff + ai * hSteps + (hSteps - 1);
    const iB = innerOff + (ai + 1) * hSteps + (hSteps - 1);
    // Upward (+Y) normal
    indices.push(oA, oB, iA);
    indices.push(oB, iB, iA);
  }

  // ── Assemble ───────────────────────────────────────────────────────
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
