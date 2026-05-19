const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS настройки
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer'],
}));

app.use(express.json());

// 🔧 Хелперы для Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: '🚀 Backend is running!', 
    supabase: SUPABASE_URL ? 'connected' : 'not configured',
    timestamp: new Date().toISOString()
  });
});

// 🎮 Основной эндпоинт
app.post('/api/action', async (req, res) => {
  const t0 = Date.now();
  console.log(`\n📥 [${new Date().toISOString()}] POST /api/action`);
  
  try {
    const { userId, userAction } = req.body;
    
    if (!userId || !userAction) {
      return res.status(400).json({ error: 'Missing userId or userAction' });
    }
    
    console.log(`🎮 User: ${userId} | Action: "${userAction}"`);
    
    // ========================================
    // 1. 📥 ЗАГРУЗКА СОСТОЯНИЯ ИЗ SUPABASE
    // ========================================
    const t1 = Date.now();
    const stateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/game_state?select=*&user_id=eq.${userId}`,
      { headers: supabaseHeaders }
    );
    
    if (!stateRes.ok) {
      throw new Error(`Supabase error: ${stateRes.status} ${stateRes.statusText}`);
    }
    
    const stateData = await stateRes.json();
    const gameState = stateData[0];
    
    if (!gameState) {
      console.error('❌ Game state not found for user:', userId);
      return res.status(404).json({ error: 'Game state not found' });
    }
    
    console.log(`⏱️ DB_LOAD: ${Date.now() - t1}ms | HP: ${gameState.hp}, SYNC: ${gameState.chip_sync}%`);
    
    // ========================================
    // 2. 🧠 ПРОМПТ ДЛЯ ИИ
    // ========================================
    const prompt = `Ты — Чип, ИИ в голове киберпанк-героя. Циничен, помогаешь выжить. Отвечай на русском.

Действие игрока: "${userAction}"
Статы: HP=${gameState.hp}, SYNC=${gameState.chip_sync}%
Флаги: ${gameState.story_flags?.join(', ') || 'нет'}

Верни СТРОГО один валидный JSON-объект (без текста до/после, без markdown):
{
  "narrative": "2-3 предложения описания ситуации",
  "thought": "короткая внутренняя мысль героя в кавычках",
  "branches": [
    {"label": "вариант действия 1", "narrative": "краткий результат", "hp_change": 0, "image_prompt": "киберпанк сцена на английском"},
    {"label": "вариант действия 2", "narrative": "краткий результат", "hp_change": 0, "image_prompt": "киберпанк сцена на английском"},
    {"label": "вариант действия 3", "narrative": "краткий результат", "hp_change": 0, "image_prompt": "киберпанк сцена на английском"}
  ]
}

Пример:
{"narrative":"Ты в переулке","thought":"Где я?","branches":[{"label":"Осмотреться","narrative":"Вижу мусор","hp_change":0,"image_prompt":"cyberpunk alley trash"}]}`;
    
    // ========================================
    // 3. 🤖 ЗАПРОС К ИИ (OpenCode)
    // ========================================
    const t2 = Date.now();
    const aiRes = await fetch(`${process.env.OPENCODE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENCODE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 3000,
      }),
    });
    
    const aiData = await aiRes.json();
    const fullText = aiData.choices?.[0]?.message?.content || '';
    console.log(`⏱️ AI_RESPONSE: ${Date.now() - t2}ms`);
    
    // ========================================
    // 4. 🔪 ПАРСИНГ ОТВЕТА
    // ========================================
    let updates = {};
    let narrative = fullText;
    
    const jsonMatch = fullText.match(/\{[\s\S]*\}\s*$/);
    if (jsonMatch) {
      try {
        updates = JSON.parse(jsonMatch[0]);
        narrative = updates.narrative || narrative;
        console.log(`✅ Parsed JSON: narrative=${narrative?.substring(0, 40)}..., branches=${updates.branches?.length || 0}`);
      } catch (e) {
        console.warn('⚠️ JSON parse failed:', e.message);
      }
    }
    
    // Если ИИ вернул массив — берём первый элемент
    if (Array.isArray(updates) && updates.length > 0) {
      updates = updates[0];
      narrative = updates.narrative || narrative;
    }
    
    // ========================================
    // 5. 🖼️ ГЕНЕРАЦИЯ КАРТИНОК ДЛЯ ВЕТОК
    // ========================================
    const branches = updates.branches || [];
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      if (branch.image_prompt) {
        const branchId = `branch_${branch.label.replace(/\s+/g, '_')}`;
        
        // Проверяем кэш в Supabase
        try {
          const cacheRes = await fetch(
            `${SUPABASE_URL}/rest/v1/location_images?select=image_url&location_id=eq.${branchId}`,
            { headers: supabaseHeaders }
          );
          const cacheData = await cacheRes.json();
          
          if (cacheData.length > 0) {
            branch.image_url = cacheData[0].image_url;
            console.log(`🖼️ [BRANCH ${i}] CACHE HIT`);
          } else {
            // Генерируем новую картинку (Unsplash заглушка)
            const keywords = branch.image_prompt.toLowerCase()
              .replace(/[^a-z0-9\s,]/g, '')
              .split(/[\s,]+/)
              .filter(w => w.length > 3)
              .slice(0, 3)
              .join(',');
            
            const variants = [
              'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1024&q=80',
              'https://images.unsplash.com/photo-1558002038-1055907df827?w=1024&q=80',
              'https://images.unsplash.com/photo-1512499617640-c2f999098e95?w=1024&q=80',
              'https://images.unsplash.com/photo-1515634928627-2a4e0dae3ddf?w=1024&q=80',
            ];
            const finalUrl = variants[i % variants.length];
            
            branch.image_url = finalUrl;
            
            // Сохраняем в кэш
            await fetch(`${SUPABASE_URL}/rest/v1/location_images`, {
              method: 'POST',
              headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
              body: JSON.stringify({
                location_id: branchId,
                image_url: finalUrl,
                prompt_used: branch.image_prompt
              }),
            });
            console.log(`🖼️ [BRANCH ${i}] GENERATED & CACHED`);
          }
        } catch (e) {
          console.warn(`⚠️ Image gen error: ${e.message}`);
        }
      }
    }
    
    // ========================================
    // 6. 💾 ОБНОВЛЕНИЕ СОСТОЯНИЯ В SUPABASE
    // ========================================
    const t3 = Date.now();
    const newFlags = [...(gameState.story_flags || [])];
    if (updates.new_flags) {
      updates.new_flags.forEach(f => { if (!newFlags.includes(f)) newFlags.push(f); });
    }
    
    const payload = {
      hp: Math.max(0, gameState.hp + (updates.hp_change || 0)),
      chip_sync: Math.min(100, Math.max(0, gameState.chip_sync + (updates.sync_change || 0))),
      sabotage_score: gameState.sabotage_score + (updates.sabotage_change || 0),
      story_flags: newFlags,
      updated_at: new Date().toISOString(),
    };
    
    if (updates.inventory_add) {
      payload.inventory = { ...(gameState.inventory || {}), ...updates.inventory_add };
    }
    if (updates.currency_chip_used) payload.currency_chip_available = false;
    if (updates.current_location_id) payload.current_location_id = updates.current_location_id;
    
    await fetch(`${SUPABASE_URL}/rest/v1/game_state?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify(payload),
    });
    console.log(`⏱️ DB_UPDATE: ${Date.now() - t3}ms`);
    
    // ========================================
    // 7. 📤 ОТВЕТ КЛИЕНТУ
    // ========================================
    const totalTime = Date.now() - t0;
    console.log(`✅ TOTAL: ${totalTime}ms\n`);
    
    res.json({
      narrative: narrative || 'Чип молчит...',
      text: narrative || '',
      thought: updates.thought || "",
      branches: branches,
      state_updated: true,
      image_url: null, // Можно добавить основную картинку локации
      debug_time_ms: totalTime
    });
    
  } catch (err) {
    console.error('❌ ERROR:', err);
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Server: http://localhost:${PORT}`);
  console.log(`📡 Endpoint: POST http://localhost:${PORT}/api/action`);
  console.log(`🗄️  Supabase: ${SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`🤖 OpenCode: ${process.env.OPENCODE_API_KEY ? '✅' : '❌'}`);
});