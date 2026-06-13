#!/usr/bin/env node
// Локальный тест hintEngine.getHint с мок-провайдерами
import { getHint } from '../src/hintEngine.js';

const nodes = [
  { id: 'start', ending_type: null },
  { id: 'mid', ending_type: null },
  { id: 'far', ending_type: null },
  { id: 'end', ending_type: 'VICTORY' },
];

const choices = [
  // ach_victory: choice находится на дальней ноде, forward не может добраться (нужен флаг),
  // но reverse покажет теоретический путь.
  { id: 'c_start_far', node_id: 'start', target_node_id: 'far', label: 'Go far', conditions: { flag_required: 'far_key' }, effects: {} },
  { id: 'c_far_end', node_id: 'far', target_node_id: 'end', label: 'Claim victory', conditions: {}, effects: { unlock_achievement: 'ach_victory' } },

  // ach_secret: полностью недостижим вперёд, но reverse найдёт маршрут.
  { id: 'c_start_mid_secret', node_id: 'start', target_node_id: 'mid', label: 'Secret path', conditions: { flag_required: 'secret_key' }, effects: {} },
  { id: 'c_mid_secret', node_id: 'mid', target_node_id: 'end', label: 'Claim secret', conditions: {}, effects: { unlock_achievement: 'ach_secret' } },
];

const achievements = [
  { id: 'ach_victory', medal_tier: 'GOLD', title: 'Victory' },
  { id: 'ach_secret', medal_tier: 'PLATINUM', title: 'Secret' },
];

async function mockSupabaseFetch(env, path, options) {
  if (path.startsWith('/nodes') || path.startsWith('/achievements')) {
    return { json: async () => path.startsWith('/nodes') ? nodes : achievements };
  }
  if (path.startsWith('/choices')) {
    return { json: async () => choices };
  }
  if (path.startsWith('/user_achievements')) {
    return { json: async () => [] };
  }
  if (path.startsWith('/hint_routes')) {
    return { json: async () => [] };
  }
  throw new Error(`Unexpected path: ${path}`);
}

async function mockGetPlayerState(env, userId) {
  return {
    user_id: userId,
    current_node_id: 'start',
    hp: 100,
    story_flags: [],
    inventory: [],
    skills: [],
  };
}

async function run() {
  const dataProviders = { getPlayerState: mockGetPlayerState, supabaseFetch: mockSupabaseFetch };

  console.log('--- Test 1: fixed target uses reverse when forward finds no path ---');
  const h1 = await getHint({}, 'user1', 'ANY', 'any', 'ach_secret', dataProviders);
  console.log(JSON.stringify(h1, null, 2));
  if (!h1.reachable || !h1.theoretical || h1.next_choice?.id !== 'c_start_mid_secret') {
    throw new Error('Expected theoretical secret via c_start_mid_secret');
  }

  console.log('--- Test 2: ANY tier falls back to reverse when nothing is forward-reachable ---');
  const h2 = await getHint({}, 'user2', 'ANY', 'any', null, dataProviders);
  console.log(JSON.stringify(h2, null, 2));
  if (!h2.reachable || !h2.theoretical) {
    throw new Error('Expected ANY to return a theoretical achievement');
  }

  console.log('✅ All local tests passed');
}

run().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
