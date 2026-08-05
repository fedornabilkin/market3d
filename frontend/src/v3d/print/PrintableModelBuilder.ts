import * as THREE from 'three';
import type { BooleanInput } from '../constructor/features/csg/booleanCsg';
import { unionPrintableParts } from './ManifoldKernel';
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
  applyPlanarOverlap?: boolean;
}

export interface PrintableModelBuildOptions {
  allowDisconnected?: boolean;
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

export async function buildPrintableModel(
  parts: readonly PrintablePart[],
  options: PrintableModelBuildOptions = {},
): Promise<PrintableModel> {
  if (parts.length === 0) {
    throw new PrintableModelBuildError('Нет геометрии для экспорта STL.');
  }

  let geometry: THREE.BufferGeometry;
  try {
    geometry = await unionPrintableParts(parts);
  } catch (error) {
    throw new PrintableModelBuildError(
      `Не удалось собрать печатную модель: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const validation = validatePrintableGeometry(geometry, {
    allowDisconnected: options.allowDisconnected,
  });
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
