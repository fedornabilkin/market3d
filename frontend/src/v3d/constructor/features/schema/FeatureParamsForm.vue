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
  /**
   * Reactivity-trigger от родителя. `feature.params` — мутируемый non-reactive
   * объект (Vue его не отслеживает); чтобы computed'ы пересчитывались после
   * `featureDoc.updateParams`, родитель пробрасывает version-счётчик
   * (treeVersion) и computed внутри его читают.
   */
  version?: number;
}>();

const emit = defineEmits<{
  (e: 'update:params', patch: Record<string, unknown>): void;
  (e: 'update:name', name: string | undefined): void;
}>();

const schema = computed<ParamsSchema>(() => getParamsSchema(props.feature.type));

/**
 * `props.feature.params` — мутируемый non-reactive объект (Vue не отслеживает
 * мутации полей класса). Чтобы computed'ы пересчитывались после
 * `featureDoc.updateParams`, читаем `props.version` (реактивный trigger от
 * родителя) ВНУТРИ каждого computed'а. Промежуточный `params`-computed
 * нельзя использовать: он возвращал бы тот же object ref, Vue делал бы
 * `Object.is(old, new) === true` и НЕ инвалидировал downstream computed'ы.
 */
function readParams(): Record<string, unknown> {
  void props.version;
  return props.feature.params as Record<string, unknown>;
}

/**
 * Для шаблона/legacy-функций (vecValue/setVecComponent/field-loop). Возвращает
 * тот же object ref, но обёрнут в computed → каждый ре-рендер шаблона
 * (триггерится reactive computed'ами вроде `isHoleChipValue`) читает свежие
 * значения полей.
 */
const params = computed<Record<string, unknown>>(() => readParams());

const isTransform = computed(() => props.feature.type === 'transform');

/** Дефолтный цвет — совпадает с GroupNode.buildDefaultMaterial (teal). */
const DEFAULT_COLOR = '#00a5a4';

/** Schema содержит хотя бы color или isHole — показываем «чипы» материала. */
const hasMaterialChips = computed(
  () => 'color' in schema.value || 'isHole' in schema.value,
);

const colorChipValue = computed<string>(() => {
  const c = readParams().color;
  return typeof c === 'string' && c ? c : DEFAULT_COLOR;
});

const isHoleChipValue = computed<boolean>(() => !!readParams().isHole);

function setSolid(): void {
  if (isHoleChipValue.value) emit('update:params', { isHole: false });
}

function setHole(): void {
  if (!isHoleChipValue.value) emit('update:params', { isHole: true });
}

/** Поля, которые рендерятся специальным «чип»-виджетом сверху, а не в общем списке. */
const SPECIAL_CHIP_FIELDS = new Set(['color', 'isHole']);

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
  index: number,
  raw: unknown,
): void {
  const tp = params.value as Partial<TransformFeatureParams>;
  const current = tp[vecName] ?? [0, 0, 0];
  const next: [number, number, number] = [current[0], current[1], current[2]];
  const num = raw === '' || raw === null || raw === undefined ? 0 : Number(raw);
  const i = (index | 0) as 0 | 1 | 2;
  next[i] = Number.isNaN(num) ? 0 : num;
  emit('update:params', { [vecName]: next });
}

function vecValue(
  vecName: 'position' | 'rotation' | 'scale',
  index: number,
): number {
  const tp = params.value as Partial<TransformFeatureParams>;
  const v = tp[vecName];
  if (!v) return vecName === 'scale' ? 1 : 0;
  const i = (index | 0) as 0 | 1 | 2;
  return v[i] ?? 0;
}

function fieldEntries() {
  return (Object.entries(schema.value) as [string, FieldSchema][])
    .filter(([name]) => !SPECIAL_CHIP_FIELDS.has(name));
}

const vecNames = ['position', 'rotation', 'scale'] as const;

function vecLabel(name: 'position' | 'rotation' | 'scale'): string {
  if (name === 'position') return 'Позиция';
  if (name === 'rotation') return 'Поворот';
  return 'Масштаб';
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
        @change="emit('update:name', $event.target.value || undefined)"
      )

  .feature-params-form__chips(v-if="hasMaterialChips")
    .chip-wrap(
      v-if="'color' in schema"
      :class="{ 'chip-wrap--active': !isHoleChipValue }"
      title="Сплошной"
    )
      input.chip.chip--color(
        type="color"
        :value="colorChipValue"
        @click="setSolid"
        @change="setField('color', $event.target.value, 'color')"
      )
    .chip-wrap(
      v-if="'isHole' in schema"
      :class="{ 'chip-wrap--active': isHoleChipValue }"
      role="button"
      tabindex="0"
      title="Отверстие (вычитать)"
      @click="setHole"
      @keydown.enter.prevent="setHole"
      @keydown.space.prevent="setHole"
    )
      .chip.chip--zebra(:style="{ '--chip-color': colorChipValue }")

  template(v-if="isTransform")
    .feature-params-form__vec(v-for="vecName in vecNames" :key="vecName")
      label.label.is-small {{ vecLabel(vecName) }}
      .columns.is-mobile.is-gapless
        .column(v-for="i in [0, 1, 2]" :key="i")
          .field.has-addons
            p.control
              a.button.is-static.is-small {{ ['X', 'Y', 'Z'][i] }}
            .control.is-expanded
              input.input.is-small(
                type="number"
                step="0.5"
                :value="vecValue(vecName, i)"
                @change="setVecComponent(vecName, i, $event.target.value)"
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
              :step="field.kind === 'integer' ? 1 : (field.step ?? 0.1)"
              :value="params[name] ?? ''"
              :placeholder="field.optional ? 'auto' : ''"
              @change="setField(name, $event.target.value, field.kind)"
            )
          p.control(v-if="field.kind === 'number' && field.unit")
            a.button.is-static.is-small {{ field.unit }}

      .control(v-else-if="field.kind === 'boolean'")
        label.checkbox.is-small
          input(
            type="checkbox"
            :checked="!!params[name]"
            @change="setField(name, $event.target.checked, 'boolean')"
          )
          | &nbsp;{{ field.label }}

      .control(v-else-if="field.kind === 'color'")
        .field.has-addons
          .control
            input(
              type="color"
              :value="params[name] || '#cccccc'"
              @change="setField(name, $event.target.value, 'color')"
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
            @change="setField(name, $event.target.value, 'select')"
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

.feature-params-form__chips {
  display: flex;
  gap: 6px;
  align-items: center;
}
.feature-params-form__chips .chip-wrap {
  width: 32px;
  height: 32px;
  padding: 2px;
  border: 2px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  box-sizing: border-box;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.feature-params-form__chips .chip-wrap--active {
  border-color: #4a7cff;
  background: rgba(74, 124, 255, 0.12);
}
.feature-params-form__chips .chip-wrap:focus-visible {
  outline: none;
  border-color: #4a7cff;
}
.feature-params-form__chips .chip {
  width: 100%;
  height: 100%;
  border: 1px solid #dbdbdb;
  border-radius: 3px;
  padding: 0;
  box-sizing: border-box;
  cursor: pointer;
}
.feature-params-form__chips .chip--color {
  background: transparent;
}
.feature-params-form__chips .chip--zebra {
  background-image: repeating-linear-gradient(
    45deg,
    var(--chip-color, #00a5a4) 0 4px,
    #ffffff 4px 8px
  );
}
</style>
