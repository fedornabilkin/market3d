<script setup lang="ts">
import type {
  DebugLogEntry,
  FeatureDocStats,
  StorageStat,
} from '@/v3d/constructor/debug';

defineProps<{
  fps: number;
  now: string;
  camera: { x: string; y: string; z: string; tx: string; ty: string; tz: string } | null;
  selection: {
    type: string;
    name: string | null;
    uuid: string | null;
    pos: string;
    scale: string;
    rot: string;
    center: string;
    totalCount: number;
  } | null;
  modes: {
    mirror: boolean;
    cruise: boolean;
    alignment: boolean;
    chamfer: boolean;
    generator: boolean;
    generatorType: string;
  };
  snapStep: number;
  history: { canUndo: boolean; canRedo: boolean; treeVersion: number };
  sceneInfo: Array<{ index: number; type: string; name: string; visible: boolean; childrenCount: number }>;
  gizmo: string;
  featureDocStats: FeatureDocStats | null;
  storage: StorageStat[];
  activeSceneIndex: number;
  sceneCount: number;
  logs: DebugLogEntry[];
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'download'): void;
  (e: 'clear-logs'): void;
}>();
</script>

<template lang="pug">
.debug-panel
  .debug-header
    span Debug
    .debug-actions
      button.debug-action(@click="$emit('download')" title="Скачать всё состояние JSON-ом") ⬇
      button.debug-action(@click="$emit('clear-logs')" title="Очистить лог") ⌫
      button.debug-close(@click="$emit('close')" title="Закрыть") &times;
  .debug-body
    .debug-section
      .debug-title FPS / Date
      .debug-value
        | {{ fps }} fps · {{ now }}
    .debug-section
      .debug-title Camera
      .debug-value(v-if="camera")
        | pos: ({{ camera.x }}, {{ camera.y }}, {{ camera.z }})
        br
        | target: ({{ camera.tx }}, {{ camera.ty }}, {{ camera.tz }})
      .debug-value(v-else) —
    .debug-section
      .debug-title Selection
      .debug-value(v-if="selection")
        | type: {{ selection.type }}
        br
        | name: {{ selection.name || '—' }}
        br
        | uuid: {{ selection.uuid ? selection.uuid.slice(0, 8) : '—' }}
        br
        | pos: ({{ selection.pos }})
        br
        | scale: ({{ selection.scale }})
        br
        | rot: ({{ selection.rot }})
        br
        | center: ({{ selection.center }})
        br
        | total selected: {{ selection.totalCount }}
      .debug-value(v-else) none
    .debug-section
      .debug-title Modes
      .debug-value
        | mirror={{ modes.mirror }} cruise={{ modes.cruise }}
        br
        | align={{ modes.alignment }} chamfer={{ modes.chamfer }}
        br
        | generator={{ modes.generator }} ({{ modes.generatorType }})
        br
        | snap={{ snapStep }} мм
    .debug-section
      .debug-title History
      .debug-value
        | undo={{ history.canUndo }} redo={{ history.canRedo }} treeVer={{ history.treeVersion }}
    .debug-section
      .debug-title Scene root ({{ sceneInfo.length }})
      .debug-value
        .debug-row(v-for="c in sceneInfo" :key="c.index")
          | {{ c.index }}: {{ c.type }} "{{ c.name }}" vis={{ c.visible }} ch={{ c.childrenCount }}
    .debug-section
      .debug-title Gizmo
      .debug-value {{ gizmo }}
    .debug-section
      .debug-title FeatureDocument
      .debug-value(v-if="featureDocStats")
        | features: {{ featureDocStats.featureCount }}
        br
        | roots: {{ featureDocStats.rootIds.join(', ') || '—' }}
        br
        | failed: {{ featureDocStats.failed.length }}
        template(v-if="featureDocStats.failed.length")
          br
          .debug-row(v-for="f in featureDocStats.failed" :key="f.id")
            | ⚠ {{ f.id }} ({{ f.type }}): {{ f.error }}
        br
        | by-type: {{ featureDocStats.byType }}
      .debug-value(v-else) (нет шадоу-дока)
    .debug-section
      .debug-title Storage
      .debug-value
        | active scene: {{ activeSceneIndex + 1 }} / {{ sceneCount }}
        template(v-for="(stat, idx) in storage" :key="idx")
          br
          | s{{ idx + 1 }}: v2={{ stat.v2 }} legacy={{ stat.v1 }}
    .debug-section.debug-section--logs
      .debug-title
        | Logs ({{ logs.length }})
      .debug-value
        .debug-log-row(v-for="(log, i) in logs" :key="i" :class="`debug-log--${log.level}`")
          span.debug-log-time {{ log.t }}
          span.debug-log-level [{{ log.level }}]
          span.debug-log-msg {{ log.msg }}
        .debug-row(v-if="logs.length === 0") (логов нет)
</template>

<style scoped>
.debug-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  border-left: 1px solid #d0d0d0;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  color: #333;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.08);
}
.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.6rem;
  font-weight: 700;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.85rem;
  background: #fafafa;
  flex: 0 0 auto;
}
.debug-actions {
  display: flex;
  gap: 0.25rem;
}
.debug-action,
.debug-close {
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 0.95rem;
  color: #666;
  line-height: 1;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-family: inherit;
}
.debug-action:hover,
.debug-close:hover {
  color: #111;
  background: #ececec;
  border-color: #ccc;
}
.debug-body {
  padding: 0.5rem 0.6rem 0.6rem;
  overflow-y: auto;
  flex: 1 1 auto;
}
.debug-section {
  margin-bottom: 0.6rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px dashed #ececec;
}
.debug-section:last-child { border-bottom: none; }
.debug-section--logs {
  display: flex;
  flex-direction: column;
}
.debug-title {
  font-weight: 700;
  color: #555;
  margin-bottom: 0.2rem;
  text-transform: uppercase;
  font-size: 0.66rem;
  letter-spacing: 0.04em;
}
.debug-value {
  color: #222;
  word-break: break-word;
  line-height: 1.5;
}
.debug-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.debug-log-row {
  display: flex;
  gap: 0.3rem;
  padding: 0.15rem 0;
  border-bottom: 1px dotted #f0f0f0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.35;
  font-size: 0.68rem;
}
.debug-log-time {
  flex: 0 0 auto;
  color: #999;
}
.debug-log-level {
  flex: 0 0 auto;
  font-weight: 700;
}
.debug-log--warn .debug-log-level { color: #b78103; }
.debug-log--warn { background: rgba(255, 217, 102, 0.08); }
.debug-log--error .debug-log-level { color: #b3261e; }
.debug-log--error { background: rgba(255, 100, 100, 0.08); }
.debug-log--info .debug-log-level { color: #1565c0; }
.debug-log-msg {
  flex: 1 1 auto;
  color: #333;
}
</style>
