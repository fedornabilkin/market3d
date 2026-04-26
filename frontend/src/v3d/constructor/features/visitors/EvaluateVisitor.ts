import * as THREE from 'three';
import type { EvaluateContext, FeatureOutput, LeafOutput } from '../types';
import { FeatureVisitor } from '../FeatureVisitor';
import type { Feature } from '../Feature';

import type { BoxFeature } from '../primitives/BoxFeature';
import type { SphereFeature } from '../primitives/SphereFeature';
import type { CylinderFeature } from '../primitives/CylinderFeature';
import type { ConeFeature } from '../primitives/ConeFeature';
import type { TorusFeature } from '../primitives/TorusFeature';
import type { RingFeature } from '../primitives/RingFeature';
import type { PlaneFeature } from '../primitives/PlaneFeature';
import type { ThreadFeature } from '../primitives/ThreadFeature';
import type { KnurlFeature } from '../primitives/KnurlFeature';
import type { ImportedMeshFeature } from '../primitives/ImportedMeshFeature';
import type { TransformFeature } from '../composite/TransformFeature';
import type { BooleanFeature } from '../composite/BooleanFeature';
import type { GroupFeature } from '../composite/GroupFeature';

import { BoxBuilder } from '../../entities/builders/BoxBuilder';
import { SphereBuilder } from '../../entities/builders/SphereBuilder';
import { CylinderBuilder } from '../../entities/builders/CylinderBuilder';
import { ConeBuilder } from '../../entities/builders/ConeBuilder';
import { TorusBuilder } from '../../entities/builders/TorusBuilder';
import { RingBuilder } from '../../entities/builders/RingBuilder';
import { PlaneBuilder } from '../../entities/builders/PlaneBuilder';
import { ThreadBuilder } from '../../entities/builders/ThreadBuilder';
import { KnurlBuilder } from '../../entities/builders/KnurlBuilder';

import { booleanCsg, type BooleanInput } from '../csg/booleanCsg';

/**
 * Visitor, вычисляющий FeatureOutput из текущих params + resolved входов.
 *
 * Передаваемый ctx должен содержать outputs всех фич, от которых зависит
 * текущая. FeatureGraph гарантирует это через топологическую сортировку.
 *
 * Каждый visitX отвечает за свою операцию; общие ошибки (нет входа,
 * неверный тип входа) бросаются как Error — FeatureGraph ловит их и
 * помечает фичу как failed.
 */
export class EvaluateVisitor extends FeatureVisitor<FeatureOutput> {
  constructor(private readonly ctx: EvaluateContext) {
    super();
  }

  protected visitFeature(feature: Feature): FeatureOutput {
    throw new Error(`[EvaluateVisitor] нет обработчика для типа: ${feature.type}`);
  }

  // ─── Примитивы ─────────────────────────────────────────────
  // Соглашение позиции (совпадает с legacy Primitive.applyParamsToMesh):
  //   `params.position.z = 0` означает «нижняя грань на сетке (z=0)».
  //   Геометрии примитивов центрированы вокруг origin'а, поэтому в
  //   LeafOutput.transform добавляем сдвиг (0, 0, halfHeight). Сверху
  //   TransformFeature композирует свои position/rotation/scale.
  override visitBox(f: BoxFeature): FeatureOutput {
    const entity = new BoxBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitSphere(f: SphereFeature): FeatureOutput {
    const entity = new SphereBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitCylinder(f: CylinderFeature): FeatureOutput {
    const entity = new CylinderBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitCone(f: ConeFeature): FeatureOutput {
    const entity = new ConeBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitTorus(f: TorusFeature): FeatureOutput {
    const entity = new TorusBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitRing(f: RingFeature): FeatureOutput {
    const entity = new RingBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitPlane(f: PlaneFeature): FeatureOutput {
    const entity = new PlaneBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitThread(f: ThreadFeature): FeatureOutput {
    const entity = new ThreadBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitKnurl(f: KnurlFeature): FeatureOutput {
    const entity = new KnurlBuilder().withParams(f.params).build();
    return primitiveLeaf(entity.createGeometry(), entity.getHalfHeight(), f.params.color, f.name);
  }

  override visitImportedMesh(f: ImportedMeshFeature): FeatureOutput {
    if (!f.params.geometry) {
      throw new Error(`[ImportedMesh ${f.id}] geometry не загружена (binaryRef=${f.params.binaryRef ?? '?'})`);
    }
    const geom = f.params.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const halfH = geom.boundingBox ? (geom.boundingBox.max.z - geom.boundingBox.min.z) / 2 : 0;
    return {
      kind: 'leaf',
      geometry: geom,
      transform: new THREE.Matrix4(),
      isHole: false,
      color: f.params.color,
      name: f.name,
      sharedGeometry: true,
      bottomAnchorOffsetZ: halfH,
    };
  }

  // ─── Composite ─────────────────────────────────────────────
  override visitTransform(f: TransformFeature): FeatureOutput {
    const inputs = f.getInputs();
    if (inputs.length !== 1) {
      throw new Error(`[Transform ${f.id}] ожидался ровно 1 вход, получено ${inputs.length}`);
    }
    const input = this.ctx.resolved.get(inputs[0]);
    if (!input) {
      throw new Error(`[Transform ${f.id}] вход ${inputs[0]} не разрешён`);
    }
    const tr = composeMatrix(f.params);
    const composed = tr.clone().multiply(input.transform);

    if (input.kind === 'composite') {
      return {
        ...input,
        transform: composed,
        isHole: f.params.isHole ?? input.isHole,
        color: f.params.color ?? input.color,
        name: f.name ?? input.name,
      };
    }
    return {
      ...input,
      transform: composed,
      isHole: f.params.isHole ?? input.isHole,
      color: f.params.color ?? input.color,
      name: f.name ?? input.name,
    };
  }

  override visitBoolean(f: BooleanFeature): FeatureOutput {
    const inputs = f.getInputs();
    if (inputs.length === 0) {
      throw new Error(`[Boolean ${f.id}] нет входов`);
    }
    const csgInputs: BooleanInput[] = [];
    for (const inputId of inputs) {
      const out = this.ctx.resolved.get(inputId);
      if (!out) throw new Error(`[Boolean ${f.id}] вход ${inputId} не разрешён`);
      collectLeavesForCsg(out, csgInputs);
    }

    const geom = booleanCsg(csgInputs, f.params.operation);
    return {
      kind: 'leaf',
      geometry: geom,
      transform: new THREE.Matrix4(),
      isHole: false,
      color: f.params.color,
      name: f.name,
    };
  }

  override visitGroup(f: GroupFeature): FeatureOutput {
    const children: FeatureOutput[] = [];
    for (const inputId of f.getInputs()) {
      const out = this.ctx.resolved.get(inputId);
      if (!out) throw new Error(`[Group ${f.id}] вход ${inputId} не разрешён`);
      // Помечаем child выходом source-feature'ом, чтобы FeatureRenderer мог
      // проставить честный userData.featureId на дочернем меше (для
      // selection / trace mapping при render-cutover'е).
      children.push({ ...out, sourceFeatureId: inputId });
    }
    return {
      kind: 'composite',
      children,
      transform: new THREE.Matrix4(),
      isHole: f.params.isHole ?? false,
      color: f.params.color,
      name: f.name,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function primitiveLeaf(
  geometry: THREE.BufferGeometry,
  halfHeight: number,
  color: string | undefined,
  name: string | undefined,
): LeafOutput {
  return {
    kind: 'leaf',
    geometry,
    // transform = identity. halfHeight-сдвиг — отдельное поле, применяется
    // FeatureRenderer'ом СНАРУЖИ user-transform (как `mesh.position.z += halfH`
    // в legacy applyParamsToMesh — сверху rotation/scale/translation).
    transform: new THREE.Matrix4(),
    isHole: false,
    color,
    name,
    bottomAnchorOffsetZ: halfHeight,
  };
}

function composeMatrix(params: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...params.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...params.rotation)),
    new THREE.Vector3(...params.scale),
  );
}

/**
 * Раскрывает CompositeOutput (от GroupFeature) в плоский список Leaf'ов
 * для CSG. Transform контейнера применяется к transform'ам детей.
 */
function collectLeavesForCsg(out: FeatureOutput, target: BooleanInput[]): void {
  if (out.kind === 'leaf') {
    target.push({
      geometry: out.geometry,
      // bottomAnchorOffsetZ — внешний Z-сдвиг (legacy mesh.position.z += halfH).
      // Для CSG нужно скомпоновать его в матрицу: T(0,0,halfH) · transform.
      transform: bakeBottomAnchor(out.transform, out.bottomAnchorOffsetZ),
      isHole: out.isHole,
    });
    return;
  }
  // composite: разворачиваем детей с компонованным transform'ом
  for (const child of out.children) {
    if (child.kind === 'leaf') {
      // T(0,0,halfH_child) · out.transform · child.transform
      const composed = out.transform.clone().multiply(child.transform);
      target.push({
        geometry: child.geometry,
        transform: bakeBottomAnchor(composed, child.bottomAnchorOffsetZ),
        isHole: out.isHole || child.isHole,
      });
    } else {
      // Рекурсивный спуск: пробрасываем transform контейнера в детей
      const folded: FeatureOutput = {
        ...child,
        transform: out.transform.clone().multiply(child.transform),
        isHole: out.isHole || child.isHole,
      };
      collectLeavesForCsg(folded, target);
    }
  }
}

/** Применяет bottomAnchorOffsetZ как внешнюю Z-трансляцию: T(0,0,halfH) · transform. */
function bakeBottomAnchor(transform: THREE.Matrix4, halfH: number | undefined): THREE.Matrix4 {
  if (!halfH) return transform.clone();
  return new THREE.Matrix4().makeTranslation(0, 0, halfH).multiply(transform);
}
