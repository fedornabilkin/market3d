import * as THREE from 'three';
import { Base, Barcode, Border, Code, Keychain, Magnet, Text } from '../src/v3d/entity';
import ModelGenerator from '../src/v3d/generator/ModelGenerator';
import NameTagGenerator from '../src/v3d/generator/NameTagGenerator';
import GRZGenerator from '../src/v3d/generator/GRZGenerator';
import CoasterGenerator from '../src/v3d/generator/CoasterGenerator';
import BrailleGenerator from '../src/v3d/generator/BrailleGenerator';
import {
  buildPrintableModel,
  PrintableModelBuildError,
  type PrintablePart,
} from '../src/v3d/print/PrintableModelBuilder';

const result = document.querySelector('#result')!;
const mask = createQrMask(21);

const auditDefinitions: Array<[string, () => Record<string, THREE.Object3D | undefined>]> = [
  ['Control: two overlapping boxes', createOverlappingBoxes],
  ['QR-код: рамка, текст и ушко', createQrMeshes],
  ['Штрихкод: рамка, текст и ушко', createBarcodeMeshes],
  ['NameTag: реальные настройки генератора', createNameTagMeshes],
  ['ГРЗ: рамка, символы и ушко', () => new GRZGenerator({
    keychain: { active: true, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3 },
  }).generate()],
  ['Coaster: кольца, текст и ушко', () => new CoasterGenerator({
    text: { active: true, message: 'MANIFOLD', size: 5, depth: 1, mode: 'straight', color: '#000000' },
    rings: { active: true, count: 3, ringWidth: 1, spacing: 3, startRadius: 15, depth: 1, color: '#000000' },
    keychain: { active: true, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3 },
  }).generate()],
  ['Брайль: точки, обычный текст и ушко', () => new BrailleGenerator({
    text: 'проверка',
    showPlainText: true,
    keychain: { active: true, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3 },
  }).generate()],
];

const requestedAudit = new URLSearchParams(location.search).get('only');
const audits = await Promise.all(auditDefinitions
  .filter(([name]) => !requestedAudit || name.toLowerCase().includes(requestedAudit.toLowerCase()))
  .map(([name, createMeshes]) => runAudit(name, createMeshes)));

result.textContent = JSON.stringify({
  passed: audits.every(({ passed }) => passed),
  audits,
}, null, 2);

async function runAudit(name: string, createMeshes: () => Record<string, THREE.Object3D | undefined>) {
  const startedAt = performance.now();
  const meshes = createMeshes();
  try {
    const allowDisconnected = new URLSearchParams(location.search).get('variant') === 'no-backing';
    const model = await buildPrintableModel(toParts(meshes), { allowDisconnected });
    const output = {
      name,
      passed: model.validation.valid,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      triangleCount: model.validation.triangleCount,
      componentCount: model.validation.componentCount,
      diagnostics: model.validation.diagnostics,
    };
    model.geometry.dispose();
    return output;
  } catch (error) {
    return {
      name,
      passed: false,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      diagnostics: error instanceof PrintableModelBuildError ? error.diagnostics : [],
    };
  } finally {
    disposeMeshes(meshes);
  }
}

function toParts(meshes: Record<string, THREE.Object3D | undefined>): PrintablePart[] {
  const requestedParts = new URLSearchParams(location.search).get('parts')?.split(',');
  return Object.entries(meshes)
    .filter(([id, object]): object is THREE.Object3D => (
      Boolean(object) && (!requestedParts || requestedParts.includes(id))
    ))
    .map(([id, object]) => ({ id, object, isBase: id === 'base' || id === 'backing' }));
}

function disposeMeshes(meshes: Record<string, THREE.Object3D | undefined>): void {
  for (const object of Object.values(meshes)) {
    object?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    });
  }
}

function createOverlappingBoxes(): Record<string, THREE.Object3D | undefined> {
  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 3));
  const detail = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1));
  detail.position.z = 1.9;
  return { base, detail };
}

function createNameTagMeshes(): Record<string, THREE.Object3D | undefined> {
  const variant = new URLSearchParams(location.search).get('variant');
  const options: Record<string, unknown> = {};
  if (variant === 'hollow') {
    options.hollow = { active: true, wallThickness: 0.8, floorThickness: 0.6 };
  } else if (variant === 'no-backing') {
    options.backing = { active: false };
  } else if (variant === 'cyrillic') {
    options.message = 'Имя';
  } else if (variant === 'random') {
    options.message = 'Высота';
    options.randomHeight = { active: true, variance: 0.8, seed: 42 };
  } else if (variant === 'bevel-transition') {
    options.bevel = { active: true, size: 0.7, thickness: 0.7, segments: 3 };
  } else if (variant === 'bevel-max') {
    options.bevel = { active: true, size: 3, thickness: 3, segments: 8 };
  }
  return new NameTagGenerator(options).generate();
}

function createQrMeshes(): Record<string, THREE.Object3D | undefined> {
  const params = new URLSearchParams(location.search);
  const simple = params.get('simple') === '1';
  const magnetMode = params.get('magnet');
  const generator = new ModelGenerator({
    base: new Base({ active: true, width: 60, height: 60, depth: 3, cornerRadius: 5 }),
    border: new Border({ active: !simple, width: 1, depth: 1 }),
    code: new Code({ active: true, depth: 1, margin: 3, emptyCenter: false }),
    text: new Text({ active: !simple, message: 'AUDIT', size: 5, depth: 1 }),
    keychain: new Keychain({ active: !simple, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3 }),
    magnet: new Magnet({
      active: Boolean(magnetMode),
      hidden: magnetMode === 'hidden',
      shape: 'round',
      size: 10,
      depth: 1,
      count: 1,
    }),
    icon: { active: false, isNoneName: () => true },
  }, mask);
  const base = generator.getBaseMesh();
  const border = generator.getBorderMesh();
  const keychain = generator.getKeychainMesh();
  const text = generator.getTextMesh();
  const qr = generator.getQRCodeMesh();
  return { base, border, keychain, text, qr };
}

function createBarcodeMeshes(): Record<string, THREE.Object3D | undefined> {
  const generator = new ModelGenerator({
    base: new Base({ active: true, width: 70, height: 40, depth: 3, cornerRadius: 5 }),
    border: new Border({ active: true, width: 1, depth: 1 }),
    code: new Code({ active: false, margin: 3 }),
    barcode: new Barcode({ active: true, depth: 1, margin: 3, height: 22, barRatio: 100 }),
    text: new Text({ active: true, message: 'AUDIT', size: 4, depth: 1 }),
    keychain: new Keychain({ active: true, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3 }),
    magnet: new Magnet({ active: false }),
    icon: { active: false, isNoneName: () => true },
  }, null, {
    totalModules: 20,
    bars: [
      { start: 0, length: 1 }, { start: 2, length: 2 }, { start: 5, length: 1 },
      { start: 7, length: 3 }, { start: 12, length: 1 }, { start: 15, length: 2 },
    ],
  });
  return {
    base: generator.getBaseMesh(),
    border: generator.getBorderMesh(),
    keychain: generator.getKeychainMesh(),
    text: generator.getTextMesh(),
    barcode: generator.getBarcodeMesh(),
  };
}

function createQrMask(size: number): Uint8Array {
  const output = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      output[y * size + x] = Number((x * 7 + y * 11 + x * y) % 5 < 2);
    }
  }
  return output;
}
