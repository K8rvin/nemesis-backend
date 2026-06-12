# Деплой бэкенда в Cloudflare Workers

Эта инструкция описывает, как задеплоить `nemesis-backend` в облако через **Cloudflare Workers** и **wrangler**, используя **Supabase** для данных и **Cloudflare R2** для изображений.

---

## Что понадобится

- Аккаунт Cloudflare (бесплатный подходит).
- Проект Supabase с уже созданными таблицами (`nodes`, `choices`, `game_state`, `achievements`, `user_achievements`).
- Node.js версии 18+.
- Установленный Flutter-клиент (для обновления `backendUrl`).

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

## 3. Создание R2-бакета для изображений

Изображения нод и достижений хранятся в Cloudflare R2. Создай бакет с именем, указанным в `wrangler.toml`:

```bash
wrangler r2 bucket create nemesis-images
```

Проверь, что бакет появился:

```bash
wrangler r2 bucket list
```

### 3.1. Загрузи изображения

Структура в бакете должна повторять старую папку `uploads/`:

```
nodes/{nodeId}.png
achievements/{achId}.png
```

Загрузить можно через Cloudflare Dashboard (R2 → bucket → Upload) или через CLI:

```bash
# Пример загрузки одного файла
wrangler r2 object put nemesis-images/nodes/node-001.png --file uploads/nodes/node-001.png

# Массовая загрузка через rclone или аналогичный инструмент
```

Если изображений много, удобнее использовать `rclone`:

```bash
rclone sync uploads/ :s3:nemesis-images \
  --s3-provider=Cloudflare \
  --s3-endpoint=https://<account-id>.r2.cloudflarestorage.com \
  --s3-access-key-id=... \
  --s3-secret-access-key=...
```

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

### 7.4. Изображение

```bash
curl https://nemesis-backend.your-account.workers.dev/api/image/node-001.png
```

Должен вернуться PNG-файл.

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

### `No such bucket`

Убедись, что бакет `nemesis-images` создан и имя совпадает с `bucket_name` в `wrangler.toml`.

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
- **Изображения:** Cloudflare R2.
- **Деплой:** Cloudflare Workers через `wrangler deploy`.
- **Локальный запуск:** `wrangler dev`.

Старый LOCAL-режим PostgreSQL удалён.

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

