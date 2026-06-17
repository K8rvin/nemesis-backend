import { readFileSync } from 'fs';
import { getHint } from '../src/achievementRoutes.js';

function loadDevVars(path = '.dev.vars') {
  const vars = {};
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (m) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return vars;
}

const cfg = loadDevVars();
const SUPABASE_REST = `${cfg.SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: cfg.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${cfg.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function dbGet(path) {
  const res = await fetch(SUPABASE_REST + path, { headers });
  if (!res.ok) throw new Error(`DB ${path} -> ${res.status}`);
  return res.json();
}

function jsonResponse(obj) {
  const body = JSON.stringify(obj);
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body,
  };
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function applyEffects(player, effects) {
  const p = { ...player };
  p.skills = [...(p.skills || [])];
  p.story_flags = [...(p.story_flags || [])];
  p.inventory = [...(p.inventory || [])];

  for (const s of asArray(effects.add_skill)) if (!p.skills.includes(s)) p.skills.push(s);
  for (const f of asArray(effects.add_flag)) if (!p.story_flags.includes(f)) p.story_flags.push(f);
  for (const it of asArray(effects.add_item)) if (!p.inventory.includes(it)) p.inventory.push(it);
  for (const f of asArray(effects.remove_flags)) p.story_flags = p.story_flags.filter(x => x !== f);
  for (const it of asArray(effects.remove_item)) p.inventory = p.inventory.filter(x => x !== it);

  return p;
}

async function main() {
  const [route, achievements] = await Promise.all([
    dbGet('/achievement_routes?achievement_id=eq.ach_no_man_left_behind_workbench&select=*'),
    dbGet('/achievements?select=*'),
  ]);
  const r = route[0];
  const path = r.path;

  const allChoices = await dbGet(`/choices?id=in.(${path.join(',')})`);
  const byId = new Map(allChoices.map(c => [c.id, c]));

  let player = {
    user_id: 'test-user',
    hp: 100,
    max_hp: 100,
    current_node_id: 'act1_start',
    story_flags: [],
    inventory: [],
    skills: [],
  };

  const dataProviders = {
    getPlayerState: async () => player,
    supabaseFetch: async (_env, p, options = {}) => {
      if (p.startsWith('/user_achievements')) return jsonResponse([]);
      if (p.startsWith('/achievement_routes')) return jsonResponse([r]);
      if (p === '/achievements?select=*') return jsonResponse(achievements);
      if (p.startsWith('/choices?id=in.')) return jsonResponse(allChoices);
      throw new Error(`unexpected supabaseFetch ${p}`);
    },
  };

  const errors = [];
  for (let idx = 0; idx < path.length; idx++) {
    const cid = path[idx];
    const choice = byId.get(cid);

    const hint = await getHint(null, 'test-user', null, null, 'ach_no_man_left_behind_workbench', dataProviders);
    const recommended = hint.next_choice?.id || null;
    console.log(`step ${String(idx).padStart(2, '0')} node=${player.current_node_id.padEnd(30)} expected=${cid.padEnd(40)} recommended=${recommended}`);
    if (recommended !== cid) {
      errors.push({ idx, node: player.current_node_id, expected: cid, recommended, hint });
      console.log('  MISMATCH', hint);
    }

    player = applyEffects(player, choice.effects || {});
    player.current_node_id = choice.target_node_id || player.current_node_id;
  }

  if (errors.length) {
    console.log('\nERRORS', errors.length);
    for (const e of errors) console.log(e);
    process.exit(1);
  } else {
    console.log('\nOK');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
