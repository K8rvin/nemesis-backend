#!/usr/bin/env node
// ==========================================
// applyFixLoungeTransitions.js
// Переорганизация переходов вокруг Брошенного уюта.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/applyFixLoungeTransitions.js

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
  console.log('🚀 Переорганизация переходов Брошенный уют');

  console.log('1️⃣ ch_2_rec_back теперь ведёт в Свалочный хаб...');
  await supabaseFetch('/choices?id=eq.ch_2_rec_back', {
    method: 'PATCH',
    body: JSON.stringify({
      target_node_id: 'act1_hub',
      label: '↩️ Вернуться в Свалочный хаб',
    }),
  });
  console.log('   ✅ Обновлён ch_2_rec_back');

  console.log('2️⃣ Добавление прямого выхода в Хаб жилого сектора...');
  await supabaseFetch('/choices', {
    method: 'POST',
    body: JSON.stringify({
      id: 'ch_2_rec_to_corridors',
      node_id: 'act2_recreation_room',
      target_node_id: 'act2_corridors',
      label: '🚪 Выйти в общие коридоры кают',
      narrative_override: null,
      conditions: {},
      effects: {},
      sort_order: 1,
    }),
  });
  console.log('   ✅ Добавлен ch_2_rec_to_corridors');

  console.log('3️⃣ Обновление маршрутов ачивок...');
  for (const achId of ['ach_lucky_bastard', 'ach_steel_cocoon']) {
    const res = await supabaseFetch(`/achievement_routes?start_node_id=eq.act1_skills&achievement_id=eq.${achId}&select=path`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`   ⚠️ Маршрут ${achId} не найден`);
      continue;
    }
    const path = data[0].path.map(step => step === 'ch_2_rec_back' ? 'ch_2_rec_to_corridors' : step);
    await supabaseFetch(`/achievement_routes?start_node_id=eq.act1_skills&achievement_id=eq.${achId}`, {
      method: 'PATCH',
      body: JSON.stringify({ path }),
    });
    console.log(`   ✅ Обновлён маршрут ${achId}`);
  }

  console.log('🎉 Готово');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
