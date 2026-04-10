import * as THREE from 'three';

/**
 * CylinderBufferGeometry with rounded (filleted) top and bottom edges.
 * Uses LatheBufferGeometry with a profile that has quarter-circle fillets.
 */
export class RoundedCylinderBufferGeometry extends THREE.LatheGeometry {
  constructor(
    radiusTop = 1,
    radiusBottom = 1,
    height = 1,
    radialSegments = 32,
    radius = 0.1,
    bevelSegments = 4,
  ) {
    // Clamp radius to half height and half of each cylinder radius
    radius = Math.min(radius, height / 2, radiusTop, radiusBottom);

    const halfH = height / 2;
    const points: THREE.Vector2[] = [];

    // Bottom center
    points.push(new THREE.Vector2(0, -halfH));

    // Bottom edge: flat + fillet
    if (radius > 0) {
      // Bottom flat part
      points.push(new THREE.Vector2(radiusBottom - radius, -halfH));
      // Bottom fillet (quarter arc from bottom face to side)
      for (let i = 0; i <= bevelSegments; i++) {
        const t = (i / bevelSegments) * (Math.PI / 2);
        const x = radiusBottom - radius + Math.sin(t) * radius;
        const y = -halfH + radius - Math.cos(t) * radius;
        points.push(new THREE.Vector2(x, y));
      }
    } else {
      points.push(new THREE.Vector2(radiusBottom, -halfH));
    }

    // Top edge: side + fillet + flat
    if (radius > 0) {
      // Top fillet (quarter arc from side to top face)
      for (let i = 0; i <= bevelSegments; i++) {
        const t = (i / bevelSegments) * (Math.PI / 2);
        const x = radiusTop - radius + Math.cos(t) * radius;
        const y = halfH - radius + Math.sin(t) * radius;
        points.push(new THREE.Vector2(x, y));
      }
      // Top flat part
      points.push(new THREE.Vector2(0, halfH));
    } else {
      points.push(new THREE.Vector2(radiusTop, halfH));
      points.push(new THREE.Vector2(0, halfH));
    }

    super(points, radialSegments);
  }
}
