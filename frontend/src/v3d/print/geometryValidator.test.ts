import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { validatePrintableGeometry } from './geometryValidator';

const codes = (geometry: THREE.BufferGeometry): string[] => (
  validatePrintableGeometry(geometry).diagnostics.map((diagnostic) => diagnostic.code)
);

describe('validatePrintableGeometry', () => {
  it('принимает замкнутый manifold-куб', () => {
    const result = validatePrintableGeometry(new THREE.BoxGeometry(10, 8, 6));

    expect(result).toMatchObject({ valid: true, componentCount: 1, triangleCount: 12 });
    expect(result.diagnostics).toEqual([]);
  });

  it('находит открытые рёбра у незамкнутой плоскости', () => {
    expect(codes(new THREE.PlaneGeometry(10, 8))).toContain('open-edge');
  });

  it('находит ребро, к которому примыкают три грани', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      0, -1, 0,
    ], 3));
    geometry.setIndex([0, 1, 2, 1, 0, 3, 0, 1, 4]);

    expect(codes(geometry)).toContain('non-manifold-edge');
  });

  it('находит две замкнутые оболочки, которые касаются только вершиной', () => {
    const first = tetrahedron([
      [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    ]);
    const second = tetrahedron([
      [0, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 0, -1],
    ]);
    const geometry = mergeGeometries([first, second]);

    expect(codes(geometry)).toContain('non-manifold-vertex');
  });

  it('находит раздельные печатные тела', () => {
    const first = new THREE.BoxGeometry(1, 1, 1);
    const second = new THREE.BoxGeometry(1, 1, 1);
    second.translate(3, 0, 0);
    const result = validatePrintableGeometry(mergeGeometries([first, second]));

    expect(result.componentCount).toBe(2);
    expect(codes(mergeGeometries([first, second]))).toContain('disconnected-components');
  });

  it('находит вырожденные треугольники', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      2, 0, 0,
    ], 3));
    geometry.setIndex([0, 1, 2]);

    expect(codes(geometry)).toContain('degenerate-triangle');
  });
});

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const position: number[] = [];
  const index: number[] = [];
  let offset = 0;
  for (const geometry of geometries) {
    const points = geometry.getAttribute('position');
    position.push(...Array.from(points.array));
    const sourceIndex = geometry.getIndex();
    if (sourceIndex) {
      index.push(...Array.from(sourceIndex.array, (value) => value + offset));
    } else {
      index.push(...Array.from({ length: points.count }, (_, value) => value + offset));
    }
    offset += points.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  merged.setIndex(index);
  return merged;
}

function tetrahedron(points: number[][]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return geometry;
}
