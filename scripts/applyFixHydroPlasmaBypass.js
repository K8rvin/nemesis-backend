#!/usr/bin/env node
// ==========================================
// applyFixHydroPlasmaBypass.js
// Логика использования Тяжелого плазмореза в Плотоядном саду.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/applyFixHydroPlasmaBypass.js

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
  console.log('🚀 Исправление логики плазмореза в Плотоядном саду');

  console.log('1️⃣ Обновление ch_2_hydro_to_bypass...');
  await supabaseFetch('/choices?id=eq.ch_2_hydro_to_bypass', {
    method: 'PATCH',
    body: JSON.stringify({
      conditions: {
        item_required: 'Тяжелый Плазморез',
        flag_not_required: 'hydro_plasma_used',
      },
      effects: {
        add_flag: 'hydro_plasma_used',
      },
    }),
  });
  console.log('   ✅ Теперь ставит флаг hydro_plasma_used и скрывается после использования');

  console.log('2️⃣ Добавление выбора для прохода через открытый люк...');
  await supabaseFetch('/choices', {
    method: 'POST',
    body: JSON.stringify({
      id: 'ch_2_hydro_bypass_open',
      node_id: 'act2_hydroponics',
      target_node_id: 'act2_bypass_tunnel',
      label: '🚪 Пройти через открытый грузовой люк',
      narrative_override: null,
      conditions: {
        flag_required: 'hydro_plasma_used',
      },
      effects: {},
      sort_order: 4,
    }),
  });
  console.log('   ✅ Добавлен ch_2_hydro_bypass_open');

  console.log('🎉 Готово');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
