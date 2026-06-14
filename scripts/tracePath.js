#!/usr/bin/env node
// Ручной backward trace от целевой ачивки к act1_skills,
// выбирая incoming choice с минимумом условий.
import fetch from 'node-fetch';
import https from 'https';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve('.env') });

const agent = new https.Agent({ keepAlive: false });
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function get(path) {
  const r = await fetch(process.env.SUPABASE_URL + '/rest/v1' + path, {
    agent,
    headers: { apikey: key, Authorization: 'Bearer ' + key },
  });
  return r.json();
}

async function getAll(path) {
  const all = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}&limit=100&offset=${offset}`, {
      agent,
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    });
    const d = await r.json();
    if (d.length === 0) break;
    all.push(...d);
    if (d.length < 100) break;
    offset += 100;
  }
  return all;
}

function conditionCount(choice) {
  const c = choice.conditions || {};
  let count = 0;
  if (c.required_skill) count++;
  if (c.flag_required) count += Array.isArray(c.flag_required) ? c.flag_required.length : 1;
  if (c.flag_not_required) count += Array.isArray(c.flag_not_required) ? c.flag_not_required.length : 1;
  if (c.flags_not_required_all) count += Array.isArray(c.flags_not_required_all) ? c.flags_not_required_all.length : 1;
  if (c.flag_forbidden) count++;
  if (c.item_required) count += Array.isArray(c.item_required) ? c.item_required.length : 1;
  if (c.item_not_required) count++;
  return count;
}

async function trace(achievementId) {
  const [nodes, choices] = await Promise.all([
    getAll('/nodes?select=id,title'),
    getAll('/choices?select=*'),
  ]);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const incoming = new Map();
  for (const c of choices) {
    if (!c.target_node_id) continue;
    if (!incoming.has(c.target_node_id)) incoming.set(c.target_node_id, []);
    incoming.get(c.target_node_id).push(c);
  }

  // Найти choice, который даёт ачивку
  const targetChoices = choices.filter(c => c.effects?.unlock_achievement === achievementId);
  if (targetChoices.length === 0) {
    console.log('No choice unlocks', achievementId);
    return;
  }

  // Начинаем с целевого choice с минимумом условий
  let currentChoice = targetChoices.sort((a, b) => conditionCount(a) - conditionCount(b))[0];
  const path = [currentChoice];
  const visitedNodes = new Set();

  while (currentChoice.node_id !== 'act1_skills') {
    const nodeId = currentChoice.node_id;
    if (visitedNodes.has(nodeId)) {
      console.log('Cycle detected at', nodeId);
      break;
    }
    visitedNodes.add(nodeId);

    const inc = incoming.get(nodeId) || [];
    if (inc.length === 0) {
      console.log('No incoming to', nodeId);
      break;
    }

    // Выбираем incoming с минимумом условий, избегая connector-нод (trans_*)
    // и backward-выборов (↩️ / Вернуться), которые создают циклы.
    const filtered = inc.filter(c => !c.label.includes('↩️') && !c.label.toLowerCase().includes('вернуться'));
    const candidates = filtered.length > 0 ? filtered : inc;
    const sorted = candidates.slice().sort((a, b) => {
      const ca = conditionCount(a);
      const cb = conditionCount(b);
      if (ca !== cb) return ca - cb;
      return a.node_id.startsWith('trans_') ? 1 : -1;
    });

    currentChoice = sorted[0];
    path.unshift(currentChoice);
  }

  console.log(`\n=== Path to ${achievementId} ===`);
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    const nodeTitle = nodeMap.get(c.node_id)?.title || c.node_id;
    console.log(`${i + 1}. [${c.node_id}] ${nodeTitle}`);
    console.log(`   → ${c.id}: ${c.label}`);
    if (conditionCount(c) > 0) {
      console.log(`   CONDITIONS:`, JSON.stringify(c.conditions));
    }
    if (c.effects && Object.keys(c.effects).length > 0) {
      console.log(`   EFFECTS:`, JSON.stringify(c.effects));
    }
  }
}

const achievementId = process.argv[2] || 'ach_lucky_bastard';
trace(achievementId).catch(err => {
  console.error(err);
  process.exit(1);
});
