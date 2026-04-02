import * as THREE from 'three';

/** Cached zebra stripe texture (shared across all hole materials) */
let zebraTexture: THREE.CanvasTexture | null = null;

function getZebraTexture(): THREE.CanvasTexture {
  if (zebraTexture) return zebraTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Diagonal dark stripes
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 3;
  for (let i = -size; i < size * 2; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  zebraTexture = tex;
  return tex;
}

/** Apply zebra + transparency to a MeshPhongMaterial for hole objects */
export function applyHoleStyle(mat: THREE.MeshPhongMaterial): void {
  mat.transparent = true;
  mat.opacity = 0.35;
  mat.map = getZebraTexture();
  mat.needsUpdate = true;
}

/** Remove hole style, restore solid look */
export function removeHoleStyle(mat: THREE.MeshPhongMaterial): void {
  mat.transparent = false;
  mat.opacity = 1.0;
  mat.map = null;
  mat.needsUpdate = true;
}
