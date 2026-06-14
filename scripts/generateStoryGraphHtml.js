#!/usr/bin/env node
// ==========================================
// 🕸️ generateStoryGraphHtml.js — интерактивная карта графа истории
// ==========================================
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/generateStoryGraphHtml.js

import fetch from 'node-fetch';
import https from 'https';
import { config } from 'dotenv';
import { resolve, basename } from 'path';
import { writeFileSync } from 'fs';

config({ path: resolve('.env') });

const agent = new https.Agent({ keepAlive: false });
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = resolve('..', 'Материалы', 'story_graph.html');

async function getAll(path) {
  const all = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}&limit=100&offset=${offset}`, {
      agent,
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const d = await r.json();
    if (d.length === 0) break;
    all.push(...d);
    if (d.length < 100) break;
    offset += 100;
  }
  return all;
}

function extractAct(nodeId) {
  const m = nodeId.match(/^act(\d)/);
  return m ? `act${m[1]}` : (nodeId.startsWith('ending') ? 'ending' : 'other');
}

function formatConditions(conds) {
  if (!conds) return '';
  const parts = [];
  if (conds.required_skill) parts.push(`навык: ${conds.required_skill}`);
  if (conds.flag_required) {
    const flags = Array.isArray(conds.flag_required) ? conds.flag_required : [conds.flag_required];
    parts.push(`флаги: ${flags.join(', ')}`);
  }
  if (conds.flag_not_required) {
    const flags = Array.isArray(conds.flag_not_required) ? conds.flag_not_required : [conds.flag_not_required];
    parts.push(`нет флагов: ${flags.join(', ')}`);
  }
  if (conds.flag_forbidden) parts.push(`запрет: ${conds.flag_forbidden}`);
  if (conds.item_required) {
    const items = Array.isArray(conds.item_required) ? conds.item_required : [conds.item_required];
    parts.push(`предметы: ${items.join(', ')}`);
  }
  if (conds.item_not_required) parts.push(`нет предмета: ${conds.item_not_required}`);
  return parts.join('; ');
}

function getNodeColor(nodeId, endingType) {
  if (endingType) {
    const et = (endingType || '').toUpperCase();
    if (et.includes('DEATH')) return '#EF4444';
    if (et.includes('VICTORY')) return '#22C55E';
    if (et.includes('SECRET')) return '#A855F7';
    return '#94A3B8';
  }
  const act = extractAct(nodeId);
  const colors = {
    act1: '#F97316',
    act2: '#38BDF8',
    act3: '#22C55E',
    act4: '#EAB308',
    act5: '#A855F7',
    other: '#64748B',
  };
  return colors[act] || colors.other;
}

async function main() {
  const [nodes, choices] = await Promise.all([
    getAll('/nodes?select=id,title,ending_type'),
    getAll('/choices?select=*'),
  ]);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const visNodes = nodes.map(n => ({
    id: n.id,
    label: n.title || n.id,
    title: `${n.id}${n.ending_type ? ` (${n.ending_type})` : ''}`,
    color: getNodeColor(n.id, n.ending_type),
    font: { color: '#E2E8F0', size: 11 },
    shape: n.ending_type ? 'box' : 'dot',
    size: n.ending_type ? 15 : 8,
  }));

  const visEdges = choices
    .filter(c => c.target_node_id)
    .map(c => {
      const condText = formatConditions(c.conditions);
      const effText = c.effects?.unlock_achievement ? ` 🏆 ${c.effects.unlock_achievement}` : '';
      return {
        from: c.node_id,
        to: c.target_node_id,
        label: condText ? '🔒' : '',
        title: `${c.id}: ${c.label}${condText ? '\n' + condText : ''}${effText}`,
        color: condText ? '#F97316' : '#475569',
        arrows: 'to',
        font: { color: '#F97316', size: 9 },
      };
    });

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Nemesis Story Graph</title>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style>
    body { margin: 0; background: #0A0B0E; color: #E2E8F0; font-family: sans-serif; }
    #header { padding: 10px 15px; background: #12141C; border-bottom: 1px solid #334155; }
    #header h1 { margin: 0; font-size: 16px; }
    #header p { margin: 4px 0 0; font-size: 12px; color: #94A3B8; }
    #mynetwork { width: 100vw; height: calc(100vh - 80px); }
    .legend { display: inline-block; margin-right: 12px; font-size: 11px; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
  </style>
</head>
<body>
  <div id="header">
    <h1>Карта графа истории Nemesis RPG</h1>
    <p>
      <span class="legend"><span class="dot" style="background:#F97316"></span>act1</span>
      <span class="legend"><span class="dot" style="background:#38BDF8"></span>act2</span>
      <span class="legend"><span class="dot" style="background:#22C55E"></span>act3</span>
      <span class="legend"><span class="dot" style="background:#EAB308"></span>act4</span>
      <span class="legend"><span class="dot" style="background:#A855F7"></span>act5</span>
      <span class="legend"><span class="dot" style="background:#EF4444"></span>смерть</span>
      <span class="legend"><span class="dot" style="background:#22C55E"></span>победа</span>
      <span class="legend"><span class="dot" style="background:#A855F7"></span>секрет</span>
      <span class="legend">🔸 — условия у перехода (наведи для деталей)</span>
    </p>
  </div>
  <div id="mynetwork"></div>
  <script>
    const nodes = new vis.DataSet(${JSON.stringify(visNodes)});
    const edges = new vis.DataSet(${JSON.stringify(visEdges)});
    const container = document.getElementById('mynetwork');
    const data = { nodes, edges };
    const options = {
      layout: { improvedLayout: false },
      physics: {
        stabilization: { iterations: 200 },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09,
        }
      },
      nodes: { borderWidth: 1, borderWidthSelected: 2 },
      edges: { width: 1, smooth: { type: 'continuous' } }
    };
    new vis.Network(container, data, options);
  </script>
</body>
</html>`;

  writeFileSync(OUT, html);
  console.log(`✅ Граф сохранён: ${OUT}`);
  console.log(`   Нод: ${visNodes.length}, переходов: ${visEdges.length}`);
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
