import * as THREE from 'three';

/**
 * Применяет/снимает «неоновое» свечение (emissive) на материалах мешей
 * выделенного объекта.
 *
 * Раньше: подсветка ребёр через outline. Заменено на emissive — он
 * не требует второго прохода рендера и хорошо смотрится на тёмных hole-материалах.
 *
 * Тёмная обводка рёбер (`userData.isEdgeLine`) пропускается — её цвет
 * фиксированный и не должен мерцать на selection.
 */
const NEON_EMISSIVE = new THREE.Color(0x00a5a4);
const NEON_INTENSITY = 0.15;

/** Применяет неоновое свечение ко всем мешам в obj и его потомках. */
export function applySelectionGlow(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material && !child.userData.isEdgeLine) {
      const mat = child.material as THREE.MeshPhongMaterial;
      mat.emissive.copy(NEON_EMISSIVE);
      mat.emissiveIntensity = NEON_INTENSITY;
      mat.needsUpdate = true;
    }
  });
}

/** Снимает свечение со всех мешей в obj и его потомках. */
export function clearSelectionGlow(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material && !child.userData.isEdgeLine) {
      const mat = child.material as THREE.MeshPhongMaterial;
      mat.emissive.setScalar(0);
      mat.needsUpdate = true;
    }
  });
}
