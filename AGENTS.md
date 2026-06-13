# AGENTS.md — nemesis-backend

## Обзор

Бэкенд развёрнут на **Cloudflare Workers**, фреймворк **Hono**, код — plain JavaScript ESM.

- Точка входа: `src/index.js`.
- Hint engine вынесен в `src/hintEngine.js`.
- База данных — **только Supabase** (локальный PostgreSQL-режим удалён).

## Команды

```bash
cd nemesis-backend
npm install
npm run dev      # локально через wrangler, порт 8787
npm run deploy   # деплой в Cloudflare Workers
```

## Hint system

- Эндпоинт: `POST /api/hint`.
- Алгоритм:
  1. Сначала пытается найти прямой путь методом `findPath` (forward BFS с учётом условий и эффектов).
  2. Если прямой путь не найден, использует `findReversePath` — обратный BFS, игнорирующий условия. Результат помечается флагом `theoretical: true`.
  3. Предрасчитанные маршруты хранятся в таблице `hint_routes`.

## Скрипты

- `scripts/computeHintRoutes.js` — предрасчёт `hint_routes`.
  - Глобальный режим: `node scripts/computeHintRoutes.js` (все ноды × все ачивки).
  - Персональный режим: `USER_ID=... node scripts/computeHintRoutes.js`.
  - Сухой прогон: `DRY_RUN=1 ... node scripts/computeHintRoutes.js`.
- `scripts/testHintEngineLocal.js` — локальный unit-тест hint engine без БД.
- `scripts/checkAchievability.js` — быстрая проверка теоретической достижимости ачивок.
- `scripts/testHintForUser.js` — forward BFS для конкретного пользователя.
- `scripts/testGetHint.js` — end-to-end тест `/api/hint`.

## Миграции

Файлы миграций лежат в `migrations/` и применяются вручную через SQL Editor Supabase:

- `migrations/001_create_hint_routes.sql` — создание таблицы `hint_routes`.
- `migrations/002_hint_routes_add_forward.sql` — добавление колонок `forward_reachable`, `forward_reason`, `is_theoretical`.
