import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import polygonClipping from 'polygon-clipping';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import fontInterExtraBoldItalic from '@/assets/fonts/Inter_ExtraBold_Italic.json';
import fontInterSemiBold from '@/assets/fonts/Inter_SemiBold.json';
import fontInterSemiBoldItalic from '@/assets/fonts/Inter_SemiBold_Italic.json';
import BaseGenerator, { parseHexColor } from '@/v3d/generator/base';

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
      message: 'vsqr',
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
    const arcSegments = Math.max(4, Math.round(padding * 1.5) + 4);

    // Collect each offset glyph contour as a polygon-clipping Polygon
    // (array of rings, outer ring first). Holes in glyphs (e.g. 'O' counter)
    // are dropped intentionally — backing should be a filled plate.
    const offsetPolys = [];
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
        offsetPolys.push([offset.map((p) => [p.x, p.y])]);
      }
    }
    if (!offsetPolys.length) return null;

    // 2D polygon union → single multi-polygon with holes where appropriate.
    // Gives a manifold 2D outline — no CSG, no seams, no z-fighting.
    let merged;
    try {
      merged = polygonClipping.union(offsetPolys[0], ...offsetPolys.slice(1));
    } catch (e) {
      console.warn('NameTagGenerator: polygon-clipping union failed, falling back to raw shapes', e);
      merged = offsetPolys.map((poly) => [poly[0]]);
    }

    const shapes = [];
    for (const poly of merged) {
      if (!poly.length || poly[0].length < 3) continue;
      const outer = poly[0].map(([x, y]) => new THREE.Vector2(x, y));
      const shape = new THREE.Shape(outer);
      for (let i = 1; i < poly.length; i++) {
        const hole = poly[i].map(([x, y]) => new THREE.Vector2(x, y));
        if (hole.length >= 3) shape.holes.push(new THREE.Path(hole));
      }
      shapes.push(shape);
    }
    if (!shapes.length) return null;

    const material = new THREE.MeshPhongMaterial({ color: parseHexColor(b.color, 0xffffff) });
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: false,
      curveSegments,
    });
    const mesh = new THREE.Mesh(geo, material);

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
    // an optional floor at the bottom. Uses three-bvh-csg for numerical robustness.
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

    const innerGeo = outerMesh.geometry.clone();
    innerGeo.translate(-center.x, -center.y, 0);
    innerGeo.scale(sx, sy, 1);
    innerGeo.translate(center.x, center.y, 0);
    innerGeo.translate(0, 0, floor);

    try {
      const outerBrush = new Brush(this.prepForBvhCsg(outerMesh.geometry));
      outerBrush.updateMatrixWorld();
      const innerBrush = new Brush(this.prepForBvhCsg(innerGeo));
      innerBrush.updateMatrixWorld();

      const evaluator = new Evaluator();
      const result = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
      // Weld coincident vertices produced by BVH CSG to guarantee a manifold mesh.
      result.geometry = BufferGeometryUtils.mergeVertices(result.geometry, 1e-4);
      result.geometry.computeVertexNormals();
      result.material = material;
      return result;
    } catch (e) {
      console.warn('NameTagGenerator: hollow BVH CSG failed', e);
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

    return this.buildKeychainTab({
      kc,
      depth: plateDepth,
      plateHalfW: layout.totalWidth / 2 + padding,
      plateHalfH: this.options.size / 2 + padding,
      tabShape: 'pill',
      plateColor: b.color,
    });
  }
}
