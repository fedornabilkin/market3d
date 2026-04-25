import type * as THREE from 'three';
import type { Entity, EntityKind } from './Entity';
import type { BoxParams } from './BoxEntity';
import type { SphereParams } from './SphereEntity';
import type { CylinderParams } from './CylinderEntity';
import type { ConeParams } from './ConeEntity';
import type { TorusParams } from './TorusEntity';
import type { RingParams } from './RingEntity';
import type { PlaneParams } from './PlaneEntity';
import type { ThreadParams } from './ThreadEntity';
import type { KnurlParams } from './KnurlEntity';
import type { ImportedMeshParams } from './ImportedMeshEntity';
import {
  BoxBuilder,
  SphereBuilder,
  CylinderBuilder,
  ConeBuilder,
  TorusBuilder,
  RingBuilder,
  PlaneBuilder,
  ThreadBuilder,
  KnurlBuilder,
  ImportedMeshBuilder,
} from './builders';

/**
 * Фабрика сущностей. По дискриминатору и словарю параметров создаёт нужный
 * Entity через соответствующий Builder — так пропущенные поля подтягивают
 * дефолты, а не ломают геометрию.
 *
 * Принимает params в максимально допустимой форме (`Record<string, unknown>`),
 * потому что в реальности параметры приходят из `PrimitiveParams` — плоского
 * словаря со всеми возможными полями. Каждый билдер берёт из него только
 * своё, остальное игнорируется.
 */
export function createEntity(kind: EntityKind, params: Record<string, unknown>): Entity {
  switch (kind) {
    case 'box':
      return new BoxBuilder().withParams(params as Partial<BoxParams>).build();
    case 'sphere':
      return new SphereBuilder().withParams(params as Partial<SphereParams>).build();
    case 'cylinder':
      return new CylinderBuilder().withParams(params as Partial<CylinderParams>).build();
    case 'cone':
      return new ConeBuilder().withParams(params as Partial<ConeParams>).build();
    case 'torus':
      return new TorusBuilder().withParams(params as Partial<TorusParams>).build();
    case 'ring':
      return new RingBuilder().withParams(params as Partial<RingParams>).build();
    case 'plane':
      return new PlaneBuilder().withParams(params as Partial<PlaneParams>).build();
    case 'thread':
      return new ThreadBuilder().withParams(params as Partial<ThreadParams>).build();
    case 'knurl':
      return new KnurlBuilder().withParams(params as Partial<KnurlParams>).build();
    case 'imported': {
      const p = params as Partial<ImportedMeshParams>;
      return new ImportedMeshBuilder()
        .geometry(p.geometry as THREE.BufferGeometry)
        .stlBase64(p.stlBase64 as string)
        .filename(p.filename as string)
        .build();
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`[EntityFactory] неизвестный kind: ${String(exhaustive)}`);
    }
  }
}
