import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getHint } from './achievementRoutes.js';
import { normalizeLang, localizeNode, localizeChoice, localizeAchievement } from './localization.js';

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
// 📦 СЛОЙ ДАННЫХ (DATA PROVIDERS)
// ==========================================
async function getPlayerState(env, userId) {
  const res = await supabaseFetch(env, `/game_state?user_id=eq.${userId}`);
  const data = await res.json();
  return data[0];
}

async function getStartNodeId(env) {
  const res = await supabaseFetch(env, '/nodes?is_start_node=eq.true&select=id');
  const data = await res.json();
  return data[0]?.id;
}

async function createPlayerState(env, userId, startNodeId) {
  const res = await supabaseFetch(env, '/game_state', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      current_node_id: startNodeId,
      hp: 100,
      story_flags: [],
      inventory: [],
      skills: [],
    }),
  });
  return (await res.json())[0];
}

async function updatePlayerState(env, userId, updates) {
  const res = await supabaseFetch(env, `/game_state?user_id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      hp: updates.hp,
      story_flags: updates.story_flags,
      inventory: updates.inventory,
      skills: updates.skills,
      current_node_id: updates.current_node_id,
    }),
  });
  await res.text(); // Освобождаем сокет
}

async function getNode(env, nodeId, lang) {
  const res = await supabaseFetch(env, `/nodes?id=eq.${nodeId}`);
  return localizeNode((await res.json())[0], lang);
}

async function getChoicesForNode(env, nodeId, lang) {
  const res = await supabaseFetch(env, `/choices?node_id=eq.${nodeId}&order=sort_order.asc`);
  const choices = await res.json();
  return choices.map(c => localizeChoice(c, lang));
}

async function getAchievements(env, lang) {
  const res = await supabaseFetch(env, '/achievements?order=medal_tier.asc,title.asc');
  const data = await res.json();
  return data.map(a => localizeAchievement(a, lang));
}

async function unlockAchievement(env, userId, achievementId) {
  const checkRes = await supabaseFetch(env, `/user_achievements?user_id=eq.${userId}&achievement_id=eq.${achievementId}&select=achievement_id`);
  const checkData = await checkRes.json();
  if (checkData.length > 0) return false; // уже разблокировано

  const res = await supabaseFetch(env, '/user_achievements', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ user_id: userId, achievement_id: achievementId }),
  });
  if (res) await res.text(); // Освобождаем сокет Supabase!
  return true;
}

async function getAchievement(env, achievementId, lang) {
  const res = await supabaseFetch(env, `/achievements?id=eq.${achievementId}`);
  const data = await res.json();
  return localizeAchievement(data[0], lang);
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
  const requestStart = Date.now();
  try {
    const userId = c.get('userId');

    let player = await getPlayerState(c.env, userId);

    if (!player) {
      const startNodeId = await getStartNodeId(c.env);
      if (!startNodeId) throw new Error('No start node configured in DB');
      player = await createPlayerState(c.env, userId, startNodeId);
    }

    if (!player.current_node_id) {
      const startNodeId = await getStartNodeId(c.env);
      if (!startNodeId) return c.json({ error: 'No start node to recover' }, 500);
      player.current_node_id = startNodeId;
      await updatePlayerState(c.env, userId, player);
    }

    const skillsArr = player.skills || [];
    player.skill_primary = skillsArr[0] || null;

    const lang = normalizeLang(c.req.header('Accept-Language'));
    const currentNode = await getNode(c.env, player.current_node_id, lang);
    if (!currentNode) return c.json({ error: 'Current node not found in DB' }, 404);

    const allChoices = await getChoicesForNode(c.env, currentNode.id, lang);
    const availableChoices = filterChoices(allChoices, player);

    console.log(`[API /api/state] user=${userId} duration=${Date.now() - requestStart}ms`);
    return c.json({ player, node: currentNode, choices: availableChoices });
  } catch (err) {
    console.error(`❌ Error in /api/state after ${Date.now() - requestStart}ms:`, err.message);
    return c.json({ error: 'Failed to load game state', details: err.message }, 500);
  }
});

// 2. Обработка выбора игрока
app.post('/api/choice', authMiddleware, async (c) => {
  const requestStart = Date.now();
  try {
    const userId = c.get('userId');
    const { choiceId } = await c.req.json();
    if (!choiceId) return c.json({ error: 'Missing choiceId' }, 400);

    const choiceRes = await supabaseFetch(c.env, `/choices?id=eq.${choiceId}`);
    const choice = (await choiceRes.json())[0];

    if (!choice) return c.json({ error: 'Choice not found' }, 404);

    let player = await getPlayerState(c.env, userId);
    if (!player) return c.json({ error: 'Player not found' }, 404);

    const lang = normalizeLang(c.req.header('Accept-Language'));

    const effects = choice.effects || {};
    const updates = { ...player };
    // Клонируем массивы, чтобы отслеживать добавленные/удалённые элементы
    updates.inventory = [...(player.inventory || [])];
    updates.story_flags = [...(player.story_flags || [])];
    updates.skills = [...(player.skills || [])];

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
        }
        if (satisfied && col.required_flags) {
          if (!col.required_flags.every(f => newFlags.includes(f))) satisfied = false;
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

    // Логика обработки явной ачивки из выбора (если не была выдана автопроверкой)
    if (effects.unlock_achievement && (!unlockedAchievement || unlockedAchievement.id !== effects.unlock_achievement)) {
      const ach = await getAchievement(c.env, effects.unlock_achievement, lang);
      if (ach) {
        const wasNew = await unlockAchievement(c.env, userId, effects.unlock_achievement);
        unlockedAchievement = ach;
        alreadyUnlocked = !wasNew;
      }
    }

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

    const newNode = await getNode(c.env, choice.target_node_id, lang);
    if (!newNode) return c.json({ error: 'Target node missing from database' }, 404);
    const nextAllChoices = await getChoicesForNode(c.env, newNode.id, lang);
    const nextChoices = filterChoices(nextAllChoices, updates);

    console.log(`[API /api/choice] user=${userId} choice=${choiceId} duration=${Date.now() - requestStart}ms`);
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
    console.error(`❌ Error in /api/choice after ${Date.now() - requestStart}ms:`, err.message);
    return c.json({ error: 'Failed to process choice', details: err.message }, 500);
  }
});

// 2a. Обработка провала мини-игры (failure-выборы удалены из БД)
app.post('/api/minigame/failure', authMiddleware, async (c) => {
  const requestStart = Date.now();
  try {
    const userId = c.get('userId');
    const { choiceId } = await c.req.json();
    if (!choiceId) return c.json({ error: 'Missing choiceId' }, 400);

    const choiceRes = await supabaseFetch(c.env, `/choices?id=eq.${choiceId}`);
    const choice = (await choiceRes.json())[0];
    if (!choice) return c.json({ error: 'Choice not found' }, 404);

    const effects = choice.effects || {};
    if (!effects.minigame) {
      return c.json({ error: 'Choice is not a minigame' }, 400);
    }

    const player = await getPlayerState(c.env, userId);
    if (!player) return c.json({ error: 'Player not found' }, 404);

    const lang = normalizeLang(c.req.header('Accept-Language'));
    const failNodeId = `fail_${choiceId}`;
    const failedFlag = `${choiceId}_failed`;

    const storyFlags = [...(player.story_flags || [])];
    if (!storyFlags.includes(failedFlag)) storyFlags.push(failedFlag);

    const updates = {
      ...player,
      current_node_id: failNodeId,
      story_flags: storyFlags,
    };

    await updatePlayerState(c.env, userId, updates);

    const failNode = await getNode(c.env, failNodeId, lang);
    if (!failNode) return c.json({ error: 'Failure node not found' }, 404);

    const allChoices = await getChoicesForNode(c.env, failNodeId, lang);
    const availableChoices = filterChoices(allChoices, updates);

    console.log(`[API /api/minigame/failure] user=${userId} choice=${choiceId} duration=${Date.now() - requestStart}ms`);
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
    console.error(`❌ Error in /api/minigame/failure after ${Date.now() - requestStart}ms:`, err.message);
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
      current_node_id: startNodeId
    });

    return c.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /api/reset:', err.message);
    return c.json({ error: 'Failed to reset game state', details: err.message }, 500);
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
  const requestStart = Date.now();
  try {
    const userId = c.get('userId');
    const { target_tier, target_type, target_achievement_id } = await c.req.json();

    const lang = normalizeLang(c.req.header('Accept-Language'));
    const result = await getHint(c.env, userId, target_tier, target_type, target_achievement_id, {
      getPlayerState,
      supabaseFetch,
      getChoicesForNode,
      lang,
      localizeAchievement,
      localizeChoice,
    });

    if (result.error) {
      console.log(`[API /api/hint] user=${userId} error=${result.error} duration=${Date.now() - requestStart}ms`);
      return c.json({ error: result.error }, 404);
    }

    console.log(`[API /api/hint] user=${userId} tier=${target_tier || 'ANY'} target=${result.target_achievement?.id || 'none'} reachable=${result.reachable} duration=${Date.now() - requestStart}ms`);
    return c.json(result);
  } catch (err) {
    console.error(`❌ Error in /api/hint after ${Date.now() - requestStart}ms:`, err.message);
    return c.json({ error: 'Failed to build hint', details: err.message }, 500);
  }
});

// Health-check
app.get('/', (c) => c.json({ status: '🚀 Engine Running', platform: 'Cloudflare Workers' }));

export default app;
