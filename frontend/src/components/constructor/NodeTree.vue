<template lang="pug">
.node-tree(v-if="node")
  .node-row(
    :class="{ 'is-selected': isSelected }"
    :style="{ paddingLeft: (level * 12) + 'px' }"
    @click="onRowClick"
  )
    span.node-toggle(v-if="isGroupNode" @click.stop="toggleExpanded")
      | {{ expanded ? '▼' : '▶' }}
    span.node-toggle-placeholder(v-else)
    span.node-color-dot(
      v-if="nodeColor"
      :style="{ background: nodeColor }"
    )
    span.node-label {{ nodeLabel }}
  template(v-if="isGroupNode && expanded")
    NodeTree(
      v-for="(child, i) in node.children"
      :key="i"
      :node="child"
      :selected-nodes="selectedNodes"
      :level="level + 1"
      @select="$emit('select', $event)"
    )
</template>

<script>
import { ref, computed } from 'vue';
import { GroupNode, Primitive, ImportedMeshNode } from '@/v3d/constructor';

export default {
  name: 'NodeTree',
  props: {
    node: { type: Object, required: true },
    selectedNodes: { type: Array, default: () => [] },
    level: { type: Number, default: 0 },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const expanded = ref(props.level === 0);

    const isGroupNode = computed(() => props.node instanceof GroupNode);
    const isSelected = computed(() => (props.selectedNodes || []).includes(props.node));

    const nodeColor = computed(() => {
      const color = props.node?.params?.color;
      return typeof color === 'string' && color ? color : null;
    });

    const nodeLabel = computed(() => {
      if (props.node.name) return props.node.name;
      if (props.node instanceof ImportedMeshNode) return `STL: ${props.node.filename}`;
      if (props.node instanceof Primitive) return `Примитив: ${props.node.type}`;
      if (props.node instanceof GroupNode) return `Группа (${props.node.operation})`;
      return 'Узел';
    });

    function toggleExpanded() {
      expanded.value = !expanded.value;
    }

    function onRowClick(event) {
      emit('select', { node: props.node, shiftKey: !!event.shiftKey });
    }

    return { isGroupNode, isSelected, nodeLabel, nodeColor, expanded, toggleExpanded, onRowClick };
  },
};
</script>

<style scoped>
.node-tree {
  font-size: 0.9rem;
}
.node-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
}
.node-row:hover {
  background: #e8e8e8;
}
.node-row.is-selected {
  background: #4a7cff;
  color: #fff;
}
.node-toggle {
  display: inline-block;
  width: 1rem;
  font-size: 0.7rem;
  color: #888;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.node-toggle:hover {
  color: #333;
}
.node-toggle-placeholder {
  display: inline-block;
  width: 1rem;
  flex-shrink: 0;
}
.node-color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.2);
  flex-shrink: 0;
}
.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
</style>
