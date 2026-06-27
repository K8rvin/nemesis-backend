import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getHint } from './achievementRoutes.js';
import { normalizeLang, localizeNode, localizeChoice, localizeAchievement } from './localization.js';
import { cacheGet, cacheSet, cacheStats } from './cache.js';

// ==========================================
// 🎛️ НАСТРОЙКИ ПРИЛОЖЕНИЯ
// ==========================================
const app = new Hono();

app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer'],
}));

// ==========================================
// 🔐 AUTH MIDDLEWARE (Supabase Auth API)
// ==========================================
async function authMiddleware(c, next) {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Отсутствует токен авторизации' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const userRes = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      throw new Error(`Auth API returned ${userRes.status}`);
    }

    const user = await userRes.json();
    c.set('userId', user.id);
    await next();
  } catch (err) {
    console.error('❌ [AUTH] Verify error:', err.message);
    return c.json({ error: 'Недействительный или просроченный токен' }, 401);
  }
}

// ==========================================
// 📦 КЛИЕНТ SUPABASE REST
// ==========================================
function getDefaultHeaders(env) {
  return {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseFetch(env, path, options = {}, retries = 3, baseDelay = 100) {
  const url = `${env.SUPABASE_URL}/rest/v1${path}`;
  const fetchOptions = {
    ...options,
    headers: { ...getDefaultHeaders(env), ...(options.headers || {}) },
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, fetchOptions);
    } catch (error) {
      const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' ||
                             error.code === 'ETIMEDOUT' || error.name === 'TypeError';
      if (isNetworkError && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`⚠️ Supabase dropped. Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      throw error;
    }
  }
}

// ==========================================
// ⏱️ TIMING HELPERS
// ==========================================
function timingStart() {
  return { start: Date.now(), steps: {} };
}

function timingStep(t, name) {
  const now = Date.now();
  t.steps[name] = now - t.start;
  t.start = now;
  return t.steps[name];
}

function timingLog(prefix, t, extra = {}) {
  const total = Object.values(t.steps).reduce((a, b) => a + b, 0);
  console.log(`[TIMING ${prefix}] total=${total}ms`, Object.entries(t.steps).map(([k, v]) => `${k}=${v}ms`).join(' '), Object.keys(extra).length ? JSON.stringify(extra) : '');
}

// ==========================================
// 📦 СЛОЙ ДАННЫХ (DATA PROVIDERS)
// ==========================================
async function getPlayerState(env, userId) {
  const res = await supabaseFetch(env, `/game_state?user_id=eq.${userId}`);
  const data = await res.json();
  return data[0];
}

async function isProUser(env, userId) {
  const res = await supabaseFetch(env, `/user_pro_status?user_id=eq.${userId}&select=is_pro`);
  const data = await res.json();
  return data.length > 0 && data[0].is_pro === true;
}

async function setProUser(env, userId, source) {
  const res = await supabaseFetch(env, '/user_pro_status', {
    method: 'POST',
    headers: {
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      is_pro: true,
      purchased_at: new Date().toISOString(),
      source,
    }),
  });
  await res.text();
}

async function getStartNodeId(env) {
  const cacheKey = 'start_node_id';
  let id = cacheGet(cacheKey);
  if (id !== undefined) return id;

  const res = await supabaseFetch(env, '/nodes?is_start_node=eq.true&select=id');
  const data = await res.json();
  id = data[0]?.id || null;
  cacheSet(cacheKey, id);
  return id;
}

async function createPlayerState(env, userId, startNodeId) {
  const res = await supabaseFetch(env, '/game_state', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      current_node_id: startNodeId,
      visited_nodes: [startNodeId],
      hp: 100,
      story_flags: [],
      inventory: [],
      skills: [],
    }),
  });
  return (await res.json())[0];
}

async function updatePlayerState(env, userId, updates) {
  const payload = {
    hp: updates.hp,
    story_flags: updates.story_flags,
    inventory: updates.inventory,
    skills: updates.skills,
    current_node_id: updates.current_node_id,
  };
  if (updates.visited_nodes !== undefined) {
    payload.visited_nodes = updates.visited_nodes;
  }
  const res = await supabaseFetch(env, `/game_state?user_id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  await res.text(); // Освобождаем сокет
}

async function getNode(env, nodeId, lang) {
  const cacheKey = `node:${nodeId}:${lang}`;
  let node = cacheGet(cacheKey);
  if (node !== undefined) return node;

  const res = await supabaseFetch(env, `/nodes?id=eq.${nodeId}`);
  node = localizeNode((await res.json())[0], lang);
  cacheSet(cacheKey, node);
  return node;
}

async function getChoicesForNode(env, nodeId, lang) {
  const cacheKey = `choices:${nodeId}:${lang}`;
  let choices = cacheGet(cacheKey);
  if (choices !== undefined) return choices;

  const res = await supabaseFetch(env, `/choices?node_id=eq.${nodeId}&order=sort_order.asc`);
  choices = (await res.json()).map(c => localizeChoice(c, lang));
  cacheSet(cacheKey, choices);
  return choices;
}

async function getChoiceById(env, choiceId, lang) {
  const cacheKey = `choice:${choiceId}:${lang}`;
  let choice = cacheGet(cacheKey);
  if (choice !== undefined) return choice;

  const res = await supabaseFetch(env, `/choices?id=eq.${choiceId}`);
  choice = localizeChoice((await res.json())[0], lang);
  cacheSet(cacheKey, choice);
  return choice;
}

async function getAchievements(env, lang) {
  const res = await supabaseFetch(env, '/achievements?order=medal_tier.asc,title.asc');
  const data = await res.json();
  return data.map(a => localizeAchievement(a, lang));
}

async function unlockAchievement(env, userId, achievementId, alreadyUnlocked = false) {
  if (alreadyUnlocked) return false;

  const res = await supabaseFetch(env, '/user_achievements', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ user_id: userId, achievement_id: achievementId }),
  });
  if (res) await res.text(); // Освобождаем сокет Supabase!
  return true;
}

async function getAchievement(env, achievementId, lang) {
  const cacheKey = `achievement:${achievementId}:${lang}`;
  let ach = cacheGet(cacheKey);
  if (ach !== undefined) return ach;

  const res = await supabaseFetch(env, `/achievements?id=eq.${achievementId}`);
  ach = localizeAchievement((await res.json())[0], lang);
  cacheSet(cacheKey, ach);
  return ach;
}

// 🏆 Рейтинг: запись концовки игрока.
async function recordUserEnding(env, userId, nodeId, endingType) {
  try {
    const res = await supabaseFetch(env, '/user_endings', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        node_id: nodeId,
        ending_type: endingType || null,
      }),
    });
    if (res) await res.text();
  } catch (err) {
    console.warn('⚠️ Failed to record user ending:', err.message);
  }
}

// 🏆 Рейтинг: принудительный пересчёт строки игрока.
async function recalculateLeaderboard(env, userId) {
  try {
    const res = await supabaseFetch(env, '/rpc/recalculate_leaderboard', {
      method: 'POST',
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (res) await res.text();
  } catch (err) {
    console.warn('⚠️ Failed to recalculate leaderboard:', err.message);
  }
}

// Изображения теперь встроены в Flutter-клиент (assets/images/).
// Бэкенд больше не отдает imageUrl.
function getImageUrl() {
  return null;
}

// ==========================================
// 🛠️ ИГРОВАЯ ЛОГИКА И ФИЛЬТРЫ
// ==========================================
function filterChoices(allChoices, player) {
  const playerSkills = player.skills || [];
  const storyFlags = player.story_flags || [];
  const playerInventory = player.inventory || [];

  return allChoices.filter(choice => {
    const conds = choice.conditions || {};
    const effects = choice.effects || {};

    // Скрытые failure-выборы мини-игр не показываются в UI
    if (conds.required_skill && !playerSkills.includes(conds.required_skill)) return false;
    if (effects.add_skill && playerSkills.includes(effects.add_skill)) return false;
    if (conds.flag_required) {
      const flags = Array.isArray(conds.flag_required) ? conds.flag_required : [conds.flag_required];
      if (!flags.every(f => storyFlags.includes(f))) return false;
    }
    if (conds.flag_not_required) {
      const flags = Array.isArray(conds.flag_not_required) ? conds.flag_not_required : [conds.flag_not_required];
      if (flags.some(f => storyFlags.includes(f))) return false;
    }
    if (conds.flags_not_required_all) {
      const flags = Array.isArray(conds.flags_not_required_all) ? conds.flags_not_required_all : [conds.flags_not_required_all];
      if (flags.every(f => storyFlags.includes(f))) return false;
    }
    if (conds.flag_forbidden && storyFlags.includes(conds.flag_forbidden)) return false;
    if (conds.item_required) {
      const items = Array.isArray(conds.item_required) ? conds.item_required : [conds.item_required];
      if (!items.every(it => playerInventory.includes(it))) return false;
    }
    if (conds.item_required_any) {
      const items = Array.isArray(conds.item_required_any) ? conds.item_required_any : [conds.item_required_any];
      if (!items.some(it => playerInventory.includes(it))) return false;
    }

    return true;
  });
}

// ==========================================
// 🔐 АВТОРИЗАЦИЯ (SUPABASE AUTH)
// ==========================================

// Регистрация нового игрока
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, username } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: 'Email и пароль обязательны' }, 400);
    }

    const authRes = await fetch(`${c.env.SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        data: { username: username || email.split('@')[0] },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return c.json({
        error: authData.error_description || authData.msg || 'Ошибка регистрации',
      }, authRes.status);
    }

    if (!authData.access_token) {
      return c.json({
        message: 'Регистрация успешна. Проверьте email для подтверждения.',
        user: { id: authData.user?.id, email: authData.user?.email },
      }, 200);
    }

    return c.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.user_metadata?.username,
      },
    });
  } catch (err) {
    console.error('❌ [AUTH] Register error:', err.message);
    return c.json({ error: 'Ошибка сервера при регистрации' }, 500);
  }
});

// Вход (получение токена)
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: 'Email и пароль обязательны' }, 400);
    }

    const authRes = await fetch(`${c.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return c.json({
        error: authData.error_description || authData.msg || 'Неверный email или пароль',
      }, 401);
    }

    return c.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.user_metadata?.username,
      },
    });
  } catch (err) {
    console.error('❌ [AUTH] Login error:', err.message);
    return c.json({ error: 'Ошибка сервера при входе' }, 500);
  }
});

// Обновление токена
app.post('/api/auth/refresh', async (c) => {
  try {
    const { refresh_token } = await c.req.json();
    if (!refresh_token) {
      return c.json({ error: 'Refresh token обязателен' }, 400);
    }

    const authRes = await fetch(`${c.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return c.json({ error: 'Недействительный refresh token' }, 401);
    }

    return c.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
    });
  } catch (err) {
    console.error('❌ [AUTH] Refresh error:', err.message);
    return c.json({ error: 'Ошибка обновления токена' }, 500);
  }
});

// --- API ЭНДПОИНТЫ ---

// 1. Получить текущую сцену и доступные выборы
app.get('/api/state', authMiddleware, async (c) => {
  const t = timingStart();
  const userId = c.get('userId');
  try {
    let player = await getPlayerState(c.env, userId);
    timingStep(t, 'player');

    if (!player) {
      const startNodeId = await getStartNodeId(c.env);
      if (!startNodeId) throw new Error('No start node configured in DB');
      player = await createPlayerState(c.env, userId, startNodeId);
    }

    if (!player.current_node_id) {
      const startNodeId = await getStartNodeId(c.env);
      if (!startNodeId) return c.json({ error: 'No start node to recover' }, 500);
      player.current_node_id = startNodeId;
      player.visited_nodes = player.visited_nodes?.length ? player.visited_nodes : [startNodeId];
      await updatePlayerState(c.env, userId, player);
    }

    const skillsArr = player.skills || [];
    player.skill_primary = skillsArr[0] || null;

    const lang = normalizeLang(c.req.header('Accept-Language'));
    const [currentNode, allChoices] = await Promise.all([
      getNode(c.env, player.current_node_id, lang),
      getChoicesForNode(c.env, player.current_node_id, lang),
    ]);
    timingStep(t, 'node+choices');

    if (!currentNode) return c.json({ error: 'Current node not found in DB' }, 404);

    const availableChoices = filterChoices(allChoices, player);

    timingLog('GET /api/state', t, { user: userId, node: currentNode.id, cache: cacheStats().size });
    return c.json({ player, node: currentNode, choices: availableChoices });
  } catch (err) {
    timingLog('GET /api/state ERROR', t, { user: userId, error: err.message });
    return c.json({ error: 'Failed to load game state', details: err.message }, 500);
  }
});

// 2. Обработка выбора игрока
app.post('/api/choice', authMiddleware, async (c) => {
  const t = timingStart();
  const userId = c.get('userId');
  try {
    const { choiceId, difficulty } = await c.req.json();
    if (!choiceId) return c.json({ error: 'Missing choiceId' }, 400);

    const lang = normalizeLang(c.req.header('Accept-Language'));

    const [choice, player] = await Promise.all([
      getChoiceById(c.env, choiceId, lang),
      getPlayerState(c.env, userId),
    ]);
    timingStep(t, 'choice+player');

    if (!choice) return c.json({ error: 'Choice not found' }, 404);
    if (!player) return c.json({ error: 'Player not found' }, 404);

    const effects = choice.effects || {};
    const updates = { ...player };
    // Клонируем массивы, чтобы отслеживать добавленные/удалённые элементы
    updates.inventory = [...(player.inventory || [])];
    updates.story_flags = [...(player.story_flags || [])];
    updates.skills = [...(player.skills || [])];
    updates.visited_nodes = [...(player.visited_nodes || [])];
    if (!updates.visited_nodes.includes(player.current_node_id)) {
      updates.visited_nodes.push(player.current_node_id);
    }

    if (effects.apply_damage) updates.hp = Math.max(0, updates.hp - effects.apply_damage);
    if (effects.add_hp) updates.hp = Math.min(100, updates.hp + effects.add_hp);
    if (effects.set_hp !== undefined) updates.hp = effects.set_hp;

    if (effects.add_flag) {
      const flags = updates.story_flags || [];
      if (!flags.includes(effects.add_flag)) flags.push(effects.add_flag);
      updates.story_flags = flags;
    }
    if (effects.remove_flags && Array.isArray(effects.remove_flags)) {
      updates.story_flags = (updates.story_flags || []).filter(f => !effects.remove_flags.includes(f));
    }

    if (effects.add_item) {
      const items = updates.inventory || [];
      if (!items.includes(effects.add_item)) items.push(effects.add_item);
      updates.inventory = items;
    }
    if (effects.remove_item) {
      updates.inventory = (updates.inventory || []).filter(item => item !== effects.remove_item);
    }

    const currentSkills = updates.skills || [];
    if (effects.add_skill && !currentSkills.includes(effects.add_skill)) {
      currentSkills.push(effects.add_skill);
    }
    updates.skills = currentSkills;
    updates.skill_primary = currentSkills[0] || null;

    // --- Автопроверка коллекционных ачивок ---
    const COLLECTION_ACHIEVEMENTS = [
      {
        id: 'ach_full_toolkit',
        flag: 'ach_full_toolkit_unlocked',
        items: ['Откалиброванный Магнитометр', 'Тяжелый лом', 'Канцелярские зажимы', 'Сломанный Хронометр', 'КПК Директора', 'Сломанный Сервопривод'],
      },
      {
        id: 'ach_lore_historian',
        flag: 'ach_lore_historian_unlocked',
        required_flags: ['visited_lore_pad', 'visited_lore_papers', 'visited_core_terminal'],
      },
      {
        id: 'ach_clean_bill',
        flag: 'ach_clean_bill_unlocked',
        absent_flags: ['открытое_кровотечение', 'травма_контузия', 'травма_токсикоз'],
        trigger_removed_flags: ['открытое_кровотечение', 'травма_контузия', 'травма_токсикоз'],
      },
    ];

    let unlockedAchievement = null;
    let alreadyUnlocked = false;

    const oldInventory = player.inventory || [];
    const newInventory = updates.inventory || [];
    const addedItems = newInventory.filter(it => !oldInventory.includes(it));

    const oldFlags = player.story_flags || [];
    const newFlags = updates.story_flags || [];
    const addedFlags = newFlags.filter(f => !oldFlags.includes(f));
    const removedFlags = oldFlags.filter(f => !newFlags.includes(f));

    const hasAnyCollectionTrigger = addedItems.length > 0 || addedFlags.length > 0 || removedFlags.length > 0;
    if (hasAnyCollectionTrigger && COLLECTION_ACHIEVEMENTS.length > 0) {
      const achIds = COLLECTION_ACHIEVEMENTS.map(a => a.id).join(',');
      const unlockedRes = await supabaseFetch(c.env, `/user_achievements?user_id=eq.${userId}&achievement_id=in.(${achIds})&select=achievement_id`);
      const unlockedData = await unlockedRes.json();
      const unlockedIds = new Set(unlockedData.map(r => r.achievement_id));

      for (const col of COLLECTION_ACHIEVEMENTS) {
        let satisfied = true;

        if (col.items) {
          if (!col.items.every(it => newInventory.includes(it))) satisfied = false;
          // Swiss knife achievement should only trigger when one of its items is picked up
          if (satisfied && !col.items.some(it => addedItems.includes(it))) satisfied = false;
        }
        if (satisfied && col.required_flags) {
          if (!col.required_flags.every(f => newFlags.includes(f))) satisfied = false;
          // Lore historian achievement should only trigger when one of its lore flags is added
          if (satisfied && !col.required_flags.some(f => addedFlags.includes(f))) satisfied = false;
        }
        if (satisfied && col.absent_flags) {
          if (col.absent_flags.some(f => newFlags.includes(f))) satisfied = false;
        }
        if (satisfied && col.trigger_removed_flags) {
          if (!col.trigger_removed_flags.some(f => removedFlags.includes(f))) satisfied = false;
        }

        if (!satisfied) continue;

        const ach = await getAchievement(c.env, col.id, lang);
        if (!ach) continue;

        if (unlockedIds.has(col.id)) {
          // Ачивка уже есть, но клиент может захотеть показать эффект повторно
          unlockedAchievement = ach;
          alreadyUnlocked = true;
          continue;
        }

        const flags = updates.story_flags || [];
        if (!flags.includes(col.flag)) flags.push(col.flag);
        updates.story_flags = flags;

        const wasNew = await unlockAchievement(c.env, userId, col.id);
        unlockedAchievement = ach;
        alreadyUnlocked = !wasNew;
      }
    }
    // ---

    updates.current_node_id = choice.target_node_id;
    await updatePlayerState(c.env, userId, updates);
    timingStep(t, 'update');

    // Логика обработки явной ачивки из выбора (если не была выдана автопроверкой)
    if (effects.unlock_achievement && (!unlockedAchievement || unlockedAchievement.id !== effects.unlock_achievement)) {
      const ach = await getAchievement(c.env, effects.unlock_achievement, lang);
      if (ach) {
        const wasNew = await unlockAchievement(c.env, userId, effects.unlock_achievement);
        unlockedAchievement = ach;
        alreadyUnlocked = !wasNew;
      }
    }
    timingStep(t, 'achievements');

    // Если у выбора нет следующей ноды — генерируем виртуальную финальную сцену
    if (!choice.target_node_id) {
      const closingNode = {
        id: 'ending_terminal_node',
        act: 3,
        location_name: 'КРИТИЧЕСКИЙ СЕКТОР',
        title: 'ПРОТОКОЛ ЗАВЕРШЕН',
        narrative: choice.narrative_override || 'Конец сессии связи с терминалом.',
        thought: 'Био-сигналы оператора потеряны...',
        is_ending: true,
        ending_type: 'TERMINATED'
      };
      timingLog('POST /api/choice terminal', t, { user: userId, choice: choiceId, cache: cacheStats().size });
      return c.json({
        success: true,
        node: closingNode,
        choices: [],
        player: updates,
        is_ending: true,
        unlocked_achievement: unlockedAchievement,
        already_unlocked: alreadyUnlocked
      });
    }

    const [newNode, nextAllChoices] = await Promise.all([
      getNode(c.env, choice.target_node_id, lang),
      getChoicesForNode(c.env, choice.target_node_id, lang),
    ]);
    timingStep(t, 'node+choices');

    if (!newNode) return c.json({ error: 'Target node missing from database' }, 404);

    // 🏆 Фиксируем достигнутую концовку для рейтинга.
    if (newNode.is_ending) {
      await recordUserEnding(c.env, userId, newNode.id, newNode.ending_type || null);
    }

    // 🏆 Автоматическая выдача достижений по типу концовки (если choice ещё не выдал ачивку).
    const ENDING_ACHIEVEMENTS = {
      'victory_stasis': 'ach_steel_cocoon',
    };
    if (newNode.is_ending && ENDING_ACHIEVEMENTS[newNode.ending_type] && !unlockedAchievement) {
      const endingAchId = ENDING_ACHIEVEMENTS[newNode.ending_type];
      const endingAch = await getAchievement(c.env, endingAchId, lang);
      if (endingAch) {
        const wasNew = await unlockAchievement(c.env, userId, endingAchId);
        unlockedAchievement = endingAch;
        alreadyUnlocked = !wasNew;
      }
    }

    const nextChoices = filterChoices(nextAllChoices, updates);

    timingLog('POST /api/choice', t, { user: userId, choice: choiceId, node: newNode.id, cache: cacheStats().size });
    return c.json({
      success: true,
      narrative_override: choice.narrative_override,
      node: newNode,
      choices: nextChoices,
      player: updates,
      is_ending: newNode.is_ending || false,
      ending_type: newNode.ending_type || null,
      unlocked_achievement: unlockedAchievement,
      already_unlocked: alreadyUnlocked
    });
  } catch (err) {
    timingLog('POST /api/choice ERROR', t, { user: userId, choice: choiceId, error: err.message, cache: cacheStats().size });
    return c.json({ error: 'Failed to process choice', details: err.message }, 500);
  }
});

// 2a. Обработка провала мини-игры (failure-выборы удалены из БД)
app.post('/api/minigame/failure', authMiddleware, async (c) => {
  const t = timingStart();
  const userId = c.get('userId');
  try {
    const { choiceId, difficulty } = await c.req.json();
    if (!choiceId) return c.json({ error: 'Missing choiceId' }, 400);

    const lang = normalizeLang(c.req.header('Accept-Language'));

    const [choice, player] = await Promise.all([
      getChoiceById(c.env, choiceId, lang),
      getPlayerState(c.env, userId),
    ]);
    timingStep(t, 'choice+player');

    if (!choice) return c.json({ error: 'Choice not found' }, 404);

    const effects = choice.effects || {};
    if (!effects.minigame) {
      return c.json({ error: 'Choice is not a minigame' }, 400);
    }

    if (!player) return c.json({ error: 'Player not found' }, 404);

    const failNodeId = `fail_${choiceId}`;
    const failedFlag = `${choiceId}_failed`;

    const storyFlags = [...(player.story_flags || [])];
    if (!storyFlags.includes(failedFlag)) storyFlags.push(failedFlag);

    const updates = {
      ...player,
      current_node_id: failNodeId,
      story_flags: storyFlags,
    };

    // Apply damage on minigame failure; Hard difficulty doubles it
    const baseDamage = effects.apply_damage || 10;
    const damageMultiplier = difficulty === 'hard' ? 2 : 1;
    updates.hp = Math.max(0, (player.hp || 100) - baseDamage * damageMultiplier);

    await updatePlayerState(c.env, userId, updates);
    timingStep(t, 'update');

    const [failNode, allChoices] = await Promise.all([
      getNode(c.env, failNodeId, lang),
      getChoicesForNode(c.env, failNodeId, lang),
    ]);
    timingStep(t, 'node+choices');

    if (!failNode) return c.json({ error: 'Failure node not found' }, 404);

    const availableChoices = filterChoices(allChoices, updates);

    timingLog('POST /api/minigame/failure', t, { user: userId, choice: choiceId, cache: cacheStats().size });
    return c.json({
      success: true,
      narrative_override: null,
      node: failNode,
      choices: availableChoices,
      player: updates,
      is_ending: failNode.is_ending || false,
      ending_type: failNode.ending_type || null,
      unlocked_achievement: null,
    });
  } catch (err) {
    timingLog('POST /api/minigame/failure ERROR', t, { user: userId, choice: choiceId, error: err.message, cache: cacheStats().size });
    return c.json({ error: 'Failed to process minigame failure', details: err.message }, 500);
  }
});

// 3. Полный сброс прогресса игрока под новую игру
app.post('/api/reset', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');

    const startNodeId = await getStartNodeId(c.env);
    if (!startNodeId) throw new Error('No start node configured in DB');

    await updatePlayerState(c.env, userId, {
      hp: 100,
      story_flags: [],
      inventory: [],
      skills: [],
      current_node_id: startNodeId,
      visited_nodes: [startNodeId],
    });

    return c.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /api/reset:', err.message);
    return c.json({ error: 'Failed to reset game state', details: err.message }, 500);
  }
});

// 3.1 Прогресс для интерактивной карты сюжета (Pro)
app.get('/api/story/progress', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const isPro = await isProUser(c.env, userId);
    if (!isPro) {
      return c.json({ error: 'pro_required', message: 'Карта сюжета доступна в Pro версии' }, 403);
    }

    const [playerRes, achievementsRes, endingsRes] = await Promise.all([
      supabaseFetch(c.env, `/game_state?user_id=eq.${userId}&select=visited_nodes,current_node_id`),
      supabaseFetch(c.env, `/user_achievements?user_id=eq.${userId}&select=achievement_id`),
      supabaseFetch(c.env, `/user_endings?user_id=eq.${userId}&select=node_id,ending_type`),
    ]);

    const playerData = await playerRes.json();
    const achievementsData = await achievementsRes.json();
    const endingsData = await endingsRes.json();

    const player = playerData[0] || {};
    return c.json({
      visited_nodes: player.visited_nodes || [],
      current_node_id: player.current_node_id || null,
      unlocked_achievements: achievementsData.map((r) => r.achievement_id),
      unlocked_endings: endingsData.map((r) => ({ node_id: r.node_id, ending_type: r.ending_type })),
    });
  } catch (err) {
    console.error('❌ Error in GET /api/story/progress:', err.message);
    return c.json({ error: 'Failed to load story progress', details: err.message }, 500);
  }
});

// 4. Кабинет достижений — список всех достижений + статус разблокировки
app.get('/api/achievements', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');

    const lang = normalizeLang(c.req.header('Accept-Language'));
    const allAchievements = await getAchievements(c.env, lang);

    const uaRes = await supabaseFetch(c.env, `/user_achievements?user_id=eq.${userId}&select=achievement_id`);
    const uaData = await uaRes.json();
    const unlockedIds = uaData.map(r => r.achievement_id);

    const achievements = allAchievements.map(ach => ({
      ...ach,
      unlocked: unlockedIds.includes(ach.id),
    }));

    return c.json({ achievements });
  } catch (err) {
    console.error('❌ Error in /api/achievements:', err.message);
    return c.json({ error: 'Failed to load achievements', details: err.message }, 500);
  }
});

// 4.1 Сброс всех достижений игрока
app.post('/api/achievements/reset', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');

    await supabaseFetch(c.env, `/user_achievements?user_id=eq.${userId}`, {
      method: 'DELETE',
    });

    return c.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /api/achievements/reset:', err.message);
    return c.json({ error: 'Failed to reset achievements', details: err.message }, 500);
  }
});

// 5. Умный подсказчик к неполученным ачивкам
app.post('/api/hint', authMiddleware, async (c) => {
  const t = timingStart();
  const userId = c.get('userId');
  try {
    const { target_tier, target_type, target_achievement_id } = await c.req.json();

    const isPro = await isProUser(c.env, userId);
    const requestedTier = (target_tier || '').toUpperCase();
    if (!isPro && ['GOLD', 'PLATINUM'].includes(requestedTier)) {
      timingLog('POST /api/hint PRO REQUIRED', t, { user: userId, tier: requestedTier, cache: cacheStats().size });
      return c.json({ error: 'pro_required', message: 'Подсказки для GOLD и PLATINUM доступны в Pro версии' }, 403);
    }

    // Free-версия видит только BRONZE и SILVER; ANY трактуем как SILVER.
    const effectiveTier = isPro
      ? (target_tier || 'ANY')
      : (requestedTier === 'ANY' ? 'SILVER' : target_tier);

    const lang = normalizeLang(c.req.header('Accept-Language'));
    const result = await getHint(c.env, userId, effectiveTier, target_type, target_achievement_id, {
      getPlayerState,
      supabaseFetch,
      getChoicesForNode,
      lang,
      localizeAchievement,
      localizeChoice,
    });
    timingStep(t, 'hint');

    if (result.error) {
      timingLog('POST /api/hint ERROR', t, { user: userId, error: result.error, cache: cacheStats().size });
      return c.json({ error: result.error }, 404);
    }

    timingLog('POST /api/hint', t, { user: userId, tier: effectiveTier || 'ANY', target: result.target_achievement?.id || 'none', reachable: result.reachable, cache: cacheStats().size });
    return c.json(result);
  } catch (err) {
    timingLog('POST /api/hint ERROR', t, { user: userId, error: err.message, cache: cacheStats().size });
    return c.json({ error: 'Failed to build hint', details: err.message }, 500);
  }
});

// 6. 🏆 Глобальный рейтинг игроков
app.get('/api/leaderboard', async (c) => {
  const t = timingStart();
  try {
    const query = c.req.query();
    const limit = Math.min(parseInt(query.limit || '50', 10), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);
    const sort = ['score', 'achievements_count', 'endings_count'].includes(query.sort)
      ? query.sort
      : 'score';

    const authHeader = c.req.header('authorization');
    let currentUserId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const userRes = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        });
        if (userRes.ok) {
          const user = await userRes.json();
          currentUserId = user.id;
        }
      } catch (err) {
        // Токен недействителен — просто не показываем "мою" позицию.
      }
    }

    // Рейтинг доступен только в Pro.
    const hasProAccess = currentUserId && await isProUser(c.env, currentUserId);
    if (!hasProAccess) {
      timingLog('GET /api/leaderboard PRO REQUIRED', t, { user: currentUserId || 'anonymous', cache: cacheStats().size });
      return c.json({ error: 'pro_required', message: 'Рейтинг доступен в Pro версии' }, 403);
    }

    const [listRes, countRes, meRes] = await Promise.all([
      supabaseFetch(c.env, '/rpc/get_leaderboard', {
        method: 'POST',
        body: JSON.stringify({ p_limit: limit, p_offset: offset, p_sort: sort }),
      }),
      supabaseFetch(c.env, '/leaderboard?select=user_id'),
      currentUserId
        ? supabaseFetch(c.env, '/rpc/get_leaderboard_me', {
            method: 'POST',
            body: JSON.stringify({ p_user_id: currentUserId }),
          })
        : Promise.resolve(null),
    ]);

    const list = await listRes.json();
    const countData = await countRes.json();
    const me = meRes ? await meRes.json() : null;
    timingStep(t, 'leaderboard');

    timingLog('GET /api/leaderboard', t, { limit, offset, sort, count: list.length });
    return c.json({
      leaderboard: list,
      total: countData.length,
      me: Array.isArray(me) ? me[0] : me,
    });
  } catch (err) {
    timingLog('GET /api/leaderboard ERROR', t, { error: err.message });
    return c.json({ error: 'Failed to load leaderboard', details: err.message }, 500);
  }
});

// 7. 💎 Pro-статус
app.get('/api/pro/verify', authMiddleware, async (c) => {
  const t = timingStart();
  const userId = c.get('userId');
  try {
    const isPro = await isProUser(c.env, userId);
    timingLog('GET /api/pro/verify', t, { user: userId, is_pro: isPro, cache: cacheStats().size });
    return c.json({ is_pro: isPro });
  } catch (err) {
    timingLog('GET /api/pro/verify ERROR', t, { user: userId, error: err.message, cache: cacheStats().size });
    return c.json({ error: 'Failed to verify pro status', details: err.message }, 500);
  }
});

app.post('/api/redeem_promo_code', authMiddleware, async (c) => {
  const t = timingStart();
  const userId = c.get('userId');
  try {
    const { code } = await c.req.json();
    if (!code || typeof code !== 'string') {
      return c.json({ error: 'Missing promo code' }, 400);
    }

    if (await isProUser(c.env, userId)) {
      return c.json({ error: 'already_pro' }, 400);
    }

    const promoRes = await supabaseFetch(c.env, `/promo_codes?code=eq.${encodeURIComponent(code.trim())}&is_active=eq.true&select=code,max_uses,used_count,expires_at`);
    const promos = await promoRes.json();
    if (promos.length === 0) {
      timingLog('POST /api/redeem_promo_code INVALID', t, { user: userId, code: code.trim(), cache: cacheStats().size });
      return c.json({ error: 'invalid_code' }, 400);
    }

    const promo = promos[0];
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      timingLog('POST /api/redeem_promo_code EXPIRED', t, { user: userId, code: code.trim(), cache: cacheStats().size });
      return c.json({ error: 'expired_code' }, 400);
    }
    if (promo.max_uses !== null && promo.max_uses !== undefined && promo.used_count >= promo.max_uses) {
      timingLog('POST /api/redeem_promo_code DEPLETED', t, { user: userId, code: code.trim(), cache: cacheStats().size });
      return c.json({ error: 'code_depleted' }, 400);
    }

    // Атомарно увеличиваем счётчик использований.
    const newUsedCount = (promo.used_count ?? 0) + 1;
    const patchRes = await supabaseFetch(c.env, `/promo_codes?code=eq.${encodeURIComponent(code.trim())}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ used_count: newUsedCount }),
    });
    if (!patchRes.ok) {
      throw new Error('Failed to update promo code usage count');
    }

    await setProUser(c.env, userId, 'promo_code');
    timingLog('POST /api/redeem_promo_code OK', t, { user: userId, code: code.trim(), cache: cacheStats().size });
    return c.json({ success: true, is_pro: true });
  } catch (err) {
    timingLog('POST /api/redeem_promo_code ERROR', t, { user: userId, error: err.message, cache: cacheStats().size });
    return c.json({ error: 'Failed to redeem promo code', details: err.message }, 500);
  }
});

// 6. Баг-репорты
app.post('/api/bug_report', authMiddleware, async (c) => {
  const userId = c.get('userId');
  try {
    const body = await c.req.json();
    const comment = (body.comment || '').toString().trim();
    if (comment.length > 2000) {
      return c.json({ error: 'Comment is too long' }, 400);
    }

    const payload = {
      user_id: userId,
      current_node_id: body.current_node_id || null,
      player_state: body.player_state || null,
      comment: comment || null,
      app_version: (body.app_version || '').toString() || null,
      locale: (body.locale || '').toString() || null,
    };

    const res = await supabaseFetch(c.env, '/bug_reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase error ${res.status}: ${errText}`);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /api/bug_report:', err.message);
    return c.json({ error: 'Failed to send bug report', details: err.message }, 500);
  }
});

// Health-check
app.get('/', (c) => c.json({ status: '🚀 Engine Running', platform: 'Cloudflare Workers' }));

export default app;
