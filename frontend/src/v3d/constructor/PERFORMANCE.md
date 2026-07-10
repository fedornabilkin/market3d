# Производительность конструктора

Этот документ фиксирует обязательные архитектурные инварианты, эталонные
замеры и порядок проверки производительности конструктора. Любые изменения
загрузки сцен, Feature Graph, CSG или FeatureRenderer должны сверяться с ним.

## Критические пользовательские сценарии

Проверяются четыре сценария:

1. первая загрузка сохранённой сцены после открытия страницы;
2. переключение между тремя слотами сцен;
3. объединение и разъединение объектов;
4. undo/redo после объединения и перемещения.

Главный критерий — отсутствие длительных задач, визуально замораживающих
браузер. Индикатор загрузки не считается исправлением фриза.

## Архитектура загрузки сцен

### Холодная загрузка

```text
ScenePersistenceService.load
        ↓
loadFeatureDocument
  ├─ валидация FeatureDocumentJSON v2
  ├─ восстановление imported geometry из IndexedDB
  └─ один полный recompute Feature Graph
        ↓
ConstructorSceneService.replaceFeatureDocument
        ↓
FeatureRenderer создаёт Three.js-группу и геометрию один раз
        ↓
группа подключается к modelRootGroup
```

В холодном пути допустим ровно один полный recompute. Запрещена цепочка
`FeatureDocument → toJSON() → loadFromV2JSON()`, потому что она повторно
сериализует и вычисляет уже готовый документ.

### Тёплое переключение

`useConstructorScenes` хранит по одному вычисленному `FeatureDocument` на
каждый слот. `ConstructorSceneService` хранит соответствующую связку
`FeatureRenderer + THREE.Group`.

При возврате к уже открытой сцене выполняются только:

1. сохранение текущего слота;
2. отсоединение активной Three.js-группы;
3. подключение кешированной группы следующего слота;
4. сброс истории и выделения.

На тёплом переключении не должно быть чтения storage, CSG, recompute,
создания edge-lines или пересоздания геометрии. Индикатор для такого
переключения не показывается.

## Критический CSG-инвариант

Файл: `features/csg/booleanCsg.ts`.

Все hole-операнды и solid-cutters после первого операнда в операции subtract
должны проходить через `inflateGeom(..., CUT_INFLATE_EPS)` до выполнения CSG.
Текущее значение `CUT_INFLATE_EPS` — `0.005` мм.

Это не косметическая коррекция. Она разносит копланарные грани cutter и базы.
Без неё `three-bvh-csg` попадает в патологически медленный случай на реальных
сценах с отверстиями, а также может создавать нестабильные неманифолдные срезы.

Нельзя удалять inflation или менять epsilon без одновременного:

- браузерного benchmark на реальной CSG-сцене;
- проверки размеров результата;
- проверки hole/subtract и копланарных граней;
- полного набора тестов конструктора.

Node-тесты мокают `booleanCsg` из-за несовместимости UMD/CJS-зависимостей
`three-bvh-csg` и `three-mesh-bvh`. Поэтому зелёный Vitest сам по себе не
защищает от регрессии реального CSG — обязателен браузерный audit.

## Зафиксированный инцидент 2026-07-10

Регрессия появилась в коммите `f308a6e` относительно `ebeb4a8`. Вместе с
рефакторингом было удалено epsilon-раздувание cutters.

Контрольная сцена: `frontend/scene-fail.audit.json`:

- 178 фич;
- 30 boolean-фич;
- 80 transform-фич;
- 8 group-фич.

Замеры Chrome на одной машине:

| Реализация | Feature Graph | Feature Graph + renderer |
|---|---:|---:|
| `ebeb4a8`, до регрессии | 925,9 мс | 960,3 мс |
| без cutter inflation | 20 589,3 мс | 18 533,3 мс |
| исправленная версия | 392,4 мс | 330,5 мс |

Регрессия составляла примерно 20 раз. После возврата inflation новые
оптимизации графа дали результат быстрее исходного master.

Абсолютные времена зависят от CPU и браузера. Для ревью важны оба условия:

- результат не медленнее текущего master более чем в два раза на той же машине;
- на эталонной машине cold graph-load остаётся ниже 1,5 с, bound-load — ниже 2 с.

## Браузерный audit

Audit-страница: `frontend/cold-load-audit.html`.

Запуск:

```powershell
cd frontend
npm run dev -- --port 5173
```

Открыть `http://localhost:5173/cold-load-audit.html`. Страница выводит JSON:

```json
{
  "graphLoadMs": 392.4,
  "boundLoadMs": 330.5,
  "failedGraphFeatures": 0,
  "failedBoundFeatures": 0,
  "thresholds": { "graphLoadMs": 1500, "boundLoadMs": 2000 },
  "passed": true
}
```

Для чистого cold-run использовать новый профиль/инкогнито и выполнить не
менее трёх запусков. Сравнивать медиану. Оба счётчика failed должны быть равны
нулю.

## Автоматические проверки

```powershell
cd frontend
npm exec -- vue-tsc --noEmit
npm exec -- vitest run --reporter=dot
npm run build
```

Профильные тесты:

```powershell
npm exec -- vitest run src/v3d/constructor/features src/v3d/constructor/modes src/composables --reporter=dot
```

`performance.audit.test.ts` полезен для относительной оценки операций графа,
merge, ungroup и history, но использует mock CSG. Он дополняет, а не заменяет
браузерный cold-load audit.

## Checklist перед слиянием

- [ ] Cold-load выполняет ровно один полный recompute.
- [ ] `loadFeatureDocument` не сериализуется обратно через `toJSON` перед активацией.
- [ ] Тёплое переключение использует кеш документа и Three.js-группы.
- [ ] Не удалены `CUT_INFLATE_EPS` и inflation hole/subtract cutters.
- [ ] Не добавлен полный rebuild на каждое событие или кадр.
- [ ] Drag использует targeted live-update, полный recompute — только при commit.
- [ ] Undo/redo использует быстрый restore совпадающего графа, когда возможно.
- [ ] Browser audit не хуже master более чем в два раза.
- [ ] В audit нет failed features.
- [ ] TypeScript, Vitest и production build проходят.

## Файлы, влияющие на производительность

- `composables/useConstructorScenes.ts` — lifecycle и кеш слотов;
- `ConstructorSceneService.ts` — lifecycle renderer и кеш Three.js-групп;
- `features/FeatureDocument.ts` — batching, restore и загрузка документа;
- `features/FeatureGraph.ts` — планирование и кеш outputs;
- `features/visitors/EvaluateVisitor.ts` — построение FeatureOutput и CSG operands;
- `features/csg/booleanCsg.ts` — CSG pipeline;
- `features/csg/geometryCleanup.ts` — cutter inflation и cleanup;
- `features/rendering/FeatureRenderer.ts` — targeted reconcile и создание мешей.

При регрессии сначала измерять отдельно graph-load и bound-load. Если медленный
уже graph-load — причина в FeatureGraph/EvaluateVisitor/CSG. Если graph-load
быстрый, а bound-load медленный — исследовать FeatureRenderer, edge-lines,
материалы и disposal.
