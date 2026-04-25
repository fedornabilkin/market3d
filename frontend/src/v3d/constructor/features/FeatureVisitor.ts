import type { Feature } from './Feature';

// Forward-declare конкретные фичи через типы — реальный импорт в самих
// концрет-классах. Это разрывает цикл импортов.
import type { BoxFeature } from './primitives/BoxFeature';
import type { SphereFeature } from './primitives/SphereFeature';
import type { CylinderFeature } from './primitives/CylinderFeature';
import type { ConeFeature } from './primitives/ConeFeature';
import type { TorusFeature } from './primitives/TorusFeature';
import type { RingFeature } from './primitives/RingFeature';
import type { PlaneFeature } from './primitives/PlaneFeature';
import type { ThreadFeature } from './primitives/ThreadFeature';
import type { KnurlFeature } from './primitives/KnurlFeature';
import type { ImportedMeshFeature } from './primitives/ImportedMeshFeature';
import type { TransformFeature } from './composite/TransformFeature';
import type { BooleanFeature } from './composite/BooleanFeature';
import type { GroupFeature } from './composite/GroupFeature';

/**
 * Visitor над иерархией Feature.
 *
 * Каждая концерт-фича маршрутизирует accept(visitor) в visitX(this).
 * По умолчанию visitX(f) делегируют в visitFeature(f) — это «catch-all»,
 * полезный, например, для SerializeVisitor, которому достаточно
 * id+type+params вне зависимости от конкретного класса.
 *
 * Когда добавляется новый тип фичи:
 *  1. В FeatureType (types.ts) — новый тег.
 *  2. В этот класс — новый visitX-метод с дефолтным делегированием.
 *  3. В EvaluateVisitor (или другой обходной visitor) — переопределение.
 */
export abstract class FeatureVisitor<R> {
  // ─── Catch-all ─────────────────────────────────────────────
  /** Вызывается, если конкретный visitX не переопределён. */
  protected abstract visitFeature(feature: Feature): R;

  // ─── Примитивы ─────────────────────────────────────────────
  visitBox(feature: BoxFeature): R { return this.visitFeature(feature); }
  visitSphere(feature: SphereFeature): R { return this.visitFeature(feature); }
  visitCylinder(feature: CylinderFeature): R { return this.visitFeature(feature); }
  visitCone(feature: ConeFeature): R { return this.visitFeature(feature); }
  visitTorus(feature: TorusFeature): R { return this.visitFeature(feature); }
  visitRing(feature: RingFeature): R { return this.visitFeature(feature); }
  visitPlane(feature: PlaneFeature): R { return this.visitFeature(feature); }
  visitThread(feature: ThreadFeature): R { return this.visitFeature(feature); }
  visitKnurl(feature: KnurlFeature): R { return this.visitFeature(feature); }
  visitImportedMesh(feature: ImportedMeshFeature): R { return this.visitFeature(feature); }

  // ─── Composite ─────────────────────────────────────────────
  visitTransform(feature: TransformFeature): R { return this.visitFeature(feature); }
  visitBoolean(feature: BooleanFeature): R { return this.visitFeature(feature); }
  visitGroup(feature: GroupFeature): R { return this.visitFeature(feature); }
}
