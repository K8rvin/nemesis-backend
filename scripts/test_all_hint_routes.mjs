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
const headers = {
  apikey: cfg.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${cfg.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function dbGet(path, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1${path}`, { headers });
      if (!res.ok) throw new Error(`DB ${path} -> ${res.status}`);
      return res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300 * attempt));
      }
    }
  }
  throw lastErr;
}

function jsonResponse(obj) {
  const body = JSON.stringify(obj);
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function applyEffects(player, effects) {
  const p = { ...player, skills: [...player.skills], story_flags: [...player.story_flags], inventory: [...player.inventory] };
  for (const s of asArray(effects.add_skill)) if (!p.skills.includes(s)) p.skills.push(s);
  for (const f of asArray(effects.add_flag)) if (!p.story_flags.includes(f)) p.story_flags.push(f);
  for (const it of asArray(effects.add_item)) if (!p.inventory.includes(it)) p.inventory.push(it);
  for (const f of asArray(effects.remove_flags)) p.story_flags = p.story_flags.filter(x => x !== f);
  for (const it of asArray(effects.remove_item)) p.inventory = p.inventory.filter(x => x !== it);
  return p;
}

async function testRoute(route, achievements) {
  const path = route.path || [];
  if (path.length === 0) return { errors: 0, skipped: true };

  const choices = await dbGet(`/choices?id=in.(${path.join(',')})`);
  const byId = new Map(choices.map(c => [c.id, c]));

  let player = {
    user_id: 'test-user',
    hp: 100,
    max_hp: 100,
    current_node_id: route.start_node_id || 'act1_start',
    story_flags: [],
    inventory: [],
    skills: [],
  };

  const dataProviders = {
    getPlayerState: async () => player,
    supabaseFetch: async (_env, p) => {
      if (p.startsWith('/user_achievements')) return jsonResponse([]);
      if (p.startsWith('/achievement_routes')) return jsonResponse([route]);
      if (p === '/achievements?select=*') return jsonResponse(achievements);
      if (p.startsWith('/choices?id=in.')) return jsonResponse(choices);
      throw new Error(`unexpected ${p}`);
    },
  };

  const mismatches = [];
  for (let idx = 0; idx < path.length; idx++) {
    const cid = path[idx];
    const choice = byId.get(cid);

    const hint = await getHint(null, 'test-user', null, null, route.achievement_id, dataProviders);
    const recommended = hint.next_choice?.id || null;
    if (recommended !== cid) {
      mismatches.push({ idx, node: player.current_node_id, expected: cid, recommended });
    }

    if (choice) {
      player = applyEffects(player, choice.effects || {});
      player.current_node_id = choice.target_node_id || player.current_node_id;
    }
  }

  return { errors: mismatches.length, mismatches };
}

async function main() {
  const [routes, achievements] = await Promise.all([
    dbGet('/achievement_routes?select=*'),
    dbGet('/achievements?select=*'),
  ]);

  let totalErrors = 0;
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (i > 0) await new Promise(r => setTimeout(r, 200));
    const { errors, mismatches } = await testRoute(route, achievements);
    totalErrors += errors;
    if (errors) {
      console.log(`\n[FAIL] ${route.achievement_id}: ${errors} mismatch(es)`);
      for (const m of mismatches) {
        console.log(`  step ${m.idx} node=${m.node} expected=${m.expected} got=${m.recommended}`);
      }
    } else {
      console.log(`[OK]   ${route.achievement_id}`);
    }
  }

  console.log(`\nTotal errors: ${totalErrors}`);
  process.exit(totalErrors ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
