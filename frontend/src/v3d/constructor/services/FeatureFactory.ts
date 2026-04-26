import type { ModelNode } from '../nodes/ModelNode';
import { Primitive } from '../nodes/Primitive';
import { ImportedMeshNode } from '../nodes/ImportedMeshNode';
import type { PrimitiveType, PrimitiveParams } from '../types';
import type { BufferGeometry } from 'three';
import type { FeatureIdGenerator } from './FeatureIdGenerator';

/**
 * Factory для создания нодов модели + future-ready для создания Feature'ей
 * напрямую (после source-of-truth flip — Phase 2 prep stage 2/3).
 *
 * На стадии P2-prep-1 источник-of-truth — ModelNode-tree, поэтому методы
 * возвращают `ModelNode`. Внутри прячется логика дефолтных params для
 * каждого типа примитива и интеграция с FeatureIdGenerator.
 *
 * Pattern: **Factory Method** — единая точка создания, легко расширять
 * новыми типами без правки caller'ов; legacy detail-логика (legacy
 * Primitive vs ImportedMeshNode vs ...) скрыта от вызывающего кода.
 */
export class FeatureFactory {
  constructor(private readonly idGen: FeatureIdGenerator) {}

  /**
   * Создаёт примитивную ноду нужного типа с дефолтными геометрическими
   * параметрами. Caller может override'нуть отдельные поля через
   * `paramsOverride`.
   */
  createPrimitive(
    type: PrimitiveType,
    paramsOverride?: Partial<PrimitiveParams>,
  ): Primitive {
    const defaults = DEFAULT_PRIMITIVE_PARAMS[type] ?? FALLBACK_PARAMS;
    const geometryParams: PrimitiveParams = { ...defaults, ...paramsOverride };
    const node = new Primitive(type, geometryParams, { position: { x: 0, y: 0, z: 0 } });
    node.uuidMesh = this.idGen.next(type);
    return node;
  }

  /**
   * Создаёт imported-mesh ноду из подготовленного BufferGeometry.
   * Геометрия — обязательный параметр (вызывающий уже распарсил STL).
   * binaryRef и stlBase64 — опциональны.
   */
  createImportedMesh(
    filename: string,
    geometry: BufferGeometry,
    opts: { binaryRef?: string; stlBase64?: string; color?: string } = {},
  ): ImportedMeshNode {
    const node = new ImportedMeshNode(
      geometry,
      opts.stlBase64 ?? '',
      filename,
      opts.color ? { color: opts.color } : undefined,
      opts.binaryRef,
    );
    node.uuidMesh = this.idGen.next('imported');
    return node;
  }

  /**
   * Клонирует существующую ноду (deep-clone params + новый id).
   * Для duplicate-операции.
   */
  cloneNode(node: ModelNode): ModelNode {
    const cloned = node.clone();
    cloned.uuidMesh = this.idGen.next(node.constructor.name.toLowerCase().replace('node', ''));
    return cloned;
  }
}

/**
 * Дефолтные геометрические параметры по типу примитива. Совпадают с
 * legacy `getDefaultParamsForType` в Constructor.vue (которая после
 * flip'а удалится, дефолты живут только здесь).
 */
const DEFAULT_PRIMITIVE_PARAMS: Record<PrimitiveType, PrimitiveParams> = {
  box: { width: 20, height: 20, depth: 20 },
  sphere: { radius: 10, widthSegments: 32, heightSegments: 32 },
  cylinder: { radiusTop: 10, radiusBottom: 10, height: 20, segments: 32 },
  cone: { radius: 10, height: 20, segments: 32 },
  torus: { radius: 10, tube: 2, segments: 32 },
  plane: { width: 20, height: 20 },
  ring: { innerRadius: 5, outerRadius: 10, segments: 32 },
  thread: {
    outerDiameter: 10, innerDiameter: 8, pitch: 1.5, turns: 5,
    threadProfile: 'trapezoid', segmentsPerTurn: 32, leftHand: false,
  },
  knurl: {
    outerDiameter: 10, innerDiameter: 9, height: 10, notchCount: 24,
    knurlPattern: 'diamond', knurlAngle: 30, segmentsPerNotch: 4,
  },
};

const FALLBACK_PARAMS: PrimitiveParams = { width: 20, height: 20, depth: 20 };
