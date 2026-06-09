const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// ==========================================
// 🕵️‍♂️ ДИАГНОСТИКА ТИХОГО ВЫХОДА (УДАЛИТЬ ПОСЛЕ ТЕСТОВ)
// ==========================================
const originalExit = process.exit;
process.exit = function (code) {
  console.error(`\n🚨 ВНИМАНИЕ! Кто-то вызвал process.exit() с кодом: ${code}`);
  console.trace('Стек вызова, который убил сервер:');
  originalExit.apply(process, arguments);
};

process.on('exit', (code) => {
  console.log(`\n=== Event Loop пуст. Процесс завершается с кодом: ${code} ===`);
});
process.on('uncaughtException', (err) => {
  console.error('\n💥 КРИТИЧЕСКАЯ НЕПЕРЕХВАЧЕННАЯ ОШИБКА:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('\n💥 НЕОБРАБОТАННЫЙ ПРОМИС:', reason);
});

// ==========================================
// 🎛️ НАСТРОЙКИ СЕРВЕРА И ДЕПЕНДЕНСИ
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer'],
}));
app.use(express.json());

const DB_MODE = process.env.DB_MODE || 'LOCAL';
console.log(`📡 Инициализация движка. Режим базы данных: [${DB_MODE}]`);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const defaultHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ==========================================
// 🔐 AUTH MIDDLEWARE (Supabase Auth API)
// ==========================================

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Отсутствует токен авторизации' });
  }

  const token = authHeader.slice(7);
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      throw new Error(`Auth API returned ${userRes.status}`);
    }

    const user = await userRes.json();
    req.userId = user.id;
    next();
  } catch (err) {
    console.error('❌ [AUTH] Verify error:', err.message);
    return res.status(401).json({ error: 'Недействительный или просроченный токен' });
  }
}

let localPool = null;
if (DB_MODE === 'LOCAL') {
  localPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
}

// Сетевой клиент для работы с Supabase REST API
async function supabaseFetch(path, options = {}, retries = 3, baseDelay = 100) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const fetchOptions = {
    ...options,
    headers: { 'Connection': 'close', ...defaultHeaders, ...(options.headers || {}) }
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
// 📦 УНИВЕРСАЛЬНЫЙ СЛОЙ ДАННЫХ (DATA PROVIDERS)
// ==========================================

async function getPlayerState(userId) {
  if (DB_MODE === 'LOCAL') {
    const res = await localPool.query('SELECT * FROM public.game_state WHERE user_id = $1', [userId]);
    return res.rows[0];
  } {
    const res = await supabaseFetch(`/game_state?user_id=eq.${userId}`);
    const data = await res.json();
    return data[0];
  }
}

async function getStartNodeId() {
  if (DB_MODE === 'LOCAL') {
    const res = await localPool.query('SELECT id FROM public.nodes WHERE is_start_node = true LIMIT 1');
    return res.rows[0]?.id;
  } {
    const res = await supabaseFetch('/nodes?is_start_node=eq.true&select=id');
    const data = await res.json();
    return data[0]?.id;
  }
}

async function createPlayerState(userId, startNodeId) {
  if (DB_MODE === 'LOCAL') {
    const res = await localPool.query(
      `INSERT INTO public.game_state (user_id, current_node_id, hp, story_flags, inventory, skills) 
       VALUES ($1, $2, 100, $3, $4, $5) RETURNING *`,
      [userId, startNodeId, [], [], []]
    );
    return res.rows[0];
  } {
    const res = await supabaseFetch('/game_state', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ user_id: userId, current_node_id: startNodeId, hp: 100, story_flags: [], inventory: [], skills: [] })
    });
    return (await res.json())[0];
  }
}

async function updatePlayerState(userId, updates) {
  if (DB_MODE === 'LOCAL') {
    await localPool.query(
      `UPDATE public.game_state 
       SET hp = $1, story_flags = $2, inventory = $3, skills = $4, current_node_id = $5, updated_at = NOW() 
       WHERE user_id = $6`,
      [updates.hp, updates.story_flags, updates.inventory, updates.skills, updates.current_node_id, userId]
    );
  } {
    const res = await supabaseFetch(`/game_state?user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        hp: updates.hp,
        story_flags: updates.story_flags,
        inventory: updates.inventory,
        skills: updates.skills, 
        current_node_id: updates.current_node_id
      })
    });
    await res.text(); // Освобождаем сокет
  }
}

async function getNode(nodeId) {
  if (DB_MODE === 'LOCAL') {
    const res = await localPool.query('SELECT * FROM public.nodes WHERE id = $1', [nodeId]);
    return res.rows[0];
  } {
    const res = await supabaseFetch(`/nodes?id=eq.${nodeId}`);
    return (await res.json())[0];
  }
}

async function getChoicesForNode(nodeId) {
  if (DB_MODE === 'LOCAL') {
    const res = await localPool.query('SELECT * FROM public.choices WHERE node_id = $1 ORDER BY sort_order ASC', [nodeId]);
    return res.rows;
  } {
    const res = await supabaseFetch(`/choices?node_id=eq.${nodeId}&order=sort_order.asc`);
    return await res.json();
  }
}

async function unlockAchievement(userId, achievementId) {
  if (DB_MODE === 'LOCAL') {
    await localPool.query(
      `INSERT INTO public.user_achievements (user_id, achievement_id) 
       VALUES ($1, $2) 
       ON CONFLICT DO NOTHING`, 
      [userId, achievementId]
    );
  } else {
    const res = await supabaseFetch('/user_achievements', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify({ user_id: userId, achievement_id: achievementId })
    });
    if (res) await res.text(); // Освобождаем сокет Supabase!
  }
}

async function getAchievement(achievementId) {
  if (DB_MODE === 'LOCAL') {
    const res = await localPool.query('SELECT * FROM public.achievements WHERE id = $1', [achievementId]);
    return res.rows[0];
  } {
    const res = await supabaseFetch(`/achievements?id=eq.${achievementId}`);
    const data = await res.json();
    return data[0];
  }
}

async function getImageUrl(node) {
  if (!node || !node.id) return null;
  
  const filepath = path.join(__dirname, '..', 'uploads', 'nodes', `${node.id}.png`);
  try {
    await fs.access(filepath);
    return `/api/image/${node.id}`;
  } catch {
    return null;
  }
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
    if (conds.flag_not_required && storyFlags.includes(conds.flag_not_required)) return false;
    if (conds.flag_forbidden && storyFlags.includes(conds.flag_forbidden)) return false;
    if (conds.item_required && !playerInventory.includes(conds.item_required)) return false;
    
    // БАГ ИСПРАВЛЕН: Перенос строки убран, теперь возвращает true корректно
    return true; 
  });
}

// ==========================================
// 🔐 АВТОРИЗАЦИЯ (SUPABASE AUTH)
// ==========================================

// Регистрация нового игрока
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
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
      return res.status(authRes.status).json({
        error: authData.error_description || authData.msg || 'Ошибка регистрации',
      });
    }

    if (!authData.access_token) {
      return res.status(200).json({
        message: 'Регистрация успешна. Проверьте email для подтверждения.',
        user: { id: authData.user?.id, email: authData.user?.email },
      });
    }

    res.json({
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
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Вход (получение токена)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return res.status(401).json({
        error: authData.error_description || authData.msg || 'Неверный email или пароль',
      });
    }

    res.json({
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
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Обновление токена
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token обязателен' });
    }

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return res.status(401).json({ error: 'Недействительный refresh token' });
    }

    res.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
    });
  } catch (err) {
    console.error('❌ [AUTH] Refresh error:', err.message);
    res.status(500).json({ error: 'Ошибка обновления токена' });
  }
});

// --- API ЭНДПОИНТЫ ---

// 1. Получить текущую сцену и доступные выборы
app.get('/api/state', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    let player = await getPlayerState(userId);

    if (!player) {
      const startNodeId = await getStartNodeId();
      if (!startNodeId) throw new Error('No start node configured in DB');
      player = await createPlayerState(userId, startNodeId);
    }

    if (!player.current_node_id) {
      const startNodeId = await getStartNodeId();
      if (!startNodeId) return res.status(500).json({ error: 'No start node to recover' });
      player.current_node_id = startNodeId;
      await updatePlayerState(userId, player);
    }

    const skillsArr = player.skills || [];
    player.skill_primary = skillsArr[0] || 'КАЛИБРОВКА';

    const currentNode = await getNode(player.current_node_id);
    if (!currentNode) return res.status(404).json({ error: 'Current node not found in DB' });

    const allChoices = await getChoicesForNode(currentNode.id);
    const availableChoices = filterChoices(allChoices, player);

    const imageUrl = await getImageUrl(currentNode);

    res.json({ player, node: currentNode, choices: availableChoices, imageUrl });
  } catch (err) {
    console.error('❌ Error in /api/state:', err.message);
    res.status(500).json({ error: 'Failed to load game state', details: err.message });
  }
});

// 2. Обработка выбора игрока
app.post('/api/choice', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { choiceId } = req.body;
    if (!choiceId) return res.status(400).json({ error: 'Missing choiceId' });

    let choice = null;
    if (DB_MODE === 'LOCAL') {
      const choiceRes = await localPool.query('SELECT * FROM public.choices WHERE id = $1', [choiceId]);
      choice = choiceRes.rows[0];
    } else {
      const choiceRes = await supabaseFetch(`/choices?id=eq.${choiceId}`);
      choice = (await choiceRes.json())[0];
    }
    if (!choice) return res.status(404).json({ error: 'Choice not found' });

    let player = await getPlayerState(userId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

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
    await updatePlayerState(userId, updates);

    // Логика обработки ачивки
    let unlockedAchievement = null;
    if (effects.unlock_achievement) {
      await unlockAchievement(userId, effects.unlock_achievement);
      const ach = await getAchievement(effects.unlock_achievement);
      if (ach) {
        // Маппинг для старых и новых версий клиента (совместимость medal_tier -> rarity)
        const tierMap = { 'BRONZE': 'ОБЫЧНАЯ', 'SILVER': 'РЕДКАЯ', 'GOLD': 'ЭПИЧЕСКАЯ', 'PLATINUM': 'ЛЕГЕНДАРНАЯ' };
        unlockedAchievement = {
          ...ach,
          rarity: tierMap[ach.medal_tier?.toUpperCase()] || 'ОБЫЧНАЯ'
        };
      }
    }

    // Если у выбора нет следующей ноды — генерируем виртуальную финальную сцену, чтобы не ломать UI фронтенда
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
      return res.json({
        success: true,
        node: closingNode,
        choices: [],
        player: updates,
        is_ending: true,
        unlocked_achievement: unlockedAchievement
      });
    }

    const newNode = await getNode(choice.target_node_id);
    if (!newNode) return res.status(404).json({ error: 'Target node missing from database' });
    const nextAllChoices = await getChoicesForNode(newNode.id);
    const nextChoices = filterChoices(nextAllChoices, updates);

    const imageUrl = await getImageUrl(newNode);

    res.json({
      success: true,
      narrative_override: choice.narrative_override,
      node: newNode,
      choices: nextChoices,
      imageUrl,
      player: updates,
      is_ending: newNode.is_ending || false,
      ending_type: newNode.ending_type || null,
      unlocked_achievement: unlockedAchievement 
    });
  } catch (err) {
    console.error('❌ Error in /api/choice:', err.message);
    res.status(500).json({ error: 'Failed to process choice', details: err.message });
  }
});

// 3. Полный сброс прогресса игрока под новую игру
app.post('/api/reset', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const startNodeId = await getStartNodeId();
    if (!startNodeId) throw new Error('No start node configured in DB');

    await updatePlayerState(userId, {
      hp: 100,
      story_flags: [],
      inventory: [],
      skills: [],
      current_node_id: startNodeId
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /api/reset:', err.message);
    res.status(500).json({ error: 'Failed to reset game state', details: err.message });
  }
});

app.get('/api/image/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const filepath = path.join(__dirname, '..', 'uploads', 'nodes', `${nodeId}.png`);
    
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Image not found' });
    }

    const buffer = await fs.readFile(filepath);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error('❌ [IMAGE] Error:', err.message);
    res.status(500).json({ error: 'Image error', details: err.message });
  }
});

// 4. Кабинет достижений — список всех достижений + статус разблокировки
app.get('/api/achievements', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    let allAchievements = [];
    let unlockedIds = [];

    if (DB_MODE === 'LOCAL') {
      const achRes = await localPool.query('SELECT * FROM public.achievements ORDER BY medal_tier, title');
      allAchievements = achRes.rows;
      const uaRes = await localPool.query('SELECT achievement_id FROM public.user_achievements WHERE user_id = $1', [userId]);
      unlockedIds = uaRes.rows.map(r => r.achievement_id);
    } else {
      const achRes = await supabaseFetch('/achievements?order=medal_tier.asc,title.asc');
      allAchievements = await achRes.json();
      const uaRes = await supabaseFetch(`/user_achievements?user_id=eq.${userId}&select=achievement_id`);
      const uaData = await uaRes.json();
      unlockedIds = uaData.map(r => r.achievement_id);
    }

    const achievements = allAchievements.map(ach => ({
      ...ach,
      unlocked: unlockedIds.includes(ach.id),
      imageUrl: `/api/image/achievement/${ach.id}`,
    }));

    res.json({ achievements });
  } catch (err) {
    console.error('❌ Error in /api/achievements:', err.message);
    res.status(500).json({ error: 'Failed to load achievements', details: err.message });
  }
});

// 4.1 Сброс всех достижений игрока
app.post('/api/achievements/reset', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    if (DB_MODE === 'LOCAL') {
      await localPool.query('DELETE FROM public.user_achievements WHERE user_id = $1', [userId]);
    } else {
      await supabaseFetch(`/user_achievements?user_id=eq.${userId}`, {
        method: 'DELETE',
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /api/achievements/reset:', err.message);
    res.status(500).json({ error: 'Failed to reset achievements', details: err.message });
  }
});

// 5. Раздача иконок достижений
app.get('/api/image/achievement/:achId', async (req, res) => {
  try {
    const { achId } = req.params;
    const filepath = path.join(__dirname, '..', 'uploads', 'achievements', `${achId}.png`);
    
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Achievement image not found' });
    }

    const buffer = await fs.readFile(filepath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error('❌ [ACH_IMAGE] Error:', err.message);
    res.status(500).json({ error: 'Image error', details: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: '🚀 Engine Running', db_mode: DB_MODE, uptime: process.uptime() }));

app.listen(PORT, () => console.log(`🔥 Server online on port ${PORT} [Mode: ${DB_MODE}]`));