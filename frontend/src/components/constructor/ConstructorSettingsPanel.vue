<template lang="pug">
.constructor-panel.constructor-panel--settings
  template(v-if="generatorActive")
    .panel-header Генератор
    .generator-tabs
      button.generator-tab(:class="{ 'is-active': generatorType === 'thread' }" @click="generatorType = 'thread'") Резьба
      button.generator-tab(:class="{ 'is-active': generatorType === 'knurl' }" @click="generatorType = 'knurl'") Насечки
    .settings-content
      template(v-if="generatorType === 'thread'")
        .field
          label.label Внешний диаметр (мм)
          input.input.is-small(type="number" step="0.5" min="1" v-model.number="thread.outerDiameter")
        .field
          label.label Внутренний диаметр (мм)
          input.input.is-small(type="number" step="0.5" min="0.5" v-model.number="thread.innerDiameter")
        .field
          label.label Шаг (мм)
          input.input.is-small(type="number" step="0.25" min="0.25" v-model.number="thread.pitch")
        .field
          label.label Витки
          input.input.is-small(type="number" step="1" min="1" v-model.number="thread.turns")
        .field
          label.label Сегментов на виток
          input.input.is-small(type="number" step="8" min="8" v-model.number="thread.segmentsPerTurn")
        .field
          label.checkbox
            input(type="checkbox" v-model="thread.leftHand")
            span Левая резьба
      template(v-else)
        .field
          label.label Внешний диаметр (мм)
          input.input.is-small(type="number" step="0.5" :min="knurl.innerDiameter" v-model.number="knurl.outerDiameter")
        .field
          label.label Внутренний диаметр (мм)
          input.input.is-small(type="number" step="0.5" min="0.5" :max="knurl.outerDiameter" v-model.number="knurl.innerDiameter")
        .field
          label.label Высота (мм)
          input.input.is-small(type="number" step="0.5" min="0.5" v-model.number="knurl.height")
        .field
          label.label Количество насечек
          input.input.is-small(type="number" step="1" min="3" v-model.number="knurl.notchCount")
        .field
          label.label Узор
          select.input.is-small(v-model="knurl.pattern")
            option(value="straight") Прямые
            option(value="diagonal" disabled) Диагональные (скоро)
            option(value="diamond" disabled) Ромбовидные (скоро)
            option(value="cross45" disabled) Перекрёстные 45° (скоро)
            option(value="flatDiamond" disabled) Плоский ромб (скоро)
        .field
          label.label Сегментов на насечку
          input.input.is-small(type="number" step="1" min="2" v-model.number="knurl.segmentsPerNotch")
        .field
          label.label Шагов по высоте
          input.input.is-small(type="number" step="4" min="4" v-model.number="knurl.heightSegments")
      .field
        button.button.is-small.is-primary(@click="$emit('confirm-generator')" style="width:100%") Применить
  template(v-else-if="chamferActive")
    .panel-header Фаска
    .settings-content
      .field
        label.label Размер (мм)
        input.input.is-small(type="number" :step="snapStep || 0.5" :min="snapStep || 0.1" v-model.number="chamferRadius")
  template(v-else)
    .panel-header Настройки фичи
    .settings-content(v-if="feature")
      FeatureParamsForm(
        :feature="feature"
        :version="treeVersion"
        @update:params="$emit('update:params', $event)"
        @update:name="$emit('update:name', $event)"
      )
    .settings-placeholder(v-else) Выберите фичу в сцене или в дереве
</template>

<script setup lang="ts">
import FeatureParamsForm from '@/v3d/constructor/features/schema/FeatureParamsForm.vue';
import type { Feature } from '@/v3d/constructor/features/Feature';

type GeneratorType = 'thread' | 'knurl';
type ThreadForm = { outerDiameter: number; innerDiameter: number; pitch: number; turns: number; segmentsPerTurn: number; leftHand: boolean };
type KnurlForm = { outerDiameter: number; innerDiameter: number; height: number; notchCount: number; pattern: 'straight' | 'diagonal' | 'diamond' | 'cross45' | 'flatDiamond'; angle: number; segmentsPerNotch: number; heightSegments: number };

defineProps<{ generatorActive: boolean; chamferActive: boolean; snapStep: number; feature: Feature | null | undefined; treeVersion: number }>();
const generatorType = defineModel<GeneratorType>('generatorType', { required: true });
const thread = defineModel<ThreadForm>('thread', { required: true });
const knurl = defineModel<KnurlForm>('knurl', { required: true });
const chamferRadius = defineModel<number>('chamferRadius', { required: true });
defineEmits<{
  'confirm-generator': [];
  'update:params': [patch: Record<string, unknown>];
  'update:name': [name: string | undefined];
}>();
</script>

<style scoped>
.constructor-panel { padding:.75rem; overflow:auto; }
.constructor-panel--settings { flex:1; min-height:0; }
.panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.6rem; font-size:.95rem; font-weight:600; }
.generator-tabs { display:flex; margin-bottom:.75rem; border:1px solid #d0d0d0; border-radius:6px; overflow:hidden; }
.generator-tab { flex:1; padding:.4rem 0; border:0; background:#f5f5f5; color:#666; cursor:pointer; font-size:.82rem; font-weight:500; }
.generator-tab:not(:last-child) { border-right:1px solid #d0d0d0; }
.generator-tab:hover:not(.is-active) { background:#e8e8e8; color:#333; }
.generator-tab.is-active { background:#4a7cff; color:#fff; font-weight:600; }
.settings-content .field { margin-bottom:.65rem; }
.settings-content .label { margin-bottom:.2rem; font-size:.82rem; }
.settings-placeholder { padding:1rem .25rem; color:#999; font-size:.85rem; text-align:center; }
</style>
