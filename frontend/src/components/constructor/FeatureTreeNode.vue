<script setup lang="ts">
import { ref } from 'vue';

export interface FeatureNodeView {
  id: string;
  type: string;
  label: string;
  hasError: boolean;
  errorText: string | null;
  children: FeatureNodeView[];
  innerLabel: string | null;
}

const props = defineProps<{
  node: FeatureNodeView;
  depth: number;
  highlightedId?: string | null;
  badgeFn: (type: string) => string;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

const expanded = ref(true);

function toggle(): void {
  if (props.node.children.length > 0) expanded.value = !expanded.value;
}

function onClick(): void {
  emit('select', props.node.id);
}
</script>

<template lang="pug">
.ftree-node
  .ftree-row(
    :class="{ 'ftree-row--highlighted': highlightedId === node.id, 'ftree-row--error': node.hasError }"
    :style="{ paddingLeft: (depth * 12 + 4) + 'px' }"
    @click="onClick"
  )
    span.ftree-twisty(
      :class="{ 'ftree-twisty--expanded': expanded, 'ftree-twisty--leaf': node.children.length === 0 }"
      @click.stop="toggle"
    ) {{ node.children.length === 0 ? '·' : (expanded ? '▼' : '▶') }}
    span.ftree-badge {{ badgeFn(node.type) }}
    span.ftree-label {{ node.label }}
    span.ftree-inner(v-if="node.innerLabel") ({{ node.innerLabel }})
    span.ftree-error(v-if="node.hasError" :title="node.errorText ?? ''") ⚠
  template(v-if="expanded")
    FeatureTreeNode(
      v-for="child in node.children"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
      :highlighted-id="highlightedId"
      :badge-fn="badgeFn"
      @select="(id) => emit('select', id)"
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
.ftree-row--highlighted {
  background: #e3f2fd;
  font-weight: 600;
}
.ftree-row--highlighted:hover {
  background: #d0e8fb;
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
