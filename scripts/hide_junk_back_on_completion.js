#!/usr/bin/env node
// ==========================================
// hide_junk_back_on_completion.js
// Скрыть выход "Отойти от завалов", когда на Завалах собраны все предметы.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/hide_junk_back_on_completion.js

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
  console.log('🔧 Скрываем выход "Отойти от завалов" при полном сборе');

  await supabaseFetch('/choices?id=eq.ch_1_junk_back', {
    method: 'PATCH',
    body: JSON.stringify({
      conditions: {
        flags_not_required_all: [
          'нашел_магнитометр',
          'нашел_лом',
          'взял_сервопривод',
          'visited_lore_pad',
        ],
      },
    }),
  });

  console.log('   ✅ Условие добавлено к ch_1_junk_back');
  console.log('🎉 Готово');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
