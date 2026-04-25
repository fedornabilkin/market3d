import type {
  ModelTreeJSON,
  PrimitiveNodeJSON,
  GroupNodeJSON,
  ImportedMeshNodeJSON,
  NodeParams,
  PrimitiveParams,
  PrimitiveType,
} from '../../types';
import type {
  FeatureDocumentJSON,
  FeatureJSON,
  FeatureType,
  FeatureId,
} from '../types';

/**
 * Миграция legacy ModelTreeJSON (version 1, единое дерево ModelNode) в
 * FeatureDocumentJSON (version 2, граф фич с inputs).
 *
 * Стратегия: каждый legacy-узел разворачивается в одну или две фичи.
 *
 *   Primitive  → <Type>Feature (геометрия + color)
 *                Если есть nodeParams (position/rotation/scale/isHole) —
 *                оборачивается в TransformFeature.
 *
 *   Imported   → ImportedMeshFeature (filename, binaryRef|stlBase64, color)
 *                Тоже оборачивается в TransformFeature при наличии nodeParams.
 *
 *   Group      → BooleanFeature (operation: union|subtract|intersect)
 *                inputs — id'шники мигрированных детей.
 *                Оборачивается в Transform при наличии nodeParams группы.
 *                NB: legacy GroupNode = CSG-операция (через three-bvh-csg);
 *                новый GroupFeature — чисто-логический контейнер. Поэтому
 *                карта именно в BooleanFeature, не в GroupFeature.
 *
 * Координатное соглашение НЕ конвертируется — миграцию Y↔Z делает
 * Serializer.migrateLegacyYupToZupIfNeeded(rootJson) ДО вызова этой функции.
 */
export function migrateLegacyTreeToDocument(
  rootJson: ModelTreeJSON,
): FeatureDocumentJSON {
  const ctx = new MigrationContext();
  const rootId = visit(rootJson, ctx);
  return {
    version: 2,
    metadata: { createdAt: new Date().toISOString() },
    features: ctx.features,
    rootIds: [rootId],
  };
}

class MigrationContext {
  features: FeatureJSON[] = [];
  private seq = 0;

  newId(prefix: string): FeatureId {
    return `m_${prefix}_${++this.seq}`;
  }

  push(f: FeatureJSON): void {
    this.features.push(f);
  }
}

/** Возвращает id корневой фичи, представляющей данный legacy-узел. */
function visit(node: ModelTreeJSON, ctx: MigrationContext): FeatureId {
  if (node.kind === 'primitive') return visitPrimitive(node, ctx);
  if (node.kind === 'imported') return visitImported(node, ctx);
  return visitGroup(node, ctx);
}

function visitPrimitive(node: PrimitiveNodeJSON, ctx: MigrationContext): FeatureId {
  const type = node.type as FeatureType;
  const id = ctx.newId(node.type);
  const params = remapPrimitiveParams(node.type, node.params, node.nodeParams);

  const featureJson: FeatureJSON = {
    id,
    type,
    params,
  };
  if (node.name) featureJson.name = node.name;
  ctx.push(featureJson);

  return wrapInTransformIfNeeded(id, node.nodeParams, node.name, ctx);
}

function visitImported(
  node: ImportedMeshNodeJSON,
  ctx: MigrationContext,
): FeatureId {
  const id = ctx.newId('imported');
  const params: Record<string, unknown> = { filename: node.filename };
  if (node.binaryRef) params.binaryRef = node.binaryRef;
  if (node.stlBase64) params.stlBase64 = node.stlBase64;
  if (node.nodeParams?.color) params.color = node.nodeParams.color;

  const featureJson: FeatureJSON = {
    id,
    type: 'imported',
    params,
  };
  if (node.name) featureJson.name = node.name;
  ctx.push(featureJson);

  return wrapInTransformIfNeeded(id, node.nodeParams, node.name, ctx);
}

function visitGroup(node: GroupNodeJSON, ctx: MigrationContext): FeatureId {
  const childIds = node.children.map((c) => visit(c, ctx));
  const id = ctx.newId(`bool_${node.operation}`);

  const params: Record<string, unknown> = { operation: node.operation };
  if (node.nodeParams?.color) params.color = node.nodeParams.color;

  const featureJson: FeatureJSON = {
    id,
    type: 'boolean',
    params,
    inputs: childIds,
  };
  if (node.name) featureJson.name = node.name;
  ctx.push(featureJson);

  return wrapInTransformIfNeeded(id, node.nodeParams, node.name, ctx);
}

/**
 * Если у legacy-узла есть нетривиальный nodeParams (любой из
 * position/rotation/scale/isHole — color уже ушёл в саму фичу),
 * оборачиваем feature в TransformFeature и возвращаем его id.
 * Иначе возвращаем исходный id.
 */
function wrapInTransformIfNeeded(
  innerId: FeatureId,
  nodeParams: NodeParams | undefined,
  legacyName: string | undefined,
  ctx: MigrationContext,
): FeatureId {
  if (!hasNonTrivialTransform(nodeParams)) return innerId;

  const id = ctx.newId('xf');
  const params: Record<string, unknown> = {
    position: vec(nodeParams?.position, 0),
    rotation: vec(nodeParams?.rotation, 0),
    scale: vec(nodeParams?.scale, 1),
  };
  if (nodeParams?.isHole) params.isHole = true;

  const json: FeatureJSON = {
    id,
    type: 'transform',
    params,
    inputs: [innerId],
  };
  // Имя из legacy-узла привязано к "семантической" фиче — оставляем его на
  // примитиве; у Transform-обёртки имя пустое (UI возьмёт дефолт по типу).
  void legacyName;
  ctx.push(json);
  return id;
}

function hasNonTrivialTransform(p: NodeParams | undefined): boolean {
  if (!p) return false;
  if (p.isHole) return true;
  if (p.position && (p.position.x || p.position.y || p.position.z)) return true;
  if (p.rotation && (p.rotation.x || p.rotation.y || p.rotation.z)) return true;
  if (p.scale && (p.scale.x !== 1 || p.scale.y !== 1 || p.scale.z !== 1)) return true;
  return false;
}

function vec(
  v: { x: number; y: number; z: number } | undefined,
  fallback: number,
): [number, number, number] {
  if (!v) return [fallback, fallback, fallback];
  return [v.x ?? fallback, v.y ?? fallback, v.z ?? fallback];
}

/**
 * Перенос геометрических параметров примитива из legacy-формата (плоский
 * PrimitiveParams + nodeParams.color) в FeatureParams конкретного типа.
 * Имена полей для thread/knurl отличаются (legacy: threadProfile/knurlPattern/
 * knurlAngle → новые: profile/pattern/angle).
 */
function remapPrimitiveParams(
  type: PrimitiveType,
  legacy: PrimitiveParams,
  nodeParams: NodeParams | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Прокидываем все «совпадающие по имени» геометрические поля.
  const passthrough: (keyof PrimitiveParams)[] = [
    'width', 'height', 'depth',
    'radius', 'radiusTop', 'radiusBottom',
    'segments', 'widthSegments', 'heightSegments',
    'tube', 'innerRadius', 'outerRadius',
    'bevelRadius', 'bevelSegments',
    'outerDiameter', 'innerDiameter', 'pitch', 'turns',
    'leftHand', 'notchCount', 'segmentsPerNotch',
  ];
  for (const k of passthrough) {
    const v = legacy[k];
    if (v !== undefined) out[k] = v;
  }

  // Переименования.
  if (type === 'thread' && legacy.threadProfile !== undefined) {
    out.profile = legacy.threadProfile;
  }
  if (type === 'knurl') {
    if (legacy.knurlPattern !== undefined) out.pattern = legacy.knurlPattern;
    if (legacy.knurlAngle !== undefined) out.angle = legacy.knurlAngle;
  }

  if (nodeParams?.color) out.color = nodeParams.color;
  return out;
}
