<template lang="pug">
.node-tree(v-if="node")
  .node-row(
    :class="{ 'is-selected': isSelected }"
    :style="{ paddingLeft: (level * 12) + 'px' }"
    @click="onRowClick"
  )
    span.node-label {{ nodeLabel }}
  template(v-if="isGroupNode")
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
import { computed } from 'vue';
import { GroupNode } from '@/v3d/constructor';
import { Primitive } from '@/v3d/constructor';

export default {
  name: 'NodeTree',
  props: {
    node: { type: Object, required: true },
    selectedNodes: { type: Array, default: () => [] },
    level: { type: Number, default: 0 },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const isGroupNode = computed(() => props.node instanceof GroupNode);
    const isSelected = computed(() => (props.selectedNodes || []).includes(props.node));
    function onRowClick(event) {
      emit('select', { node: props.node, shiftKey: !!event.shiftKey });
    }
    const nodeLabel = computed(() => {
      if (props.node instanceof Primitive) {
        return `Примитив: ${props.node.type}`;
      }
      if (props.node instanceof GroupNode) {
        return `Группа (${props.node.operation})`;
      }
      return 'Узел';
    });
    return { isGroupNode, isSelected, nodeLabel, onRowClick };
  },
};
</script>

<style scoped>
.node-tree {
  font-size: 0.9rem;
}
.node-row {
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
}
.node-row:hover {
  background: #2a2a3e;
}
.node-row.is-selected {
  background: #3636c9;
  color: #fff;
}
.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
