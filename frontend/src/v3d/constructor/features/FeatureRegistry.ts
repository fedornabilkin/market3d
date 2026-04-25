import type { FeatureType, FeatureJSON } from './types';
import type { Feature } from './Feature';

import { BoxFeature } from './primitives/BoxFeature';
import { SphereFeature } from './primitives/SphereFeature';
import { CylinderFeature } from './primitives/CylinderFeature';
import { ConeFeature } from './primitives/ConeFeature';
import { TorusFeature } from './primitives/TorusFeature';
import { RingFeature } from './primitives/RingFeature';
import { PlaneFeature } from './primitives/PlaneFeature';
import { ThreadFeature } from './primitives/ThreadFeature';
import { KnurlFeature } from './primitives/KnurlFeature';
import { ImportedMeshFeature } from './primitives/ImportedMeshFeature';
import { TransformFeature } from './composite/TransformFeature';
import { BooleanFeature } from './composite/BooleanFeature';
import { GroupFeature } from './composite/GroupFeature';

type FeatureCtor = (json: FeatureJSON) => Feature;

/**
 * Реестр конструкторов фич по типу — нужен для десериализации.
 * Регистрация всех штатных типов выполняется в createDefaultRegistry().
 */
export class FeatureRegistry {
  private ctors = new Map<FeatureType, FeatureCtor>();

  register(type: FeatureType, ctor: FeatureCtor): void {
    this.ctors.set(type, ctor);
  }

  create(json: FeatureJSON): Feature {
    const ctor = this.ctors.get(json.type);
    if (!ctor) {
      throw new Error(`[FeatureRegistry] неизвестный type: ${json.type}`);
    }
    return ctor(json);
  }

  has(type: FeatureType): boolean {
    return this.ctors.has(type);
  }
}

/** Реестр со всеми штатными фичами Phase 1. */
export function createDefaultRegistry(): FeatureRegistry {
  const r = new FeatureRegistry();

  // Примитивы (Leaf): inputs не учитываем — они пустые.
  r.register('box', (json) =>
    Object.assign(new BoxFeature(json.id, json.params as never), { name: json.name }));
  r.register('sphere', (json) =>
    Object.assign(new SphereFeature(json.id, json.params as never), { name: json.name }));
  r.register('cylinder', (json) =>
    Object.assign(new CylinderFeature(json.id, json.params as never), { name: json.name }));
  r.register('cone', (json) =>
    Object.assign(new ConeFeature(json.id, json.params as never), { name: json.name }));
  r.register('torus', (json) =>
    Object.assign(new TorusFeature(json.id, json.params as never), { name: json.name }));
  r.register('ring', (json) =>
    Object.assign(new RingFeature(json.id, json.params as never), { name: json.name }));
  r.register('plane', (json) =>
    Object.assign(new PlaneFeature(json.id, json.params as never), { name: json.name }));
  r.register('thread', (json) =>
    Object.assign(new ThreadFeature(json.id, json.params as never), { name: json.name }));
  r.register('knurl', (json) =>
    Object.assign(new KnurlFeature(json.id, json.params as never), { name: json.name }));
  r.register('imported', (json) =>
    Object.assign(new ImportedMeshFeature(json.id, json.params as never), { name: json.name }));

  // Composite: восстанавливаем inputs из JSON.
  r.register('transform', (json) => {
    const f = new TransformFeature(json.id, json.params as never, json.inputs ?? []);
    f.name = json.name;
    return f;
  });
  r.register('boolean', (json) => {
    const f = new BooleanFeature(json.id, json.params as never, json.inputs ?? []);
    f.name = json.name;
    return f;
  });
  r.register('group', (json) => {
    const f = new GroupFeature(json.id, json.params as never, json.inputs ?? []);
    f.name = json.name;
    return f;
  });

  return r;
}
