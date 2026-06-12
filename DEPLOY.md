# Деплой бэкенда в Cloudflare Workers

Эта инструкция описывает, как задеплоить `nemesis-backend` в облако через **Cloudflare Workers** и **wrangler**, используя **Supabase** для данных. Изображения хранятся локально в **Flutter assets** и не требуют внешнего хранилища.

---

## Что понадобится

- Аккаунт Cloudflare (бесплатный подходит).
- Проект Supabase с уже созданными таблицами (`nodes`, `choices`, `game_state`, `achievements`, `user_achievements`).
- Node.js версии 18+.
- Установленный Flutter-клиент.
- Изображения нод и достижений должны лежать в `nemesis-flutter/assets/images/nodes/` и `nemesis-flutter/assets/images/achievements/`.

---

## 1. Подготовка окружения

### 1.1. Установи зависимости

```bash
cd nemesis-backend
npm install
```

### 1.2. Установи Wrangler глобально

```bash
npm install -g wrangler
```

### 1.3. Авторизуйся в Cloudflare

```bash
wrangler login
```

Откроется браузер — подтверди вход. После этого `wrangler` получит права на деплой.

---

## 2. Настройка секретов

### 2.1. Локальная разработка

Скопируй пример и заполни реальными значениями:

```bash
cp .dev.vars.example .dev.vars
```

Отредактируй `.dev.vars`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> **Важно:** файл `.dev.vars` уже добавлен в `.gitignore` и не должен попадать в git.

### 2.2. Продакшн-секреты

Загрузи те же значения в Cloudflare:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

На запрос введи значения. Они будут зашифрованы и привязаны к Worker.

---

## 3. Подготовка изображений для Flutter

Все изображения теперь встроены в клиент. Они должны лежать в:

```
nemesis-flutter/assets/images/nodes/{nodeId}.png
nemesis-flutter/assets/images/achievements/{achId}.png
```

### 3.1. Скопируй изображения из `uploads/`

```bash
cd nemesis-flutter
mkdir -p assets/images/nodes assets/images/achievements
cp ../nemesis-backend/uploads/nodes/*.png assets/images/nodes/
cp ../nemesis-backend/uploads/achievements/*.png assets/images/achievements/
```

### 3.2. Зарегистрируй assets в `pubspec.yaml`

```yaml
flutter:
  assets:
    - assets/images/nodes/
    - assets/images/achievements/
```

### 3.3. Сожми изображения перед релизом

Для production рекомендуется сжать PNG до 100–300 КБ каждый, чтобы уменьшить размер APK.

---

## 4. Локальный запуск

Запусти Worker локально:

```bash
npm run dev
# или
wrangler dev
```

По умолчанию `wrangler dev` поднимет локальный сервер на `http://localhost:8787`.

Проверь эндпоинты:

```bash
curl http://localhost:8787/
```

Должен вернуться JSON:

```json
{ "status": "🚀 Engine Running", "platform": "Cloudflare Workers" }
```

---

## 5. Деплой в облако

```bash
npm run deploy
# или
wrangler deploy
```

После успешного деплоя `wrangler` выведет URL вида:

```
https://nemesis-backend.your-account.workers.dev
```

Этот URL и нужно будет прописать в Flutter-клиенте.

---

## 6. Обновление Flutter-клиента

Открой `nemesis-flutter/lib/main.dart` и замени захардкоженный URL:

```dart
// Было:
const String backendUrl = "http://192.168.1.143:3000";

// Стало:
const String backendUrl = "https://nemesis-backend.your-account.workers.dev";
```

Собери и запусти приложение:

```bash
cd nemesis-flutter
flutter pub get
flutter run
```

---

## 7. Проверка после деплоя

### 7.1. Health-check

```bash
curl https://nemesis-backend.your-account.workers.dev/
```

### 7.2. Регистрация / вход

```bash
curl -X POST https://nemesis-backend.your-account.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 7.3. Получение состояния

Используй токен из ответа регистрации:

```bash
curl https://nemesis-backend.your-account.workers.dev/api/state \
  -H "Authorization: Bearer <access_token>"
```

### 7.4. Локальные изображения

Изображения теперь загружаются из `assets/images/` внутри Flutter-приложения. Убедись, что файлы лежат в:
```
assets/images/nodes/node-001.png
assets/images/achievements/ach-001.png
```

---

## 8. Полезные команды

```bash
# Локальный запуск
npm run dev

# Деплой
npm run deploy

# Просмотр логов в реальном времени
wrangler tail

# Управление секретами
wrangler secret put SUPABASE_URL
wrangler secret delete SUPABASE_URL

# Управление R2
wrangler r2 bucket list
wrangler r2 object put nemesis-images/nodes/foo.png --file ./foo.png
wrangler r2 object get nemesis-images/nodes/foo.png --file ./foo-downloaded.png
```

---

## 9. Возможные проблемы

### Картинка не отображается в приложении

1. Проверь, что файл есть в `assets/images/nodes/` или `assets/images/achievements/`.
2. Проверь, что имя файла совпадает с `node.id` или `ach.id` из базы (без учёта `.png`).
3. Убедись, что папка зарегистрирована в `pubspec.yaml`.
4. Запусти `flutter clean && flutter pub get`.
5. Проверь консоль Flutter на ошибки `Unable to load asset`.

### `SUPABASE_URL is not defined`

Локально: проверь `.dev.vars`. В продакшене: проверь секреты через `wrangler secret list`.

### CORS-ошибки во Flutter

CORS в коде настроен через `hono/cors` с `origin: '*'`. Если появятся проблемы, проверь, что preflight-запрос `OPTIONS` проходит.

### `fetch is not defined`

Убедись, что `compatibility_date` в `wrangler.toml` не старше 2022 года. `fetch` доступен глобально в Workers.

---

## 10. Архитектура после миграции

- **Роутер:** Hono (вместо Express).
- **База данных:** Supabase (единственный режим).
- **Авторизация:** Supabase Auth API.
- **Изображения:** локальные assets в Flutter (`assets/images/`).
- **Деплой:** Cloudflare Workers через `wrangler deploy` (локально) или GitHub Actions.
- **Локальный запуск:** `wrangler dev`.

Старый LOCAL-режим PostgreSQL и интеграция с Cloudflare R2 удалены.

---

## 11. Деплой через GitHub Actions (если локальный wrangler не работает)

Если `wrangler deploy` падает с сетевыми ошибками (`ECONNRESET`, `fetch failed`) на твоём компьютере, используй GitHub Actions. Деплой будет выполняться с серверов GitHub, что обходит локальные блокировки и проблемы провайдера.

### 11.1. Подготовка

Убедись, что код запушен в репозиторий на GitHub:
```bash
git add .
git commit -m "Prepare Cloudflare Workers deploy"
git push origin master
```

### 11.2. Создай API Token в Cloudflare

1. Открой https://dash.cloudflare.com/profile/api-tokens
2. Нажми **Create Token**.
3. Выбери шаблон **"Edit Cloudflare Workers"**.
4. В **Account Resources** выбери свой аккаунт.
5. В **Zone Resources** выбери **All zones** (или оставь None, если зоны не используются).
6. Создай токен и скопируй его.

### 11.3. Добавь токен в секреты GitHub

1. Открой репозиторий на GitHub.
2. Перейди в **Settings** → **Secrets and variables** → **Actions**.
3. Нажми **New repository secret**.
4. Имя: `CLOUDFLARE_API_TOKEN`
5. Значение: скопированный токен.
6. Сохрани.

### 11.4. Установи секреты Supabase в Cloudflare Dashboard

1. Открой https://dash.cloudflare.com
2. Перейди в **Workers & Pages** → выбери `nemesis-backend`.
3. Вкладка **Settings** → **Variables and Secrets**.
4. Добавь секреты:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 11.5. Workflow уже добавлен

Файл `.github/workflows/deploy.yml` уже создан в репозитории. Он запускается автоматически при каждом push в `master`.

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - master

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

### 11.6. Запусти деплой

После того как `CLOUDFLARE_API_TOKEN` добавлен и секреты Supabase установлены в Cloudflare, запушь любое изменение в `master`:

```bash
git push origin master
```

Или запусти workflow вручную:
1. Открой репозиторий на GitHub.
2. Перейди во вкладку **Actions**.
3. Выбери workflow **"Deploy to Cloudflare Workers"**.
4. Нажми **Run workflow** → **Run workflow**.

### 11.7. Проверь результат

1. Открой вкладку **Actions** в репозитории.
2. Найди запущенный workflow.
3. Если он зелёный — деплой успешен.
4. URL Worker'а будет в логах или в Cloudflare Dashboard (**Workers & Pages** → `nemesis-backend`).

