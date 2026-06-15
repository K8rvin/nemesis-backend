#!/usr/bin/env node
// ==========================================
// applyMergeAltProtocols.js
// Применение изменений по удалению ноды "Альтернативные протоколы"
// через Supabase REST API.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/applyMergeAltProtocols.js
//
// Переменные берутся из .dev.vars (через dotenv) или окружения.

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
  console.log('🚀 Применение изменений: Альтернативные протоколы -> Протоколы судьбы активированы');

  // 1. Перенос выборов
  console.log('1️⃣ Перенос выборов из act5_terminal_alt в act5_terminal_final...');
  await supabaseFetch('/choices?id=in.%28ch_5_b_ending_4%2Cch_5_b_ending_5%2Cch_5_b_ending_8%29', {
    method: 'PATCH',
    body: JSON.stringify({ node_id: 'act5_terminal_final' }),
  });
  console.log('   ✅ Перенесены ch_5_b_ending_4, ch_5_b_ending_5, ch_5_b_ending_8');

  // 2. Удаление выборов
  console.log('2️⃣ Удаление лишних выборов...');
  await supabaseFetch('/choices?id=in.%28ch_5_alt_back%2Cch_5_terminal_to_alt%2Ctrans_choice_ch_5_terminal_to_alt%29', {
    method: 'DELETE',
  });
  console.log('   ✅ Удалены ch_5_alt_back, ch_5_terminal_to_alt, trans_choice_ch_5_terminal_to_alt');

  // 3. Удаление нод
  console.log('3️⃣ Удаление нод act5_terminal_alt и trans_ch_5_terminal_to_alt...');
  await supabaseFetch('/nodes?id=in.%28act5_terminal_alt%2Ctrans_ch_5_terminal_to_alt%29', {
    method: 'DELETE',
  });
  console.log('   ✅ Ноды удалены');

  // 4. Обновление маршрута ach_lucky_bastard
  console.log('4️⃣ Обновление маршрута ach_lucky_bastard...');
  const newPath = [
    "ch_1_skill_luck", "trans_choice_ch_1_skill_luck",
    "ch_1_hub_to_lounge", "trans_choice_ch_1_hub_to_lounge",
    "ch_2_rec_back",
    "ch_2_corridors_to_rooms", "trans_choice_ch_2_corridors_to_rooms",
    "ch_2_hub_to_secret", "trans_choice_ch_2_hub_to_secret",
    "ch_2_secret_take_cutter", "trans_choice_ch_2_secret_take_cutter",
    "ch_2_secret_take_pda", "trans_choice_ch_2_secret_take_pda",
    "ch_2_secret_office_back",
    "ch_2_rooms_back",
    "ch_2_hub_to_hydro", "trans_choice_ch_2_hub_to_hydro",
    "ch_2_hydro_to_bypass",
    "ch_2_bypass_to_bridge", "trans_choice_ch_2_bypass_to_bridge",
    "ch_5_start_next", "trans_choice_ch_5_start_next",
    "ch_5_showdown_hack", "trans_choice_ch_5_showdown_hack",
    "ch_5_b_ending_5", "trans_choice_ch_5_b_ending_5"
  ];
  await supabaseFetch('/achievement_routes?start_node_id=eq.act1_skills&achievement_id=eq.ach_lucky_bastard', {
    method: 'PATCH',
    body: JSON.stringify({
      path: newPath,
      steps_remaining: newPath.length,
    }),
  });
  console.log('   ✅ Маршрут ach_lucky_bastard обновлён');

  console.log('🎉 Все изменения применены');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
