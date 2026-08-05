import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

const { booleanCsg } = vi.hoisted(() => ({
  booleanCsg: vi.fn(() => new THREE.BoxGeometry(10, 10, 10)),
}));

vi.mock('../constructor/features/csg/booleanCsg', () => ({ booleanCsg }));

import {
  buildPrintableModel,
  collectPrintableInputs,
  PRINT_JOIN_OVERLAP,
} from './PrintableModelBuilder';

describe('PrintableModelBuilder', () => {
  beforeEach(() => booleanCsg.mockClear());

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

  it('отдаёт в CSG все печатные детали и возвращает валидный результат', () => {
    const model = buildPrintableModel([
      { id: 'base', object: new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2)), isBase: true },
      { id: 'text', object: new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1)) },
    ]);

    expect(booleanCsg).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ isHole: false }),
    ]), 'union');
    expect(model.validation.valid).toBe(true);
    expect(model.validation.componentCount).toBe(1);
    model.geometry.dispose();
  });

  it('не создаёт STL без геометрии', () => {
    expect(() => buildPrintableModel([])).toThrow('Нет геометрии для экспорта STL');
  });
});
