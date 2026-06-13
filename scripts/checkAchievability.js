#!/usr/bin/env node
// ==========================================
// 🧪 checkAchievability.js — проверка, достижимы ли ачивки в принципе
// ==========================================
//
// Игнорирует conditions у выборов, считая все пути открытыми.
// Показывает минимальное теоретическое расстояние от стартовой ноды.
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... USER_ID=23cc3902-... node scripts/checkAchievability.js

import { buildGraph } from '../src/hintEngine.js';
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
  const pageSize = 200;
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

// BFS без учёта conditions — ищем кратчайший путь в графе в принципе
function findPathIgnoringConditions(startNodeId, targetAchievementId, graph, maxDepth = 100) {
  const queue = [{ nodeId: startNodeId, steps: 0, firstChoice: null }];
  const visited = new Set([startNodeId]);

  while (queue.length > 0) {
    const { nodeId, steps, firstChoice } = queue.shift();
    if (steps >= maxDepth) continue;

    const choices = graph.nodeToChoices.get(nodeId) || [];
    for (const choice of choices) {
      const currentFirstChoice = firstChoice || choice;

      if (choice.effects?.unlock_achievement === targetAchievementId) {
        return { reachable: true, steps: steps + 1, firstChoice: currentFirstChoice };
      }

      const targetNodeId = choice.target_node_id;
      if (!targetNodeId) continue;
      if (visited.has(targetNodeId)) continue;
      visited.add(targetNodeId);
      queue.push({ nodeId: targetNodeId, steps: steps + 1, firstChoice: currentFirstChoice });
    }
  }

  return { reachable: false };
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

  const player = stateData[0];
  if (!player) {
    console.error('❌ Игрок не найден');
    process.exit(1);
  }

  const unlockedIds = new Set(uaData.map(r => r.achievement_id));
  const missing = achievements.filter(a => !unlockedIds.has(a.id));
  const choices = await loadAllChoices();
  const graph = buildGraph(nodes, choices);

  console.log(`👤 Игрок: ${USER_ID}`);
  console.log(`🎮 Стартовая нода: ${player.current_node_id}\n`);
  console.log('Проверка достижимости в принципе (игнорируя conditions):\n');

  for (const a of missing.sort((x, y) => {
    const order = { BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 };
    return (order[x.medal_tier.toUpperCase()] || 0) - (order[y.medal_tier.toUpperCase()] || 0);
  })) {
    const res = findPathIgnoringConditions(player.current_node_id, a.id, graph, 200);
    const status = res.reachable ? `✅ ДА, ${res.steps} шагов` : '❌ НЕТ пути в графе';
    console.log(`${a.medal_tier.padEnd(8)} ${a.title.padEnd(30)} (${a.id}) — ${status}`);
    if (res.reachable) {
      console.log(`          Первый выбор: ${res.firstChoice.label || res.firstChoice.id}`);
    }
  }
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
