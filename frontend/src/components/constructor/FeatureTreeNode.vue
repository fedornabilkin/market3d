<script setup lang="ts">
import { computed, ref } from 'vue';

export interface FeatureNodeView {
  id: string;
  type: string;
  label: string;
  color: string | null;
  hasError: boolean;
  errorText: string | null;
  children: FeatureNodeView[];
  innerLabel: string | null;
}

const props = defineProps<{
  node: FeatureNodeView;
  depth: number;
  /** Все выделенные FeatureId — для multi-select подсветки. */
  selectedIds?: readonly string[];
  badgeFn: (type: string) => string;
}>();

const emit = defineEmits<{
  (e: 'select', payload: { id: string; shiftKey: boolean }): void;
}>();

const expanded = ref(true);

const isSelected = computed(() => (props.selectedIds ?? []).includes(props.node.id));

function toggle(): void {
  if (props.node.children.length > 0) expanded.value = !expanded.value;
}

function onClick(event: MouseEvent): void {
  emit('select', { id: props.node.id, shiftKey: !!event.shiftKey });
}
</script>

<template lang="pug">
.ftree-node
  .ftree-row(
    :class="{ 'ftree-row--selected': isSelected, 'ftree-row--error': node.hasError }"
    :style="{ paddingLeft: (depth * 12 + 4) + 'px' }"
    @click="onClick"
  )
    span.ftree-twisty(
      :class="{ 'ftree-twisty--expanded': expanded, 'ftree-twisty--leaf': node.children.length === 0 }"
      @click.stop="toggle"
    ) {{ node.children.length === 0 ? '·' : (expanded ? '▼' : '▶') }}
    span.ftree-badge {{ badgeFn(node.type) }}
    span.ftree-color-dot(v-if="node.color" :style="{ background: node.color }")
    span.ftree-label {{ node.label }}
    span.ftree-inner(v-if="node.innerLabel") ({{ node.innerLabel }})
    span.ftree-error(v-if="node.hasError" :title="node.errorText ?? ''") ⚠
  template(v-if="expanded")
    FeatureTreeNode(
      v-for="child in node.children"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
      :selected-ids="selectedIds"
      :badge-fn="badgeFn"
      @select="(payload) => emit('select', payload)"
    )
</template>

<style scoped>
.ftree-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.18rem 0.4rem 0.18rem 0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 3px;
}
.ftree-row:hover {
  background: #f5f5f5;
}
.ftree-row--selected {
  background: #4a7cff;
  color: #fff;
}
.ftree-row--selected:hover {
  background: #3666e6;
}
.ftree-row--selected .ftree-badge,
.ftree-row--selected .ftree-twisty,
.ftree-row--selected .ftree-inner {
  color: rgba(255, 255, 255, 0.85);
}
.ftree-color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex: 0 0 auto;
}
.ftree-row--error {
  background: rgba(255, 80, 80, 0.08);
}
.ftree-twisty {
  display: inline-block;
  width: 12px;
  flex: 0 0 auto;
  text-align: center;
  color: #888;
  font-size: 0.66rem;
}
.ftree-twisty--leaf {
  color: #ccc;
}
.ftree-badge {
  display: inline-block;
  width: 14px;
  flex: 0 0 auto;
  text-align: center;
  color: #555;
  font-weight: 700;
}
.ftree-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ftree-inner {
  color: #888;
  font-size: 0.68rem;
}
.ftree-error {
  color: #b3261e;
  flex: 0 0 auto;
}
</style>
