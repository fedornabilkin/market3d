import * as THREE from 'three';
import { booleanCsg, type BooleanInput } from '../constructor/features/csg/booleanCsg';
import {
  validatePrintableGeometry,
  type PrintDiagnostic,
  type PrintValidationResult,
} from './geometryValidator';

export const PRINT_JOIN_OVERLAP = 0.05;

export interface PrintablePart {
  id: string;
  object: THREE.Object3D;
  isBase?: boolean;
}

export interface PrintableModel {
  geometry: THREE.BufferGeometry;
  validation: PrintValidationResult;
}

export class PrintableModelBuildError extends Error {
  readonly diagnostics: PrintDiagnostic[];

  constructor(message: string, diagnostics: PrintDiagnostic[] = []) {
    super(message);
    this.name = 'PrintableModelBuildError';
    this.diagnostics = diagnostics;
  }
}

export function buildPrintableModel(parts: readonly PrintablePart[]): PrintableModel {
  const inputs = collectPrintableInputs(parts);
  if (inputs.length === 0) {
    throw new PrintableModelBuildError('Нет геометрии для экспорта STL.');
  }

  let geometry: THREE.BufferGeometry;
  try {
    geometry = booleanCsg(inputs, 'union');
  } catch (error) {
    throw new PrintableModelBuildError(
      `Не удалось объединить детали модели: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const validation = validatePrintableGeometry(geometry);
  if (!validation.valid) {
    geometry.dispose();
    throw new PrintableModelBuildError(
      `Печатная модель не прошла проверку: ${validation.diagnostics.map(({ code }) => code).join(', ')}.`,
      validation.diagnostics,
    );
  }

  return { geometry, validation };
}

export function collectPrintableInputs(parts: readonly PrintablePart[]): BooleanInput[] {
  const inputs: BooleanInput[] = [];
  for (const part of parts) {
    part.object.updateMatrixWorld(true);
    part.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.geometry?.getAttribute('position')) return;
      const transform = object.matrixWorld.clone();
      if (!part.isBase) transform.premultiply(new THREE.Matrix4().makeTranslation(0, 0, -PRINT_JOIN_OVERLAP));
      inputs.push({
        geometry: object.geometry,
        transform,
        isHole: false,
      });
    });
  }
  return inputs;
}
