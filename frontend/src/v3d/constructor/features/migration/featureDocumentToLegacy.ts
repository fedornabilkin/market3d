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
  FeatureId,
} from '../types';

/**
 * Trace для inverse-конверсии: featureId → ModelTreeJSON, в который эта фича
 * перетекает. Симметрично `MigrationTrace` из migrateLegacyTreeToDocument:
 * Caller комбинирует эту таблицу с walk'ом построенного ModelNode-tree
 * (структурно идентичного ModelTreeJSON), чтобы получить `featureId → ModelNode`
 * без re-migrate.
 *
 * Для Transform-фич trace указывает на тот же узел, что и для inner-фичи
 * (Primitive/Group/etc.) — потому что Transform "сливается" в `nodeParams`
 * целевого ModelTreeJSON, а не имеет собственного ModelNode-аналога.
 */
export type InverseMigrationTrace = Map<FeatureId, ModelTreeJSON>;

/**
 * Обратное преобразование: FeatureDocumentJSON v2 → ModelTreeJSON v1.
 *
 * Используется для cutover-стадии Phase 1: позволяет хранить сохранёнки в
 * новом формате, но продолжать рендерить через legacy ModelNode-tree
 * (sceneService.rebuildSceneFromTree). Парный обратный путь к
 * migrateLegacyTreeToDocument — round-trip для документов, происходящих
 * из legacy-миграции, должен быть identity.
 *
 * Стратегия — рекурсивный обход от единственного rootId:
 *
 *   Primitive*Feature  → PrimitiveNodeJSON (geom params + name + color из
 *                       params.color уезжает в nodeParams.color)
 *   ImportedMeshFeature → ImportedMeshNodeJSON (filename + binaryRef|stlBase64)
 *   BooleanFeature     → GroupNodeJSON{operation, children}
 *   GroupFeature       → GroupNodeJSON{operation: 'union', children}
 *                       (logical container не имеет точного аналога в legacy;
 *                        union — самое близкое поведение)
 *   TransformFeature   → берёт inner = visit(input), записывает свои
 *                       position/rotation/scale/isHole/color в inner.nodeParams.
 *
 * Допущения (выполняются для документов, полученных через
 * migrateLegacyTreeToDocument):
 *  - Граф — дерево от единственного rootId (нет shared-фич между ветками).
 *  - TransformFeature имеет ровно один input, и тот не является другим Transform.
 *  - В документе нет циклов (FeatureGraph это гарантирует).
 *
 * При нарушениях бросает ошибку — caller делает fallback на legacy-чтение.
 *
 * @param trace опционально — пишем сюда featureId → ModelTreeJSON для каждой
 *              посещённой фичи. Полезно для load-flow flip (см. InverseMigrationTrace).
 */
export function featureDocumentToLegacy(
  doc: FeatureDocumentJSON,
  trace?: InverseMigrationTrace,
): ModelTreeJSON {
  if (doc.version !== 2) {
    throw new Error(`[featureDocumentToLegacy] неподдерживаемая версия: ${doc.version}`);
  }
  if (doc.rootIds.length !== 1) {
    throw new Error(
      `[featureDocumentToLegacy] ожидался ровно один rootId, получено: ${doc.rootIds.length}`,
    );
  }

  const byId = new Map<FeatureId, FeatureJSON>();
  for (const f of doc.features) byId.set(f.id, f);

  const visit = (id: FeatureId): ModelTreeJSON => {
    const f = byId.get(id);
    if (!f) throw new Error(`[featureDocumentToLegacy] фича ${id} не найдена`);

    if (f.type === 'transform') {
      const inputs = f.inputs ?? [];
      if (inputs.length !== 1) {
        throw new Error(`[featureDocumentToLegacy] transform ${f.id} ожидает 1 input, получено ${inputs.length}`);
      }
      const inner = visit(inputs[0]);
      applyTransformParams(inner, f.params);
      // name на Transform не переносим: legacy-имя живёт на семантической
      // фиче (см. migrateLegacyTreeToDocument). Но если по какой-то причине
      // только Transform имеет имя — пробрасываем, чтобы не потерять.
      if (f.name && !inner.name) inner.name = f.name;
      // Transform "сливается" в nodeParams inner — указываем тот же ModelTreeJSON.
      if (trace) trace.set(f.id, inner);
      return inner;
    }

    let json: ModelTreeJSON;

    if (f.type === 'boolean') {
      const children = (f.inputs ?? []).map(visit);
      const operation = (f.params as { operation?: 'union' | 'subtract' | 'intersect' }).operation ?? 'union';
      const node: GroupNodeJSON = {
        kind: 'group',
        operation,
        children,
      };
      if (f.name) node.name = f.name;
      const color = (f.params as { color?: string }).color;
      if (color) {
        node.nodeParams = node.nodeParams ?? {};
        node.nodeParams.color = color;
      }
      json = node;
    } else if (f.type === 'group') {
      const children = (f.inputs ?? []).map(visit);
      const node: GroupNodeJSON = {
        kind: 'group',
        operation: 'union',
        children,
      };
      if (f.name) node.name = f.name;
      const params = f.params as { color?: string; isHole?: boolean };
      if (params.color || params.isHole) {
        node.nodeParams = node.nodeParams ?? {};
        if (params.color) node.nodeParams.color = params.color;
        if (params.isHole) node.nodeParams.isHole = params.isHole;
      }
      json = node;
    } else if (f.type === 'imported') {
      const params = f.params as {
        filename?: string;
        binaryRef?: string;
        stlBase64?: string;
        color?: string;
      };
      const node: ImportedMeshNodeJSON = {
        kind: 'imported',
        filename: params.filename ?? '',
        stlBase64: params.stlBase64 ?? '',
      };
      if (params.binaryRef) node.binaryRef = params.binaryRef;
      if (f.name) node.name = f.name;
      if (params.color) {
        node.nodeParams = node.nodeParams ?? {};
        node.nodeParams.color = params.color;
      }
      json = node;
    } else {
      // Остальные — примитивы.
      const node: PrimitiveNodeJSON = {
        kind: 'primitive',
        type: f.type as PrimitiveType,
        params: extractPrimitiveParams(f.type, f.params as Record<string, unknown>),
      };
      if (f.name) node.name = f.name;
      const color = (f.params as { color?: string }).color;
      if (color) {
        node.nodeParams = node.nodeParams ?? {};
        node.nodeParams.color = color;
      }
      json = node;
    }

    if (trace) trace.set(f.id, json);
    return json;
  };

  const result = visit(doc.rootIds[0]);
  // FeatureDocumentJSON v2 всегда в Z-up. Без этой пометки последующий
  // `migrateLegacyYupToZupIfNeeded` (вызывается load-флоу для legacy-сохранёнок)
  // ошибочно посчитает данные за Y-up и поменяет Y↔Z в позициях/ротациях —
  // объекты «улетят вверх» при первой загрузке через v2-sidecar.
  (result as ModelTreeJSON & { coordsConvention?: string }).coordsConvention = 'zup';
  return result;
}

/**
 * Применяет параметры Transform-фичи к nodeParams вложенного legacy-узла.
 * Перезаписывает существующие поля — поведение совпадает с legacy:
 * вложенный Transform-эффект полностью определяет position/rotation/scale.
 */
function applyTransformParams(
  inner: ModelTreeJSON,
  transformParams: Record<string, unknown>,
): void {
  const np: NodeParams = inner.nodeParams ?? {};
  const position = transformParams.position as [number, number, number] | undefined;
  const rotation = transformParams.rotation as [number, number, number] | undefined;
  const scale = transformParams.scale as [number, number, number] | undefined;
  const isHole = transformParams.isHole as boolean | undefined;
  const color = transformParams.color as string | undefined;

  if (position && (position[0] !== 0 || position[1] !== 0 || position[2] !== 0)) {
    np.position = { x: position[0], y: position[1], z: position[2] };
  }
  if (rotation && (rotation[0] !== 0 || rotation[1] !== 0 || rotation[2] !== 0)) {
    np.rotation = { x: rotation[0], y: rotation[1], z: rotation[2] };
  }
  if (scale && (scale[0] !== 1 || scale[1] !== 1 || scale[2] !== 1)) {
    np.scale = { x: scale[0], y: scale[1], z: scale[2] };
  }
  if (isHole) np.isHole = true;
  if (color) np.color = color;

  if (Object.keys(np).length > 0) inner.nodeParams = np;
}

/**
 * Извлекает геометрические параметры в legacy-формате. Для thread/knurl
 * переименовывает обратно: profile → threadProfile, pattern → knurlPattern,
 * angle → knurlAngle.
 */
function extractPrimitiveParams(
  type: string,
  v2Params: Record<string, unknown>,
): PrimitiveParams {
  const out: PrimitiveParams = {};

  const passthrough = [
    'width', 'height', 'depth',
    'radius', 'radiusTop', 'radiusBottom',
    'segments', 'widthSegments', 'heightSegments',
    'tube', 'innerRadius', 'outerRadius',
    'bevelRadius', 'bevelSegments',
    'outerDiameter', 'innerDiameter', 'pitch', 'turns',
    'leftHand', 'notchCount', 'segmentsPerNotch',
  ] as const;
  for (const k of passthrough) {
    const v = v2Params[k];
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }

  if (type === 'thread' && v2Params.profile !== undefined) {
    out.threadProfile = v2Params.profile as string;
  }
  if (type === 'knurl') {
    if (v2Params.pattern !== undefined) out.knurlPattern = v2Params.pattern as string;
    if (v2Params.angle !== undefined) out.knurlAngle = v2Params.angle as number;
  }

  return out;
}
