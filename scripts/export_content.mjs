#!/usr/bin/env node
// ==========================================
// 📤 Экспорт игрового контента из Supabase в JSON
// ==========================================
// Использует SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY из .dev.vars
// Создаёт файл data/content_ru.json с текущими русскими текстами.
// Использует curl для обхода нестабильности Node fetch с этим хостом.

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = path.join(ROOT, '.dev.vars');
const OUT_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(OUT_DIR, 'content_ru.json');

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

async function curlJson(env, path) {
  const url = `${env.SUPABASE_URL}/rest/v1${path}`;
  const { stdout } = await execFileAsync('curl', [
    '-s', '-S',
    '-H', `apikey: ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    '-H', `Authorization: Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    '-H', 'Accept: application/json',
    url,
  ], { timeout: 30000 });
  try {
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Invalid JSON from ${path}: ${stdout.slice(0, 200)}`);
  }
}

async function fetchAll(env, basePath, pageSize = 25) {
  const all = [];
  let offset = 0;
  while (true) {
    const path = `${basePath}&limit=${pageSize}&offset=${offset}`;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const page = await curlJson(env, path);
        if (!Array.isArray(page)) {
          throw new Error(`Unexpected response for ${basePath}: not an array`);
        }
        all.push(...page);
        if (page.length < pageSize) return all;
        offset += pageSize;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ ${path} attempt ${attempt} failed: ${err.message}. Retrying...`);
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
    if (lastError) throw lastError;
  }
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`❌ .dev.vars not found at ${ENV_PATH}`);
    process.exit(1);
  }

  const env = loadEnv(ENV_PATH);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    process.exit(1);
  }

  console.log('⏳ Loading nodes, choices, achievements...');

  const nodes = await fetchAll(env, '/nodes?select=id,location_name,title,narrative,thought');
  const choices = await fetchAll(env, '/choices?select=id,label,narrative_override');
  const achievements = await fetchAll(env, '/achievements?select=id,title,description');

  const out = {
    nodes: {},
    choices: {},
    achievements: {},
  };

  for (const n of nodes) {
    out.nodes[n.id] = {
      location_name: n.location_name || '',
      title: n.title || '',
      narrative: n.narrative || '',
      thought: n.thought || '',
    };
  }

  for (const c of choices) {
    out.choices[c.id] = {
      label: c.label || '',
      narrative_override: c.narrative_override || '',
    };
  }

  for (const a of achievements) {
    out.achievements[a.id] = {
      title: a.title || '',
      description: a.description || '',
    };
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

  console.log(`✅ Exported ${nodes.length} nodes, ${choices.length} choices, ${achievements.length} achievements to ${OUT_FILE}`);
}

main().catch(err => {
  console.error('❌ Export failed:', err.message);
  process.exit(1);
});
