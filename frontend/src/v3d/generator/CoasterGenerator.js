import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import BaseGenerator from '@/v3d/generator/base';

function parseHexColor(hexStr, defaultNum) {
  if (hexStr == null || typeof hexStr !== 'string') return defaultNum;
  const hex = hexStr.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return defaultNum;
  return parseInt(hex, 16);
}

export default class CoasterGenerator extends BaseGenerator {
  constructor(options = {}) {
    super();
    this.options = {
      base: { active: true, width: 90, height: 90, depth: 3, cornerRadius: 5, shape: 'circle', color: null, segments: 64 },
      text: { active: false, message: 'ПОДСТАВКА', size: 5, depth: 1, mode: 'straight', circularRadius: 30, color: '#000000' },
      icon: { active: false, ratio: 20, src: undefined, srcCustom: undefined, inverted: false, color: '#000000', offsetX: 0, offsetY: 0 },
      rings: { active: false, count: 3, ringWidth: 1, spacing: 3, startRadius: 15, depth: 1, color: '#000000' },
      keychain: { active: false, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3, mirror: false, color: null, offsetX: 0, offsetY: 0 },
      ...options,
    };
    this.font = new Font(fontInterExtraBold);
  }

  generate() {
    const meshes = {};
    meshes.base = this._createBase();
    if (this.options.rings && this.options.rings.active) {
      meshes.rings = this._createRings();
    }
    if (this.options.text && this.options.text.active) {
      meshes.text = this.options.text.mode === 'circular'
        ? this._createCircularText()
        : this._createStraightText();
    }
    if (this.options.icon && this.options.icon.active) {
      meshes.icon = this._createIcon();
    }
    if (this.options.keychain && this.options.keychain.active) {
      meshes.keychain = this._createKeychain();
    }
    return meshes;
  }

  // ─── Base ──────────────────────────────────────────────

  _createBase() {
    if (!this.options.base.active) return undefined;
    const b = this.options.base;
    const baseColor = parseHexColor(b.color, 0xffffff);
    const material = new THREE.MeshPhongMaterial({ color: baseColor });
    let shape;

    if (b.shape === 'circle') {
      const r = b.width / 2;
      shape = new THREE.Shape();
      shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    } else {
      const w = b.width;
      const h = b.height;
      const cr = Math.min(b.cornerRadius, w / 2, h / 2);
      shape = this.getRoundedRectShape(-w / 2, -h / 2, w, h, cr);
    }

    const segments = b.shape === 'circle' ? (b.segments || 64) : undefined;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: b.depth, bevelEnabled: false, curveSegments: segments,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrix();
    return mesh;
  }

  // ─── Concentric Rings ─────────────────────────────────

  _createRings() {
    const group = new THREE.Group();
    const r = this.options.rings;
    const baseZ = this.options.base.depth;
    const ringColor = parseHexColor(r.color, 0x000000);
    const material = new THREE.MeshPhongMaterial({ color: ringColor });

    const maxRadius = this.options.base.shape === 'circle'
      ? this.options.base.width / 2
      : Math.min(this.options.base.width, this.options.base.height) / 2;

    for (let i = 0; i < r.count; i++) {
      const innerR = r.startRadius + i * (r.ringWidth + r.spacing);
      const outerR = innerR + r.ringWidth;

      if (outerR > maxRadius) break;

      const ringShape = new THREE.Shape();
      ringShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
      ringShape.holes.push(hole);

      const segments = this.options.base.segments || 64;
      const geo = new THREE.ExtrudeGeometry(ringShape, {
        steps: 1, depth: r.depth, bevelEnabled: false, curveSegments: segments,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.z = baseZ;
      mesh.updateMatrix();
      group.add(mesh);
    }
    return group;
  }

  // ─── Straight Text ────────────────────────────────────

  _createStraightText() {
    const group = new THREE.Group();
    const t = this.options.text;
    const baseZ = this.options.base.depth;
    const textColor = parseHexColor(t.color, 0x000000);
    const material = new THREE.MeshPhongMaterial({ color: textColor });

    const lines = t.message.split('\n');
    const lineHeight = t.size * 1.4;
    const totalHeight = lines.length * lineHeight;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const geo = new TextGeometry(line, {
        font: this.font,
        size: t.size,
        depth: t.depth,
      });
      const mesh = new THREE.Mesh(geo, material);
      const size = this.getBoundingBoxSize(mesh);
      const x = -size.x / 2;
      const y = totalHeight / 2 - i * lineHeight - t.size;
      mesh.position.set(x, y, baseZ);
      mesh.updateMatrix();
      group.add(mesh);
    }
    return group;
  }

  // ─── Circular Text ────────────────────────────────────

  _createCircularText() {
    const group = new THREE.Group();
    const t = this.options.text;
    const baseZ = this.options.base.depth;
    const textColor = parseHexColor(t.color, 0x000000);
    const material = new THREE.MeshPhongMaterial({ color: textColor });
    const radius = t.circularRadius || 30;
    const text = t.message;

    if (!text) return group;

    // Measure each character width
    const charData = [];
    for (const ch of text) {
      const geo = new TextGeometry(ch, {
        font: this.font,
        size: t.size,
        depth: t.depth,
      });
      const mesh = new THREE.Mesh(geo, material);
      const sz = this.getBoundingBoxSize(mesh);
      charData.push({ char: ch, width: sz.x, height: sz.y, geo });
    }

    // Total arc length occupied by characters + spacing
    const charSpacing = t.size * 0.15;
    let totalArc = 0;
    for (const cd of charData) {
      totalArc += cd.width + charSpacing;
    }
    totalArc -= charSpacing; // remove trailing space

    const totalAngle = totalArc / radius;
    // Start at top, distribute left-to-right (clockwise from top)
    let angle = Math.PI / 2 + totalAngle / 2;

    for (const cd of charData) {
      const charAngle = cd.width / radius;
      angle -= charAngle / 2;

      const mesh = new THREE.Mesh(cd.geo, material);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      mesh.position.set(x, y, baseZ);
      mesh.rotation.z = angle - Math.PI / 2;

      // Center the character on its position
      const halfW = cd.width / 2;
      const offsetX = -halfW * Math.cos(angle - Math.PI / 2);
      const offsetY = -halfW * Math.sin(angle - Math.PI / 2);
      mesh.position.x += offsetX;
      mesh.position.y += offsetY;

      mesh.updateMatrix();
      group.add(mesh);

      angle -= charAngle / 2 + charSpacing / radius;
    }

    return group;
  }

  // ─── Icon ─────────────────────────────────────────────

  _createIcon() {
    const ic = this.options.icon;
    const svgStr = ic.src || ic.srcCustom;
    if (!svgStr) return undefined;

    const baseZ = this.options.base.depth;
    const iconColor = parseHexColor(ic.color, 0x000000);
    const material = new THREE.MeshPhongMaterial({ color: iconColor });

    const svgLoader = new SVGLoader();
    const svgData = svgLoader.parse(svgStr);
    const svgGroup = new THREE.Group();

    svgData.paths.forEach((path) => {
      const shapes = path.toShapes(!ic.inverted);
      shapes.forEach((shape) => {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: this.options.text.depth || 1,
          bevelEnabled: false,
        });
        const mesh = new THREE.Mesh(geo, material);
        svgGroup.add(mesh);
      });
    });

    // Scale to fit
    const box = new THREE.Box3().setFromObject(svgGroup);
    const svgSize = new THREE.Vector3();
    box.getSize(svgSize);
    const svgCenter = new THREE.Vector3();
    box.getCenter(svgCenter);

    const baseDim = this.options.base.shape === 'circle'
      ? this.options.base.width
      : Math.min(this.options.base.width, this.options.base.height);
    const targetSize = baseDim * (ic.ratio / 100);
    const scaleFactor = targetSize / Math.max(svgSize.x, svgSize.y);

    svgGroup.scale.set(scaleFactor, -scaleFactor, 1); // flip Y for SVG
    svgGroup.updateMatrixWorld(true);

    // Re-center after scaling
    const box2 = new THREE.Box3().setFromObject(svgGroup);
    const center2 = new THREE.Vector3();
    box2.getCenter(center2);

    svgGroup.position.set(
      -center2.x + (ic.offsetX || 0),
      -center2.y + (ic.offsetY || 0),
      baseZ,
    );
    svgGroup.updateMatrix();

    return svgGroup;
  }

  // ─── Keychain ─────────────────────────────────────────

  _createKeychain() {
    const kc = this.options.keychain;
    const b = this.options.base;
    const holeDiam = kc.holeDiameter;
    const bw = kc.borderWidth;
    const tabW = holeDiam + bw;
    const tabH = holeDiam + bw;

    const keychainColor = parseHexColor(kc.color, parseHexColor(b.color, 0xffffff));
    const shape = this.getRoundedRectShape(-tabW / 2, -tabH / 2, tabW, tabH + kc.height, tabH / 2);

    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: b.depth, bevelEnabled: false,
    });

    const material = new THREE.MeshPhongMaterial({ color: keychainColor });
    let mesh = new THREE.Mesh(geo, material);
    mesh.updateMatrix();

    // Hole
    const holeGeo = new THREE.CylinderGeometry(holeDiam / 2, holeDiam / 2, b.depth, 32);
    const holeMesh = new THREE.Mesh(holeGeo, material);
    holeMesh.rotation.x = -Math.PI / 2;
    holeMesh.position.set(0, 0, b.depth / 2);
    holeMesh.updateMatrix();
    mesh = this.subtractMesh(mesh, holeMesh);

    // Position
    const placement = kc.placement || 'left';
    let x, y, zR;
    const halfW = b.width / 2;
    const halfH = (b.shape === 'circle' ? b.width : b.height) / 2;

    if (placement === 'top') {
      x = 0;
      y = halfH + tabW / 2 + kc.height / 2 - bw / 2;
      zR = -Math.PI;
    } else {
      // left
      x = -halfW - tabW / 2 - kc.height / 2 + bw / 2;
      y = 0;
      zR = -Math.PI / 2;
    }

    mesh.position.set(x + (kc.offsetX || 0), y + (kc.offsetY || 0), 0);
    mesh.rotation.z = zR;
    mesh.updateMatrix();
    return mesh;
  }
}
