import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import fontInterExtraBoldItalic from '@/assets/fonts/Inter_ExtraBold_Italic.json';
import fontInterSemiBold from '@/assets/fonts/Inter_SemiBold.json';
import fontInterSemiBoldItalic from '@/assets/fonts/Inter_SemiBold_Italic.json';
import BaseGenerator from '@/v3d/generator/base';

const BUNDLED_FONTS = {
  Inter_ExtraBold: fontInterExtraBold,
  Inter_ExtraBold_Italic: fontInterExtraBoldItalic,
  Inter_SemiBold: fontInterSemiBold,
  Inter_SemiBold_Italic: fontInterSemiBoldItalic,
};

export function getBundledFontList() {
  return [
    { value: 'Inter_ExtraBold', label: 'Inter ExtraBold' },
    { value: 'Inter_ExtraBold_Italic', label: 'Inter ExtraBold Italic' },
    { value: 'Inter_SemiBold', label: 'Inter SemiBold' },
    { value: 'Inter_SemiBold_Italic', label: 'Inter SemiBold Italic' },
  ];
}

function parseHexColor(hexStr, defaultNum) {
  if (hexStr == null || typeof hexStr !== 'string') return defaultNum;
  const hex = hexStr.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return defaultNum;
  return parseInt(hex, 16);
}

// Deterministic pseudo-random from seed + index. Keeps letter heights stable
// across regenerations unless seed changes.
function seededRandom(seed, index) {
  const x = Math.sin(seed * 9301 + index * 49297 + 233.333) * 43758.5453;
  return x - Math.floor(x);
}

export default class NameTagGenerator extends BaseGenerator {
  constructor(options = {}) {
    super();
    this.options = {
      message: 'NAME',
      fontName: 'Inter_ExtraBold',
      customFontData: null,
      size: 18,
      depth: 2,
      letterSpacing: 1.2,
      color: '#2b6cb0',
      backing: { active: true, padding: 4, depth: 2, color: '#ffffff', curveSegments: 6 },
      bevel: { active: true, size: 0.3, thickness: 0.3, segments: 3 },
      hollow: { active: false, wallThickness: 0.8, floorThickness: 0.6 },
      randomHeight: { active: false, variance: 0.35, seed: 42 },
      keychain: { active: true, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3, color: null, offsetX: 0, offsetY: 0 },
      ...options,
    };
    this.font = this._loadFont();
  }

  _loadFont() {
    const custom = this.options.customFontData;
    if (custom) {
      try {
        const data = typeof custom === 'string' ? JSON.parse(custom) : custom;
        return new Font(data);
      } catch (e) {
        console.warn('NameTagGenerator: custom font parse failed, falling back to bundled.', e);
      }
    }
    const bundled = BUNDLED_FONTS[this.options.fontName] || fontInterExtraBold;
    return new Font(bundled);
  }

  generate() {
    const meshes = {};
    const message = (this.options.message || '').toString();
    if (!message.trim()) return meshes;

    if (this.options.backing && this.options.backing.active) {
      const backing = this._createBacking(message);
      if (backing) meshes.backing = backing;
    }

    const letters = this._createLetters(message);
    if (letters) meshes.letters = letters;

    if (this.options.keychain && this.options.keychain.active) {
      const keychain = this._createKeychain(message);
      if (keychain) meshes.keychain = keychain;
    }

    return meshes;
  }

  // ─── Letter layout ─────────────────────────────────────

  /** Computes per-glyph advance widths and total width so letters + backing share layout. */
  _computeLayout(message) {
    const fontData = this.font.data;
    const scale = this.options.size / fontData.resolution;
    const spacing = this.options.letterSpacing || 0;

    const chars = Array.from(message);
    const infos = [];
    let cursor = 0;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '\n') {
        // Multi-line intentionally unsupported for v1 — collapse to space.
        infos.push({ char: ' ', x: cursor, advance: fontData.resolution * 0.3 * scale, printable: false });
        cursor += fontData.resolution * 0.3 * scale + spacing;
        continue;
      }
      const glyph = fontData.glyphs[ch] || fontData.glyphs['?'] || { ha: fontData.resolution * 0.5 };
      const advance = glyph.ha * scale;
      infos.push({ char: ch, x: cursor, advance, printable: ch !== ' ' });
      cursor += advance + spacing;
    }

    const totalWidth = cursor > 0 ? cursor - spacing : 0;
    return { infos, totalWidth, scale };
  }

  // ─── Backing plate that follows the text contour ──────

  _createBacking(message) {
    const b = this.options.backing;
    const layout = this._computeLayout(message);

    const padding = Math.max(0, b.padding || 0);
    const depth = Math.max(0.1, b.depth || 1);
    const curveSegments = b.curveSegments || 6;
    // Arc resolution scales with padding so larger plates still look round.
    const arcSegments = Math.max(4, Math.round(padding * 1.5) + 4);

    // Build shapes per-glyph and offset their x by layout.infos[i].x so the
    // backing uses the same letterSpacing-aware positions as _createLetters.
    // Using font.generateShapes(message) would ignore letterSpacing and make
    // the plate drift left/right of the text.
    const backingShapes = [];
    for (const info of layout.infos) {
      if (!info.printable) continue;
      const glyphShapes = this.font.generateShapes(info.char, this.options.size);
      for (const shape of glyphShapes) {
        const pts = shape.getPoints(curveSegments);
        if (pts.length < 3) continue;
        const shifted = pts.map((p) => new THREE.Vector2(p.x + info.x, p.y));
        const closed = shifted[0].equals(shifted[shifted.length - 1])
          ? shifted.slice(0, -1)
          : shifted;
        const offset = padding > 0
          ? this._offsetPolygonRounded(closed, padding, arcSegments)
          : closed.slice();
        if (offset.length < 3) continue;
        backingShapes.push(new THREE.Shape(offset));
      }
    }
    if (!backingShapes.length) return null;

    const material = new THREE.MeshPhongMaterial({ color: parseHexColor(b.color, 0xffffff) });

    // Merge overlapping per-letter plates into one continuous solid via CSG
    // union. Without this, letters that overlap after offsetting leave visible
    // seams and z-fighting on the top face. Falls back to multi-shape extrusion
    // if any union step fails (degenerate glyphs, etc).
    let mesh = null;
    try {
      for (const shape of backingShapes) {
        const geo = new THREE.ExtrudeGeometry([shape], {
          depth,
          bevelEnabled: false,
          curveSegments,
        });
        const part = new THREE.Mesh(geo, material);
        part.updateMatrix();
        mesh = mesh ? this.unionMesh(mesh, part) : part;
      }
    } catch (e) {
      console.warn('NameTagGenerator: backing union failed, using overlapped extrusion', e);
      const geo = new THREE.ExtrudeGeometry(backingShapes, {
        depth,
        bevelEnabled: false,
        curveSegments,
      });
      mesh = new THREE.Mesh(geo, material);
    }

    // Center horizontally (generateShapes lays text starting at x=0). Bottom
    // sits on the grid (z=0); letters go on top via _letterBaseZ().
    mesh.position.set(-layout.totalWidth / 2, -this.options.size / 2, 0);
    mesh.updateMatrix();
    return mesh;
  }

  /** Z offset at which letters rest — on top of the backing if active, else on grid. */
  _letterBaseZ() {
    const b = this.options.backing;
    return b && b.active ? Math.max(0.1, b.depth || 1) : 0;
  }

  /**
   * Rounded polygon offset: every vertex moves outward by `offset`. At convex
   * corners we emit an arc of `arcSegments` samples so the outline looks like
   * a soft stroke instead of sharp miters. At concave/flat corners we use a
   * clamped miter so sharp concave angles don't spike inward.
   */
  _offsetPolygonRounded(points, offset, arcSegments) {
    const n = points.length;
    if (n < 3 || offset <= 0) return points.slice();

    // Signed area > 0 means CCW in math-y-up coords; we use this to flip normal
    // direction so "outward" is consistent for either winding.
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const c = points[(i + 1) % n];
      area += a.x * c.y - c.x * a.y;
    }
    const sign = area >= 0 ? 1 : -1;

    const result = [];
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];

      const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
      const e2x = next.x - curr.x, e2y = next.y - curr.y;
      const l1 = Math.hypot(e1x, e1y) || 1;
      const l2 = Math.hypot(e2x, e2y) || 1;
      const d1x = e1x / l1, d1y = e1y / l1;
      const d2x = e2x / l2, d2y = e2y / l2;

      // Outward normals for each edge (rotate edge -90° when CCW).
      const n1x = sign * d1y, n1y = -sign * d1x;
      const n2x = sign * d2y, n2y = -sign * d2x;

      // Cross product sign in the polygon's winding frame: > 0 = convex corner.
      const convex = sign * (d1x * d2y - d1y * d2x);

      if (convex > 1e-6) {
        // Convex — sweep an arc of radius `offset` from n1 to n2 around curr.
        const a1 = Math.atan2(n1y, n1x);
        const a2 = Math.atan2(n2y, n2x);
        let delta = a2 - a1;
        // Keep the short-way sweep that actually hugs the outward side.
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta <= -Math.PI) delta += 2 * Math.PI;
        const steps = Math.max(1, Math.ceil((Math.abs(delta) / Math.PI) * arcSegments));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const a = a1 + delta * t;
          result.push(new THREE.Vector2(
            curr.x + offset * Math.cos(a),
            curr.y + offset * Math.sin(a),
          ));
        }
      } else {
        // Concave or ~straight — miter with clamp so sharp concave corners
        // don't produce infinite spikes or flip inward.
        let bx = n1x + n2x;
        let by = n1y + n2y;
        const bl = Math.hypot(bx, by);
        let mx, my, miter;
        if (bl < 1e-6) {
          mx = n1x; my = n1y; miter = offset;
        } else {
          bx /= bl; by /= bl;
          const cosHalf = bx * n1x + by * n1y;
          miter = offset / Math.max(cosHalf, 0.25);
          mx = bx; my = by;
        }
        result.push(new THREE.Vector2(curr.x + mx * miter, curr.y + my * miter));
      }
    }
    return result;
  }

  // ─── Letters ──────────────────────────────────────────

  _createLetters(message) {
    const group = new THREE.Group();
    const { infos, totalWidth } = this._computeLayout(message);

    const baseDepth = Math.max(0.1, this.options.depth || 3);
    const material = new THREE.MeshPhongMaterial({
      color: parseHexColor(this.options.color, 0x2b6cb0),
    });

    const rnd = this.options.randomHeight;
    const variance = rnd?.active ? Math.max(0, Math.min(0.9, rnd.variance || 0)) : 0;
    const seed = rnd?.seed ?? 42;

    const bevel = this.options.bevel || {};
    const bevelActive = !!bevel.active;
    const bevelSize = Math.max(0, bevel.size || 0);
    const bevelThickness = Math.max(0, bevel.thickness || 0);
    const bevelSegments = Math.max(1, bevel.segments || 2);

    const hollow = this.options.hollow || {};
    const hollowActive = !!hollow.active;
    const wall = Math.max(0.1, hollow.wallThickness || 0.8);
    const floor = Math.max(0, hollow.floorThickness || 0);

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i];
      if (!info.printable) continue;

      const factor = variance > 0 ? 1 + (seededRandom(seed, i) - 0.5) * 2 * variance : 1;
      const letterDepth = Math.max(0.2, baseDepth * factor);

      // Clamp bevel for this letter so it fits in its depth.
      const maxBevel = Math.max(0, (letterDepth / 2) - 0.01);
      const bt = Math.min(bevelThickness, maxBevel);
      const bs = Math.min(bevelSize, bt);

      let mesh;
      try {
        const geo = new TextGeometry(info.char, {
          font: this.font,
          size: this.options.size,
          depth: letterDepth,
          bevelEnabled: bevelActive && bt > 0,
          bevelSize: bs,
          bevelThickness: bt,
          bevelSegments,
          curveSegments: 6,
        });
        mesh = new THREE.Mesh(geo, material);
      } catch (e) {
        console.warn('NameTagGenerator: glyph failed', info.char, e);
        continue;
      }

      if (hollowActive) {
        const hollowed = this._hollowOutLetter(mesh, material, letterDepth, wall, floor);
        if (hollowed) mesh = hollowed;
      }

      // Position: center text horizontally, align vertical baseline to 0.
      // Lift letters up by the backing depth so they rest on the plate.
      mesh.position.set(info.x - totalWidth / 2, -this.options.size / 2, this._letterBaseZ());
      mesh.updateMatrix();
      group.add(mesh);
    }

    return group;
  }

  _hollowOutLetter(outerMesh, material, letterDepth, wall, floor) {
    // Carve a scaled-down copy of the glyph out of the top face, leaving walls and
    // an optional floor at the bottom. Bounding box gives us a local scale factor.
    const box = new THREE.Box3().setFromObject(outerMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.x < wall * 2.2 || size.y < wall * 2.2) {
      return outerMesh; // too small to hollow safely
    }
    const center = new THREE.Vector3();
    box.getCenter(center);

    const sx = (size.x - wall * 2) / size.x;
    const sy = (size.y - wall * 2) / size.y;

    // Build a simple box that covers the glyph footprint at reduced XY; then intersect
    // with a scaled copy of the outline. Simpler approach: clone outer geometry,
    // scale X/Y around glyph center, and subtract it from the outer mesh.
    const innerGeo = outerMesh.geometry.clone();
    innerGeo.translate(-center.x, -center.y, 0);
    innerGeo.scale(sx, sy, 1);
    innerGeo.translate(center.x, center.y, 0);
    // Lift inner by floor thickness so we keep a floor; extend upward past the top
    // so CSG cleanly removes the top portion.
    innerGeo.translate(0, 0, floor);

    const innerMesh = new THREE.Mesh(innerGeo, material);
    innerMesh.updateMatrix();

    try {
      return this.subtractMesh(outerMesh, innerMesh);
    } catch (e) {
      console.warn('NameTagGenerator: hollow CSG failed', e);
      return outerMesh;
    }
  }

  // ─── Keychain ─────────────────────────────────────────

  _createKeychain(message) {
    const kc = this.options.keychain;
    const b = this.options.backing || {};
    const layout = this._computeLayout(message);

    // Keychain thickness follows the backing plate so it sits flush. If the
    // backing is off, fall back to a reasonable fraction of letter depth.
    const plateDepth = b.active ? Math.max(0.1, b.depth || 1) : Math.max(0.5, this.options.depth / 2);
    const padding = b.active ? Math.max(0, b.padding || 0) : 0;

    // Bounds that the text+backing occupy (after positioning in _createBacking).
    const halfW = layout.totalWidth / 2 + padding;
    const halfH = this.options.size / 2 + padding;

    const holeDiam = Math.max(1, kc.holeDiameter || 6);
    const bw = Math.max(0.5, kc.borderWidth || 3);
    const height = Math.max(0, kc.height || 0);
    const tabW = holeDiam + bw;
    const tabH = holeDiam + bw;

    const keychainColor = parseHexColor(
      kc.color,
      parseHexColor(b.color, 0xffffff),
    );

    const shape = this.getRoundedRectShape(-tabW / 2, -tabH / 2, tabW, tabH + height, tabH / 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: plateDepth, bevelEnabled: false,
    });
    const material = new THREE.MeshPhongMaterial({ color: keychainColor });
    let mesh = new THREE.Mesh(geo, material);
    mesh.updateMatrix();

    // Hole
    const holeGeo = new THREE.CylinderGeometry(holeDiam / 2, holeDiam / 2, plateDepth * 2, 32);
    const holeMesh = new THREE.Mesh(holeGeo, material);
    holeMesh.rotation.x = -Math.PI / 2;
    holeMesh.position.set(0, 0, plateDepth / 2);
    holeMesh.updateMatrix();
    try {
      mesh = this.subtractMesh(mesh, holeMesh);
    } catch (e) {
      console.warn('NameTagGenerator: keychain hole CSG failed', e);
    }

    const placement = kc.placement || 'left';
    let x, y, zR;
    if (placement === 'top') {
      x = 0;
      y = halfH + tabW / 2 + height / 2 - bw / 2;
      zR = -Math.PI;
    } else if (placement === 'topLeft') {
      x = -halfW - tabW / 2 + bw * 1.5;
      y = halfH + tabW / 2 - bw * 1.5;
      zR = -Math.PI / 4 + -Math.PI / 2;
    } else if (placement === 'topRight') {
      x = halfW + tabW / 2 - bw * 1.5;
      y = halfH + tabW / 2 - bw * 1.5;
      zR = Math.PI / 4 + Math.PI / 2;
    } else {
      // left
      x = -halfW - tabW / 2 - height / 2 + bw / 2;
      y = 0;
      zR = -Math.PI / 2;
    }

    mesh.position.set(x + (kc.offsetX || 0), y + (kc.offsetY || 0), 0);
    mesh.rotation.z = zR;
    mesh.updateMatrix();

    if (!kc.mirror) return mesh;

    // Mirror: duplicate on the opposite side of the plate.
    const mirrorGeo = new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: plateDepth, bevelEnabled: false,
    });
    let mirror = new THREE.Mesh(mirrorGeo, material);
    mirror.updateMatrix();
    try {
      mirror = this.subtractMesh(mirror, holeMesh);
    } catch (e) {
      console.warn('NameTagGenerator: mirror keychain hole CSG failed', e);
    }

    let mx, my, mzR;
    if (placement === 'top') {
      mx = x + (kc.offsetX || 0);
      my = -(y + (kc.offsetY || 0));
      mzR = zR + Math.PI;
    } else if (placement === 'left') {
      mx = -(x + (kc.offsetX || 0));
      my = y + (kc.offsetY || 0);
      mzR = zR + Math.PI;
    } else {
      mx = -(x + (kc.offsetX || 0));
      my = -(y + (kc.offsetY || 0));
      mzR = zR + Math.PI;
    }
    mirror.position.set(mx, my, 0);
    mirror.rotation.z = mzR;
    mirror.updateMatrix();

    const group = new THREE.Group();
    group.add(mesh);
    group.add(mirror);
    return group;
  }
}
