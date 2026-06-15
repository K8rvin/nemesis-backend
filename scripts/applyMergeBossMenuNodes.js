#!/usr/bin/env node
// ==========================================
// applyMergeBossMenuNodes.js
// Удаление переходных нод "Меню боя" и "Отступление от боя"
// через Supabase REST API.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/applyMergeBossMenuNodes.js

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
  console.log('🚀 Удаление переходных нод: Меню боя и Отступление от боя');

  console.log('1️⃣ Обновление целевых нод выборов...');
  await supabaseFetch("/choices?id=eq.ch_3_boss_to_combat", {
    method: 'PATCH',
    body: JSON.stringify({ target_node_id: 'act3_boss_combat' }),
  });
  await supabaseFetch("/choices?id=eq.ch_3_combat_back", {
    method: 'PATCH',
    body: JSON.stringify({ target_node_id: 'act3_boss_pat' }),
  });
  console.log('   ✅ ch_3_boss_to_combat -> act3_boss_combat');
  console.log('   ✅ ch_3_combat_back -> act3_boss_pat');

  console.log('2️⃣ Удаление переходных выборов...');
  await supabaseFetch('/choices?id=in.%28trans_choice_ch_3_boss_to_combat%2Ctrans_choice_ch_3_combat_back%29', {
    method: 'DELETE',
  });
  console.log('   ✅ Удалены trans_choice_ch_3_boss_to_combat, trans_choice_ch_3_combat_back');

  console.log('3️⃣ Удаление переходных нод...');
  await supabaseFetch('/nodes?id=in.%28trans_ch_3_boss_to_combat%2Ctrans_ch_3_combat_back%29', {
    method: 'DELETE',
  });
  console.log('   ✅ Ноды trans_ch_3_boss_to_combat и trans_ch_3_combat_back удалены');

  console.log('🎉 Готово');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
