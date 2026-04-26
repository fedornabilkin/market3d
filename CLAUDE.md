# CLAUDE.md

Проектная справка для Claude Code. Общение с пользователем — на русском.

## Обзор

Монорепо: **Vue 3 фронтенд** (SPA с 3D-генераторами и визуальным конструктором) + **Express бэкенд** (API, БД, auth). Фронтенд — основная поверхность работы.

## Стек

### Frontend (`frontend/`)
- **Vue 3.5** + `<script setup>` + Composition API
- **Vite 7.3** — dev-сервер на `0.0.0.0:5174`
- **Pinia 3** — state (`src/store/`)
- **vue-router 5**, **vue-i18n 11**
- **Element Plus 2.8** + **Bulma 1** + **FontAwesome 5** — UI
- **Pug** — шаблоны (`<template lang="pug">`)
- **Three.js 0.183** — 3D-рендеринг
- **three-csg-ts 3.2** — CSG **только для экспорта** STL/OBJ, не для рантайма
- TS + JS смешанный: конструктор на TS, генераторы на JS

### Backend (`backend/`)
- **Express 4.18** (ESM) через **tsx**
- **PostgreSQL** (pg + db-migrate)
- **Passport** (Local + JWT), **bcryptjs**
- **multer**, **express-validator**

## Запуск

```bash
# Frontend dev (5174)
cd frontend && npm run dev

# Backend dev (3000)
cd backend && npm run dev

# Миграции БД
cd backend && npm run migrate:up

# Весь стек
docker-compose up
```

**Важно**: dev-сервер фронтенда уже может быть запущен на `:5174` — проверь `curl http://localhost:5174/` перед запуском нового.

## Структура

### `frontend/src/`
- `main.js` — bootstrap (Pinia, Router, i18n, Element Plus)
- `views/` — страницы (`Generator{QR,NameTag,Coaster,GRZ,Braille}.vue`, `Constructor.vue`, auth, dashboard)
- `components/` — переиспользуемые SFC:
  - `forms/` — формы настроек генераторов, разбиты на секции (`nametag/`, `coaster/`)
  - `forms/Keychain.vue` — общий компонент брелока (используется во всех генераторах)
  - `generator/`, `page/`, `template/`, `registry/`, `monetisation/`
- `v3d/` — 3D-система:
  - `generator/` — классы генераторов (`QRGenerator`, `NameTagGenerator`, `CoasterGenerator`, `GRZGenerator`, `BrailleGenerator`, `ModelGenerator`)
  - `constructor/` — TS-конструктор (см. ниже)
  - `box.js`, `entity.js` — общие обёртки сцены и сущностей
  - `animation/`, `primitives/`
- `store/` — Pinia (`auth`, `theme`, `tour`, `orders`, `clusters`, `printers`, `dictionaries`, `exportList`)
- `router/` — роуты с lazy-loading
- `translations/` — `{ru,en,de,cz,br,fr,gal}.js` + `loader.js`; ключи используются через `$t('form.nametag.text.title')`
- `service/` — axios-клиенты API

### `backend/src/`
- `app.js` — Express setup
- `routes/`, `controllers/`, `models/`, `services/`, `middleware/`, `config/`, `migrations/`, `templates/` (Handlebars для email)

## Конструктор (`frontend/src/v3d/constructor/`)

Визуальный 3D-редактор. **Phase 1 (параметрическая CAD-модель) закрыта на 2026-04-26.**
Архитектура: feature graph (DAG из фич с типами и параметрами) — см.
[`features/README.md`](frontend/src/v3d/constructor/features/README.md) и
[`plan/cad/phase-1-feature-tree.md`](plan/cad/phase-1-feature-tree.md).

- **Feature Graph** (`features/`) — параметрическая модель: каждый узел сцены — `Feature` (Box/Sphere/Cylinder/.../Transform/Boolean/Group/ImportedMesh, всего 13 типов). `FeatureGraph` (DAG), `FeatureDocument` (граф + roots + events), `EvaluateVisitor` (Feature → BufferGeometry+transform+flags), `FeatureRenderer` (FeatureDocument → THREE.js scene).
- **Z-up конвенция** (как FreeCAD/SolidWorks). Legacy Y-up сохранёнки автомигрируются на load.
- **CSG**: `three-bvh-csg` для рантайма (subtract/intersect/union с holes-детьми) и для экспорта STL/OBJ. Чистый `union` без holes-детей рендерится как logical container (без CSG, GroupFeature).
- **Примитивы**: Box, Sphere, Cylinder, Cone, Torus, Ring, Plane, Thread, Knurl + импорт STL.
- **Persistence**: формат на диске — `FeatureDocumentJSON v2` (`constructor_scene_v2_*` в localStorage); legacy v1 (`constructor_scene_v1_*`) — read-only fallback. STL-бинарники в IndexedDB через `BinaryStorage` (`binaryRef` вместо base64).
- **История**: `HistoryManager` + `FeatureSnapshotCommand` (snapshots в FeatureDocumentJSON v2). Undo/redo derive'ит ModelNode-tree из featureDoc через `featureDocumentToLegacy`.
- **In-memory source-of-truth (Phase 1)**: ModelNode-tree остаётся primary для мутаций (drag/handle/mirror/chamfer/alignment/generator/STL-import). FeatureDocument перестраивается из ModelNode на каждом `rebuildSceneFromTree`. UI: bridge `applyFeaturePatchToNode` маппит patch от schema-форм → ModelNode мутации. Полный flip на FeatureDocument primary — Phase 2 prep.
- **UI**:
  - Левая панель: toggle между legacy `NodeTree.vue` (по ModelNode) и `FeatureTree.vue` (по FeatureDocument).
  - Правая панель: соответственно hand-rolled inputs или schema-driven `FeatureParamsForm.vue` (по `paramsSchema.ts`).
  - Debug-панель `DebugPanel.vue` (FPS/camera/selection/modes/storage/featureDoc/logs/snapshot-download).
  - Тест-чеклист `TestChecklistPanel.vue` (~50 пунктов регресс-чеклиста с persist в localStorage).
- **Сетка и привязка**: `GridMode.setSnapStep(step)` → `_snapStep`; выбор шага в нижней панели `.snap-toolbar`.
- **Gizmo**: `ModificationGizmo` — handles для translate/scale/rotate с raycast-драгом.
- **Режимы**: Mirror, Cruise (прилипание), Alignment, Chamfer (фаска), Generator (резьба/насечки).
- **Стрелки**: перемещение на `snapStep`, **Shift** — `snapStep × 5`, **Ctrl+↑/↓** — по Z.

## Конвенции

- **Русский UI** по умолчанию; все строки в генераторах идут через `$t()`. В `Constructor.vue` строки **захардкожены** (исключение).
- **Формы генераторов разбиты на секции-компоненты** (`src/components/forms/{nametag,coaster}/{Section}.vue`) с переводами.
- **Scoped CSS** в SFC. Для стилизации `<slot>` — `:slotted(...)`.
- **Three.js-объекты** оборачиваются в `markRaw()` при хранении в реактивных структурах.
- **Не создавать** новые `*.md` без просьбы пользователя.
- **Не добавлять комментарии** кроме нетривиальных "почему".
- **GPU**: в `WebGLRenderer` используется `powerPreference: 'high-performance'` (дискретная GPU).

## Экспорт и история скачиваний

- Pinia-стор `useExportList` хранит список экспортов
- Во всех генераторах блок экспорта переведён: `$t('e.downloadHistory')`, `$t('e.downloadAll')`

## Git

- Основная ветка — `master`
- Коммиты на русском (см. `git log`)
