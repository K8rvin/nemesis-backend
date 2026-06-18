#!/usr/bin/env node
// ==========================================
// ⬆️ Загрузка переводов из JSON в Supabase
// ==========================================
// Читает data/content_<lang>.json (по умолчанию content_en.json)
// и записывает переводы в JSONB-поле translations таблиц nodes/choices/achievements.
// Использует curl для обхода нестабильности Node fetch с этим хостом.

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = path.join(ROOT, '.dev.vars');

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

async function curlJson(env, path, method = 'GET', body = null) {
  const url = `${env.SUPABASE_URL}/rest/v1${path}`;
  const args = ['-s', '-S'];
  args.push('-X', method);
  args.push('-H', `apikey: ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  args.push('-H', `Authorization: Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  args.push('-H', 'Content-Type: application/json');
  args.push('-H', 'Accept: application/vnd.pgrst.array+json');
  if (method === 'PATCH' || method === 'POST') {
    args.push('-H', 'Prefer: return=minimal');
  }
  if (body) {
    args.push('-d', JSON.stringify(body));
  }
  args.push(url);

  const { stdout, stderr } = await execFileAsync('curl', args, { timeout: 30000 });
  if (stderr) throw new Error(stderr);
  if (!stdout) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout;
  }
}

async function fetchExistingTranslations(env, table, id) {
  const data = await curlJson(
    env,
    `/${table}?id=eq.${encodeURIComponent(id)}&select=id,translations`
  );
  return data?.[0]?.translations || {};
}

async function patchRecord(env, table, id, translations, lang) {
  const existing = await fetchExistingTranslations(env, table, id);
  const merged = { ...existing, [lang]: translations };
  await curlJson(
    env,
    `/${table}?id=eq.${encodeURIComponent(id)}`,
    'PATCH',
    { translations: merged }
  );
}

async function applyTable(env, table, records, lang, concurrency = 4) {
  const ids = Object.keys(records);
  console.log(`⏳ Applying ${ids.length} ${table} translations (lang=${lang})...`);

  let done = 0;
  let failed = 0;

  const runBatch = async (batchIds) => {
    for (const id of batchIds) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await patchRecord(env, table, id, records[id], lang);
          done++;
          break;
        } catch (err) {
          if (attempt === 3) {
            failed++;
            console.error(`❌ Failed ${table} ${id}: ${err.message}`);
          } else {
            console.warn(`⚠️ ${table} ${id} attempt ${attempt} failed: ${err.message}. Retrying...`);
            await new Promise(r => setTimeout(r, 500 * attempt));
          }
        }
      }
    }
  };

  const queue = [...ids];
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const id = queue.shift();
          await runBatch([id]);
          await new Promise(r => setTimeout(r, 50));
        }
      })()
    );
  }
  await Promise.all(workers);

  console.log(`✅ ${table}: ${done} applied, ${failed} failed`);
}

async function main() {
  const lang = process.argv[2] || 'en';
  const fileName = process.argv[3] || `content_${lang}.json`;
  const filePath = path.join(ROOT, 'data', fileName);

  if (!fs.existsSync(ENV_PATH)) {
    console.error(`❌ .dev.vars not found at ${ENV_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Translation file not found: ${filePath}`);
    process.exit(1);
  }

  const env = loadEnv(ENV_PATH);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  await applyTable(env, 'nodes', data.nodes || {}, lang);
  await applyTable(env, 'choices', data.choices || {}, lang);
  await applyTable(env, 'achievements', data.achievements || {}, lang);

  console.log('🎉 All translations applied');
}

main().catch(err => {
  console.error('❌ Apply failed:', err.message);
  process.exit(1);
});
