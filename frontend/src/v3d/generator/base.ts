import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
// @ts-ignore — shape.js is plain JS.
import { RectangleRoundedCornerShape } from '@/v3d/primitives/shape';

/**
 * Parses a hex color string ("#rrggbb" or "rrggbb") into a numeric THREE color.
 * Returns `defaultNum` for null/undefined/malformed input.
 */
export function parseHexColor(
  hexStr: string | null | undefined,
  defaultNum: number,
): number {
  if (hexStr == null || typeof hexStr !== 'string') return defaultNum;
  const hex = hexStr.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return defaultNum;
  return parseInt(hex, 16);
}

/**
 * Keychain-tab build parameters.
 *
 * Each generator anchors the keychain differently (plate size vs. text bounds),
 * so the caller supplies `plateHalfW` / `plateHalfH` as the half-extents the tab
 * should attach to, and `depth` as the extrusion thickness (usually equal to the
 * plate depth so the tab sits flush).
 */
export interface KeychainBuildOpts {
  kc: {
    active?: boolean;
    placement?: 'left' | 'top' | 'topLeft' | 'topRight';
    holeDiameter?: number;
    borderWidth?: number;
    height?: number;
    color?: string | null;
    offsetX?: number;
    offsetY?: number;
    mirror?: boolean;
  };
  depth: number;
  plateHalfW: number;
  plateHalfH: number;
  /**
   * 'pill' — all four corners rounded with r = tabH/2 (used by NameTag, Coaster,
   * Braille). 'd' — only the far end rounded, sharp corners on the side that
   * meets the plate (used by QR, GRZ).
   */
  tabShape?: 'pill' | 'd';
  /** Fallback color if `kc.color` is not set. */
  plateColor?: string | null;
}

/**
 * Border-frame build parameters.
 *
 * Собирает «рамку» вокруг плиты одним экструдом: внешний rounded-rect Shape
 * плюс внутренний rounded-rect как Path hole. Манифолд по построению, без CSG.
 */
export interface BorderFrameOpts {
  /** Полная ширина плиты (внешний габарит рамки). */
  width: number;
  /** Полная высота плиты. */
  height: number;
  /** Радиус скругления внешних углов (= cornerRadius плиты). */
  cornerRadius: number;
  /** Толщина рамки от края к центру. */
  borderWidth: number;
  /** Толщина экструзии рамки по Z. */
  borderDepth: number;
  /** Толщина плиты — рамка садится поверх, на z = baseDepth. */
  baseDepth: number;
  /** Цвет рамки. */
  color?: string | null;
}

/**
 * Base class for 3D model generators.
 * Provides common methods for geometries, materials, meshes, and CSG operations.
 */
export default class BaseGenerator {
  /**
   * Creates a basic material with the given color.
   */
  protected createMaterial(color: number | string): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color: color as number });
  }

  /**
   * Returns the size of the given object's bounding box.
   */
  protected getBoundingBoxSize(mesh: THREE.Object3D): THREE.Vector3 {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const target = new THREE.Vector3();
    boundingBox.getSize(target);
    return target;
  }

  /** Delegates to the module-level `parseHexColor` so subclasses can use `this.parseHexColor`. */
  protected parseHexColor(hexStr: string | null | undefined, defaultNum: number): number {
    return parseHexColor(hexStr, defaultNum);
  }

  /**
   * Нормализует геометрию перед отправкой в three-bvh-csg: оставляет только
   * базовые аттрибуты и сшивает совпадающие вершины, превращая non-indexed
   * геометрию в индексированную. Возвращает клон — исходная геометрия не трогается.
   */
  protected prepForBvhCsg(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    let g = geometry.clone();
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    }
    g = BufferGeometryUtils.mergeVertices(g, 1e-5);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  }

  /**
   * Returns a rounded rectangle shape with the given parameters.
   * Taken from: https://threejs.org/examples/webgl_geometry_shapes.html
   */
  protected getCustomRoundedRectShape(
    x: number,
    y: number,
    width: number,
    height: number,
    radiusA: number,
    radiusB: number,
    radiusC: number,
    radiusD: number,
    path: boolean = false
  ): THREE.Shape | THREE.Path {
    const ctx = path ? new THREE.Path() : new THREE.Shape();
    ctx.moveTo(x, y + radiusD);
    ctx.lineTo(x, y + height - radiusA);
    ctx.quadraticCurveTo(x, y + height, x + radiusA, y + height);
    ctx.lineTo(x + width - radiusB, y + height);
    ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radiusB);
    ctx.lineTo(x + width, y + radiusC);
    ctx.quadraticCurveTo(x + width, y, x + width - radiusC, y);
    ctx.lineTo(x + radiusD, y);
    ctx.quadraticCurveTo(x, y, x, y + radiusD);
    return ctx;
  }

  /**
   * Returns a rounded rectangle shape with equal corner radius for each corner.
   */
  protected getRoundedRectShape(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    path: boolean = false
  ): THREE.Shape | THREE.Path {
    return this.getCustomRoundedRectShape(
      x,
      y,
      width,
      height,
      radius,
      radius,
      radius,
      radius,
      path
    );
  }

  /**
   * Собирает меш «ушка» для брелока: манифолдный ExtrudeGeometry из Shape'а
   * с круговым отверстием-Path'ом внутри. Без CSG.
   *
   * Поддерживает четыре варианта размещения (`left`/`top`/`topLeft`/`topRight`)
   * и зеркальное отражение. При `mirror: true` возвращает `THREE.Group` из двух
   * экструдов — они не пересекаются, поэтому объединение не требуется.
   *
   * Позиционирование единое для всех генераторов: край ушка заходит внутрь
   * плиты на `borderWidth / 2`, чтобы при сборке швов не было зазоров.
   */
  protected buildKeychainTab(opts: KeychainBuildOpts): THREE.Mesh | THREE.Group | undefined {
    const { kc, depth, plateHalfW, plateHalfH, tabShape = 'pill', plateColor } = opts;
    if (!kc || !kc.active) return undefined;

    const holeDiam = Math.max(1, kc.holeDiameter || 6);
    const bw = Math.max(0.1, kc.borderWidth || 3);
    const height = Math.max(0, kc.height || 0);
    const tabW = holeDiam + bw;
    const tabH = holeDiam + bw;

    let shape: THREE.Shape;
    if (tabShape === 'd') {
      // D-образная форма: скругляются только углы, противоположные плите.
      shape = new RectangleRoundedCornerShape({
        x: -tabW / 2,
        y: -tabH / 2,
        rA: 0,
        rB: 0,
        rC: tabH / 2,
        rD: tabH / 2,
        w: tabW,
        h: tabH + height,
      }).create();
    } else {
      // Pill: скругление на всех четырёх углах.
      shape = this.getRoundedRectShape(
        -tabW / 2,
        -tabH / 2,
        tabW,
        tabH + height,
        tabH / 2,
      ) as THREE.Shape;
    }

    const holePath = new THREE.Path();
    holePath.absellipse(0, 0, holeDiam / 2, holeDiam / 2, 0, Math.PI * 2, true, 0);
    shape.holes.push(holePath);

    const color = parseHexColor(kc.color, parseHexColor(plateColor, 0xffffff));
    const material = new THREE.MeshPhongMaterial({ color });

    const makeTab = () => {
      const geo = new THREE.ExtrudeGeometry(shape, {
        steps: 1,
        depth,
        bevelEnabled: false,
        curveSegments: 32,
      });
      return new THREE.Mesh(geo, material);
    };

    const placement = kc.placement || 'left';
    let x: number, y: number, zR: number;
    if (placement === 'top') {
      x = 0;
      y = plateHalfH + tabW / 2 + height / 2 - bw / 2;
      zR = -Math.PI;
    } else if (placement === 'topLeft') {
      x = -plateHalfW - tabW / 2 + bw * 1.5;
      y = plateHalfH + tabW / 2 - bw * 1.5;
      zR = -Math.PI / 4 - Math.PI / 2;
    } else if (placement === 'topRight') {
      x = plateHalfW + tabW / 2 - bw * 1.5;
      y = plateHalfH + tabW / 2 - bw * 1.5;
      zR = Math.PI / 4 + Math.PI / 2;
    } else {
      x = -plateHalfW - tabW / 2 - height / 2 + bw / 2;
      y = 0;
      zR = -Math.PI / 2;
    }

    const mesh = makeTab();
    mesh.position.set(x + (kc.offsetX || 0), y + (kc.offsetY || 0), 0);
    mesh.rotation.z = zR;
    mesh.updateMatrix();

    if (!kc.mirror) return mesh;

    const mirror = makeTab();
    let mx: number, my: number, mzR: number;
    if (placement === 'top') {
      mx = x + (kc.offsetX || 0);
      my = -(y + (kc.offsetY || 0));
      mzR = zR + Math.PI;
    } else if (placement === 'topRight') {
      mx = -(x + (kc.offsetX || 0));
      my = -(y + (kc.offsetY || 0));
      mzR = zR - Math.PI;
    } else if (placement === 'topLeft') {
      mx = -(x + (kc.offsetX || 0));
      my = -(y + (kc.offsetY || 0));
      mzR = zR + Math.PI;
    } else {
      mx = -(x + (kc.offsetX || 0));
      my = y + (kc.offsetY || 0);
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

  /**
   * Собирает манифолдную «рамку» вокруг плиты: один ExtrudeGeometry из внешнего
   * rounded-rect Shape'а с внутренним rounded-rect Path hole. Без CSG.
   *
   * Внутренний радиус скругления уменьшается на `borderWidth * sin(π/4)`, чтобы
   * углы рамки оставались равной толщины по нормали к внешнему контуру.
   * Результат позиционируется по Z на `baseDepth` — садится поверх плиты.
   */
  protected buildBorderFrame(opts: BorderFrameOpts): THREE.Mesh {
    const { width, height, cornerRadius, borderWidth, borderDepth, baseDepth, color } = opts;

    const outer = this.getRoundedRectShape(
      -width / 2,
      -height / 2,
      width,
      height,
      cornerRadius,
    ) as THREE.Shape;

    const innerW = width - borderWidth * 2;
    const innerH = height - borderWidth * 2;
    const innerR = Math.max(0, cornerRadius - borderWidth * Math.sin(Math.PI / 4));
    const holePath = this.getRoundedRectShape(
      -innerW / 2,
      -innerH / 2,
      innerW,
      innerH,
      innerR,
      true,
    ) as THREE.Path;
    outer.holes.push(holePath);

    const geo = new THREE.ExtrudeGeometry(outer, {
      steps: 1,
      depth: borderDepth,
      bevelEnabled: false,
    });

    const frameColor = parseHexColor(color, 0x000000);
    const material = new THREE.MeshPhongMaterial({ color: frameColor });
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.z = baseDepth;
    mesh.updateMatrix();
    return mesh;
  }
}
