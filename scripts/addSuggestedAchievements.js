#!/usr/bin/env node
// ==========================================
// addSuggestedAchievements.js
// Добавление предложенных ачивок и привязка их к существующим выборам.
// ==========================================
//
// Запуск:
//   cd nemesis-backend
//   node scripts/addSuggestedAchievements.js

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import fetch from 'node-fetch';
import https from 'https';

const envPath = resolve(process.cwd(), '.dev.vars');
try {
  readFileSync(envPath);
  config({ path: envPath });
} catch {
  // .dev.vars отсутствует, используем переменные окружения
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Необходимы переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
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
    const text = await res.text();
    throw new Error(`Supabase ${res.status} on ${path}: ${text}`);
  }

  return res;
}

async function fetchChoiceEffects(choiceId) {
  const res = await supabaseFetch(`/choices?id=eq.${encodeURIComponent(choiceId)}&select=effects`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Choice ${choiceId} not found`);
  }
  return data[0].effects || {};
}

async function patchChoiceEffects(choiceId, effects) {
  await supabaseFetch(`/choices?id=eq.${encodeURIComponent(choiceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ effects }),
  });
}

async function main() {
  console.log('🚀 Добавление предложенных ачивок');

  // 1. Insert achievements
  console.log('1️⃣ Добавление ачивок...');
  const achievements = [
    {
      id: 'ach_abandon_tobias',
      title: 'Каждый сам за себя',
      description: 'Бросить раненого Тобиаса умирать в Акте 2.',
      medal_tier: 'BRONZE',
      icon_url: null,
    },
    {
      id: 'ach_hart_deal',
      title: 'Сделка с дьяволом',
      description: 'Заключить сомнительную сделку с доктором Харт.',
      medal_tier: 'SILVER',
      icon_url: null,
    },
    {
      id: 'ach_hart_enemy',
      title: 'Враг науки',
      description: 'Отказать Харт и сделать его врагом.',
      medal_tier: 'SILVER',
      icon_url: null,
    },
    {
      id: 'ach_hydro_shortcut',
      title: 'Крысиный обход',
      description: 'Срезать путь через гидропонику, минуя лаборатории.',
      medal_tier: 'BRONZE',
      icon_url: null,
    },
    {
      id: 'ach_patriarch_sneak',
      title: 'Тень в вентиляции',
      description: 'Обмануть Слепого Патриарха и уйти незамеченным.',
      medal_tier: 'SILVER',
      icon_url: null,
    },
    {
      id: 'ach_patriarch_blind',
      title: 'Слепой часовщик',
      description: 'Ослепить Слепого Патриарха.',
      medal_tier: 'SILVER',
      icon_url: null,
    },
    {
      id: 'ach_full_toolkit',
      title: 'Швейцарский нож',
      description: 'Собрать полный набор инструментов: магнитометр, лом, сервопривод, зажимы, хронометр и КПК директора.',
      medal_tier: 'GOLD',
      icon_url: null,
    },
    {
      id: 'ach_toxicosis',
      title: 'Зелёный защитник',
      description: 'Получить токсическое отравление, вырывая капсулу Изолята Омега.',
      medal_tier: 'BRONZE',
      icon_url: null,
    },
  ];

  await supabaseFetch('/achievements', {
    method: 'POST',
    body: JSON.stringify(achievements),
  });
  console.log(`   ✅ Добавлено ${achievements.length} ачивок`);

  // 2. Update existing choices to unlock achievements
  console.log('2️⃣ Привязка ачивок к существующим выборам...');
  const choiceUnlocks = [
    { choiceId: 'trans_choice_ch_2_leave_to_act3', achId: 'ach_abandon_tobias' },
    { choiceId: 'trans_choice_ch_3_choice_hart', achId: 'ach_hart_deal' },
    { choiceId: 'trans_choice_ch_3_choice_self', achId: 'ach_hart_enemy' },
    { choiceId: 'trans_choice_ch_2_hydro_bypass_oil', achId: 'ach_hydro_shortcut' },
    { choiceId: 'trans_choice_ch_2_bypass_to_bridge', achId: 'ach_hydro_shortcut' },
    { choiceId: 'trans_choice_ch_3_boss_stl', achId: 'ach_patriarch_sneak' },
    { choiceId: 'trans_choice_ch_3_boss_ref', achId: 'ach_patriarch_blind' },
    { choiceId: 'trans_choice_ch_3_nest_srv', achId: 'ach_toxicosis' },
  ];

  for (const { choiceId, achId } of choiceUnlocks) {
    const effects = await fetchChoiceEffects(choiceId);
    effects.unlock_achievement = achId;
    await patchChoiceEffects(choiceId, effects);
    console.log(`   ✅ ${choiceId} -> ${achId}`);
  }

  // 3. Insert toolkit trigger choices in act3_hub
  console.log('3️⃣ Добавление выборов для ачивки Швейцарский нож...');
  const commonItems = [
    'Откалиброванный Магнитометр',
    'Тяжелый лом',
    'Канцелярские зажимы',
    'Сломанный Хронометр',
    'КПК Директора',
  ];

  await supabaseFetch('/choices', {
    method: 'POST',
    body: JSON.stringify([
      {
        id: 'ch_3_hub_toolkit_broken',
        node_id: 'act3_hub',
        target_node_id: 'act3_hub',
        label: '🧰 Полный набор инструментов',
        narrative_override: null,
        conditions: {
          item_required: [...commonItems, 'Сломанный Сервопривод'],
          flag_not_required: 'ach_full_toolkit_unlocked',
        },
        effects: {
          unlock_achievement: 'ach_full_toolkit',
          add_flag: 'ach_full_toolkit_unlocked',
        },
        sort_order: 0,
      },
      {
        id: 'ch_3_hub_toolkit_enhanced',
        node_id: 'act3_hub',
        target_node_id: 'act3_hub',
        label: '🧰 Полный набор инструментов',
        narrative_override: null,
        conditions: {
          item_required: [...commonItems, 'Усиленный Сервопривод'],
          flag_not_required: 'ach_full_toolkit_unlocked',
        },
        effects: {
          unlock_achievement: 'ach_full_toolkit',
          add_flag: 'ach_full_toolkit_unlocked',
        },
        sort_order: 0,
      },
    ]),
  });
  console.log('   ✅ Выборы добавлены в act3_hub');

  console.log('🎉 Все ачивки добавлены');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
