#!/usr/bin/env node
// ==========================================
// 💡 computeHintRoutes.js — предрасчёт маршрутов для hint engine
// ==========================================
//
// Использует ОБРАТНЫЙ поиск (findReversePath) для быстрого построения
// теоретических маршрутов от каждой ноды до каждой ачивки.
// Обратный поиск игнорирует условия выборов, поэтому все найденные
// маршруты помечаются как is_theoretical.
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/computeHintRoutes.js
//
// Для персонального предрасчёта одного игрока:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... USER_ID=23cc3902-... node scripts/computeHintRoutes.js
//
// Сухой прогон (без записи в БД):
//   DRY_RUN=1 ... node scripts/computeHintRoutes.js

import { buildGraph, findReversePath } from '../src/hintEngine.js';
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
const DRY_RUN = process.env.DRY_RUN === '1';

// Отключаем keep-alive, иначе Supabase рвет соединение при серии запросов
const httpsAgent = new https.Agent({ keepAlive: false });

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Необходимы переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 300;

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
    supabaseFetch('/achievements?select=id,medal_tier'),
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

async function loadUnlockedAchievements(userId) {
  const res = await supabaseFetch(`/user_achievements?user_id=eq.${userId}&select=achievement_id`);
  const data = await res.json();
  return new Set(data.map(r => r.achievement_id));
}

async function clearHintRoutes(nodeIds) {
  if (nodeIds && nodeIds.length > 0) {
    const ids = nodeIds.join(',');
    await supabaseFetch(`/hint_routes?node_id=in.(${ids})`, { method: 'DELETE' });
    console.log(`🗑️  Очищены старые маршруты для ${nodeIds.length} нод(ы)`);
  } else {
    // Supabase REST требует WHERE для DELETE; используем фильтр, который охватывает все строки
    await supabaseFetch('/hint_routes?node_id=not.is.null', { method: 'DELETE' });
    console.log('🗑️  Очищены все старые маршруты');
  }
}

function computeRoutes({ graph, nodes, achievements }, player = null, onlyNodeId = null) {
  const routes = [];

  const nodesToProcess = onlyNodeId
    ? nodes.filter(n => n.id === onlyNodeId)
    : nodes;

  let processed = 0;
  const total = nodesToProcess.length * achievements.length;

  for (const node of nodesToProcess) {
    for (const achievement of achievements) {
      processed++;
      const start = Date.now();

      const reverse = findReversePath(node.id, achievement.id, graph, 100, player);

      const route = reverse.reachable
        ? {
            node_id: node.id,
            achievement_id: achievement.id,
            next_choice_id: reverse.nextChoice?.id || null,
            steps_remaining: reverse.stepsRemaining,
            reachable: true,
            forward_reachable: null,
            forward_reason: null,
            is_theoretical: true,
            reason: 'theoretical_reverse',
          }
        : {
            node_id: node.id,
            achievement_id: achievement.id,
            next_choice_id: null,
            steps_remaining: null,
            reachable: false,
            forward_reachable: false,
            forward_reason: reverse.reason || 'no_path_found',
            is_theoretical: false,
            reason: reverse.reason || 'no_path_found',
          };

      const duration = Date.now() - start;
      routes.push(route);

      if (processed % 100 === 0 || total <= 26) {
        console.log(`  [${processed}/${total}] ${achievement.id}: ${route.reachable ? 'theoretical' : route.reason} (${duration}ms)`);
      }
    }
  }

  return routes;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function upsertRoutes(routes) {
  for (let i = 0; i < routes.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);

    const batch = routes.slice(i, i + BATCH_SIZE);
    const maxRetries = 3;
    let lastErr = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
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
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`⚠️ Batch ${i / BATCH_SIZE + 1} attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) await sleep(1000 * attempt);
      }
    }

    if (lastErr) throw lastErr;
  }
}

async function main() {
  const startTime = Date.now();

  console.log('🔌 Загрузка графа и ачивок...');
  const data = await loadData();
  const { nodes, achievements } = data;
  console.log(`📊 Нод: ${nodes.length}, выборов: ${data.graph.nodeToChoices.size}, ачивок: ${achievements.length}`);

  let nodeIdsToClear = null;
  let onlyNodeId = null;
  let achievementsToProcess = data.achievements;
  let player = null;

  if (USER_ID) {
    console.log(`👤 Персональный режим для ${USER_ID}`);
    player = await loadPlayerState(USER_ID);
    const unlockedIds = await loadUnlockedAchievements(USER_ID);
    achievementsToProcess = data.achievements.filter(a => !unlockedIds.has(a.id));
    nodeIdsToClear = [player.current_node_id];
    onlyNodeId = player.current_node_id;
    console.log(`🎮 Стартовая нода: ${player.current_node_id}`);
    console.log(`🏅 Неполученных ачивок: ${achievementsToProcess.length}`);
  } else {
    console.log('🌐 Глобальный режим: обратный поиск для всех нод');
  }

  if (!DRY_RUN) {
    await clearHintRoutes(nodeIdsToClear);
  } else {
    console.log('🌵 DRY_RUN: старые маршруты не очищаются');
  }

  console.log('🔎 Предрасчёт маршрутов...');
  const routes = computeRoutes({ ...data, achievements: achievementsToProcess }, player, onlyNodeId);

  const reachableCount = routes.filter(r => r.reachable && !r.is_theoretical).length;
  const theoreticalCount = routes.filter(r => r.is_theoretical).length;
  const noPathCount = routes.filter(r => !r.reachable).length;
  console.log(`📈 Reachable: ${reachableCount}, theoretical: ${theoreticalCount}, no_path: ${noPathCount}`);

  if (DRY_RUN) {
    console.log('🌵 DRY_RUN: записи в БД не производятся');
    const sample = routes.filter(r => r.reachable).slice(0, 10);
    for (const r of sample) {
      console.log(`   ${r.node_id} → ${r.achievement_id}: ${r.is_theoretical ? 'theoretical' : 'reachable'}, next=${r.next_choice_id}`);
    }
  } else {
    console.log('💾 Сохранение в БД...');
    await upsertRoutes(routes);
  }

  console.log(`🎉 Готово за ${((Date.now() - startTime) / 1000).toFixed(1)}с`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
