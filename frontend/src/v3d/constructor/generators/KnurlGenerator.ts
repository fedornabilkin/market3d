import * as THREE from 'three';

/**
 * Knurl (насечки) generator settings.
 */
export interface KnurlSettings {
  /** Outer diameter of the knurl ridges (mm). */
  outerDiameter: number;
  /** Inner (root) diameter where grooves sit (mm). */
  innerDiameter: number;
  /** Total cylinder height (mm). */
  height: number;
  /** Number of ridges around the circumference. */
  notchCount: number;
  /** Knurl pattern type. */
  pattern: 'straight' | 'diagonal' | 'diamond' | 'cross45' | 'flatDiamond';
  /** Helix angle for diagonal/diamond patterns (degrees, 0..60). Ignored for 'cross45' / 'flatDiamond' (fixed 45°). */
  angle: number;
  /** Angular segments per ridge (resolution). */
  segmentsPerNotch: number;
  /** Vertical grid resolution. */
  heightSegments: number;
}

export const DEFAULT_KNURL_SETTINGS: KnurlSettings = {
  outerDiameter: 10,
  innerDiameter: 9,
  height: 10,
  notchCount: 16,
  pattern: 'straight',
  angle: 30,
  segmentsPerNotch: 4,
  heightSegments: 12,
};

/**
 * Generates a closed (watertight) cylinder with surface knurl (notches).
 *
 * Topology: outer grid with varying radius, capped at top/bottom by triangle
 * fans from the center axis directly to the wavy outer edge (no innerR ring,
 * no annulus). This keeps the triangle count low and avoids degenerate sliver
 * triangles at V-groove bottoms that would explode the CSG BSP tree.
 *
 * Profile: triangular V-groove, period = 1.
 *   Groove is at phase 0.5 (depth = full); ridge tip at phase 0 / 1 (depth = 0).
 *   No smoothing — sharp ridges and sharp valleys.
 *
 * Patterns:
 *   - straight: vertical V-grooves
 *   - diagonal: helical V-grooves
 *   - diamond:  two V-grooves crossing at ±angle → rhombus-shaped raised pads
 *               at the cylinder surface, separated by V-cuts.
 *   - cross45:  two V-grooves at ±45° from the vertical axis (so they cross at
 *               90° to each other). Produces square raised pads.
 *   - flatDiamond: like cross45, but grooves are trapezoidal (flat bottoms),
 *                  giving wider flat pads at outerR separated by flat-floored cuts.
 */
export function generateKnurlGeometry(settings: KnurlSettings): THREE.BufferGeometry {
  const {
    outerDiameter,
    innerDiameter,
    height,
    notchCount,
    pattern,
    angle,
    segmentsPerNotch,
    heightSegments,
  } = settings;

  const outerR = outerDiameter / 2;
  const innerR = innerDiameter / 2;
  const depth = Math.max(0, outerR - innerR);
  const meanR = (outerR + innerR) / 2 || 1;

  // Helix twist coefficient: dPhase per unit of y.
  // For angle α from the cylinder axis, one ridge advances by tan(α) horizontally per dy.
  // Converting horizontal distance to angular: dθ = dy * tan(α) / meanR.
  // In normalized phase (notch units): dPhase/dy = (notchCount / (2π)) * tan(α) / meanR.
  const fixed45 = pattern === 'cross45' || pattern === 'flatDiamond';
  const effectiveAngle = fixed45 ? 45 : angle;
  const angleRad = (effectiveAngle * Math.PI) / 180;
  const tiltK = (notchCount / (2 * Math.PI)) * Math.tan(angleRad) / meanR;

  /** V-groove depth fraction at normalized phase (period = 1). Sharp triangle. */
  function vGroove(phase: number): number {
    const p = ((phase % 1) + 1) % 1;
    return 1 - Math.abs(2 * p - 1);
  }

  /**
   * Trapezoidal groove depth fraction at normalized phase (period = 1).
   * Center 25% of the period is flat bottom (depth = 1); next 12.5% on each
   * side ramps to 0; outer 25% on each side stays at the surface (depth = 0).
   */
  function trapGroove(phase: number): number {
    const p = ((phase % 1) + 1) % 1;
    const q = Math.abs(p - 0.5);
    const halfFlat = 0.125;
    const slope = 0.125;
    if (q <= halfFlat) return 1;
    if (q <= halfFlat + slope) return 1 - (q - halfFlat) / slope;
    return 0;
  }

  /** Outer radius at (θ, y) given the current pattern. */
  function profileRadius(theta: number, y: number): number {
    const angularPhase = (theta * notchCount) / (2 * Math.PI);
    let g: number;
    if (pattern === 'straight') {
      g = vGroove(angularPhase);
    } else if (pattern === 'diagonal') {
      g = vGroove(angularPhase - y * tiltK);
    } else if (pattern === 'flatDiamond') {
      const gL = trapGroove(angularPhase - y * tiltK);
      const gR = trapGroove(angularPhase + y * tiltK);
      g = Math.max(gL, gR);
    } else {
      // diamond / cross45: two V-grooves crossing — the deeper cut wins, so the
      // intersection between cuts forms a rhombus/square pad at outerR.
      const gL = vGroove(angularPhase - y * tiltK);
      const gR = vGroove(angularPhase + y * tiltK);
      g = Math.max(gL, gR);
    }
    return outerR - depth * g;
  }

  // ── Grid resolution ──────────────────────────────────────────────
  // For diamond/cross45/flatDiamond the two crossing helices produce raised pads
  // spaced π·R/notchCount along Y, so we need ≥3 samples per pad to keep them
  // distinguishable. Capped to keep the triangle count manageable for CSG.
  const isCrossed = pattern === 'diamond' || pattern === 'cross45' || pattern === 'flatDiamond';
  const minSegPerNotch = isCrossed ? Math.max(segmentsPerNotch, 6) : segmentsPerNotch;
  const aSegs = Math.min(512, Math.max(notchCount * 2, notchCount * minSegPerNotch));

  let hSegs = Math.max(2, heightSegments);
  if (isCrossed) {
    const padsY = (height * notchCount) / (Math.PI * meanR);
    hSegs = Math.min(192, Math.max(hSegs, Math.ceil(padsY * 3)));
  }
  const hSteps = hSegs + 1;

  const positions: number[] = [];
  const indices: number[] = [];

  // ── 1. Outer surface grid ───────────────────────────────────────
  for (let ai = 0; ai <= aSegs; ai++) {
    const theta = (ai / aSegs) * Math.PI * 2;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    for (let hi = 0; hi < hSteps; hi++) {
      const y = (hi / hSegs) * height;
      const r = profileRadius(theta, y);
      positions.push(r * ct, y, r * st);
    }
  }

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

  // ── Center-axis vertices for cap fans ───────────────────────────
  const bottomCenterIdx = positions.length / 3;
  positions.push(0, 0, 0);
  const topCenterIdx = positions.length / 3;
  positions.push(0, height, 0);

  // ── 2. Bottom cap (triangle fan from center → outer bottom row) ─
  // No annulus / no innerR ring: connecting directly to the wavy outer ring
  // avoids degenerate sliver triangles where the V-groove bottom touches
  // innerR (those previously caused CSG to explode the BSP tree).
  for (let ai = 0; ai < aSegs; ai++) {
    const oA = ai * hSteps;
    const oB = (ai + 1) * hSteps;
    indices.push(bottomCenterIdx, oA, oB);
  }

  // ── 3. Top cap (triangle fan from center → outer top row) ───────
  for (let ai = 0; ai < aSegs; ai++) {
    const oA = ai * hSteps + (hSteps - 1);
    const oB = (ai + 1) * hSteps + (hSteps - 1);
    indices.push(topCenterIdx, oB, oA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Sharp ridges/valleys are rendered via material.flatShading on the consuming
  // mesh — keeping the geometry indexed (without toNonIndexed) avoids producing
  // many near-coincident sliver triangles that break CSG when the knurl is
  // grouped with other primitives (e.g. a central hole cylinder).
  return geometry;
}
