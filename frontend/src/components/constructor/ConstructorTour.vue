<template lang="pug">
el-tour(
  v-model="tourStore.constructorOpen"
  v-model:current="current"
  @finish="finish"
  @close="close"
  @change="change"
  :next-button-props="{ children: 'Далее' }"
  :prev-button-props="{ children: 'Назад' }"
)
  el-tour-step(
    :target="targets.tourButton"
    title="Кнопка запуска тура"
    description="Нажмите эту кнопку в любой момент, чтобы пройти тур по текущей странице заново."
  )
  el-tour-step(
    :target="targets.nodes"
    title="Панель узлов"
    description="Здесь отображается дерево узлов сцены. Добавляйте примитивы и управляйте ими."
    :placement="tp('right')"
  )
  el-tour-step(
    :target="targets.settings"
    title="Панель настроек"
    description="Здесь настраиваются свойства выбранного узла: размеры, положение, материалы."
    :placement="tp('left')"
  )
  el-tour-step(
    :target="targets.actions"
    title="Управление объектом"
    description="Группировка, отмена/повтор, дублирование, зеркалирование, прилипание, фаска, удаление — действия над выделенными объектами."
    placement="top"
  )
  el-tour-step(
    :target="targets.export"
    title="Экспорт и импорт"
    description="Скачайте модель в STL/OBJ или загрузите существующий STL-файл в сцену."
    placement="top"
    :next-button-props="{ children: 'Готово' }"
  )
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useTourStore } from '@/store/tour';
import { useTourPlacement } from '@/service/useTourPlacement';

const STEPS = [
  'common.tourButton',
  'constructor.nodes',
  'constructor.settings',
  'constructor.actions',
  'constructor.export',
];

const tourStore = useTourStore();
const { tp } = useTourPlacement();
const current = ref(0);

const visibleTarget = (selector: string) => () => {
  const element = document.querySelector<HTMLElement>(selector);
  return element && element.offsetWidth > 0 ? element : null;
};

const targets = {
  tourButton: visibleTarget('.gen-tour-btn'),
  nodes: visibleTarget('.constructor-panel--nodes'),
  settings: visibleTarget('.constructor-panel--settings'),
  actions: visibleTarget('.action-toolbar'),
  export: visibleTarget('.scene-toolbar'),
};

watch(() => tourStore.constructorOpen, (open) => {
  if (!open) return;
  current.value = tourStore.startStepFor(STEPS);
  tourStore.markStepSeen(STEPS[current.value]);
});

function change(index: number): void {
  tourStore.markStepSeen(STEPS[index]);
}

function close(): void {
  tourStore.constructorOpen = false;
}

function finish(): void {
  tourStore.markAllSeen(STEPS);
  close();
}

onMounted(async () => {
  if (!tourStore.hasUnseen(STEPS)) return;
  await new Promise((resolve) => setTimeout(resolve, 100));
  tourStore.openFor('Constructor');
});
</script>
