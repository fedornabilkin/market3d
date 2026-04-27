import * as THREE from 'three';
import { BoxFeature } from '../features/primitives/BoxFeature';
import { CylinderFeature } from '../features/primitives/CylinderFeature';
import { TorusFeature } from '../features/primitives/TorusFeature';
import { GroupFeature } from '../features/composite/GroupFeature';
import { TransformFeature } from '../features/composite/TransformFeature';
import type { Feature } from '../features/Feature';
import type { FeatureId } from '../features/types';
import { nextP2FeatureId } from '../features/utils/dagMutations';

export type ChamferProfile = 'convex' | 'concave' | 'flat';

/** Спецификация линейного ребра (отрезок в local-coords target'а). */
export interface LinearEdgeSpec {
  kind: 'linear';
  /** Ось ребра в local-coords target'а: 'x', 'y', 'z'. */
  axis: 'x' | 'y' | 'z';
  /** Локальная середина ребра (точка на оси target'а). */
  localMid: THREE.Vector3;
  /** Длина ребра. */
  length: number;
  /** Знак сдвига перпендикуляра по chamfer-local X (см. buildLinearChamfer). */
  perpDirX: number;
  /** Знак сдвига перпендикуляра по chamfer-local Z. */
  perpDirZ: number;
}

/** Спецификация цилиндрического ребра (окружность на ободе). */
export interface CircularEdgeSpec {
  kind: 'circular';
  /** Локальная середина ребра (центр окружности). */
  localMid: THREE.Vector3;
  /** Радиус окружности. */
  radius: number;
  /** Верхний или нижний ободок. */
  isTopRim: boolean;
}

export type EdgeSpec = LinearEdgeSpec | CircularEdgeSpec;

/** Результат: набор фич + id корневой Transform-обёртки chamfer-группы. */
export interface ChamferFeatureGroup {
  /** Фичи в порядке добавления в граф (родители после детей). */
  features: Feature[];
  /** Id корневой фичи группы (с position/rotation от target-local). */
  rootId: FeatureId;
}

/**
 * Builder для chamfer-группы как набора фич. Параллельная реализация
 * `buildLinearChamfer`/`buildCircularChamfer` из Constructor.vue, но без
 * ModelNode/Primitive — только Feature-инстансы. Caller добавляет результат
 * в `FeatureDocument` через `addFeature` в указанном порядке и привязывает
 * `rootId` к нужному месту в DAG.
 *
 * Геометрия и позиции совпадают с legacy: пересчёт coords тот же, isHole
 * флажки те же. Отличие — Transform-обёртка над GroupFeature вместо params
 * прямо на GroupNode.
 */
export class ChamferFeatureBuilder {
  static build(spec: EdgeSpec, radius: number): ChamferFeatureGroup {
    if (spec.kind === 'linear') {
      return this._buildLinear(spec, radius);
    }
    return this._buildCircular(spec, radius);
  }

  private static _buildLinear(spec: LinearEdgeSpec, r: number): ChamferFeatureGroup {
    let dx: number;
    let dy: number;
    if (spec.axis === 'x') {
      dy = spec.perpDirX;
      dx = -spec.perpDirZ;
    } else {
      dx = spec.perpDirX;
      dy = -spec.perpDirZ;
    }
    const h = spec.length + 0.2;

    const boxId = nextP2FeatureId('chamfer_box');
    const box = new BoxFeature(boxId, { width: r, height: h, depth: r });
    const boxXformId = nextP2FeatureId('chamfer_box_xform');
    const boxXform = new TransformFeature(boxXformId, {
      position: [dx * r / 2, dy * r / 2, -h / 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, [boxId]);

    const cylId = nextP2FeatureId('chamfer_cyl');
    const cyl = new CylinderFeature(cylId, {
      radiusTop: r, radiusBottom: r, height: h, segments: 32,
    });
    const cylXformId = nextP2FeatureId('chamfer_cyl_xform');
    const cylXform = new TransformFeature(cylXformId, {
      position: [dx * r, dy * r, -h / 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      isHole: true,
    }, [cylId]);

    const groupId = nextP2FeatureId('chamfer_group');
    const group = new GroupFeature(groupId, {}, [boxXformId, cylXformId]);
    group.name = 'Скругление';

    const rootRotation: [number, number, number] =
      spec.axis === 'x' ? [0, Math.PI / 2, 0]
      : spec.axis === 'y' ? [-Math.PI / 2, 0, 0]
      : [0, 0, 0];
    const rootId = nextP2FeatureId('chamfer_root');
    const root = new TransformFeature(rootId, {
      position: [spec.localMid.x, spec.localMid.y, spec.localMid.z],
      rotation: rootRotation,
      scale: [1, 1, 1],
      isHole: true,
    }, [groupId]);

    return {
      features: [box, boxXform, cyl, cylXform, group, root],
      rootId,
    };
  }

  private static _buildCircular(spec: CircularEdgeSpec, r: number): ChamferFeatureGroup {
    const R = Math.max(0.01, spec.radius);
    const fillet = Math.min(r, R * 0.99);
    const eps = 0.05;

    const outerId = nextP2FeatureId('chamfer_outer');
    const outer = new CylinderFeature(outerId, {
      radiusTop: R, radiusBottom: R, height: fillet, segments: 64,
    });

    const innerId = nextP2FeatureId('chamfer_inner');
    const inner = new CylinderFeature(innerId, {
      radiusTop: R - fillet,
      radiusBottom: R - fillet,
      height: fillet + eps,
      segments: 64,
    });
    const innerXformId = nextP2FeatureId('chamfer_inner_xform');
    const innerXform = new TransformFeature(innerXformId, {
      position: [0, 0, -eps / 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      isHole: true,
    }, [innerId]);

    const torusId = nextP2FeatureId('chamfer_torus');
    const torus = new TorusFeature(torusId, {
      radius: R - fillet,
      tube: fillet,
      segments: 48,
    });
    const torusXformId = nextP2FeatureId('chamfer_torus_xform');
    const torusXform = new TransformFeature(torusXformId, {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      isHole: true,
    }, [torusId]);

    const groupId = nextP2FeatureId('chamfer_group');
    const group = new GroupFeature(groupId, {}, [outerId, innerXformId, torusXformId]);
    group.name = 'Скругление';

    const rootRotation: [number, number, number] = spec.isTopRim
      ? [Math.PI, 0, 0]
      : [0, 0, 0];
    const rootId = nextP2FeatureId('chamfer_root');
    const root = new TransformFeature(rootId, {
      position: [spec.localMid.x, spec.localMid.y, spec.localMid.z],
      rotation: rootRotation,
      scale: [1, 1, 1],
      isHole: true,
    }, [groupId]);

    return {
      features: [outer, inner, innerXform, torus, torusXform, group, root],
      rootId,
    };
  }
}
