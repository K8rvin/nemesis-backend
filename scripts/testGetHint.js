#!/usr/bin/env node
// ==========================================
// 🧪 testGetHint.js — локальный тест getHint
// ==========================================
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... USER_ID=23cc3902-... node scripts/testGetHint.js

import { getHint } from '../src/hintEngine.js';
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
  // .env отсутствует
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.USER_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !USER_ID) {
  console.error('❌ Необходимы SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и USER_ID');
  process.exit(1);
}

const httpsAgent = new https.Agent({ keepAlive: false });

async function supabaseFetch(env, path, options = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    agent: httpsAgent,
    ...options,
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

async function getPlayerState(env, userId) {
  const res = await supabaseFetch(env, `/game_state?user_id=eq.${userId}`);
  const data = await res.json();
  return data[0];
}

async function main() {
  const env = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log('Testing getHint with cached routes...\n');

  const tests = [
    { target_tier: 'ANY' },
    { target_tier: 'GOLD' },
    { target_tier: 'PLATINUM' },
    { target_achievement_id: 'ach_time_paradox' },
  ];

  for (const body of tests) {
    console.log(`\n[test] ${JSON.stringify(body)}`);
    const start = Date.now();
    const result = await getHint(env, USER_ID, body.target_tier, undefined, body.target_achievement_id, {
      getPlayerState,
      supabaseFetch,
    });
    console.log(`Request: ${JSON.stringify(body)}`);
    console.log(`  Duration: ${Date.now() - start}ms`);
    console.log(`  Reachable: ${result.reachable}`);
    console.log(`  Reason: ${result.reason || '-'}`);
    console.log(`  Target: ${result.target_achievement?.title || result.target_achievement?.id || '-'}`);
    console.log(`  Next choice: ${result.next_choice?.label || result.next_choice?.id || '-'}`);
    console.log(`  Steps: ${result.steps_remaining || '-'}`);
    console.log(`  Source: ${result.source || 'runtime'}\n`);
  }
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
