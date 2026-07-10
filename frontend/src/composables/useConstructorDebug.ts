import { computed, ref } from 'vue';
import * as THREE from 'three';
import type { Feature } from '@/v3d/constructor/features/Feature';
import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { SceneDebugInfo } from '@/v3d/constructor/ConstructorSceneService';
import {
  DebugLogger,
  buildFeatureDocStats,
  buildStorageStats,
  buildDebugSnapshot,
  downloadDebugSnapshot,
} from '@/v3d/constructor/debug';

type CameraDebug = { x: string; y: string; z: string; tx: string; ty: string; tz: string };
type ModeDebug = { mirror: boolean; cruise: boolean; alignment: boolean; chamfer: boolean; generator: boolean; generatorType: string };

export type ConstructorDebugDependencies = {
  storageKeys: readonly string[];
  getDocument: () => FeatureDocument | null;
  getFeature: () => Feature | null | undefined;
  getSelectedIds: () => readonly string[];
  getSelectedFeatureId: () => string | null;
  getObject: (featureId: string) => THREE.Object3D | null | undefined;
  getActiveSceneIndex: () => number;
  getTreeVersion: () => number;
  getModes: () => ModeDebug;
  getSnapStep: () => number;
  getSceneSettings: () => Record<string, unknown>;
  getHistory: () => { canUndo: boolean; canRedo: boolean };
};

export function useConstructorDebug(deps: ConstructorDebugDependencies) {
  const visible = ref(false);
  const fps = ref(0);
  const now = ref('');
  const sceneInfo = ref<SceneDebugInfo['sceneChildren']>([]);
  const gizmo = ref('—');
  const camera = ref<CameraDebug | null>(null);
  const featureDocStats = ref<ReturnType<typeof buildFeatureDocStats>>(null);
  const storageStats = ref<ReturnType<typeof buildStorageStats>>([]);
  const logger = new DebugLogger(200);
  let frames = 0;
  let lastFrameTime = performance.now();

  const nodeType = computed(() => deps.getFeature()?.type ?? '—');
  const selection = computed(() => {
    const feature = deps.getFeature();
    if (!feature) return null;
    const params = feature.params as Record<string, unknown>;
    const object = deps.getObject(feature.id);
    let center = '—';
    if (object) {
      const box = new THREE.Box3().setFromObject(object);
      const value = new THREE.Vector3();
      box.getCenter(value);
      center = formatVec(value.toArray(), 1);
    }
    return {
      type: nodeType.value,
      name: feature.name ?? null,
      uuid: feature.id,
      pos: formatVec(readVec3(params.position), 1),
      scale: formatVec(readVec3(params.scale), 2, '1, 1, 1'),
      rot: formatRotation(readVec3(params.rotation)),
      center,
      totalCount: deps.getSelectedIds().length,
    };
  });
  const modes = computed(deps.getModes);
  const history = computed(() => ({ ...deps.getHistory(), treeVersion: deps.getTreeVersion() }));

  function refreshStats(): void {
    featureDocStats.value = buildFeatureDocStats(deps.getDocument());
    storageStats.value = buildStorageStats([...deps.storageKeys]);
  }

  function handleSceneInfo(info: SceneDebugInfo, cameraDebug: CameraDebug | null): void {
    frames++;
    const timestamp = performance.now();
    if (timestamp - lastFrameTime >= 1000) {
      fps.value = frames;
      frames = 0;
      lastFrameTime = timestamp;
      now.value = new Date().toLocaleTimeString('ru-RU');
      if (visible.value) refreshStats();
    }
    if (!visible.value) return;
    sceneInfo.value = info.sceneChildren;
    const value = info.gizmo;
    gizmo.value = value
      ? `target=${value.hasTarget} visible=${value.groupVisible} handles=${value.handlesCount}`
      : 'none';
    camera.value = cameraDebug;
  }

  function toggle(): boolean {
    visible.value = !visible.value;
    if (visible.value) { logger.install(); refreshStats(); }
    else logger.uninstall();
    return visible.value;
  }

  function download(): void {
    refreshStats();
    const feature = deps.getFeature();
    const snapshot = buildDebugSnapshot({
      activeSceneIndex: deps.getActiveSceneIndex(),
      treeVersion: deps.getTreeVersion(),
      fps: fps.value,
      camera: camera.value,
      selection: {
        count: deps.getSelectedIds().length,
        primary: feature ? {
          type: nodeType.value, name: feature.name ?? null, uuid: feature.id,
          params: JSON.parse(JSON.stringify(feature.params)), geometryParams: null,
        } : null,
      },
      modes: modes.value,
      snapStep: deps.getSnapStep(),
      sceneSettings: deps.getSceneSettings(),
      sceneInfo: sceneInfo.value,
      gizmo: gizmo.value,
      history: deps.getHistory(),
      featureDoc: featureDocStats.value,
      storage: storageStats.value,
      logs: [...logger.logs.value],
    });
    const document = deps.getDocument();
    if (document) {
      try { snapshot.featureDocJson = document.toJSON(); }
      catch (error) { snapshot.featureDocJsonError = error instanceof Error ? error.message : String(error); }
    }
    downloadDebugSnapshot(snapshot);
  }

  function dispose(): void { logger.uninstall(); }

  return { visible, fps, now, sceneInfo, gizmo, camera, featureDocStats, storageStats, logger, selection, modes, history, handleSceneInfo, refreshStats, toggle, download, dispose };
}

function readVec3(value: unknown): [number, number, number] | null {
  return Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every((item) => typeof item === 'number')
    ? [value[0], value[1], value[2]] : null;
}
function formatVec(value: readonly number[] | null, digits: number, fallback = '—'): string {
  return value ? value.map((item) => item.toFixed(digits)).join(', ') : fallback;
}
function formatRotation(value: readonly number[] | null): string {
  const factor = 180 / Math.PI;
  return value ? value.map((item) => `${(item * factor).toFixed(1)}°`).join(', ') : '0, 0, 0';
}
