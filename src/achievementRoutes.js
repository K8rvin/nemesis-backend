// ==========================================
// 🗺️ ACHIEVEMENT ROUTES — загрузка готовых маршрутов из БД
// ==========================================

const START_NODE_ID = 'act1_skills';

const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

const TIER_NAME_MAP = {
  'BRONZE': 'ОБЫЧНАЯ',
  'SILVER': 'РЕДКАЯ',
  'GOLD': 'ЭПИЧЕСКАЯ',
  'PLATINUM': 'ЛЕГЕНДАРНАЯ',
};

function withRarity(achievement) {
  if (!achievement) return null;
  return {
    ...achievement,
    rarity: TIER_NAME_MAP[achievement.medal_tier?.toUpperCase()] || 'ОБЫЧНАЯ',
  };
}

function clonePlayer(player) {
  return {
    ...player,
    hp: player.hp ?? 100,
    story_flags: [...(player.story_flags || [])],
    inventory: [...(player.inventory || [])],
    skills: [...(player.skills || [])],
  };
}

export function filterSingleChoice(choice, player) {
  const playerSkills = player.skills || [];
  const storyFlags = player.story_flags || [];
  const playerInventory = player.inventory || [];

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
    const flags = Array.isArray(conds.flags_not_required_all)
      ? conds.flags_not_required_all
      : [conds.flags_not_required_all];
    if (flags.every(f => storyFlags.includes(f))) return false;
  }
  if (conds.flag_forbidden && storyFlags.includes(conds.flag_forbidden)) return false;

  if (conds.item_required && !playerInventory.includes(conds.item_required)) return false;
  if (conds.item_not_required && playerInventory.includes(conds.item_not_required)) return false;

  return true;
}

function formatChoiceRequirements(choice) {
  if (!choice) return null;
  const conds = choice.conditions || {};
  const reqs = [];
  if (conds.required_skill) reqs.push(`навык: ${conds.required_skill}`);
  if (conds.flag_required) {
    const flags = Array.isArray(conds.flag_required) ? conds.flag_required : [conds.flag_required];
    reqs.push(...flags.map(f => `флаг: ${f}`));
  }
  if (conds.item_required) reqs.push(`предмет: ${conds.item_required}`);
  if (choice.effects?.add_skill) reqs.push(`не иметь навык: ${choice.effects.add_skill}`);
  return reqs.length > 0 ? reqs : null;
}

async function loadPlayerState(env, userId, getPlayerState) {
  return getPlayerState(env, userId);
}

async function loadUnlockedAchievements(env, userId, supabaseFetch) {
  const res = await supabaseFetch(env, `/user_achievements?user_id=eq.${userId}&select=achievement_id`);
  const data = await res.json();
  return new Set(data.map(r => r.achievement_id));
}

async function loadAchievementRoutes(env, supabaseFetch) {
  const res = await supabaseFetch(env, `/achievement_routes?start_node_id=eq.${START_NODE_ID}`);
  const data = await res.json();
  return data;
}

async function loadChoicesForPath(env, supabaseFetch, path) {
  if (!path || path.length === 0) return new Map();
  const ids = path.join(',');
  const res = await supabaseFetch(env, `/choices?id=in.(${ids})`);
  const data = await res.json();
  const map = new Map();
  for (const choice of data) {
    map.set(choice.id, choice);
  }
  return map;
}

function buildResponse(player, targetAchievement, route, nextChoice, stepsFromHere) {
  const nextChoiceAvailable = nextChoice ? filterSingleChoice(nextChoice, clonePlayer(player)) : null;

  return {
    hint_enabled: true,
    reachable: true,
    reason: null,
    theoretical: false,
    next_choice_available: nextChoiceAvailable,
    next_choice_requirements: nextChoice && !nextChoiceAvailable
      ? formatChoiceRequirements(nextChoice)
      : null,
    target_achievement: withRarity(targetAchievement),
    next_choice: nextChoice
      ? { id: nextChoice.id, label: nextChoice.label }
      : null,
    path: route.path || [],
    steps_remaining: stepsFromHere,
    source: 'db',
  };
}

export async function getHint(env, userId, targetTier, _targetType, targetAchievementId, dataProviders) {
  const { getPlayerState, supabaseFetch } = dataProviders;

  const player = await loadPlayerState(env, userId, getPlayerState);
  if (!player) {
    return { error: 'Player not found' };
  }

  const [unlockedIds, routes, achievementsRes] = await Promise.all([
    loadUnlockedAchievements(env, userId, supabaseFetch),
    loadAchievementRoutes(env, supabaseFetch),
    supabaseFetch(env, '/achievements?select=*'),
  ]);

  const allAchievements = await achievementsRes.json();
  const achievementById = new Map(allAchievements.map(a => [a.id, a]));

  // Фильтруем маршруты: убираем разблокированные и недостижимые
  let candidates = routes
    .filter(r => r.reachable && !unlockedIds.has(r.achievement_id))
    .map(r => ({ route: r, achievement: achievementById.get(r.achievement_id) }))
    .filter(c => c.achievement);

  // Если клиент прислал конкретную цель — используем её вне зависимости от тира
  if (targetAchievementId) {
    const target = candidates.find(c => c.achievement.id === targetAchievementId);
    if (target) {
      candidates = [target];
    } else {
      return {
        hint_enabled: true,
        reachable: false,
        reason: 'target_not_available',
        target_achievement: withRarity(achievementById.get(targetAchievementId)) || null,
        next_choice: null,
      };
    }
  } else {
    // Фильтруем по тиру
    const tierUpper = targetTier ? targetTier.toUpperCase() : 'ANY';
    if (tierUpper !== 'ANY') {
      candidates = candidates.filter(c => (c.achievement.medal_tier || '').toUpperCase() === tierUpper);
    }
  }

  if (candidates.length === 0) {
    return {
      hint_enabled: true,
      reachable: false,
      reason: 'no_suitable_achievement',
      target_achievement: null,
      next_choice: null,
    };
  }

  // Сортируем: сначала ближайшие по маршруту, при равенстве — по порядку тиров
  candidates.sort((a, b) => {
    const diff = a.route.steps_remaining - b.route.steps_remaining;
    if (diff !== 0) return diff;
    const tierA = TIER_ORDER.indexOf((a.achievement.medal_tier || 'BRONZE').toUpperCase());
    const tierB = TIER_ORDER.indexOf((b.achievement.medal_tier || 'BRONZE').toUpperCase());
    return tierA - tierB;
  });

  const selected = candidates[0];
  const { route, achievement } = selected;
  const path = route.path || [];

  // Загружаем объекты выборов из маршрута, чтобы найти текущую позицию игрока
  const choicesById = await loadChoicesForPath(env, supabaseFetch, path);

  // Ищем выбор в маршруте, который доступен с текущей ноды.
  // Если в маршруте на текущей ноде несколько выборов (например, зашли, забрали предмет,
  // вернулись), берём первый доступный — ранее выполненные шаги уже скрыты условиями.
  let nextChoice = null;
  let stepsFromHere = null;

  for (let i = 0; i < path.length; i++) {
    const choice = choicesById.get(path[i]);
    if (!choice) continue;
    if (choice.node_id !== player.current_node_id) continue;

    // Запоминаем первый выбор на ноде как fallback (чтобы показать требования, если все заблокированы)
    if (!nextChoice) {
      nextChoice = choice;
      stepsFromHere = path.length - i;
    }

    // Если нашли доступный выбор — используем его
    if (filterSingleChoice(choice, clonePlayer(player))) {
      nextChoice = choice;
      stepsFromHere = path.length - i;
      break;
    }
  }

  // Если игрок не находится на маршруте
  if (!nextChoice) {
    return {
      hint_enabled: true,
      reachable: false,
      reason: 'off_route',
      target_achievement: withRarity(achievement),
      path,
      next_choice: null,
      steps_remaining: route.steps_remaining,
    };
  }

  return buildResponse(player, achievement, route, nextChoice, stepsFromHere);
}
