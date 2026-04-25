<script setup lang="ts">
import { computed } from 'vue';
import type { Feature } from '../Feature';
import type { TransformFeatureParams } from '../composite/TransformFeature';
import {
  getParamsSchema,
  type FieldSchema,
  type ParamsSchema,
} from './paramsSchema';

const props = defineProps<{
  feature: Feature;
}>();

const emit = defineEmits<{
  (e: 'update:params', patch: Record<string, unknown>): void;
  (e: 'update:name', name: string | undefined): void;
}>();

const schema = computed<ParamsSchema>(() => getParamsSchema(props.feature.type));

const params = computed<Record<string, unknown>>(
  () => props.feature.params as Record<string, unknown>,
);

const isTransform = computed(() => props.feature.type === 'transform');

function setField(name: string, raw: unknown, kind: FieldSchema['kind']): void {
  let value: unknown = raw;
  if (kind === 'number' || kind === 'integer') {
    if (raw === '' || raw === null || raw === undefined || Number.isNaN(raw)) {
      value = undefined;
    } else {
      value = kind === 'integer' ? Math.round(Number(raw)) : Number(raw);
    }
  }
  if (kind === 'color') {
    value = raw === '' ? undefined : raw;
  }
  emit('update:params', { [name]: value });
}

function setVecComponent(
  vecName: 'position' | 'rotation' | 'scale',
  index: 0 | 1 | 2,
  raw: unknown,
): void {
  const tp = params.value as Partial<TransformFeatureParams>;
  const current = tp[vecName] ?? [0, 0, 0];
  const next: [number, number, number] = [current[0], current[1], current[2]];
  const num = raw === '' || raw === null || raw === undefined ? 0 : Number(raw);
  next[index] = Number.isNaN(num) ? 0 : num;
  emit('update:params', { [vecName]: next });
}

function vecValue(
  vecName: 'position' | 'rotation' | 'scale',
  index: 0 | 1 | 2,
): number {
  const tp = params.value as Partial<TransformFeatureParams>;
  const v = tp[vecName];
  if (!v) return vecName === 'scale' ? 1 : 0;
  return v[index] ?? 0;
}

function fieldEntries() {
  return Object.entries(schema.value) as [string, FieldSchema][];
}
</script>

<template lang="pug">
.feature-params-form
  .feature-params-form__name.field
    label.label.is-small Имя
    .control
      input.input.is-small(
        type="text"
        :value="feature.name ?? ''"
        :placeholder="feature.type"
        @change="emit('update:name', ($event.target as HTMLInputElement).value || undefined)"
      )

  template(v-if="isTransform")
    .feature-params-form__vec(v-for="vecName in ['position', 'rotation', 'scale'] as const" :key="vecName")
      label.label.is-small {{ vecName === 'position' ? 'Позиция' : vecName === 'rotation' ? 'Поворот' : 'Масштаб' }}
      .columns.is-mobile.is-gapless
        .column(v-for="i in [0, 1, 2]" :key="i")
          .field.has-addons
            p.control
              a.button.is-static.is-small {{ ['X', 'Y', 'Z'][i] }}
            .control.is-expanded
              input.input.is-small(
                type="number"
                step="0.5"
                :value="vecValue(vecName, i as 0 | 1 | 2)"
                @change="setVecComponent(vecName, i as 0 | 1 | 2, ($event.target as HTMLInputElement).value)"
              )

  .feature-params-form__field(
    v-for="[name, field] in fieldEntries()"
    :key="name"
  )
    .field
      label.label.is-small {{ field.label }}

      .control(v-if="field.kind === 'number' || field.kind === 'integer'")
        .field.has-addons
          .control.is-expanded
            input.input.is-small(
              type="number"
              :min="field.min"
              :max="field.max"
              :step="field.kind === 'integer' ? 1 : (field as any).step ?? 0.1"
              :value="params[name] ?? ''"
              :placeholder="field.optional ? 'auto' : ''"
              @change="setField(name, ($event.target as HTMLInputElement).value, field.kind)"
            )
          p.control(v-if="field.kind === 'number' && (field as any).unit")
            a.button.is-static.is-small {{ (field as any).unit }}

      .control(v-else-if="field.kind === 'boolean'")
        label.checkbox.is-small
          input(
            type="checkbox"
            :checked="!!params[name]"
            @change="setField(name, ($event.target as HTMLInputElement).checked, 'boolean')"
          )
          | &nbsp;{{ field.label }}

      .control(v-else-if="field.kind === 'color'")
        .field.has-addons
          .control
            input(
              type="color"
              :value="(params[name] as string) || '#cccccc'"
              @change="setField(name, ($event.target as HTMLInputElement).value, 'color')"
            )
          .control(v-if="field.optional && params[name]")
            button.button.is-small(
              type="button"
              @click="setField(name, '', 'color')"
              title="Сбросить цвет"
            ) ×

      .control(v-else-if="field.kind === 'select'")
        .select.is-small.is-fullwidth
          select(
            :value="params[name] ?? ''"
            @change="setField(name, ($event.target as HTMLSelectElement).value, 'select')"
          )
            option(
              v-for="opt in field.options"
              :key="opt.value"
              :value="opt.value"
            ) {{ opt.label }}

  .feature-params-form__empty(v-if="fieldEntries().length === 0 && !isTransform")
    em.has-text-grey.is-size-7 Параметры отсутствуют
</template>

<style scoped>
.feature-params-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-params-form .label.is-small {
  margin-bottom: 2px;
  font-size: 0.78rem;
}

.feature-params-form .field {
  margin-bottom: 0;
}

.feature-params-form__vec .columns {
  margin: 0;
}

.feature-params-form__vec .column {
  padding: 1px 2px;
}

.feature-params-form input[type="color"] {
  width: 36px;
  height: 28px;
  border: 1px solid #dbdbdb;
  border-radius: 3px;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
</style>
