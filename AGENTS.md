# AGENTS.md — nemesis-backend

## Обзор

Бэкенд развёрнут на **Cloudflare Workers**, фреймворк **Hono**, код — plain JavaScript ESM.

- Точка входа: `src/index.js`.
- Подсказчик к ачивкам вынесен в `src/achievementRoutes.js`.
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
- Бэкенд **не обходит граф** в runtime. Маршруты хранятся в таблице `achievement_routes` и предоставляются извне.
- Алгоритм:
  1. Загружает готовые маршруты для стартовой ноды (`act1_skills`) из `achievement_routes`.
  2. Фильтрует неразблокированные ачивки по тиру (или по конкретной цели).
  3. Выбирает маршрут с минимальным `steps_remaining`.
  4. Находит текущую позицию игрока в `path` и возвращает ближайший шаг как `next_choice`.
  5. Если игрок сошёл с маршрута — возвращает `reachable: false, reason: 'off_route'`.

## Скрипты

- `scripts/importAchievementRoutes.js` — загрузка готовых маршрутов в `achievement_routes`.
  - `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ROUTES_FILE=./achievement_routes.json node scripts/importAchievementRoutes.js`
  - Входной файл — JSON-массив объектов `{ start_node_id, achievement_id, path: [choice_id, ...] }`.
- `scripts/computeHintRoutes.js` — устаревший скрипт предрасчёта `hint_routes`. Больше не используется основным приложением.
- `scripts/testHintEngineLocal.js`, `scripts/checkAchievability.js`, `scripts/testHintForUser.js`, `scripts/testGetHint.js` — устаревшие тестовые скрипты, зависящие от `src/hintEngine.js`.

## Миграции

Файлы миграций лежат в `migrations/` и применяются вручную через SQL Editor Supabase:

- `migrations/001_create_hint_routes.sql` — создание устаревшей таблицы `hint_routes`.
- `migrations/002_hint_routes_add_forward.sql` — добавление колонок к `hint_routes`.
- `migrations/003_create_achievement_routes.sql` — создание таблицы `achievement_routes` для хранения готовых маршрутов от стартовой ноды к ачивкам.
