#!/usr/bin/env node
// ==========================================
// 💡 computeHintRoutes.js — предрасчёт маршрутов для hint engine
// ==========================================
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/computeHintRoutes.js
//
// Для персонального предрасчёта одного игрока:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... USER_ID=23cc3902-... node scripts/computeHintRoutes.js

import { buildGraph, findPath } from '../src/hintEngine.js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import fetch from 'node-fetch';
import https from 'https';

// Подгружаем .env, если он есть рядом
const envPath = resolve(process.cwd(), '.env');
try {
  readFileSync(envPath);
  config({ path: envPath });
} catch {
  // .env отсутствует, используем переменные окружения
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.USER_ID || null;

// Отключаем keep-alive, иначе Supabase рвет соединение при серии запросов
const httpsAgent = new https.Agent({ keepAlive: false });

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Необходимы переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const BATCH_SIZE = 500;
const MAX_DEPTH = 50;
const MAX_VISITED = 200_000;

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

async function loadData() {
  const [nodesRes, achievementsRes] = await Promise.all([
    supabaseFetch('/nodes?select=id,ending_type'),
    supabaseFetch('/achievements?select=id'),
  ]);

  const [nodes, achievements] = await Promise.all([
    nodesRes.json(),
    achievementsRes.json(),
  ]);

  const choices = await loadAllChoices();

  return { graph: buildGraph(nodes, choices), nodes, achievements };
}

async function loadPlayerState(userId) {
  const res = await supabaseFetch(`/game_state?user_id=eq.${userId}&select=*`);
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`Player state not found for ${userId}`);
  }
  return data[0];
}

async function clearHintRoutes(nodeIds) {
  if (nodeIds && nodeIds.length > 0) {
    // Удаляем только записи для указанных нод (персональный режим — одна нода)
    const ids = nodeIds.join(',');
    await supabaseFetch(`/hint_routes?node_id=in.(${ids})`, { method: 'DELETE' });
    console.log(`🗑️  Очищены старые маршруты для ${nodeIds.length} нод(ы)`);
  } else {
    // Полная пересборка
    await supabaseFetch('/hint_routes', { method: 'DELETE' });
    console.log('🗑️  Очищены все старые маршруты');
  }
}

function computeRoutes({ graph, nodes, achievements }, player) {
  const routes = [];
  const playerState = {
    hp: player.hp ?? 100,
    story_flags: player.story_flags || [],
    inventory: player.inventory || [],
    skills: player.skills || [],
  };

  for (const node of nodes) {
    for (const achievement of achievements) {
      const result = findPath(node.id, playerState, achievement.id, graph, MAX_DEPTH, MAX_VISITED);
      routes.push({
        node_id: node.id,
        achievement_id: achievement.id,
        next_choice_id: result.nextChoice?.id || null,
        steps_remaining: result.stepsRemaining,
        reachable: result.reachable,
        reason: result.reason || null,
      });
    }
  }

  return routes;
}

async function upsertRoutes(routes) {
  for (let i = 0; i < routes.length; i += BATCH_SIZE) {
    const batch = routes.slice(i, i + BATCH_SIZE);
    const res = await supabaseFetch('/hint_routes', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to upsert batch: ${text}`);
    }

    console.log(`✅ Загружено ${Math.min(i + BATCH_SIZE, routes.length)} / ${routes.length} маршрутов`);
  }
}

async function main() {
  const startTime = Date.now();

  console.log('🔌 Загрузка графа и ачивок...');
  const data = await loadData();
  const { nodes, achievements } = data;
  console.log(`📊 Нод: ${nodes.length}, выборов: ${data.graph.nodeToChoices.size}, ачивок: ${achievements.length}`);

  let player;
  let nodeIdsToClear = null;

  if (USER_ID) {
    console.log(`👤 Персональный режим для ${USER_ID}`);
    player = await loadPlayerState(USER_ID);
    nodeIdsToClear = [player.current_node_id];
    console.log(`🎮 Стартовая нода: ${player.current_node_id}`);
  } else {
    console.log('🌐 Глобальный режим: пустое начальное состояние');
    player = { hp: 100, story_flags: [], inventory: [], skills: [] };
  }

  await clearHintRoutes(nodeIdsToClear);

  console.log('🔎 Предрасчёт маршрутов...');
  const routes = computeRoutes(data, player);

  const reachableCount = routes.filter(r => r.reachable).length;
  const lockedCount = routes.filter(r => r.reason === 'choice_locked').length;
  console.log(`📈 Reachable: ${reachableCount}, choice_locked: ${lockedCount}, no_path: ${routes.length - reachableCount - lockedCount}`);

  console.log('💾 Сохранение в БД...');
  await upsertRoutes(routes);

  console.log(`🎉 Готово за ${((Date.now() - startTime) / 1000).toFixed(1)}с`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
