import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import {
  CUT_INFLATE_EPS,
  inflateGeom,
  removeDegenerateTriangles,
} from './geometryCleanup';

function bbox(geom: THREE.BufferGeometry): THREE.Box3 {
  geom.computeBoundingBox();
  return geom.boundingBox!.clone();
}

// ─── Кейс 1: раздувание режущего тела при вычитании ──────────────────────
// Механизм фикса неманифолдности при subtract: грань режущего тела, копланарная
// грани базы, после раздувания на ε выходит за пределы базы → CSG режет чисто,
// без слипшихся граней / срезов нулевой толщины.
describe('inflateGeom — раздувание режущего тела', () => {
  it('увеличивает каждую сторону bbox ровно на 2·ε, сохраняя центр', () => {
    const geom = new THREE.BoxGeometry(20, 8, 8); // центр в начале координат
    const before = bbox(geom);

    inflateGeom(geom, CUT_INFLATE_EPS);
    const after = bbox(geom);

    const sizeBefore = before.getSize(new THREE.Vector3());
    const sizeAfter = after.getSize(new THREE.Vector3());
    expect(sizeAfter.x).toBeCloseTo(sizeBefore.x + 2 * CUT_INFLATE_EPS, 6);
    expect(sizeAfter.y).toBeCloseTo(sizeBefore.y + 2 * CUT_INFLATE_EPS, 6);
    expect(sizeAfter.z).toBeCloseTo(sizeBefore.z + 2 * CUT_INFLATE_EPS, 6);

    const centerAfter = after.getCenter(new THREE.Vector3());
    expect(centerAfter.x).toBeCloseTo(0, 6);
    expect(centerAfter.y).toBeCloseTo(0, 6);
    expect(centerAfter.z).toBeCloseTo(0, 6);
  });

  it('копланарная грань выходит за пределы базы (грани больше не совпадают)', () => {
    // База: грань на x = +10. Режущее тело такой же ширины по X → грань тоже x = +10.
    const cutter = new THREE.BoxGeometry(20, 8, 8);
    inflateGeom(cutter, CUT_INFLATE_EPS);

    const after = bbox(cutter);
    expect(after.max.x).toBeGreaterThan(10); // вышла за грань базы (10)
    expect(after.max.x).toBeCloseTo(10 + CUT_INFLATE_EPS, 6);
  });

  it('сохраняет центр у смещённого тела', () => {
    const geom = new THREE.BoxGeometry(4, 4, 4);
    geom.translate(5, -3, 2);

    inflateGeom(geom, CUT_INFLATE_EPS);
    const center = bbox(geom).getCenter(new THREE.Vector3());

    expect(center.x).toBeCloseTo(5, 6);
    expect(center.y).toBeCloseTo(-3, 6);
    expect(center.z).toBeCloseTo(2, 6);
  });
});

// ─── Кейс 2: удаление вырожденных граней после CSG ───────────────────────
describe('removeDegenerateTriangles', () => {
  it('выбрасывает схлопнувшиеся грани с повторяющимся индексом, сохраняя валидные', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 2, 0],
        3,
      ),
    );
    // Триангл 0 валидный (0,1,2); триангл 1 схлопнут (3,3,4).
    geom.setIndex([0, 1, 2, 3, 3, 4]);

    const out = removeDegenerateTriangles(geom);
    const idx = out.getIndex();

    expect(idx).not.toBeNull();
    expect(idx!.count).toBe(3);
    expect(Array.from(idx!.array)).toEqual([0, 1, 2]);
  });

  it('ловит схлопывание в любой из трёх позиций треугольника', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
        3,
      ),
    );
    // (0,0,1) a==b, (2,3,2) a==c, (3,1,1) b==c — все вырожденные.
    geom.setIndex([0, 0, 1, 2, 3, 2, 3, 1, 1]);

    const out = removeDegenerateTriangles(geom);
    expect(out.getIndex()!.count).toBe(0);
  });

  it('не трогает геометрию без вырожденных граней (возвращает её же)', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    geom.setIndex([0, 1, 2]);

    const out = removeDegenerateTriangles(geom);
    expect(out).toBe(geom);
    expect(out.getIndex()!.count).toBe(3);
  });

  it('возвращает неиндексированную геометрию без изменений', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const out = removeDegenerateTriangles(geom);
    expect(out).toBe(geom);
    expect(out.getIndex()).toBeNull();
  });
});
