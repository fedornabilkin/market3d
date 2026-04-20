import * as THREE from 'three';
import { generateThreadGeometry, DEFAULT_THREAD_SETTINGS } from './ThreadGenerator';
import type { ThreadSettings } from './ThreadGenerator';
import { generateKnurlGeometry, DEFAULT_KNURL_SETTINGS } from './KnurlGenerator';
import type { KnurlSettings } from './KnurlGenerator';

export type GeneratorType = 'thread' | 'knurl';

export interface GeneratorSettings {
  type: GeneratorType;
  thread: ThreadSettings;
  knurl: KnurlSettings;
}

/**
 * Mode controller for procedural generators (thread, knurl, …).
 *
 * Manages the active generator type, its settings, and a live preview mesh
 * that updates when settings change.  When the user confirms, the callback
 * delivers the final geometry.
 */
export class GeneratorMode {
  private active = false;
  private scene: THREE.Scene | null = null;
  private previewMesh: THREE.Mesh | null = null;

  settings: GeneratorSettings = {
    type: 'thread',
    thread: { ...DEFAULT_THREAD_SETTINGS },
    knurl: { ...DEFAULT_KNURL_SETTINGS },
  };

  /** Called when the user confirms generation. Delivers the final geometry + height. */
  onGenerate: ((geometry: THREE.BufferGeometry, height: number, name: string) => void) | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  init(scene: THREE.Scene): void {
    this.scene = scene;
  }

  dispose(): void {
    this.removePreview();
    this.scene = null;
  }

  // ─── State ───────────────────────────────────────────────────────────────

  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.updatePreview();
    } else {
      this.removePreview();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  setGeneratorType(type: GeneratorType): void {
    this.settings.type = type;
    if (this.active) this.updatePreview();
  }

  // ─── Preview ─────────────────────────────────────────────────────────────

  /** Rebuild the preview mesh from current settings. Call after any setting change. */
  updatePreview(): void {
    if (!this.scene || !this.active) return;

    this.removePreview();

    const geometry = this.buildGeometry();
    if (!geometry) return;

    const material = new THREE.MeshPhongMaterial({
      color: 0x00a5a4,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
      flatShading: this.settings.type === 'knurl',
    });

    this.previewMesh = new THREE.Mesh(geometry, material);
    this.previewMesh.renderOrder = 5;
    this.scene.add(this.previewMesh);
  }

  private removePreview(): void {
    if (this.previewMesh) {
      this.previewMesh.geometry.dispose();
      (this.previewMesh.material as THREE.Material).dispose();
      this.scene?.remove(this.previewMesh);
      this.previewMesh = null;
    }
  }

  // ─── Generation ──────────────────────────────────────────────────────────

  /** Confirm: generate final geometry and deliver via callback. */
  confirm(): void {
    const geometry = this.buildGeometry();
    if (!geometry || !this.onGenerate) return;

    const s = this.settings;
    let height = 0;
    let name = 'Генератор';

    if (s.type === 'thread') {
      height = s.thread.pitch * s.thread.turns;
      name = 'Резьба';
    } else if (s.type === 'knurl') {
      height = s.knurl.height;
      name = 'Насечки';
    }

    this.onGenerate(geometry, height, name);
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private buildGeometry(): THREE.BufferGeometry | null {
    const s = this.settings;
    switch (s.type) {
      case 'thread':
        return generateThreadGeometry(s.thread);
      case 'knurl':
        return generateKnurlGeometry(s.knurl);
      default:
        return null;
    }
  }
}
