import type { FeatureType } from '../types';

/**
 * Schema-driven описание полей формы для редактирования параметров фичи.
 * UI-компонент `FeatureParamsForm.vue` читает schema по типу фичи и рендерит
 * соответствующие inputs.
 *
 * Преимущество перед написанием формы под каждый тип вручную:
 *  - Один универсальный компонент, минимум кода для добавления нового типа.
 *  - Schema служит документацией параметров.
 *  - Явные min/max/step кладут data-валидацию рядом с описанием поля.
 */

export interface NumberFieldSchema {
  kind: 'number';
  label: string;
  min?: number;
  max?: number;
  step?: number;
  /** true → поле опциональное, можно очистить (тогда значение undefined). */
  optional?: boolean;
  /** Suffix-аддон в инпуте (мм, °, …). */
  unit?: string;
}

export interface IntegerFieldSchema {
  kind: 'integer';
  label: string;
  min?: number;
  max?: number;
  optional?: boolean;
}

export interface BooleanFieldSchema {
  kind: 'boolean';
  label: string;
}

export interface ColorFieldSchema {
  kind: 'color';
  label: string;
  optional?: boolean;
}

export interface SelectFieldSchema {
  kind: 'select';
  label: string;
  options: { value: string; label: string }[];
}

export type FieldSchema =
  | NumberFieldSchema
  | IntegerFieldSchema
  | BooleanFieldSchema
  | ColorFieldSchema
  | SelectFieldSchema;

/** Schema параметров одной фичи: имя поля → схема. */
export type ParamsSchema = Record<string, FieldSchema>;

// ─── Конкретные schema для штатных типов фич ──────────────────────────

const SCHEMAS: Record<FeatureType, ParamsSchema> = {
  box: {
    width:  { kind: 'number', label: 'Ширина', min: 0.1, step: 0.5, unit: 'мм' },
    height: { kind: 'number', label: 'Высота', min: 0.1, step: 0.5, unit: 'мм' },
    depth:  { kind: 'number', label: 'Глубина', min: 0.1, step: 0.5, unit: 'мм' },
    bevelRadius:   { kind: 'number',  label: 'Радиус фаски', min: 0, step: 0.1, unit: 'мм', optional: true },
    bevelSegments: { kind: 'integer', label: 'Сегменты фаски', min: 1, max: 16, optional: true },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  sphere: {
    radius:         { kind: 'number',  label: 'Радиус', min: 0.1, step: 0.5, unit: 'мм' },
    widthSegments:  { kind: 'integer', label: 'Сегменты по ширине', min: 3, max: 64, optional: true },
    heightSegments: { kind: 'integer', label: 'Сегменты по высоте', min: 2, max: 64, optional: true },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  cylinder: {
    radiusTop:     { kind: 'number',  label: 'Радиус сверху', min: 0, step: 0.5, unit: 'мм' },
    radiusBottom:  { kind: 'number',  label: 'Радиус снизу', min: 0, step: 0.5, unit: 'мм' },
    height:        { kind: 'number',  label: 'Высота', min: 0.1, step: 0.5, unit: 'мм' },
    segments:      { kind: 'integer', label: 'Сегменты', min: 3, max: 128, optional: true },
    bevelRadius:   { kind: 'number',  label: 'Радиус фаски', min: 0, step: 0.1, unit: 'мм', optional: true },
    bevelSegments: { kind: 'integer', label: 'Сегменты фаски', min: 1, max: 16, optional: true },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  cone: {
    radius:   { kind: 'number',  label: 'Радиус основания', min: 0.1, step: 0.5, unit: 'мм' },
    height:   { kind: 'number',  label: 'Высота', min: 0.1, step: 0.5, unit: 'мм' },
    segments: { kind: 'integer', label: 'Сегменты', min: 3, max: 128, optional: true },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  torus: {
    radius:          { kind: 'number',  label: 'Радиус', min: 0.1, step: 0.5, unit: 'мм' },
    tube:            { kind: 'number',  label: 'Толщина трубки', min: 0.1, step: 0.1, unit: 'мм' },
    segments:        { kind: 'integer', label: 'Сегменты', min: 3, max: 128, optional: true },
    tubularSegments: { kind: 'integer', label: 'Сегменты трубки', min: 3, max: 64, optional: true },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  ring: {
    innerRadius: { kind: 'number',  label: 'Внутренний радиус', min: 0, step: 0.5, unit: 'мм' },
    outerRadius: { kind: 'number',  label: 'Внешний радиус', min: 0.1, step: 0.5, unit: 'мм' },
    segments:    { kind: 'integer', label: 'Сегменты', min: 3, max: 128, optional: true },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  plane: {
    width:  { kind: 'number', label: 'Ширина', min: 0.1, step: 0.5, unit: 'мм' },
    height: { kind: 'number', label: 'Длина',  min: 0.1, step: 0.5, unit: 'мм' },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  thread: {
    outerDiameter:   { kind: 'number',  label: 'Внешний диаметр', min: 0.5, step: 0.5, unit: 'мм' },
    innerDiameter:   { kind: 'number',  label: 'Внутренний диаметр', min: 0.5, step: 0.5, unit: 'мм' },
    pitch:           { kind: 'number',  label: 'Шаг', min: 0.1, step: 0.1, unit: 'мм' },
    turns:           { kind: 'number',  label: 'Витков', min: 1, step: 1 },
    profile:         { kind: 'select',  label: 'Профиль', options: [{ value: 'trapezoid', label: 'Трапеция' }] },
    segmentsPerTurn: { kind: 'integer', label: 'Сегменты на виток', min: 8, max: 256, optional: true },
    leftHand:        { kind: 'boolean', label: 'Левая резьба' },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  knurl: {
    outerDiameter:    { kind: 'number',  label: 'Внешний диаметр', min: 0.5, step: 0.5, unit: 'мм' },
    innerDiameter:    { kind: 'number',  label: 'Внутренний диаметр', min: 0.5, step: 0.5, unit: 'мм' },
    height:           { kind: 'number',  label: 'Высота', min: 0.5, step: 0.5, unit: 'мм' },
    notchCount:       { kind: 'integer', label: 'Кол-во насечек', min: 4, max: 128 },
    pattern: {
      kind: 'select', label: 'Паттерн',
      options: [
        { value: 'straight', label: 'Прямые' },
        { value: 'diagonal', label: 'Диагональные' },
        { value: 'diamond', label: 'Ромб' },
        { value: 'cross45', label: 'Крест 45°' },
        { value: 'flatDiamond', label: 'Плоский ромб' },
      ],
    },
    angle:            { kind: 'number',  label: 'Угол', min: 0, max: 60, step: 1, unit: '°', optional: true },
    segmentsPerNotch: { kind: 'integer', label: 'Сегменты насечки', min: 1, max: 32, optional: true },
    heightSegments:   { kind: 'integer', label: 'Вертикальные сегменты', min: 1, max: 128, optional: true },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  imported: {
    filename: { kind: 'select', label: 'Файл', options: [] }, // readonly через UI
    color:    { kind: 'color',  label: 'Цвет', optional: true },
  },

  transform: {
    // position/rotation/scale здесь объявлены как 3-векторные «мета»-поля,
    // но FeatureParamsForm.vue их рендерит специальным виджетом OffsetField.
    // В schema указываем как color-проксы для UI — реальная UI-логика смотрит
    // на тип фичи и подставляет position/rotation/scale тройки.
    isHole: { kind: 'boolean', label: 'Отверстие (вычитать)' },
    color:  { kind: 'color', label: 'Цвет (override)', optional: true },
  },

  boolean: {
    operation: {
      kind: 'select', label: 'Операция',
      options: [
        { value: 'union', label: 'Объединение' },
        { value: 'subtract', label: 'Вычитание' },
        { value: 'intersect', label: 'Пересечение' },
      ],
    },
    color: { kind: 'color', label: 'Цвет', optional: true },
  },

  group: {
    isHole: { kind: 'boolean', label: 'Группа-отверстие' },
    color:  { kind: 'color', label: 'Цвет (override)', optional: true },
  },
};

/** Получить schema для конкретного типа фичи. */
export function getParamsSchema(type: FeatureType): ParamsSchema {
  return SCHEMAS[type] ?? {};
}
