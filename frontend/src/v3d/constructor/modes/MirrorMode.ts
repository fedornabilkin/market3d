import * as THREE from 'three';
import { MirrorGizmo } from '../MirrorGizmo';

/**
 * Manages the mirror-mode state and the associated MirrorGizmo lifecycle.
 *
 * Mirror mode lets the user flip a selected object along an axis by clicking
 * one of the three gizmo handles.  The mode controller owns the boolean flag
 * and synchronises the gizmo visibility with the current selection.
 */
export class MirrorMode {
  private active = false;
  private gizmo: MirrorGizmo | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /** Create the gizmo and add it to the scene. Call once during mount(). */
  init(scene: THREE.Scene, camera: THREE.PerspectiveCamera, containerHeight: number): void {
    this.gizmo = new MirrorGizmo(scene);
    this.gizmo.setCamera(camera);
    this.gizmo.setContainerHeight(containerHeight);
    this.gizmo.addToScene();
  }

  /** Tear down the gizmo. Call once during unmount(). */
  dispose(): void {
    this.gizmo?.dispose();
    this.gizmo = null;
    this.active = false;
  }

  // ─── State ───────────────────────────────────────────────────────────────

  setActive(active: boolean, selectedObject3D?: THREE.Object3D | null): void {
    this.active = active;
    if (!this.gizmo) return;
    if (active && selectedObject3D) {
      this.gizmo.show(selectedObject3D);
    } else {
      this.gizmo.hide();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  // ─── Gizmo access ────────────────────────────────────────────────────────

  getGizmo(): MirrorGizmo | null {
    return this.gizmo;
  }

  // ─── Frame update ────────────────────────────────────────────────────────

  /** Call once per animation frame. */
  update(): void {
    if (this.gizmo?.isVisible()) {
      this.gizmo.updatePositions();
    }
  }

  /** Called on window resize. */
  setContainerHeight(h: number): void {
    this.gizmo?.setContainerHeight(h);
  }

  // ─── Selection sync ──────────────────────────────────────────────────────

  /** Show or hide the gizmo depending on mode state and current selection. */
  syncWithSelection(obj: THREE.Object3D | null): void {
    if (!this.gizmo) return;
    if (this.active && obj) {
      this.gizmo.show(obj);
    } else {
      this.gizmo.hide();
    }
  }
}
