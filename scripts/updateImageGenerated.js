#!/usr/bin/env node
// ==========================================
// 🖼️ updateImageGenerated.js — проставить image_generated=true для нод,
// у которых есть картинка в flutter/assets/images/nodes
// ==========================================
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/updateImageGenerated.js

import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { resolve, extname } from 'path';
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Необходимы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const IMAGES_DIR = resolve('..', 'nemesis-flutter', 'assets', 'images', 'nodes');
const BATCH_SIZE = 50;

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
      'Prefer': 'return=minimal',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status} on ${path}: ${text}`);
  }

  return res;
}

function getNodeIdsFromImages() {
  const files = readdirSync(IMAGES_DIR);
  const ids = [];
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext === '.webp' || ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      ids.push(file.slice(0, -ext.length));
    }
  }
  return ids;
}

async function main() {
  const nodeIds = getNodeIdsFromImages();
  console.log(`🖼️ Найдено ${nodeIds.length} картинок в ${IMAGES_DIR}`);

  if (nodeIds.length === 0) {
    console.log('Нечего обновлять.');
    return;
  }

  // Сначала сбросим image_generated=false для всех нод
  console.log('🧹 Сброс image_generated=false для всех нод...');
  await supabaseFetch('/nodes?image_generated=not.is.null', {
    method: 'PATCH',
    body: JSON.stringify({ image_generated: false }),
  });

  // Затем проставим true батчами
  console.log('✅ Проставляю image_generated=true...');
  for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + BATCH_SIZE);
    const ids = batch.join(',');
    await supabaseFetch(`/nodes?id=in.(${ids})`, {
      method: 'PATCH',
      body: JSON.stringify({ image_generated: true }),
    });
    console.log(`  Обновлено ${Math.min(i + BATCH_SIZE, nodeIds.length)} / ${nodeIds.length}`);
  }

  console.log('🎉 Готово');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
