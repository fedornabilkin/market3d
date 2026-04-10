import * as THREE from 'three';

/**
 * Object-to-object snapping (cruise mode).
 *
 * When active, dragged objects snap their bounding-box edges/centres to
 * the edges/centres of neighbouring objects.  Visual cyan guide lines are
 * drawn through snapped coordinates.
 */
export class CruiseMode {
  private active = false;
  private threshold = 5; // snap distance in mm
  private guides: THREE.Line[] = [];
  private scene: THREE.Scene | null = null;
  private modelRootGroup: THREE.Group | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  init(scene: THREE.Scene, modelRootGroup: THREE.Group): void {
    this.scene = scene;
    this.modelRootGroup = modelRootGroup;
  }

  dispose(): void {
    this.clearGuides();
    this.scene = null;
    this.modelRootGroup = null;
  }

  // ─── State ───────────────────────────────────────────────────────────────

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.clearGuides();
  }

  isActive(): boolean {
    return this.active;
  }

  // ─── Snap logic ──────────────────────────────────────────────────────────

  /**
   * Collects bounding-box edges of all scene objects except the dragged one.
   * Returns arrays of X and Z edge coordinates.
   */
  collectNeighborEdges(exclude: THREE.Object3D): { xs: number[]; zs: number[] } {
    const xs: number[] = [];
    const zs: number[] = [];
    if (!this.modelRootGroup) return { xs, zs };
    const box = new THREE.Box3();
    this.modelRootGroup.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o === exclude) return;
      if (!(o.userData as { node?: unknown }).node) return;
      box.setFromObject(o);
      if (box.isEmpty()) return;
      xs.push(box.min.x, (box.min.x + box.max.x) / 2, box.max.x);
      zs.push(box.min.z, (box.min.z + box.max.z) / 2, box.max.z);
    });
    return { xs, zs };
  }

  /**
   * Given the dragged object's candidate position, snaps X and/or Z
   * to the nearest neighbor edge within threshold.
   * Returns the snapped position and the snap coordinates for guides.
   */
  applySnap(
    target: THREE.Object3D,
    posX: number,
    posZ: number,
    neighborEdges: { xs: number[]; zs: number[] },
  ): { x: number; z: number; guideXs: number[]; guideZs: number[] } {
    const box = new THREE.Box3().setFromObject(target);
    const halfW = (box.max.x - box.min.x) / 2;
    const halfD = (box.max.z - box.min.z) / 2;
    const centerX = posX;
    const centerZ = posZ;

    const myXs = [centerX - halfW, centerX, centerX + halfW];
    const myZs = [centerZ - halfD, centerZ, centerZ + halfD];

    let bestDx = Infinity;
    let snapX = posX;
    const guideXs: number[] = [];

    for (const mx of myXs) {
      for (const nx of neighborEdges.xs) {
        const d = Math.abs(mx - nx);
        if (d < this.threshold && d < Math.abs(bestDx)) {
          bestDx = nx - mx;
          snapX = posX + bestDx;
        }
      }
    }
    if (Math.abs(bestDx) < this.threshold) {
      const snappedXs = [snapX - halfW, snapX, snapX + halfW];
      for (const sx of snappedXs) {
        for (const nx of neighborEdges.xs) {
          if (Math.abs(sx - nx) < 0.01) guideXs.push(sx);
        }
      }
    }

    let bestDz = Infinity;
    let snapZ = posZ;
    const guideZs: number[] = [];

    for (const mz of myZs) {
      for (const nz of neighborEdges.zs) {
        const d = Math.abs(mz - nz);
        if (d < this.threshold && d < Math.abs(bestDz)) {
          bestDz = nz - mz;
          snapZ = posZ + bestDz;
        }
      }
    }
    if (Math.abs(bestDz) < this.threshold) {
      const snappedZs = [snapZ - halfD, snapZ, snapZ + halfD];
      for (const sz of snappedZs) {
        for (const nz of neighborEdges.zs) {
          if (Math.abs(sz - nz) < 0.01) guideZs.push(sz);
        }
      }
    }

    return { x: snapX, z: snapZ, guideXs, guideZs };
  }

  // ─── Guide lines ─────────────────────────────────────────────────────────

  showGuides(xs: number[], zs: number[], y: number): void {
    this.clearGuides();
    if (!this.scene) return;
    const guideLen = 500;
    const mat = new THREE.LineBasicMaterial({ color: 0x00ccff, depthTest: false, linewidth: 1 });

    const uniqueXs = [...new Set(xs.map(v => Math.round(v * 100) / 100))];
    const uniqueZs = [...new Set(zs.map(v => Math.round(v * 100) / 100))];

    for (const x of uniqueXs) {
      const pts = [new THREE.Vector3(x, y, -guideLen), new THREE.Vector3(x, y, guideLen)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 3;
      this.scene.add(line);
      this.guides.push(line);
    }
    for (const z of uniqueZs) {
      const pts = [new THREE.Vector3(-guideLen, y, z), new THREE.Vector3(guideLen, y, z)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 3;
      this.scene.add(line);
      this.guides.push(line);
    }
  }

  clearGuides(): void {
    for (const line of this.guides) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.scene?.remove(line);
    }
    this.guides = [];
  }
}
