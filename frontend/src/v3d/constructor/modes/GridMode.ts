import * as THREE from 'three';
import { GridService } from '../services/GridService';

/**
 * Grid display and snap-to-grid positioning.
 *
 * Owns the grid visibility, dimensions, and snap step, as well as the
 * GridService that renders the millimetre grid and the dashed bounding-box
 * projection on the Y=0 plane.
 */
export class GridMode {
  private service: GridService | null = null;

  private visible = true;
  private widthMm = 200;
  private lengthMm = 200;
  private _snapStep = 1;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  init(scene: THREE.Scene): void {
    this.service = new GridService(scene);
    this.service.setSize(this.widthMm, this.lengthMm);
    this.service.setVisible(this.visible);
  }

  dispose(): void {
    this.service?.dispose();
    this.service = null;
  }

  // ─── Snap step ───────────────────────────────────────────────────────────

  get snapStep(): number {
    return this._snapStep;
  }

  setSnapStep(step: number): void {
    this._snapStep = Number.isFinite(step) && step > 0 ? step : 1;
  }

  // ─── Grid visibility ────────────────────────────────────────────────────

  setVisible(visible: boolean): void {
    this.visible = !!visible;
    this.service?.setVisible(this.visible);
  }

  // ─── Grid size ───────────────────────────────────────────────────────────

  setSize(widthMm: number, lengthMm: number): void {
    this.widthMm = Math.max(10, widthMm);
    this.lengthMm = Math.max(10, lengthMm);
    this.service?.setSize(this.widthMm, this.lengthMm);
  }

  /** World-space center of the grid surface (Y=0 plane). */
  getCenter(): THREE.Vector3 {
    return new THREE.Vector3(this.widthMm / 2, 0, -this.lengthMm / 2);
  }

  // ─── Frame update ────────────────────────────────────────────────────────

  /** Update label billboard orientation. Call once per frame. */
  updateLabel(camera: THREE.PerspectiveCamera): void {
    this.service?.updateLabelBillboard(camera);
  }

  /** Update the dashed footprint projection below the selected object. */
  updateProjection(obj: THREE.Object3D | null): void {
    this.service?.updateProjection(obj);
  }

  /** Draw soft shadows for non-selected objects on the grid. */
  updateShadows(allObjects: THREE.Object3D[], selectedObj: THREE.Object3D | null): void {
    this.service?.updateShadows(allObjects, selectedObj);
  }
}
