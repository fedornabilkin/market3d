import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import NameTagGenerator from './NameTagGenerator';
import { buildPrintableModel, type PrintablePart } from '../print/PrintableModelBuilder';

function toParts(meshes: Record<string, THREE.Object3D>): PrintablePart[] {
  return Object.entries(meshes).map(([id, object]) => ({
    id,
    object,
    isBase: id === 'backing',
  }));
}

function disposeMeshes(meshes: Record<string, THREE.Object3D>): void {
  Object.values(meshes).forEach((object) => object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  }));
}

describe('NameTagGenerator', () => {
  it('создаёт манифолдную модель с полыми буквами', async () => {
    const meshes = new NameTagGenerator({
      message: 'BOP8',
      hollow: { active: true, wallThickness: 0.8, floorThickness: 0.6 },
    }).generate();

    const model = await buildPrintableModel(toParts(meshes));

    expect(model.validation.valid).toBe(true);
    expect(model.validation.componentCount).toBe(1);
    model.geometry.dispose();
    disposeMeshes(meshes);
  });

  it('экспортирует отдельные замкнутые буквы без подложки', async () => {
    const meshes = new NameTagGenerator({ backing: { active: false } }).generate();

    const model = await buildPrintableModel(toParts(meshes), { allowDisconnected: true });

    expect(model.validation.valid).toBe(true);
    expect(model.validation.componentCount).toBeGreaterThan(1);
    model.geometry.dispose();
    disposeMeshes(meshes);
  });
});
