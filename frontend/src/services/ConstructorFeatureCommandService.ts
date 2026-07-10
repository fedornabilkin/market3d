import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureId } from '@/v3d/constructor/features/types';
import { cloneFeatureSubgraph, ensureTransformWrapper, findParent } from '@/v3d/constructor/features/utils/dagMutations';
import { TransformFeature } from '@/v3d/constructor/features/composite/TransformFeature';
import { GroupingFeatureOperations } from '@/v3d/constructor/modes/GroupingFeatureOperations';

/** Graph-level constructor commands, independent from Vue and Three.js UI state. */
export class ConstructorFeatureCommandService {
  private duplicateState: {
    lastCloneId: FeatureId | null;
    snapshot: TransformSnapshot | null;
    delta: TransformDelta | null;
  } = { lastCloneId: null, snapshot: null, delta: null };

  isProtectedSceneRoot(document: FeatureDocument, featureId: FeatureId): boolean {
    if (!document.rootIds.includes(featureId) || document.rootIds.length !== 1) return false;
    return document.graph.get(featureId)?.type === 'group';
  }

  canDelete(document: FeatureDocument, featureId: FeatureId): boolean {
    return document.graph.has(featureId)
      && !(document.rootIds.length === 1 && document.rootIds[0] === featureId);
  }

  hasSceneObjects(document: FeatureDocument): boolean {
    const root = document.rootIds[0] ? document.graph.get(document.rootIds[0]) : null;
    return !!root && root.getInputs().length > 0;
  }

  canUngroup(document: FeatureDocument, featureId: FeatureId): boolean {
    const feature = document.graph.get(featureId);
    if (!feature) return false;
    const composite = feature.type === 'group'
      || feature.type === 'boolean'
      || this.isTransformWrappedGroup(document, featureId);
    if (!composite) return false;
    if (document.rootIds.length === 1 && document.rootIds[0] === featureId) {
      return feature.type === 'transform' && this.isTransformWrappedGroup(document, featureId);
    }
    return true;
  }

  updateParams(
    document: FeatureDocument,
    featureId: FeatureId,
    patch: Record<string, unknown>,
  ): boolean {
    const target = document.graph.get(featureId);
    if (!target) return false;
    if (target.type !== 'transform') {
      document.updateParams(featureId, patch);
      return true;
    }

    const transformPatch: Record<string, unknown> = {};
    const innerPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      (TRANSFORM_PARAM_KEYS.has(key) ? transformPatch : innerPatch)[key] = value;
    }
    if (Object.keys(transformPatch).length > 0) document.updateParams(featureId, transformPatch);
    const innerId = target.getInputs()[0];
    if (innerId && Object.keys(innerPatch).length > 0) document.updateParams(innerId, innerPatch);
    return true;
  }

  rename(document: FeatureDocument, featureId: FeatureId, name: string | undefined): boolean {
    const feature = document.graph.get(featureId);
    if (!feature) return false;
    feature.name = name;
    return true;
  }

  merge(document: FeatureDocument, featureIds: readonly FeatureId[]): FeatureId | null {
    return GroupingFeatureOperations.merge(document, featureIds);
  }

  ungroup(document: FeatureDocument, featureId: FeatureId): FeatureId[] | null {
    if (this.isProtectedSceneRoot(document, featureId)) return null;
    return GroupingFeatureOperations.ungroup(document, featureId);
  }

  delete(document: FeatureDocument, featureId: FeatureId): boolean {
    if (this.isProtectedSceneRoot(document, featureId)) return false;
    const target = document.graph.get(featureId);
    if (!target) return false;

    const parent = findParent(document, featureId);
    if (parent) {
      const parentFeature = document.graph.get(parent.parentId);
      if (parentFeature) {
        document.updateInputs(
          parent.parentId,
          parentFeature.getInputs().filter((id) => id !== featureId),
        );
      }
    } else {
      document.setRootIds(document.rootIds.filter((id) => id !== featureId));
    }

    this.removeOrphanSubgraph(document, featureId);
    return true;
  }

  duplicate(document: FeatureDocument, featureId: FeatureId, shrinkFactor: Vec3 | null = null): FeatureId | null {
    if (this.isProtectedSceneRoot(document, featureId)) return null;
    const parent = findParent(document, featureId);
    if (!parent && !document.rootIds.includes(featureId)) return null;

    const delta = shrinkFactor ? null : this.resolveDuplicateDelta(document, featureId);
    if (shrinkFactor) this.duplicateState.delta = null;

    const { rootId } = cloneFeatureSubgraph(document, featureId);
    const transformId = ensureTransformWrapper(document, rootId);
    const transform = document.graph.get(transformId);
    if (!(transform instanceof TransformFeature)) return null;

    const next = applyTransformDelta(transform.params, delta, shrinkFactor);
    document.updateParams(transformId, next);
    this.insertAfterSource(document, featureId, transformId, parent?.parentId ?? null);

    this.duplicateState.lastCloneId = transformId;
    this.duplicateState.snapshot = snapshotTransform(next);
    return transformId;
  }

  private resolveDuplicateDelta(document: FeatureDocument, featureId: FeatureId): TransformDelta | null {
    const state = this.duplicateState;
    const target = document.graph.get(featureId);
    if (state.lastCloneId !== featureId || !state.snapshot || !(target instanceof TransformFeature)) {
      state.delta = null;
      return null;
    }
    const current = target.params;
    const snapshot = state.snapshot;
    const delta: TransformDelta = {
      position: subtract(current.position, snapshot.position),
      scale: divide(current.scale, snapshot.scale),
      rotation: subtract(current.rotation, snapshot.rotation),
    };
    const changed = delta.position.some((value) => value !== 0)
      || delta.scale.some((value) => value !== 1)
      || delta.rotation.some((value) => value !== 0);
    if (changed) state.delta = delta;
    return state.delta;
  }

  private insertAfterSource(
    document: FeatureDocument,
    sourceId: FeatureId,
    cloneId: FeatureId,
    parentId: FeatureId | null,
  ): void {
    if (parentId) {
      const parent = document.graph.get(parentId);
      if (!parent) return;
      const inputs = [...parent.getInputs()];
      const index = inputs.indexOf(sourceId);
      inputs.splice(index < 0 ? inputs.length : index + 1, 0, cloneId);
      document.updateInputs(parentId, inputs);
      return;
    }
    const roots = [...document.rootIds];
    const index = roots.indexOf(sourceId);
    roots.splice(index < 0 ? roots.length : index + 1, 0, cloneId);
    document.setRootIds(roots);
  }

  private removeOrphanSubgraph(document: FeatureDocument, rootId: FeatureId): void {
    const visited = new Set<FeatureId>();
    const collect = (id: FeatureId): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const feature = document.graph.get(id);
      if (!feature) return;
      for (const inputId of feature.getInputs()) collect(inputId);
    };
    collect(rootId);

    for (const id of [...visited].reverse()) {
      const referenced = document.rootIds.includes(id)
        || [...document.graph.values()].some((feature) => feature.getInputs().includes(id));
      if (referenced || !document.graph.has(id)) continue;
      const feature = document.graph.get(id);
      if (feature && feature.getInputs().length > 0) {
        try { document.updateInputs(id, []); } catch { /* leaf */ }
      }
      try { document.removeFeature(id); } catch { /* concurrent reference */ }
    }
  }

  private isTransformWrappedGroup(document: FeatureDocument, featureId: FeatureId): boolean {
    const feature = document.graph.get(featureId);
    if (feature?.type !== 'transform') return false;
    const innerId = feature.getInputs()[0];
    const inner = innerId ? document.graph.get(innerId) : null;
    return inner?.type === 'group' || inner?.type === 'boolean';
  }
}

const TRANSFORM_PARAM_KEYS = new Set(['position', 'rotation', 'scale', 'isHole', 'color']);

type Vec3 = [number, number, number];
type TransformSnapshot = { position: Vec3; scale: Vec3; rotation: Vec3 };
type TransformDelta = TransformSnapshot;

function snapshotTransform(params: TransformSnapshot): TransformSnapshot {
  return {
    position: [...params.position],
    scale: [...params.scale],
    rotation: [...params.rotation],
  };
}

function applyTransformDelta(
  params: TransformSnapshot,
  delta: TransformDelta | null,
  shrink: Vec3 | null,
): TransformSnapshot {
  const position = delta ? add(params.position, delta.position) : [...params.position] as Vec3;
  const rotation = delta ? add(params.rotation, delta.rotation) : [...params.rotation] as Vec3;
  let scale = delta ? multiply(params.scale, delta.scale) : [...params.scale] as Vec3;
  if (shrink) scale = multiply(scale, shrink);
  return { ...params, position, rotation, scale };
}

function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function multiply(a: Vec3, b: Vec3): Vec3 { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
function divide(a: Vec3, b: Vec3): Vec3 { return [a[0] / b[0], a[1] / b[1], a[2] / b[2]]; }
