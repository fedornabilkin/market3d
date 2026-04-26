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
 * Trace-таблица соответствия featureId → legacy ModelTreeJSON.
 *
 * Для каждой эмитнутой фичи мы пишем ссылку на тот legacy-узел, из
 * которого она получилась. Если legacy-узел породил две фичи (semantic +
 * Transform-обёртка), оба id указывают на один и тот же ModelTreeJSON.
 *
 * Используется в render-cutover: после `FeatureRenderer.bindDocument` нужно
 * протянуть `userData.node` на меши, чтобы PointerEventController/
 * findObject3DByNode продолжали работать. Caller комбинирует эту таблицу
 * с параллельным walk'ом ModelNode-tree (структурно идентичного
 * ModelTreeJSON), чтобы получить `featureId → ModelNode`.
 */
export type MigrationTrace = Map<FeatureId, ModelTreeJSON>;

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
 *   Group      → BooleanFeature, ЕСЛИ:
 *                  - operation в {'subtract', 'intersect'}, ИЛИ
 *                  - operation === 'union' И хоть один ребёнок — hole.
 *                Иначе (чистый union без hole-детей) → GroupFeature
 *                (logical container без CSG, рендер-слой проходит детей
 *                независимо). Это совпадает с гибридной логикой
 *                ConstructorSceneService.buildNodeObject3D, где union
 *                без hole-детей рендерится как THREE.Group.
 *                Оборачивается в Transform при наличии nodeParams группы.
 *
 * Координатное соглашение НЕ конвертируется — миграцию Y↔Z делает
 * migrateLegacyYupToZupIfNeeded ДО вызова этой функции.
 *
 * @param trace опционально — пишем сюда featureId → legacy-узел для каждой
 *              эмитнутой фичи. Полезно для render-cutover (см. MigrationTrace).
 */
export function migrateLegacyTreeToDocument(
  rootJson: ModelTreeJSON,
  trace?: MigrationTrace,
): FeatureDocumentJSON {
  const ctx = new MigrationContext(trace);
  // Корень — всегда logical container (никогда CSG), как в legacy
  // ConstructorSceneService.buildNodeObject3D, где `isRoot=true` принудительно
  // даёт renderAsContainer=true. Это нужно, чтобы одиночный hole-примитив
  // в корне НЕ вычитался из сцены сразу при тогле isHole, а оставался
  // полупрозрачным «зебра-стилем».
  const rootId = visit(rootJson, ctx, /* isRoot */ true);
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
  constructor(readonly trace?: MigrationTrace) {}

  newId(prefix: string): FeatureId {
    return `m_${prefix}_${++this.seq}`;
  }

  push(f: FeatureJSON, source: ModelTreeJSON): void {
    this.features.push(f);
    if (this.trace) this.trace.set(f.id, source);
  }
}

/** Возвращает id корневой фичи, представляющей данный legacy-узел. */
function visit(node: ModelTreeJSON, ctx: MigrationContext, isRoot = false): FeatureId {
  if (node.kind === 'primitive') return visitPrimitive(node, ctx);
  if (node.kind === 'imported') return visitImported(node, ctx);
  return visitGroup(node, ctx, isRoot);
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
  ctx.push(featureJson, node);

  return wrapInTransformIfNeeded(id, node, ctx);
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
  ctx.push(featureJson, node);

  return wrapInTransformIfNeeded(id, node, ctx);
}

function visitGroup(node: GroupNodeJSON, ctx: MigrationContext, isRoot = false): FeatureId {
  const childIds = node.children.map((c) => visit(c, ctx, /* isRoot */ false));

  // Дискриминация GroupFeature vs BooleanFeature.
  //  - Корень — всегда GroupFeature (logical container), как в legacy
  //    `isRoot=true → renderAsContainer=true`. Иначе одиночный hole-примитив
  //    в корне моментально CSG-вычитался бы из ничего и исчезал.
  //  - Не-корень: чистый union без hole-детей → GroupFeature (рендерится как
  //    THREE.Group без CSG). Иначе (subtract/intersect/union с holes) →
  //    BooleanFeature (CSG-меш).
  const hasHoleChild = node.children.some((c) => !!c.nodeParams?.isHole);
  const useBoolean = !isRoot && (node.operation !== 'union' || hasHoleChild);

  let id: FeatureId;
  let featureJson: FeatureJSON;
  if (useBoolean) {
    id = ctx.newId(`bool_${node.operation}`);
    const params: Record<string, unknown> = { operation: node.operation };
    if (node.nodeParams?.color) params.color = node.nodeParams.color;
    featureJson = { id, type: 'boolean', params, inputs: childIds };
  } else {
    id = ctx.newId('group');
    const params: Record<string, unknown> = {};
    if (node.nodeParams?.color) params.color = node.nodeParams.color;
    featureJson = { id, type: 'group', params, inputs: childIds };
  }
  if (node.name) featureJson.name = node.name;
  ctx.push(featureJson, node);

  // Корень НИКОГДА не оборачиваем в Transform: это сделало бы всю сцену
  // зависимой от root.nodeParams (position/rotation/scale), которые в
  // Constructor.vue ни одна штатная операция не выставляет, но могли
  // случайно «протечь» туда от выделения root + mirror/rotate (см. отчёт
  // от 2026-04-26: пораженный v2 имел m_xf_3 на корне с position=(209,29,9)
  // и rotation R_y(π) — каждый последующий примитив рендерился через эту
  // трансформацию). При сохранении после load этот фикс самоисцеляет
  // сохранёнки: nodeParams корня молча отбрасываются.
  if (isRoot) return id;

  return wrapInTransformIfNeeded(id, node, ctx);
}

/**
 * Если у legacy-узла есть нетривиальный nodeParams (любой из
 * position/rotation/scale/isHole — color уже ушёл в саму фичу),
 * оборачиваем feature в TransformFeature и возвращаем его id.
 * Иначе возвращаем исходный id.
 */
function wrapInTransformIfNeeded(
  innerId: FeatureId,
  source: ModelTreeJSON,
  ctx: MigrationContext,
): FeatureId {
  const nodeParams = source.nodeParams;
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
  ctx.push(json, source);
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
