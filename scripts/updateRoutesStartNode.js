#!/usr/bin/env node
// ==========================================
// updateRoutesStartNode.js
// Перевод маршрутов ачивок с act1_skills на act1_start.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/updateRoutesStartNode.js

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

const START_PREFIX = ['ch_1_start_to_skills', 'trans_choice_ch_1_start_to_skills'];

async function main() {
  console.log('🚀 Перевод маршрутов ачивок на стартовую ноду act1_start');

  console.log('1️⃣ Загрузка старых маршрутов...');
  const res = await supabaseFetch('/achievement_routes?start_node_id=eq.act1_skills&select=*');
  const oldRoutes = await res.json();
  console.log(`   Найдено ${oldRoutes.length} маршрутов`);

  if (oldRoutes.length === 0) {
    console.log('   Нет маршрутов для обновления');
    return;
  }

  console.log('2️⃣ Создание новых маршрутов...');
  const newRoutes = oldRoutes.map(r => ({
    start_node_id: 'act1_start',
    achievement_id: r.achievement_id,
    path: [...START_PREFIX, ...r.path],
    next_choice_id: START_PREFIX[0],
    steps_remaining: r.path.length + START_PREFIX.length,
    reachable: r.reachable ?? true,
  }));

  await supabaseFetch('/achievement_routes', {
    method: 'POST',
    body: JSON.stringify(newRoutes),
  });
  console.log(`   ✅ Создано ${newRoutes.length} новых маршрутов`);

  console.log('3️⃣ Удаление старых маршрутов...');
  await supabaseFetch('/achievement_routes?start_node_id=eq.act1_skills', {
    method: 'DELETE',
  });
  console.log('   ✅ Старые маршруты удалены');

  for (const r of newRoutes) {
    console.log(`   ${r.achievement_id}: start=${r.start_node_id}, next=${r.next_choice_id}, steps=${r.steps_remaining}`);
  }

  console.log('🎉 Готово');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
