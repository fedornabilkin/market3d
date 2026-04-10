import * as THREE from 'three';

type AlignMode = 'minX' | 'centerX' | 'maxX' | 'minY' | 'centerY' | 'maxY' | 'minZ' | 'centerZ' | 'maxZ';

/**
 * Alignment-reference markers for selected objects.
 *
 * When active, draws 3 marker dots per axis (min, center, max) on each
 * selected object's bounding box with leader lines through the object.
 * Hovering a marker highlights it red and shows ghost silhouettes of
 * where objects would land after alignment.
 */
export class AlignmentMode {
  private active = false;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;

  /** Marker dots. */
  private markers: THREE.Mesh[] = [];
  /** Solid leader lines from markers through the object. */
  private leaderLines: THREE.Line[] = [];
  /** Map marker → associated leader line. */
  private markerToLine = new Map<THREE.Mesh, THREE.Line>();
  /** Currently hovered marker. */
  private hoveredMarker: THREE.Mesh | null = null;
  /** Ghost silhouettes shown on hover preview. */
  private previewMeshes: THREE.Mesh[] = [];
  /** Objects being aligned (stored for preview computation). */
  private currentObjects: THREE.Object3D[] = [];

  private containerHeight = 800;

  /** Cached config key to avoid rebuilding every frame. */
  private lastConfigKey = '';

  // Shared geometry / materials (created once, reused)
  private circleHorizontal: THREE.CircleGeometry | null = null;
  private circleVertical: THREE.CircleGeometry | null = null;
  private dotMaterial: THREE.MeshBasicMaterial | null = null;
  private leaderMaterial: THREE.LineBasicMaterial | null = null;
  private hoverDotMaterial: THREE.MeshBasicMaterial | null = null;
  private hoverLineMaterial: THREE.LineBasicMaterial | null = null;
  private previewMaterial: THREE.MeshBasicMaterial | null = null;

  private static readonly BASE_SIZE = 1;
  private static readonly MARKER_SCREEN_PX = 8;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  init(scene: THREE.Scene, _modelRootGroup: THREE.Group, camera?: THREE.Camera): void {
    this.scene = scene;
    this.camera = camera ?? null;
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  setContainerHeight(h: number): void {
    this.containerHeight = h;
  }

  dispose(): void {
    this.clearVisuals();
    this.circleHorizontal?.dispose();
    this.circleVertical?.dispose();
    this.dotMaterial?.dispose();
    this.leaderMaterial?.dispose();
    this.hoverDotMaterial?.dispose();
    this.hoverLineMaterial?.dispose();
    this.previewMaterial?.dispose();
    this.circleHorizontal = null;
    this.circleVertical = null;
    this.dotMaterial = null;
    this.leaderMaterial = null;
    this.hoverDotMaterial = null;
    this.hoverLineMaterial = null;
    this.previewMaterial = null;
    this.scene = null;
  }

  // ─── State ───────────────────────────────────────────────────────────────

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.clearVisuals();
  }

  isActive(): boolean {
    return this.active;
  }

  getMarkers(): THREE.Mesh[] {
    return this.markers;
  }

  // ─── Hover ───────────────────────────────────────────────────────────────

  setHovered(marker: THREE.Mesh | null): void {
    if (marker === this.hoveredMarker) return;

    // Reset previous hover
    if (this.hoveredMarker) {
      this.hoveredMarker.material = this.dotMaterial!;
      const line = this.markerToLine.get(this.hoveredMarker);
      if (line) line.material = this.leaderMaterial!;
    }
    this.clearPreview();

    this.hoveredMarker = marker;

    // Apply hover highlight
    if (marker) {
      this.ensureMaterials();
      marker.material = this.hoverDotMaterial!;
      const line = this.markerToLine.get(marker);
      if (line) line.material = this.hoverLineMaterial!;
      this.showPreview(marker);
    }
  }

  // ─── Frame update ────────────────────────────────────────────────────────

  update(selectedObjects: THREE.Object3D[]): void {
    if (!this.active || !this.scene || selectedObjects.length < 2) {
      if (this.markers.length || this.leaderLines.length) this.clearVisuals();
      this.lastConfigKey = '';
      return;
    }
    this.currentObjects = selectedObjects;

    // Build a config key from camera face directions + object bounding boxes
    const key = this.buildConfigKey(selectedObjects);
    if (key !== this.lastConfigKey && !this.hoveredMarker) {
      this.lastConfigKey = key;
      this.rebuild(selectedObjects);
    } else {
      // Just update scale each frame
      this.scaleMarkers();
    }
  }

  /** Compute a string key that changes when markers need rebuilding. */
  private buildConfigKey(objects: THREE.Object3D[]): string {
    const camPos = this.camera?.position;
    const box = new THREE.Box3();
    const parts: string[] = [];

    for (const obj of objects) {
      box.setFromObject(obj);
      if (box.isEmpty()) continue;
      const { min, max } = box;
      const cx = (min.x + max.x) / 2;
      const cz = (min.z + max.z) / 2;
      // Round positions to 0.1mm to avoid jitter
      const r = (v: number) => Math.round(v * 10);
      parts.push(`${r(min.x)},${r(min.y)},${r(min.z)},${r(max.x)},${r(max.y)},${r(max.z)}`);
      // Track which face is nearest
      if (camPos) {
        parts.push(camPos.x > cx ? 'R' : 'L');
        parts.push(camPos.z > cz ? 'F' : 'B');
      }
    }
    return parts.join('|');
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private ensureMaterials(): void {
    if (!this.circleHorizontal) {
      this.circleHorizontal = new THREE.CircleGeometry(AlignmentMode.BASE_SIZE, 16);
      this.circleHorizontal.rotateX(-Math.PI / 2);
    }
    if (!this.circleVertical) {
      this.circleVertical = new THREE.CircleGeometry(AlignmentMode.BASE_SIZE, 16);
      this.circleVertical.rotateY(-Math.PI / 2);
    }
    if (!this.dotMaterial) {
      this.dotMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333, depthTest: false, side: THREE.DoubleSide,
      });
    }
    if (!this.hoverDotMaterial) {
      this.hoverDotMaterial = new THREE.MeshBasicMaterial({
        color: 0xdd2222, depthTest: false, side: THREE.DoubleSide,
      });
    }
    if (!this.leaderMaterial) {
      this.leaderMaterial = new THREE.LineBasicMaterial({
        color: 0x888888, depthTest: false, transparent: true, opacity: 0.5, linewidth: 2,
      });
    }
    if (!this.hoverLineMaterial) {
      this.hoverLineMaterial = new THREE.LineBasicMaterial({
        color: 0xdd2222, depthTest: false, transparent: true, opacity: 0.8, linewidth: 2,
      });
    }
    if (!this.previewMaterial) {
      this.previewMaterial = new THREE.MeshBasicMaterial({
        color: 0xdd2222, transparent: true, opacity: 0.15,
        depthTest: true, side: THREE.DoubleSide,
      });
    }
  }

  private rebuild(objects: THREE.Object3D[]): void {
    this.clearVisuals();
    if (!this.scene) return;
    this.ensureMaterials();

    interface RefPoint {
      x: number; y: number; z: number;
      objectId: number; vertical: boolean; flipVertical?: boolean;
      alignMode: AlignMode;
    }
    const allPoints: RefPoint[] = [];
    /** Parallel array: one leader-line-endpoint pair per marker. */
    const leaderDefs: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
    const box = new THREE.Box3();
    const d = 5;

    const camPos = this.camera?.position;

    for (let id = 0; id < objects.length; id++) {
      if (id !== 0) continue; // Only show markers on the anchor (first selected object)
      box.setFromObject(objects[id]);
      if (box.isEmpty()) continue;

      const { min, max } = box;
      const cx = (min.x + max.x) / 2;
      const cy = (min.y + max.y) / 2;
      const cz = (min.z + max.z) / 2;

      const nearZ = camPos && camPos.z > cz ? max.z : min.z;
      const farZ  = nearZ === max.z ? min.z : max.z;
      const signZ = nearZ === max.z ? 1 : -1;

      const nearX = camPos && camPos.x > cx ? max.x : min.x;
      const farX  = nearX === max.x ? min.x : max.x;
      const signX = nearX === max.x ? 1 : -1;

      // X markers
      for (const [mx, mode] of [[min.x, 'minX'], [cx, 'centerX'], [max.x, 'maxX']] as [number, AlignMode][]) {
        allPoints.push({ x: mx, y: min.y, z: nearZ + d * signZ, objectId: id, vertical: false, alignMode: mode });
        leaderDefs.push({
          from: new THREE.Vector3(mx, min.y, nearZ + d * signZ),
          to: new THREE.Vector3(mx, min.y, farZ),
        });
      }

      // Z markers
      for (const [mz, mode] of [[min.z, 'minZ'], [cz, 'centerZ'], [max.z, 'maxZ']] as [number, AlignMode][]) {
        allPoints.push({ x: nearX + d * signX, y: min.y, z: mz, objectId: id, vertical: false, alignMode: mode });
        leaderDefs.push({
          from: new THREE.Vector3(nearX + d * signX, min.y, mz),
          to: new THREE.Vector3(farX, min.y, mz),
        });
      }

      // Y markers
      const flipV = signX < 0;
      const farZoff = farZ - d * signZ;
      for (const [my, mode] of [[min.y, 'minY'], [cy, 'centerY'], [max.y, 'maxY']] as [number, AlignMode][]) {
        allPoints.push({ x: nearX, y: my, z: farZoff, objectId: id, vertical: true, flipVertical: flipV, alignMode: mode });
        leaderDefs.push({
          from: new THREE.Vector3(nearX, my, farZoff),
          to: new THREE.Vector3(nearX, my, nearZ),
        });
      }
    }

    if (allPoints.length === 0) return;

    // Create leader lines first so we can map them to markers
    for (const ld of leaderDefs) {
      if (ld.from.distanceTo(ld.to) < 0.1) {
        this.leaderLines.push(null as unknown as THREE.Line); // placeholder to keep indices aligned
        continue;
      }
      const geo = new THREE.BufferGeometry().setFromPoints([ld.from, ld.to]);
      const line = new THREE.Line(geo, this.leaderMaterial!);
      line.renderOrder = 3;
      this.scene.add(line);
      this.leaderLines.push(line);
    }

    // Create markers and map to leader lines
    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
      const geo = p.vertical ? this.circleVertical! : this.circleHorizontal!;
      const dot = new THREE.Mesh(geo, this.dotMaterial!);
      dot.position.set(p.x, p.y, p.z);
      dot.userData = { alignMode: p.alignMode };
      if (p.vertical && p.flipVertical) {
        dot.rotation.y = Math.PI;
      }
      dot.renderOrder = 4;
      this.scene.add(dot);
      this.markers.push(dot);

      const line = this.leaderLines[i];
      if (line) this.markerToLine.set(dot, line);
    }

    this.scaleMarkers();
  }

  private scaleMarkers(): void {
    if (!(this.camera instanceof THREE.PerspectiveCamera) || this.markers.length === 0) return;
    const cam = this.camera;
    const fovRad = (cam.fov * Math.PI) / 180;
    const worldPos = new THREE.Vector3();

    for (const marker of this.markers) {
      marker.getWorldPosition(worldPos);
      const distance = worldPos.distanceTo(cam.position);
      const viewportHeightWorld = 2 * distance * Math.tan(fovRad / 2);
      const worldPerPixel = viewportHeightWorld / this.containerHeight;
      const desiredWorldSize = worldPerPixel * AlignmentMode.MARKER_SCREEN_PX;
      marker.scale.setScalar(desiredWorldSize / AlignmentMode.BASE_SIZE);
    }
  }

  // ─── Preview (ghost silhouettes) ─────────────────────────────────────────

  private showPreview(marker: THREE.Mesh): void {
    if (!this.scene || this.currentObjects.length < 2) return;
    this.ensureMaterials();

    const mode = marker.userData.alignMode as AlignMode;
    const box = new THREE.Box3();
    const boxes: THREE.Box3[] = [];

    for (const obj of this.currentObjects) {
      const b = new THREE.Box3().setFromObject(obj);
      boxes.push(b);
    }

    // Anchor = first object
    const anchor = boxes[0];
    let target: number;
    switch (mode) {
      case 'minX':    target = anchor.min.x; break;
      case 'maxX':    target = anchor.max.x; break;
      case 'centerX': target = (anchor.min.x + anchor.max.x) / 2; break;
      case 'minY':    target = anchor.min.y; break;
      case 'maxY':    target = anchor.max.y; break;
      case 'centerY': target = (anchor.min.y + anchor.max.y) / 2; break;
      case 'minZ':    target = anchor.min.z; break;
      case 'maxZ':    target = anchor.max.z; break;
      case 'centerZ': target = (anchor.min.z + anchor.max.z) / 2; break;
    }

    // Show ghost for each non-anchor object at its aligned position
    for (let i = 1; i < this.currentObjects.length; i++) {
      const b = boxes[i];
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      b.getSize(size);
      b.getCenter(center);

      let dx = 0, dy = 0, dz = 0;
      switch (mode) {
        case 'minX':    dx = target - b.min.x; break;
        case 'maxX':    dx = target - b.max.x; break;
        case 'centerX': dx = target - (b.min.x + b.max.x) / 2; break;
        case 'minY':    dy = target - b.min.y; break;
        case 'maxY':    dy = target - b.max.y; break;
        case 'centerY': dy = target - (b.min.y + b.max.y) / 2; break;
        case 'minZ':    dz = target - b.min.z; break;
        case 'maxZ':    dz = target - b.max.z; break;
        case 'centerZ': dz = target - (b.min.z + b.max.z) / 2; break;
      }

      // Skip if object wouldn't move
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 && Math.abs(dz) < 0.01) continue;

      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mesh = new THREE.Mesh(geo, this.previewMaterial!);
      mesh.position.set(center.x + dx, center.y + dy, center.z + dz);
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.previewMeshes.push(mesh);

      // Wireframe outline
      const edges = new THREE.EdgesGeometry(geo);
      const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0xdd2222, transparent: true, opacity: 0.5, depthTest: false,
      }));
      wireframe.position.copy(mesh.position);
      wireframe.renderOrder = 2;
      this.scene.add(wireframe);
      this.previewMeshes.push(wireframe as unknown as THREE.Mesh);
    }
  }

  private clearPreview(): void {
    for (const m of this.previewMeshes) {
      m.geometry.dispose();
      if (m instanceof THREE.LineSegments) {
        (m.material as THREE.Material).dispose();
      }
      this.scene?.remove(m);
    }
    this.previewMeshes = [];
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  private clearVisuals(): void {
    this.hoveredMarker = null;
    this.lastConfigKey = '';
    this.clearPreview();
    this.markerToLine.clear();

    for (const m of this.markers) {
      this.scene?.remove(m);
    }
    this.markers = [];

    for (const l of this.leaderLines) {
      if (!l) continue;
      l.geometry.dispose();
      this.scene?.remove(l);
    }
    this.leaderLines = [];
  }
}
