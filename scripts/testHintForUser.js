#!/usr/bin/env node
// ==========================================
// 🧪 testHintForUser.js — тестовый поиск пути для конкретного игрока
// ==========================================
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... USER_ID=23cc3902-... node scripts/testHintForUser.js

import { buildGraph, findPath } from '../src/hintEngine.js';
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

const httpsAgent = new https.Agent({ keepAlive: false });

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !USER_ID) {
  console.error('❌ Необходимы SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и USER_ID');
  process.exit(1);
}

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
    throw new Error(`Supabase ${res.status} on ${path}: ${await res.text()}`);
  }
  return res;
}

async function loadAllChoices() {
  const all = [];
  const pageSize = 100;
  let offset = 0;
  while (true) {
    const res = await supabaseFetch(`/choices?select=*&limit=${pageSize}&offset=${offset}`);
    const page = await res.json();
    if (page.length === 0) break;
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function main() {
  const [nodesRes, achievementsRes, stateRes, uaRes] = await Promise.all([
    supabaseFetch('/nodes?select=id,ending_type'),
    supabaseFetch('/achievements?select=id,title,medal_tier'),
    supabaseFetch(`/game_state?user_id=eq.${USER_ID}&select=*`),
    supabaseFetch(`/user_achievements?user_id=eq.${USER_ID}&select=achievement_id`),
  ]);

  const [nodes, achievements, stateData, uaData] = await Promise.all([
    nodesRes.json(),
    achievementsRes.json(),
    stateRes.json(),
    uaRes.json(),
  ]);

  const choices = await loadAllChoices();

  const player = stateData[0];
  if (!player) {
    console.error('❌ Игрок не найден');
    process.exit(1);
  }

  const unlockedIds = new Set(uaData.map(r => r.achievement_id));
  const missing = achievements.filter(a => !unlockedIds.has(a.id));

  const graph = buildGraph(nodes, choices);

  console.log(`👤 Игрок: ${USER_ID}`);
  console.log(`🎮 Нода: ${player.current_node_id}`);
  console.log(`🏅 Неполученных ачивок: ${missing.length}\n`);

  const LIMITS = [
    { maxDepth: 15, maxVisited: 12000, name: 'PLATINUM default' },
    { maxDepth: 25, maxVisited: 40000, name: 'GOLD default' },
    { maxDepth: 50, maxVisited: 200000, name: 'heavy' },
  ];

  for (const achievement of missing) {
    console.log(`--- ${achievement.medal_tier}: ${achievement.title} (${achievement.id}) ---`);
    for (const lim of LIMITS) {
      const start = Date.now();
      const result = findPath(player.current_node_id, player, achievement.id, graph, lim.maxDepth, lim.maxVisited);
      const duration = Date.now() - start;
      console.log(`  [${lim.name}] reachable=${result.reachable} reason=${result.reason} steps=${result.stepsRemaining} next=${result.nextChoice?.id || '-'} time=${duration}ms`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
