import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  buildPrintableModel,
  collectPrintableInputs,
  PRINT_JOIN_OVERLAP,
} from './PrintableModelBuilder';

describe('PrintableModelBuilder', () => {
  it('запекает трансформации мешей и погружает добавляемые детали в основу', () => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2));
    const detail = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1));
    detail.position.set(3, 2, 2);
    const inputs = collectPrintableInputs([
      { id: 'base', object: base, isBase: true },
      { id: 'detail', object: detail },
    ]);

    expect(inputs).toHaveLength(2);
    expect(inputs[0].transform.elements.slice(12, 15)).toEqual([0, 0, 0]);
    expect(inputs[1].transform.elements.slice(12, 15)).toEqual([3, 2, 2 - PRINT_JOIN_OVERLAP]);
  });

  it('объединяет пересекающиеся тела в манифолдный результат', async () => {
    const detail = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1));
    detail.position.z = 1.5;
    const model = await buildPrintableModel([
      { id: 'base', object: new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2)), isBase: true },
      { id: 'text', object: detail },
    ]);

    expect(model.validation.valid).toBe(true);
    expect(model.validation.componentCount).toBe(1);
    model.geometry.dispose();
  });

  it('принимает неиндексированную ExtrudeGeometry', async () => {
    const shape = new THREE.Shape();
    shape.moveTo(-5, -5);
    shape.lineTo(5, -5);
    shape.lineTo(5, 5);
    shape.lineTo(-5, 5);
    shape.lineTo(-5, -5);
    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false }));
    const detail = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }));
    detail.scale.setScalar(0.25);
    detail.position.z = 2;
    const model = await buildPrintableModel([
      { id: 'base', object: base, isBase: true },
      { id: 'detail', object: detail },
    ]);
    expect(model.validation.valid).toBe(true);
    model.geometry.dispose();
  });

  it('сохраняет отверстия в экструдированном контуре', async () => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 5, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const model = await buildPrintableModel([
      { id: 'base', object: new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false })), isBase: true },
    ]);
    expect(model.validation.valid).toBe(true);
    model.geometry.dispose();
  });

  it('собирает несколько отдельных рельефных островков как единое тело', async () => {
    const parts = [{ id: 'base', object: new THREE.Mesh(new THREE.BoxGeometry(20, 20, 3)), isBase: true }];
    for (let x = -6; x <= 6; x += 4) {
      for (let y = -6; y <= 6; y += 4) {
        const detail = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1));
        detail.position.set(x, y, 2);
        parts.push({ id: `${x}:${y}`, object: detail });
      }
    }
    const model = await buildPrintableModel(parts);
    expect(model.validation.valid).toBe(true);
    model.geometry.dispose();
  });

  it('не создаёт STL без геометрии', async () => {
    await expect(buildPrintableModel([])).rejects.toThrow('Нет геометрии для экспорта STL');
  });
});
