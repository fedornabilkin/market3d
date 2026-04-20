import * as THREE from 'three';

/**
 * A detected edge — either one of the 12 classical box edges, or a circular rim
 * of a cylindrical primitive. Coordinates are in both local geometry and world space.
 */
export interface BBoxEdge {
  /** Linear = straight segment edge; circular = cylinder/cone rim. */
  kind: 'linear' | 'circular';

  /** Dominant axis of a linear edge; for circular rims, the rim's axis normal (always 'y' for cylinders). */
  axis: 'x' | 'y' | 'z';

  // ─── World space (for visuals & hit-testing) ──────────────────────────
  /** Linear: segment start. Circular: rim center. */
  start: THREE.Vector3;
  /** Linear: segment end. Circular: rim center (same as start). */
  end: THREE.Vector3;
  mid: THREE.Vector3;
  /** Linear: [start, end]. Circular: sampled points on the rim circle. */
  worldChain: THREE.Vector3[];

  // ─── Local geometry space (for chamfer creation) ──────────────────────
  localStart: THREE.Vector3;
  localEnd: THREE.Vector3;
  localMid: THREE.Vector3;
  localChain: THREE.Vector3[];

  /**
   * Direction from the edge toward the bbox center in chamfer-local space
   * (where Y is always the edge axis). Values are +1 or -1. Linear only.
   */
  perpDirX: number;
  perpDirZ: number;

  // ─── Circular-only fields ─────────────────────────────────────────────
  /** Rim radius in mesh-local space. */
  radius?: number;
  /** True if this rim sits on the cylinder's top face, false for bottom. */
  isTopRim?: boolean;
}

export interface ChamferSettings {
  radius: number;
  profile: 'convex' | 'concave' | 'flat';
}

/**
 * Chamfer/Fillet mode.
 *
 * Detects 12 classical box edges from the geometry bounding box,
 * highlights the nearest edge on hover, and applies chamfer on click.
 */
export class ChamferMode {
  private active = false;
  private scene: THREE.Scene | null = null;

  private hoveredEdge: BBoxEdge | null = null;
  private edgeHighlight: THREE.Line | null = null;
  private edgeMaterial: THREE.LineBasicMaterial | null = null;
  private previewGroup: THREE.Group | null = null;
  private previewMaterial: THREE.MeshBasicMaterial | null = null;

  private targetObject: THREE.Object3D | null = null;

  private cachedEdges: BBoxEdge[] | null = null;
  private cachedEdgeObjUuid: string | null = null;

  settings: ChamferSettings = { radius: 2, profile: 'concave' };

  onEdgeClick: ((obj: THREE.Object3D, edge: BBoxEdge, settings: ChamferSettings) => void) | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.scene = scene;
  }

  dispose(): void {
    this.clearVisuals();
    this.edgeMaterial?.dispose();
    this.previewMaterial?.dispose();
    this.edgeMaterial = null;
    this.previewMaterial = null;
    this.scene = null;
    this.cachedEdges = null;
    this.cachedEdgeObjUuid = null;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.clearVisuals();
      this.hoveredEdge = null;
      this.targetObject = null;
      this.cachedEdges = null;
      this.cachedEdgeObjUuid = null;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  // ─── Edge detection ──────────────────────────────────────────────────────

  findNearestEdge(obj: THREE.Object3D, hitPoint: THREE.Vector3): BBoxEdge | null {
    const mesh = obj instanceof THREE.Mesh ? obj : this.findFirstMesh(obj);
    if (!mesh || !mesh.geometry) return null;

    mesh.updateMatrixWorld(true);

    if (this.cachedEdgeObjUuid !== mesh.uuid) {
      const nodeType = (mesh.userData as { node?: { type?: string } }).node?.type;
      this.cachedEdges = nodeType === 'cylinder'
        ? this.buildCylinderEdges(mesh)
        : this.buildBoxEdges(mesh);
      this.cachedEdgeObjUuid = mesh.uuid;
    }

    if (!this.cachedEdges || this.cachedEdges.length === 0) return null;
    return this.findClosestEdge(this.cachedEdges, hitPoint, mesh);
  }

  /**
   * Build 12 classical edges of the geometry bounding box.
   *
   * Each edge carries perpDirX / perpDirZ — the direction from the edge
   * toward the bbox center in chamfer-local space (where Y = edge axis).
   *
   * Chamfer group rotation mapping:
   *   Y-axis edge (no rotation):  localX = geomX, localZ = geomZ
   *   X-axis edge (rot z=π/2):    localX = geomY, localZ = geomZ
   *   Z-axis edge (rot x=π/2):    localX = geomX, localZ = −geomY
   */
  private buildBoxEdges(mesh: THREE.Mesh): BBoxEdge[] {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return [];

    const min = bb.min;
    const max = bb.max;
    const wm = mesh.matrixWorld;

    // 8 corners (local geometry space)
    const c = [
      new THREE.Vector3(min.x, min.y, min.z), // 0: left  bottom back
      new THREE.Vector3(max.x, min.y, min.z), // 1: right bottom back
      new THREE.Vector3(max.x, max.y, min.z), // 2: right top    back
      new THREE.Vector3(min.x, max.y, min.z), // 3: left  top    back
      new THREE.Vector3(min.x, min.y, max.z), // 4: left  bottom front
      new THREE.Vector3(max.x, min.y, max.z), // 5: right bottom front
      new THREE.Vector3(max.x, max.y, max.z), // 6: right top    front
      new THREE.Vector3(min.x, max.y, max.z), // 7: left  top    front
    ];

    // [cornerA, cornerB, axis, perpDirX, perpDirZ] in chamfer-local space
    const edgeDefs: [number, number, 'x' | 'y' | 'z', number, number][] = [
      // X-axis edges — perp world axes: Y, Z → chamfer local: X=Y, Z=Z
      [0, 1, 'x', +1, +1], // y=min, z=min → toward center: +Y, +Z → localX=+1, localZ=+1
      [4, 5, 'x', +1, -1], // y=min, z=max → +Y, −Z
      [3, 2, 'x', -1, +1], // y=max, z=min → −Y, +Z
      [7, 6, 'x', -1, -1], // y=max, z=max → −Y, −Z

      // Z-axis edges — perp world axes: X, Y → chamfer local: X=X, Z=−Y
      [0, 4, 'z', +1, -1], // x=min, y=min → +X, +Y → localX=+1, localZ=−(+1)=−1
      [1, 5, 'z', -1, -1], // x=max, y=min → −X, +Y → localX=−1, localZ=−1
      [3, 7, 'z', +1, +1], // x=min, y=max → +X, −Y → localX=+1, localZ=−(−1)=+1
      [2, 6, 'z', -1, +1], // x=max, y=max → −X, −Y → localX=−1, localZ=+1

      // Y-axis edges — perp world axes: X, Z → chamfer local: X=X, Z=Z
      [0, 3, 'y', +1, +1], // x=min, z=min → +X, +Z
      [1, 2, 'y', -1, +1], // x=max, z=min → −X, +Z
      [4, 7, 'y', +1, -1], // x=min, z=max → +X, −Z
      [5, 6, 'y', -1, -1], // x=max, z=max → −X, −Z
    ];

    const result: BBoxEdge[] = [];

    for (const [ai, bi, axis, pdx, pdz] of edgeDefs) {
      const localA = c[ai];
      const localB = c[bi];
      const localMid = localA.clone().lerp(localB, 0.5);

      const worldA = localA.clone().applyMatrix4(wm);
      const worldB = localB.clone().applyMatrix4(wm);
      const worldMid = worldA.clone().lerp(worldB, 0.5);

      result.push({
        kind: 'linear',
        axis,
        start: worldA,
        end: worldB,
        mid: worldMid,
        worldChain: [worldA, worldB],
        localStart: localA.clone(),
        localEnd: localB.clone(),
        localMid,
        localChain: [localA.clone(), localB.clone()],
        perpDirX: pdx,
        perpDirZ: pdz,
      });
    }

    return result;
  }

  /**
   * Build 2 circular rim edges (top + bottom) for a cylinder primitive.
   * Sampled chain points let the visualization draw a smooth arc even after
   * the mesh is rotated in world space.
   */
  private buildCylinderEdges(mesh: THREE.Mesh): BBoxEdge[] {
    const node = (mesh.userData as { node?: { geometryParams?: Record<string, number> } }).node;
    const p = node?.geometryParams;
    if (!p) return [];

    const h = p.height ?? 1;
    const rTop = p.radiusTop ?? p.radius ?? 0.5;
    const rBot = p.radiusBottom ?? p.radius ?? 0.5;
    const wm = mesh.matrixWorld;

    const sampleCount = 48;
    const result: BBoxEdge[] = [];

    for (const rim of [
      { isTop: false, radius: rBot, y: -h / 2 },
      { isTop: true, radius: rTop, y: h / 2 },
    ]) {
      const localChain: THREE.Vector3[] = [];
      const worldChain: THREE.Vector3[] = [];
      for (let i = 0; i < sampleCount; i++) {
        const a = (i / sampleCount) * Math.PI * 2;
        const lv = new THREE.Vector3(Math.cos(a) * rim.radius, rim.y, Math.sin(a) * rim.radius);
        localChain.push(lv);
        worldChain.push(lv.clone().applyMatrix4(wm));
      }
      const localCenter = new THREE.Vector3(0, rim.y, 0);
      const worldCenter = localCenter.clone().applyMatrix4(wm);

      result.push({
        kind: 'circular',
        axis: 'y',
        start: worldCenter.clone(),
        end: worldCenter.clone(),
        mid: worldCenter,
        worldChain,
        localStart: localCenter.clone(),
        localEnd: localCenter.clone(),
        localMid: localCenter,
        localChain,
        perpDirX: 0,
        perpDirZ: 0,
        radius: rim.radius,
        isTopRim: rim.isTop,
      });
    }

    return result;
  }

  private findClosestEdge(edges: BBoxEdge[], hitPoint: THREE.Vector3, mesh: THREE.Mesh): BBoxEdge | null {
    let closest: BBoxEdge | null = null;
    let minDist = Infinity;

    // For circular edges we need the hit point in mesh-local space so radial
    // distance is measured against the unrotated cylinder axis (Y).
    const invMatrix = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const localHit = hitPoint.clone().applyMatrix4(invMatrix);

    for (const edge of edges) {
      const d = edge.kind === 'circular' && edge.radius != null
        ? this.distanceToCircle(localHit, edge.localMid.y, edge.radius)
        : this.distanceToSegment(hitPoint, edge.start, edge.end);
      if (d < minDist) {
        minDist = d;
        closest = edge;
      }
    }

    return closest;
  }

  private distanceToCircle(localHit: THREE.Vector3, circleY: number, radius: number): number {
    const radial = Math.hypot(localHit.x, localHit.z);
    const dr = radial - radius;
    const dy = localHit.y - circleY;
    return Math.hypot(dr, dy);
  }

  private findFirstMesh(obj: THREE.Object3D): THREE.Mesh | null {
    if (obj instanceof THREE.Mesh) return obj;
    for (const child of obj.children) {
      const m = this.findFirstMesh(child);
      if (m) return m;
    }
    return null;
  }

  // ─── Hover / Click ──────────────────────────────────────────────────────

  updateHover(obj: THREE.Object3D | null, hitPoint: THREE.Vector3 | null): void {
    if (!this.active || !this.scene) {
      this.clearVisuals();
      return;
    }

    if (!obj || !hitPoint) {
      this.clearVisuals();
      this.hoveredEdge = null;
      this.targetObject = null;
      return;
    }

    const edge = this.findNearestEdge(obj, hitPoint);
    if (!edge) {
      this.clearVisuals();
      this.hoveredEdge = null;
      this.targetObject = null;
      return;
    }

    this.targetObject = obj;
    this.hoveredEdge = edge;
    this.showEdgeHighlight(edge);
    this.showPreview(edge);
  }

  refreshPreview(): void {
    if (this.hoveredEdge && this.scene) {
      this.showEdgeHighlight(this.hoveredEdge);
      this.showPreview(this.hoveredEdge);
    }
  }

  handleClick(): boolean {
    if (!this.active || !this.hoveredEdge || !this.targetObject || !this.onEdgeClick) return false;
    this.onEdgeClick(this.targetObject, this.hoveredEdge, { ...this.settings });
    this.clearVisuals();
    this.hoveredEdge = null;
    this.cachedEdges = null;
    this.cachedEdgeObjUuid = null;
    return true;
  }

  // ─── Visuals ─────────────────────────────────────────────────────────────

  private ensureMaterials(): void {
    if (!this.edgeMaterial) {
      this.edgeMaterial = new THREE.LineBasicMaterial({
        color: 0xff4444,
        depthTest: false,
        linewidth: 2,
      });
    }
    if (!this.previewMaterial) {
      this.previewMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.25,
        depthTest: true,
        side: THREE.DoubleSide,
      });
    }
  }

  private showEdgeHighlight(edge: BBoxEdge): void {
    this.ensureMaterials();
    if (!this.scene) return;

    if (this.edgeHighlight) {
      this.edgeHighlight.geometry.dispose();
      this.scene.remove(this.edgeHighlight);
    }

    if (edge.kind === 'circular') {
      const geo = new THREE.BufferGeometry().setFromPoints(edge.worldChain);
      this.edgeHighlight = new THREE.LineLoop(geo, this.edgeMaterial!);
    } else {
      const geo = new THREE.BufferGeometry().setFromPoints([edge.start, edge.end]);
      this.edgeHighlight = new THREE.Line(geo, this.edgeMaterial!);
    }
    this.edgeHighlight.renderOrder = 10;
    this.scene.add(this.edgeHighlight);
  }

  private showPreview(edge: BBoxEdge): void {
    this.ensureMaterials();
    if (!this.scene || !this.targetObject) return;

    this.clearPreview();
    this.previewGroup = new THREE.Group();

    if (edge.kind === 'circular') {
      this.buildCircularPreview(edge);
      return;
    }

    const r = this.settings.radius;
    const edgeLen = edge.start.distanceTo(edge.end);
    const dx = edge.perpDirX;
    const dz = edge.perpDirZ;

    // Geometry-space perpendicular directions (with signs toward bbox center).
    // These map chamfer-local perpDirX/Z back to geometry axes.
    let geomPerp1: THREE.Vector3, geomPerp2: THREE.Vector3;
    if (edge.axis === 'y') {
      geomPerp1 = new THREE.Vector3(dx, 0, 0);
      geomPerp2 = new THREE.Vector3(0, 0, dz);
    } else if (edge.axis === 'x') {
      geomPerp1 = new THREE.Vector3(0, dx, 0);
      geomPerp2 = new THREE.Vector3(0, 0, dz);
    } else {
      geomPerp1 = new THREE.Vector3(dx, 0, 0);
      geomPerp2 = new THREE.Vector3(0, -dz, 0);
    }

    // Transform to world space via mesh rotation
    const mesh = this.findFirstMesh(this.targetObject);
    if (!mesh) return;
    const rotM = new THREE.Matrix4().extractRotation(mesh.matrixWorld);
    const wp1 = geomPerp1.applyMatrix4(rotM);
    const wp2 = geomPerp2.applyMatrix4(rotM);

    // Compute extrusion axis as cross product to guarantee right-handed basis.
    // (Some edge sign-combos produce a left-handed triple, which flips the geometry.)
    const we = new THREE.Vector3().crossVectors(wp1, wp2).normalize();

    // Cross-section shape: the piece being subtracted (box minus quarter-cylinder).
    // Canonical form: origin at edge, extends to (+r, +r) with arc curving inward.
    //   (0,0) → (r,0) → arc → (0,r) → (0,0)
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(r, 0);
    shape.absarc(r, r, r, -Math.PI / 2, Math.PI, true);
    shape.lineTo(0, 0);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: edgeLen,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -edgeLen / 2);

    const previewMesh = new THREE.Mesh(geo, this.previewMaterial!);

    // Orient so shape X → wp1, shape Y → wp2, extrusion Z → we
    const basis = new THREE.Matrix4().makeBasis(wp1, wp2, we);
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis);

    const container = new THREE.Group();
    container.position.copy(edge.mid);
    container.quaternion.copy(quat);
    container.add(previewMesh);

    this.previewGroup.add(container);

    this.previewGroup.renderOrder = 9;
    this.scene.add(this.previewGroup);
  }

  /**
   * Preview for a cylinder rim fillet: a horizontal torus placed at the inside
   * corner (major = R − r, minor = r), orientated to match the cylinder's world
   * transform. This represents the shape of the fillet arc that will be added
   * to the corner (and the matching annular material that will be removed).
   */
  private buildCircularPreview(edge: BBoxEdge): void {
    if (!this.scene || !this.targetObject || !this.previewGroup) return;
    const mesh = this.findFirstMesh(this.targetObject);
    if (!mesh || edge.radius == null) return;

    const r = this.settings.radius;
    const major = Math.max(0.01, edge.radius - r);

    const geo = new THREE.TorusGeometry(major, r, 12, 48);
    // Default torus lies in XY; rotate into XZ so axis = Y (cylinder axis).
    geo.rotateX(Math.PI / 2);

    const previewMesh = new THREE.Mesh(geo, this.previewMaterial!);
    // Shift along Y so the torus sits flush with the rim face.
    const sign = edge.isTopRim ? -1 : +1;
    previewMesh.position.y = edge.localMid.y + sign * r;

    const container = new THREE.Group();
    container.applyMatrix4(mesh.matrixWorld);
    container.add(previewMesh);

    this.previewGroup.add(container);
    this.previewGroup.renderOrder = 9;
    this.scene.add(this.previewGroup);
  }

  private clearPreview(): void {
    if (!this.previewGroup || !this.scene) return;
    this.previewGroup.traverse((child) => {
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    });
    this.scene.remove(this.previewGroup);
    this.previewGroup = null;
  }

  private clearVisuals(): void {
    if (this.edgeHighlight && this.scene) {
      this.edgeHighlight.geometry.dispose();
      this.scene.remove(this.edgeHighlight);
      this.edgeHighlight = null;
    }
    this.clearPreview();
  }

  // ─── Geometry helpers ────────────────────────────────────────────────────

  private distanceToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = b.clone().sub(a);
    const lenSq = ab.dot(ab);
    if (lenSq < 1e-10) return p.distanceTo(a);
    const ap = p.clone().sub(a);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / lenSq));
    const closest = a.clone().add(ab.multiplyScalar(t));
    return p.distanceTo(closest);
  }
}
