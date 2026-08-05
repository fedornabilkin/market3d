import * as THREE from 'three';
import { booleanCsg } from '../src/v3d/constructor/features/csg/booleanCsg';
import { validatePrintableGeometry } from '../src/v3d/print/geometryValidator';
import { buildPrintableModel } from '../src/v3d/print/PrintableModelBuilder';

const base = new THREE.BoxGeometry(10, 10, 3);
const detail = new THREE.BoxGeometry(3, 3, 2);
const cutter = new THREE.CylinderGeometry(1.5, 1.5, 8, 32);
try {
  const geometry = booleanCsg([
    { geometry: base, transform: new THREE.Matrix4(), isHole: false },
    { geometry: detail, transform: new THREE.Matrix4().makeTranslation(2, 1, 1.7), isHole: false },
    { geometry: cutter, transform: new THREE.Matrix4().makeRotationX(Math.PI / 2), isHole: true },
  ], 'union');
  const printable = await buildPrintableModel([{
    id: 'constructor',
    object: new THREE.Mesh(geometry),
    isBase: true,
    applyPlanarOverlap: true,
  }], { allowDisconnected: true });
  document.querySelector('#result')!.textContent = JSON.stringify({
    rawValidation: validatePrintableGeometry(geometry),
    printableValidation: printable.validation,
  }, null, 2);
  printable.geometry.dispose();
  geometry.dispose();
} catch (error) {
  document.querySelector('#result')!.textContent = JSON.stringify({
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }, null, 2);
} finally {
  base.dispose();
  detail.dispose();
  cutter.dispose();
}
