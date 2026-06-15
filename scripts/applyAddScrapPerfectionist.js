#!/usr/bin/env node
// ==========================================
// applyAddScrapPerfectionist.js
// Добавление ачивки "Хламовый перфекционист" и выбора для её получения.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/applyAddScrapPerfectionist.js

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import fetch from 'node-fetch';
import https from 'https';

const envPath = resolve(process.cwd(), '.dev.vars');
try {
  readFileSync(envPath);
  config({ path: envPath });
} catch {
  // .dev.vars отсутствует, используем переменные окружения
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function main() {
  console.log('🚀 Добавление ачивки Хламовый перфекционист');

  console.log('1️⃣ Добавление ачивки в таблицу achievements...');
  await supabaseFetch('/achievements', {
    method: 'POST',
    body: JSON.stringify({
      id: 'ach_scrap_perfectionist',
      title: 'Хламовый перфекционист',
      description: 'Ничего не упустить на Завалах металлолома: три предмета и планшет — в кармане.',
      medal_tier: 'BRONZE',
      icon_url: null,
    }),
  });
  console.log('   ✅ Ачивка добавлена');

  console.log('2️⃣ Добавление выбора для получения ачивки...');
  await supabaseFetch('/choices', {
    method: 'POST',
    body: JSON.stringify({
      id: 'ch_1_junk_complete',
      node_id: 'act1_hub_junk',
      target_node_id: 'act1_hub_explore',
      label: '🏆 Завалы исследованы до дна',
      narrative_override: null,
      conditions: {
        flag_required: ['нашел_магнитометр', 'нашел_лом', 'взял_сервопривод', 'visited_lore_pad'],
      },
      effects: {
        unlock_achievement: 'ach_scrap_perfectionist',
      },
      sort_order: 0,
    }),
  });
  console.log('   ✅ Выбор добавлен');

  console.log('🎉 Готово');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
