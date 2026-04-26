# features/ — Параметрический Feature Graph

Реализация Шагов 1.1–1.4 из [`plan/cad/phase-1-feature-tree.md`](../../../../../plan/cad/phase-1-feature-tree.md).

## Паттерны

### Composite (`Feature`/`LeafFeature`/`CompositeFeature`)

```
Feature                  Component (абстракт + общий интерфейс)
├── LeafFeature          Leaf      (без входов: примитивы, импорт)
│   ├── BoxFeature
│   ├── SphereFeature
│   ├── CylinderFeature
│   ├── ConeFeature
│   ├── TorusFeature
│   ├── RingFeature
│   ├── PlaneFeature
│   ├── ThreadFeature
│   ├── KnurlFeature
│   └── ImportedMeshFeature
└── CompositeFeature     Composite (со входами: ссылки на другие фичи по id)
    ├── TransformFeature      ровно 1 вход — position/rotation/scale поверх
    ├── BooleanFeature        n входов — union/subtract/intersect через three-bvh-csg
    └── GroupFeature          n входов — логический контейнер без CSG (TinkerCAD-стайл)
```

Композит не «владеет» детьми напрямую — хранит только массив `inputs: FeatureId[]`. Сами фичи живут в `FeatureGraph` по id, граф следит за DAG-инвариантами (отсутствие циклов, валидность ссылок).

### Visitor (`FeatureVisitor<R>`)

Все операции над фичей, кроме базового CRUD над params/inputs, реализуются как посетители:

| Visitor | Назначение |
|---|---|
| `EvaluateVisitor` | Считает `FeatureOutput` (BufferGeometry + transform + flags) из текущих params + resolved входов |
| `SerializeVisitor` | Превращает фичу в `FeatureJSON` |
| `ValidateVisitor` | Структурная валидация (количество входов, диапазоны) |

Каждая концерт-фича маршрутизирует `accept(visitor)` в `visitor.visitX(this)`. Дефолтная реализация всех `visitX` методов в `FeatureVisitor` — `visitFeature(f)` (catch-all). Конкретный посетитель переопределяет только то, что ему интересно. Так Feature остаются data-only и не растут под каждую новую операцию.

## Граф

`FeatureGraph` — главный держатель state'а:

- **CRUD**: `add`, `remove`, `updateParams`, `updateInputs`. Все с проверкой инвариантов (циклы, существование ссылок).
- **Queries**: `collectDependents(rootIds)` (транзитивные потомки), `topologicalOrder(subset)`.
- **Recompute**: `recompute(changedIds)` — считает аффекетных в порядке топосорта, ловит ошибки эвалюации, кэширует outputs. Возвращает `{updated, failed}`.

Outputs хранятся в `cachedOutputs` графа (не в самих фичах) — это упрощает feature-классы.

## Документ

`FeatureDocument` оборачивает граф, держит `rootIds` (что попадает в финальный рендер) и метаданные. Эмитит события подписчикам (`feature-added`, `feature-removed`, `feature-updated`, `recompute-done`) — так UI/рендер-слой узнаёт, что нужно обновить three.js-сцену.

Реактивность намеренно через event-bus, **не** через Vue/Pinia `reactive()` — иначе proxy ломает GPU-кэши BufferGeometry.

`toJSON` / `fromJSON` сериализуют граф (с топосортом для гарантии порядка). Версия документа — `version: 2` (legacy `kind: 'group'/'primitive'/...` — `version: 1` без поля).

## Реестр

`FeatureRegistry` — map `type → constructor` для десериализации. Штатные типы регистрируются через `createDefaultRegistry()`. При добавлении нового типа фичи — регистрация ещё в одном месте (плюс новый visitor-метод).

## Поток данных

```
                ┌─ User edit (UI form)
                ▼
   FeatureDocument.updateParams(id, patch)
        ▼
   FeatureGraph.updateParams → feature.setParams (paramsVersion++)
        ▼
   FeatureGraph.recompute([id])
   │   1. collectDependents — кого пересчитывать
   │   2. topologicalOrder — в каком порядке
   │   3. для каждого: feature.accept(EvaluateVisitor) → FeatureOutput
   │   4. кэшируем
        ▼
   emit('recompute-done', updatedIds)
        ▼
   ConstructorSceneService → обновляет three.js Mesh/Group
```

## CSG (`csg/booleanCsg.ts`)

Чистая утилита поверх `three-bvh-csg`: запекает входные матрицы в геометрии (флипает winding для negative-det), evaluator цепочкой union/subtract/intersect, на выходе `mergeVertices(1e-4) + computeVertexNormals`. Используется `EvaluateVisitor.visitBoolean`. Логика та же, что была в `nodes/GroupNode` — просто вынесена в переиспользуемый модуль.

## Что НЕ сделано (следующие шаги Phase 1)

- **Шаг 1.5** — Render-слой (`ConstructorSceneService` подписывается на `FeatureDocument`).
- **Шаг 1.6** — Миграция `version: 1 → 2` в `Serializer`.
- **Шаг 1.7** — UI: `FeatureTree.vue` + schema-driven `FeatureParamsForm.vue`.
- **Шаг 1.8** — `SnapshotCommand` на feature-graph (минимальная правка).
- **Шаг 1.9** — `BinaryStorage` (IndexedDB) для STL у `ImportedMeshFeature`.
- **Шаг 1.10** — Cleanup мёртвых `nodes/`-классов после полной миграции.

## Тесты

```bash
cd frontend
npx vitest run src/v3d/constructor/features
```

20 тестов покрывают:
- DAG: add, remove, get, отказ при дубликатах, отказ при попытке удалить с зависимостями, обнаружение циклов.
- Запросы: `collectDependents`, `topologicalOrder`.
- Recompute: примитивы, transform, boolean, group, каскад при `updateParams`, propagation ошибок.
- Документ: события, сериализация (round-trip), валидация.

`booleanCsg` мокается в тестах через `vi.mock` — `three-bvh-csg`/`three-mesh-bvh` имеют circular CJS, ломающую vitest в node. Реальная CSG-логика верифицируется в браузере (на этапе интеграции с UI).

## Как добавить новый тип фичи

1. **Тип в `types.ts`** — добавить тег в `FeatureType` union.
2. **Класс фичи** в `primitives/` или `composite/` — extends `LeafFeature` или `CompositeFeature`, реализует `accept(v)` через `v.visitNewType(this)`.
3. **Метод в `FeatureVisitor`** — добавить `visitNewType(f: NewFeature): R { return this.visitFeature(f); }`.
4. **Эвалюация в `EvaluateVisitor`** — переопределить `visitNewType`. Для leaf-фичи использовать `primitiveLeaf(geometry, halfHeight, color, name)` — он выставит `bottomAnchorOffsetZ`, чтобы рендер положил низ примитива на сетку.
5. **Валидация в `ValidateVisitor`** (если нужно) — переопределить `visitNewType`.
6. **Реестр в `FeatureRegistry.createDefaultRegistry()`** — `register('new-type', json => new NewFeature(...))`.
7. **Schema в `schema/paramsSchema.ts`** — описать поля параметров (`number`/`integer`/`boolean`/`color`/`select`). `FeatureParamsForm.vue` автоматически отрисует форму.
8. **Bridge в `bridge/applyFeaturePatchToNode.ts`** (если есть legacy ModelNode-аналог) — добавить тип в `isLeafPrimitiveType` или новую ветку. Без legacy-аналога bridge просто проигнорирует с warn.
9. **Migrator в `migration/migrateLegacyTree.ts` + reverse** — если фича есть в legacy v1-сохранёнках, добавить ветку миграции и обратной конвертации.
10. **Бейдж в `FeatureTree.vue`** — добавить символ в `TYPE_BADGE` для отображения в feature-tree панели.
11. **Тест** — добавить покрытие в `FeatureGraph.test.ts` или отдельный файл.

## Шаги пути за пределами 1.1–1.4

После фундамента (Composite + Visitor + Graph + Registry) реализованы:

### 1.5 Рендер-слой — `rendering/FeatureRenderer.ts`

`FeatureRenderer` подписывается на `recompute-done` и проектирует
`FeatureOutput`-ы в three.js-сцену:
- `LeafOutput → THREE.Mesh` с user-transform'ом (decompose из `output.transform`)
  + сдвиг `mesh.position.z += bottomAnchorOffsetZ` (legacy-конвенция «низ на сетке»).
- `CompositeOutput → THREE.Group` с рекурсивно построенными детьми.
- Edge-lines per-mesh (`addEdgeLines`).
- `selectAsUnit` маркер на не-root композитах для PointerEventController
  (клик по ребёнку выделяет всю группу, как у legacy union-merged).
- Hole-style propagation (`applyHoleStyle` zebra-материал).
- Color-propagation от родителя к детям без своего цвета.

В `Constructor.vue → ConstructorSceneService.rebuildSceneFromTree` интегрировано
через мост ModelNode ↔ Feature: на каждом rebuild ModelTree migrate'ится в
v2 (с trace), документ перестраивается, FeatureRenderer'у даётся новая
ссылка. После рендера на меши протягиваются `userData.node` для совместимости
с PointerEventController/legacy-handlers.

### 1.6 Migration v1 ↔ v2 — `migration/`

`migrateLegacyTreeToDocument(rootJson, trace?)` — legacy `ModelTreeJSON`
(version 1) → `FeatureDocumentJSON` (version 2). Стратегия:
- Primitive → `<Type>Feature` + при наличии `nodeParams` оборачивается в `TransformFeature`.
- GroupNode с `union` без hole-детей → `GroupFeature` (logical container).
- GroupNode с `subtract`/`intersect`/`union с holes` → `BooleanFeature` (CSG).
- Корневая группа НИКОГДА не оборачивается в Transform (root.nodeParams игнорируются).
- Опциональный параметр `trace: Map<FeatureId, ModelTreeJSON>` — для UI-bridge'ей.

`featureDocumentToLegacy(docJson)` — обратный конвертер для cutover-стадии.
Round-trip identity для документов, происходящих из legacy migration.

### 1.7 UI: schema-форма + Feature Tree

`schema/paramsSchema.ts` описывает поля для всех 13 типов фич:
```ts
type FieldSchema =
  | { kind: 'number'; min?, max?, step?, unit?; optional? }
  | { kind: 'integer'; min?, max?; optional? }
  | { kind: 'boolean' }
  | { kind: 'color'; optional? }
  | { kind: 'select'; options: { value, label }[] };
```

`schema/FeatureParamsForm.vue` рендерит форму по schema + специальные
3-векторные виджеты для `TransformFeature.position/rotation/scale`. Эмитит
`update:params` (patch) и `update:name`.

`components/constructor/FeatureTree.vue` + `FeatureTreeNode.vue` — read-only
панель отображения графа, аналог legacy `NodeTree.vue`.

### 1.8 Undo/redo — `commands/FeatureSnapshotCommand.ts`

`captureSnapshot(doc, mutate)` оборачивает мутацию: capture before, run, capture
after, return `FeatureSnapshotCommand`. На undo/redo вызывает
`doc.loadFromJSON(...)` — in-place restore с подписками.

В Constructor.vue пока используется legacy `SnapshotCommand` (на
`ModelTreeJSON`); подключение `FeatureSnapshotCommand` отложено до полного
flip'а source-of-truth.

### 1.9 IndexedDB — `services/BinaryStorage.ts`

STL-бинарники хранятся в IDB по ключу `binaryRef`. `ImportedMeshFeature.params`
содержит `binaryRef` (опционально + legacy `stlBase64`/`geometry`).
`loadFeatureDocument` lazy-резолвит binaryRef → BufferGeometry.

### Bridge — `bridge/applyFeaturePatchToNode.ts`

Транзитный модуль на время cutover'а: маппит patch от `FeatureParamsForm` обратно
в legacy ModelNode-мутации. Используется duck-typing вместо `instanceof`,
чтобы не тянуть `nodes/GroupNode → three-bvh-csg` (circular CJS) в unit-тесты.
Полностью покрыт тестами (`applyFeaturePatchToNode.test.ts`).

### Universal loader — `loader/loadFeatureDocument.ts`

`loadFeatureDocument(json)` принимает legacy v1 или v2 JSON, делает миграцию
если нужно, резолвит imported-binaryRef'ы из IDB, возвращает
готовый `FeatureDocument`. Используется в Constructor.vue в save/load
flow и shadow-валидации.

## Текущий source-of-truth (Phase 1)

ModelNode-tree остаётся primary, FeatureDocument перестраивается из него на
каждом `rebuildSceneFromTree`. UI-формы мутируют ModelNode (через bridge для
schema-формы или напрямую для legacy-формы). Полный flip на FeatureDocument
как primary — отдельный шаг Phase 2 (потребует переписывания режимов:
chamfer, mirror, alignment, generator).

Cutover'ные шаги уже сделаны на стороне хранения и рендера:
- Save/load: v2 — канонический формат (`constructor_scene_v2_*` в localStorage),
  v1 — read-only fallback.
- Render: через `FeatureRenderer` + `EvaluateVisitor` (CSG через `booleanCsg`).
- Selection: bidirectional `featureId ↔ ModelNode` карты на ConstructorSceneService.
