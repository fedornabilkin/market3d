import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('./features/csg/booleanCsg', () => ({ booleanCsg: vi.fn() }));

import { ConstructorSceneService } from './ConstructorSceneService';
import type { FeatureRenderer } from './features/rendering/FeatureRenderer';

type SelectionCacheHost = {
  modelRootGroup: THREE.Group | null;
  featureRenderer: FeatureRenderer | null;
  getSelectableMeshes(): THREE.Mesh[];
};

describe('ConstructorSceneService selectable mesh cache', () => {
  it('does not reuse meshes from another renderer with the same version', () => {
    const service = new ConstructorSceneService();
    const host = service as unknown as SelectionCacheHost;
    const root = new THREE.Group();
    const firstMesh = new THREE.Mesh(new THREE.BoxGeometry());
    firstMesh.userData.featureId = 'first';
    root.add(firstMesh);
    host.modelRootGroup = root;
    host.featureRenderer = { getRenderVersion: () => 1 } as FeatureRenderer;

    expect(host.getSelectableMeshes()).toEqual([firstMesh]);

    root.clear();
    const loadedMesh = new THREE.Mesh(new THREE.BoxGeometry());
    loadedMesh.userData.featureId = 'loaded';
    root.add(loadedMesh);
    host.featureRenderer = { getRenderVersion: () => 1 } as FeatureRenderer;

    expect(host.getSelectableMeshes()).toEqual([loadedMesh]);
  });
});
