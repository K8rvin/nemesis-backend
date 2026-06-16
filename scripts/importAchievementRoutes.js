#!/usr/bin/env node
// ==========================================
// 📥 importAchievementRoutes.js — загрузка готовых маршрутов в БД
// ==========================================
//
// Формат входного JSON:
// [
//   {
//     "start_node_id": "act1_skills",
//     "achievement_id": "ach_lucky_bastard",
//     "path": ["ch_1_skill_luck", "trans_choice_ch_1_skill_luck", "..."]
//   }
// ]
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ROUTES_FILE=./achievement_routes.json node scripts/importAchievementRoutes.js

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import fetch from 'node-fetch';
import https from 'https';

const envPath = resolve(process.cwd(), '.env');
try {
  readFileSync(envPath);
  config({ path: envPath });
} catch {
  // .env отсутствует, используем переменные окружения
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROUTES_FILE = process.env.ROUTES_FILE || resolve(process.cwd(), 'achievement_routes.json');
const START_NODE_ID = process.env.START_NODE_ID || 'act1_start';
const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 300;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Необходимы переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const httpsAgent = new https.Agent({ keepAlive: false });

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    agent: httpsAgent,
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status} on ${path}: ${text}`);
  }

  return res;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeRoute(raw) {
  const startNodeId = raw.start_node_id || START_NODE_ID;
  const achievementId = raw.achievement_id;
  const path = Array.isArray(raw.path) ? raw.path : [];

  if (!achievementId) {
    throw new Error('Отсутствует achievement_id в маршруте');
  }
  if (path.length === 0) {
    throw new Error(`Пустой путь для ачивки ${achievementId}`);
  }

  return {
    start_node_id: startNodeId,
    achievement_id: achievementId,
    path,
    next_choice_id: path[0],
    steps_remaining: path.length,
    reachable: true,
  };
}

async function clearOldRoutes(startNodeId) {
  await supabaseFetch(`/achievement_routes?start_node_id=eq.${startNodeId}`, { method: 'DELETE' });
  console.log(`🗑️  Очищены старые маршруты для стартовой ноды ${startNodeId}`);
}

async function upsertRoutes(routes) {
  for (let i = 0; i < routes.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);

    const batch = routes.slice(i, i + BATCH_SIZE);
    const maxRetries = 3;
    let lastErr = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await supabaseFetch('/achievement_routes', {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(batch),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to upsert batch: ${text}`);
        }

        console.log(`✅ Загружено ${Math.min(i + BATCH_SIZE, routes.length)} / ${routes.length} маршрутов`);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`⚠️ Batch ${i / BATCH_SIZE + 1} attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) await sleep(1000 * attempt);
      }
    }

    if (lastErr) throw lastErr;
  }
}

async function main() {
  const startTime = Date.now();

  console.log(`📂 Чтение маршрутов из ${ROUTES_FILE}`);
  const raw = JSON.parse(readFileSync(ROUTES_FILE, 'utf-8'));
  if (!Array.isArray(raw)) {
    throw new Error('Файл маршрутов должен содержать JSON-массив');
  }

  const routes = raw.map(normalizeRoute);
  console.log(`🗺️  Найдено маршрутов: ${routes.length}`);

  if (DRY_RUN) {
    console.log('🌵 DRY_RUN: старые маршруты не очищаются, в БД не пишем');
  } else {
    const startNodeIds = [...new Set(routes.map(r => r.start_node_id))];
    for (const startNodeId of startNodeIds) {
      await clearOldRoutes(startNodeId);
    }

    console.log('💾 Загрузка маршрутов в БД...');
    await upsertRoutes(routes);
  }

  console.log(`🎉 Готово за ${((Date.now() - startTime) / 1000).toFixed(1)}с`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
