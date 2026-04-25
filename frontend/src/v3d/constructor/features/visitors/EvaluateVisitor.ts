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
  override visitBox(f: BoxFeature): FeatureOutput {
    return primitiveLeaf(
      new BoxBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitSphere(f: SphereFeature): FeatureOutput {
    return primitiveLeaf(
      new SphereBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitCylinder(f: CylinderFeature): FeatureOutput {
    return primitiveLeaf(
      new CylinderBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitCone(f: ConeFeature): FeatureOutput {
    return primitiveLeaf(
      new ConeBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitTorus(f: TorusFeature): FeatureOutput {
    return primitiveLeaf(
      new TorusBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitRing(f: RingFeature): FeatureOutput {
    return primitiveLeaf(
      new RingBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitPlane(f: PlaneFeature): FeatureOutput {
    return primitiveLeaf(
      new PlaneBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitThread(f: ThreadFeature): FeatureOutput {
    return primitiveLeaf(
      new ThreadBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitKnurl(f: KnurlFeature): FeatureOutput {
    return primitiveLeaf(
      new KnurlBuilder().withParams(f.params).build().createGeometry(),
      f.params.color,
      f.name,
    );
  }

  override visitImportedMesh(f: ImportedMeshFeature): FeatureOutput {
    if (!f.params.geometry) {
      throw new Error(`[ImportedMesh ${f.id}] geometry не загружена (binaryRef=${f.params.binaryRef ?? '?'})`);
    }
    return {
      kind: 'leaf',
      geometry: f.params.geometry,
      transform: new THREE.Matrix4(),
      isHole: false,
      color: f.params.color,
      name: f.name,
      sharedGeometry: true,
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
      children.push(out);
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
  color: string | undefined,
  name: string | undefined,
): LeafOutput {
  return {
    kind: 'leaf',
    geometry,
    transform: new THREE.Matrix4(),
    isHole: false,
    color,
    name,
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
      transform: out.transform,
      isHole: out.isHole,
    });
    return;
  }
  // composite: разворачиваем детей с компонованным transform'ом
  for (const child of out.children) {
    if (child.kind === 'leaf') {
      target.push({
        geometry: child.geometry,
        transform: out.transform.clone().multiply(child.transform),
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
