<script setup lang="ts">
import { computed } from 'vue';
import type { TestGroup } from '@/v3d/constructor/debug';

const props = defineProps<{
  groups: TestGroup[];
  checked: Set<string>;
  /**
   * Когда DebugPanel виден — сдвигаем чеклист левее (на ширину debug-панели),
   * чтобы они не перекрывались. По умолчанию — справа у края.
   */
  shifted?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle', id: string): void;
  (e: 'reset'): void;
  (e: 'check-all'): void;
}>();

const totalCount = computed(() =>
  props.groups.reduce((sum, g) => sum + g.items.length, 0),
);
const checkedCount = computed(() => props.checked.size);

function isChecked(id: string): boolean {
  return props.checked.has(id);
}
function groupCheckedCount(group: TestGroup): number {
  let n = 0;
  for (const it of group.items) if (props.checked.has(it.id)) n++;
  return n;
}
function onToggle(id: string): void {
  emit('toggle', id);
}
</script>

<template lang="pug">
.checklist-panel(:class="{ 'checklist-panel--shifted': shifted }")
  .checklist-header
    span Tests {{ checkedCount }}/{{ totalCount }}
    .checklist-actions
      button.checklist-action(@click="emit('check-all')" title="Отметить все") ✓✓
      button.checklist-action(@click="emit('reset')" title="Сбросить все") ⌫
      button.checklist-close(@click="emit('close')" title="Закрыть") &times;
  .checklist-progress
    .checklist-progress-bar(:style="{ width: totalCount ? `${(checkedCount / totalCount) * 100}%` : '0%' }")
  .checklist-body
    .checklist-group(v-for="group in groups" :key="group.id")
      .checklist-group-title
        span {{ group.title }}
        span.checklist-group-count {{ groupCheckedCount(group) }}/{{ group.items.length }}
      label.checklist-item(
        v-for="item in group.items"
        :key="item.id"
        :class="{ 'checklist-item--checked': isChecked(item.id) }"
      )
        input.checklist-checkbox(
          type="checkbox"
          :checked="isChecked(item.id)"
          @change="onToggle(item.id)"
        )
        span.checklist-text {{ item.text }}
</template>

<style scoped>
.checklist-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 16;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  border-left: 1px solid #d0d0d0;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.74rem;
  color: #333;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.08);
}
/* Если debug-панель открыта одновременно — сдвигаем чеклист левее. */
.checklist-panel--shifted {
  right: 360px;
  border-left: 1px solid #d0d0d0;
  border-right: 1px solid #ececec;
}
.checklist-header {
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
.checklist-actions {
  display: flex;
  gap: 0.25rem;
}
.checklist-action,
.checklist-close {
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
.checklist-action:hover,
.checklist-close:hover {
  color: #111;
  background: #ececec;
  border-color: #ccc;
}
.checklist-progress {
  height: 3px;
  background: #f0f0f0;
  flex: 0 0 auto;
}
.checklist-progress-bar {
  height: 100%;
  background: #4caf50;
  transition: width 0.2s ease;
}
.checklist-body {
  padding: 0.5rem 0.6rem 0.6rem;
  overflow-y: auto;
  flex: 1 1 auto;
}
.checklist-group {
  margin-bottom: 0.8rem;
}
.checklist-group-title {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  color: #333;
  margin-bottom: 0.25rem;
  font-size: 0.74rem;
  border-bottom: 1px solid #e8e8e8;
  padding-bottom: 0.15rem;
}
.checklist-group-count {
  color: #999;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.checklist-item {
  display: flex;
  gap: 0.45rem;
  align-items: flex-start;
  padding: 0.18rem 0.2rem;
  cursor: pointer;
  border-radius: 3px;
  line-height: 1.4;
}
.checklist-item:hover {
  background: #f7f7f7;
}
.checklist-item--checked {
  color: #888;
}
.checklist-item--checked .checklist-text {
  text-decoration: line-through;
}
.checklist-checkbox {
  margin-top: 0.18rem;
  flex: 0 0 auto;
  cursor: pointer;
}
.checklist-text {
  flex: 1 1 auto;
  word-break: break-word;
}
</style>
