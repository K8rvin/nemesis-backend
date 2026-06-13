import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getHint } from './hintEngine.js';

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
    headers: { 'Connection': 'close', ...getDefaultHeaders(env), ...(options.headers || {}) },
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

async function getNode(env, nodeId) {
  const res = await supabaseFetch(env, `/nodes?id=eq.${nodeId}`);
  return (await res.json())[0];
}

async function getChoicesForNode(env, nodeId) {
  const res = await supabaseFetch(env, `/choices?node_id=eq.${nodeId}&order=sort_order.asc`);
  return await res.json();
}

async function unlockAchievement(env, userId, achievementId) {
  const res = await supabaseFetch(env, '/user_achievements', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, achievement_id: achievementId }),
  });
  if (res) await res.text(); // Освобождаем сокет Supabase!
}

async function getAchievement(env, achievementId) {
  const res = await supabaseFetch(env, `/achievements?id=eq.${achievementId}`);
  const data = await res.json();
  return data[0];
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
    if (conds.item_required && !playerInventory.includes(conds.item_required)) return false;

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
    player.skill_primary = skillsArr[0] || 'КАЛИБРОВКА';

    const currentNode = await getNode(c.env, player.current_node_id);
    if (!currentNode) return c.json({ error: 'Current node not found in DB' }, 404);

    const allChoices = await getChoicesForNode(c.env, currentNode.id);
    const availableChoices = filterChoices(allChoices, player);

    return c.json({ player, node: currentNode, choices: availableChoices });
  } catch (err) {
    console.error('❌ Error in /api/state:', err.message);
    return c.json({ error: 'Failed to load game state', details: err.message }, 500);
  }
});

// 2. Обработка выбора игрока
app.post('/api/choice', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { choiceId } = await c.req.json();
    if (!choiceId) return c.json({ error: 'Missing choiceId' }, 400);

    const choiceRes = await supabaseFetch(c.env, `/choices?id=eq.${choiceId}`);
    const choice = (await choiceRes.json())[0];

    if (!choice) return c.json({ error: 'Choice not found' }, 404);

    let player = await getPlayerState(c.env, userId);
    if (!player) return c.json({ error: 'Player not found' }, 404);

    const effects = choice.effects || {};
    const updates = { ...player };

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
    updates.skill_primary = currentSkills[0] || 'КАЛИБРОВКА';

    updates.current_node_id = choice.target_node_id;
    await updatePlayerState(c.env, userId, updates);

    // Логика обработки ачивки
    let unlockedAchievement = null;
    if (effects.unlock_achievement) {
      await unlockAchievement(c.env, userId, effects.unlock_achievement);
      const ach = await getAchievement(c.env, effects.unlock_achievement);
      if (ach) {
        const tierMap = { 'BRONZE': 'ОБЫЧНАЯ', 'SILVER': 'РЕДКАЯ', 'GOLD': 'ЭПИЧЕСКАЯ', 'PLATINUM': 'ЛЕГЕНДАРНАЯ' };
        unlockedAchievement = {
          ...ach,
          rarity: tierMap[ach.medal_tier?.toUpperCase()] || 'ОБЫЧНАЯ'
        };
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
        unlocked_achievement: unlockedAchievement
      });
    }

    const newNode = await getNode(c.env, choice.target_node_id);
    if (!newNode) return c.json({ error: 'Target node missing from database' }, 404);
    const nextAllChoices = await getChoicesForNode(c.env, newNode.id);
    const nextChoices = filterChoices(nextAllChoices, updates);

    return c.json({
      success: true,
      narrative_override: choice.narrative_override,
      node: newNode,
      choices: nextChoices,
      player: updates,
      is_ending: newNode.is_ending || false,
      ending_type: newNode.ending_type || null,
      unlocked_achievement: unlockedAchievement
    });
  } catch (err) {
    console.error('❌ Error in /api/choice:', err.message);
    return c.json({ error: 'Failed to process choice', details: err.message }, 500);
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

    const achRes = await supabaseFetch(c.env, '/achievements?order=medal_tier.asc,title.asc');
    const allAchievements = await achRes.json();

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
  try {
    const userId = c.get('userId');
    const { target_tier, target_type, target_achievement_id } = await c.req.json();

    const result = await getHint(c.env, userId, target_tier, target_type, target_achievement_id, {
      getPlayerState,
      supabaseFetch,
    });

    if (result.error) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result);
  } catch (err) {
    console.error('❌ Error in /api/hint:', err.message);
    return c.json({ error: 'Failed to build hint', details: err.message }, 500);
  }
});

// Health-check
app.get('/', (c) => c.json({ status: '🚀 Engine Running', platform: 'Cloudflare Workers' }));

export default app;
