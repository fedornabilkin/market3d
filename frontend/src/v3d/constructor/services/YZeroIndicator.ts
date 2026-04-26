import * as THREE from 'three';

/**
 * Полупрозрачный плоский индикатор «объект стоит на сетке (Z=0)».
 * Подсвечивает footprint выделенного объекта в XY-плоскости когда его
 * нижняя грань близка к Z=0 (toleance 0.05 мм). Авто-скрывается через
 * 800ms после показа.
 *
 * Имя «YZero» исторически — было до Z-up миграции (тогда low-edge был по Y).
 * Сейчас это «нулевая высота» в Z-up системе.
 */
export class YZeroIndicator {
  private scene: THREE.Scene | null = null;
  private mesh: THREE.Mesh | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  attach(scene: THREE.Scene): void {
    this.scene = scene;
  }

  detach(): void {
    this.hide();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh.parent?.remove(this.mesh);
      this.mesh = null;
    }
    this.scene = null;
  }

  /**
   * Показывает индикатор если bbox.min.z близко к 0; иначе скрывает.
   * box — мировой AABB объекта (или null, если 3d-объект не найден).
   */
  showIfOnGrid(box: THREE.Box3 | null): void {
    if (!box || Math.abs(box.min.z) >= 0.05) {
      this.hide();
      return;
    }
    this.showWithFootprint(box);
  }

  /** Принудительно показывает с footprint'ом из заданного bbox'а. */
  showWithFootprint(box: THREE.Box3): void {
    if (!this.scene) return;

    const sizeX = box.max.x - box.min.x;
    const sizeY = box.max.y - box.min.y;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerY = (box.min.y + box.max.y) / 2;

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(sizeX, sizeY);
    } else {
      const geo = new THREE.PlaneGeometry(sizeX, sizeY);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.renderOrder = 2;
    }

    // Z-up: индикатор лежит в XY-плоскости. Чуть выше Z=0, чтобы не z-fight'ить с сеткой.
    this.mesh.position.set(centerX, centerY, 0.01);
    if (this.mesh.parent !== this.scene) {
      this.scene.add(this.mesh);
    }
    this.mesh.visible = true;

    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hide(), 800);
  }

  hide(): void {
    if (this.mesh) this.mesh.visible = false;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}
