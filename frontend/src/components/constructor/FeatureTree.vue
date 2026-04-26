<script setup lang="ts">
import { computed } from 'vue';
import type { FeatureDocument, FeatureId } from '@/v3d/constructor/features';
import FeatureTreeNode from './FeatureTreeNode.vue';

interface FeatureNodeView {
  id: FeatureId;
  type: string;
  label: string;
  hasError: boolean;
  errorText: string | null;
  children: FeatureNodeView[];
  /** Для UI: featureId — это «семантическая» Transform-обёртка (если есть). */
  innerLabel: string | null;
}

const props = defineProps<{
  /**
   * Текущий FeatureDocument. Дерево перестраивается при изменении
   * (передавайте reactive ref от Constructor.vue / sceneService).
   */
  doc: FeatureDocument | null;
  /** Подсветить эту фичу (rootmost feature-id выделенного ModelNode). */
  highlightedId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', id: FeatureId): void;
}>();

/**
 * Отображение типа фичи как короткая буквенная метка для иконки.
 * Можно заменить на FA-иконки позже.
 */
const TYPE_BADGE: Record<string, string> = {
  box: '□',
  sphere: '○',
  cylinder: '⫯',
  cone: '△',
  torus: '◯',
  ring: '◎',
  plane: '▭',
  thread: '✻',
  knurl: '#',
  imported: '⤓',
  transform: 'T',
  boolean: '∩',
  group: '☐',
};

function badge(type: string): string {
  return TYPE_BADGE[type] ?? '?';
}

/**
 * Конвертирует FeatureGraph в дерево для отображения.
 * Корни — fd.rootIds. Для каждой фичи children = её inputs (как в графе).
 *
 * Граф формально DAG (фичу могут переиспользовать), но в Phase 1 практически
 * всегда дерево; рекурсия аккуратно обходит, ленивый stop при отсутствии узла.
 */
const tree = computed<FeatureNodeView[]>(() => {
  const doc = props.doc;
  if (!doc) return [];

  const visit = (id: FeatureId): FeatureNodeView | null => {
    const f = doc.graph.get(id);
    if (!f) return null;
    const inputs = f.getInputs();
    const children: FeatureNodeView[] = [];
    for (const childId of inputs) {
      const child = visit(childId);
      if (child) children.push(child);
    }
    const baseLabel = f.name?.trim() || `${f.type}`;
    // Для Transform-обёртки показываем имя инкапсулированного входа в скобках,
    // если оно есть — иначе UI выглядит безымянным.
    let innerLabel: string | null = null;
    if (f.type === 'transform' && children.length === 1) {
      innerLabel = children[0].label !== children[0].type ? children[0].label : null;
    }
    return {
      id: f.id,
      type: f.type,
      label: baseLabel,
      hasError: !!f.error,
      errorText: f.error ?? null,
      children,
      innerLabel,
    };
  };

  const roots: FeatureNodeView[] = [];
  for (const rootId of doc.rootIds) {
    const v = visit(rootId);
    if (v) roots.push(v);
  }
  return roots;
});

const totalCount = computed(() => {
  if (!props.doc) return 0;
  return [...props.doc.graph.values()].length;
});
</script>

<template lang="pug">
.feature-tree
  .feature-tree-empty(v-if="!doc || tree.length === 0") (нет данных)
  template(v-else)
    .feature-tree-meta {{ totalCount }} features
    FeatureTreeNode(
      v-for="root in tree"
      :key="root.id"
      :node="root"
      :depth="0"
      :highlighted-id="highlightedId"
      :badge-fn="badge"
      @select="(id) => emit('select', id)"
    )
</template>

<style scoped>
.feature-tree {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.74rem;
  color: #333;
  line-height: 1.5;
}
.feature-tree-empty {
  color: #999;
  padding: 0.4rem 0.6rem;
}
.feature-tree-meta {
  color: #888;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.6rem 0.35rem;
  border-bottom: 1px dashed #ececec;
  margin-bottom: 0.25rem;
}
</style>
