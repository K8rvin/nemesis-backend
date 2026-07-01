// ==========================================
// 🗺️ ACHIEVEMENT ROUTES — загрузка готовых маршрутов из БД
// ==========================================

import { localizeAchievement, localizeChoice } from './localization.js';

const START_NODE_ID = 'act1_start';

const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

function asArray(val) {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val;
  return [val];
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

  if (conds.item_required) {
    const items = Array.isArray(conds.item_required) ? conds.item_required : [conds.item_required];
    if (!items.every(it => playerInventory.includes(it))) return false;
  }
  if (conds.item_required_any) {
    const items = Array.isArray(conds.item_required_any) ? conds.item_required_any : [conds.item_required_any];
    if (!items.some(it => playerInventory.includes(it))) return false;
  }
  if (conds.item_not_required) {
    const items = Array.isArray(conds.item_not_required) ? conds.item_not_required : [conds.item_not_required];
    if (items.some(it => playerInventory.includes(it))) return false;
  }

  return true;
}

function formatChoiceRequirements(choice) {
  if (!choice) return null;
  const conds = choice.conditions || {};
  const reqs = [];
  if (conds.required_skill) {
    const skills = Array.isArray(conds.required_skill) ? conds.required_skill : [conds.required_skill];
    skills.forEach(s => reqs.push({ type: 'skill', value: String(s) }));
  }
  if (conds.flag_required) {
    const flags = Array.isArray(conds.flag_required) ? conds.flag_required : [conds.flag_required];
    flags.forEach(f => reqs.push({ type: 'flag', value: f }));
  }
  if (conds.item_required) {
    const items = Array.isArray(conds.item_required) ? conds.item_required : [conds.item_required];
    reqs.push({ type: 'item', value: items.join(' + ') });
  }
  if (conds.item_required_any) {
    const items = Array.isArray(conds.item_required_any) ? conds.item_required_any : [conds.item_required_any];
    reqs.push({ type: 'item', value: items.join(' / ') });
  }
  if (choice.effects?.add_skill) reqs.push({ type: 'no_skill', value: choice.effects.add_skill });
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

function buildResponse(player, targetAchievement, route, nextChoice, stepsFromHere, lang) {
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
    target_achievement: localizeAchievement(targetAchievement, lang),
    next_choice: nextChoice
      ? { id: nextChoice.id, label: localizeChoice(nextChoice, lang).label }
      : null,
    path: route.path || [],
    steps_remaining: stepsFromHere,
    source: 'db',
  };
}

function evaluateRouteProgress(player, route, choicesById) {
  const path = route.path || [];
  if (path.length === 0) {
    return { progress: -1, nextChoice: null, stepsFromHere: null, onRoute: false, goalReached: false };
  }

  let progress = -1;
  const simSkills = new Set();
  const simFlags = new Set();
  const simItems = new Set();
  let simNode = START_NODE_ID;

  for (let i = 0; i < path.length; i++) {
    const choice = choicesById.get(path[i]);
    if (!choice) continue;

    const eff = choice.effects || {};
    asArray(eff.add_skill).forEach(s => simSkills.add(s));
    asArray(eff.add_flag).forEach(f => simFlags.add(f));
    asArray(eff.add_item).forEach(it => simItems.add(it));
    asArray(eff.remove_flags).forEach(f => simFlags.delete(f));
    asArray(eff.remove_item).forEach(it => simItems.delete(it));

    simNode = choice.target_node_id || simNode;

    const stateMatches =
      simNode === player.current_node_id &&
      [...simSkills].every(s => player.skills?.includes(s)) &&
      [...simFlags].every(f => player.story_flags?.includes(f)) &&
      [...simItems].every(it => player.inventory?.includes(it));

    if (stateMatches) {
      progress = i;
    }
  }

  let nextChoice = null;
  let stepsFromHere = null;

  for (let i = progress + 1; i < path.length; i++) {
    const choice = choicesById.get(path[i]);
    if (!choice) continue;
    if (choice.node_id !== player.current_node_id) continue;

    if (!nextChoice) {
      nextChoice = choice;
      stepsFromHere = path.slice(i).filter(id => choicesById.has(id)).length;
    }

    if (filterSingleChoice(choice, clonePlayer(player))) {
      nextChoice = choice;
      stepsFromHere = path.slice(i).filter(id => choicesById.has(id)).length;
      break;
    }
  }

  const finalChoice = choicesById.get(path[path.length - 1]);
  const goalReached = finalChoice && finalChoice.target_node_id === player.current_node_id;

  return {
    progress,
    nextChoice,
    stepsFromHere,
    onRoute: !!nextChoice,
    goalReached,
  };
}

export async function getHint(env, userId, targetTier, _targetType, targetAchievementId, dataProviders) {
  const { getPlayerState, supabaseFetch, lang } = dataProviders;

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
    // Если цель уже разблокирована — сообщаем, что цель достигнута
    if (unlockedIds.has(targetAchievementId)) {
      const achievement = achievementById.get(targetAchievementId);
      return {
        hint_enabled: true,
        reachable: true,
        reason: null,
        goal_reached: true,
        target_achievement: localizeAchievement(achievement, lang) || null,
        next_choice: null,
        path: [],
        steps_remaining: 0,
      };
    }

    const target = candidates.find(c => c.achievement.id === targetAchievementId);
    if (target) {
      candidates = [target];
    } else {
      return {
        hint_enabled: true,
        reachable: false,
        reason: 'target_not_available',
        target_achievement: localizeAchievement(achievementById.get(targetAchievementId), lang) || null,
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

  // Собираем id всех выборов по всем кандидатам, чтобы загрузить их одним запросом.
  const allChoiceIds = Array.from(new Set(candidates.flatMap(c => c.route.path || [])));
  const choicesById = await loadChoicesForPath(env, supabaseFetch, allChoiceIds);

  // Оцениваем каждый маршрут: находится ли игрок на нём и сколько шагов осталось.
  const evaluated = candidates
    .map(c => ({ ...c, ...evaluateRouteProgress(player, c.route, choicesById) }))
    .filter(c => (c.route.path || []).length > 0);

  if (evaluated.length === 0) {
    return {
      hint_enabled: true,
      reachable: false,
      reason: 'no_suitable_achievement',
      target_achievement: null,
      next_choice: null,
    };
  }

  const tierIndex = a => TIER_ORDER.indexOf((a.achievement.medal_tier || 'BRONZE').toUpperCase());

  // Приоритет — маршруты, на которых игрок уже находится (меньше оставшихся шагов первее).
  const onRoute = evaluated.filter(c => c.onRoute);
  let selected;
  if (onRoute.length > 0) {
    onRoute.sort((a, b) => {
      const diff = a.stepsFromHere - b.stepsFromHere;
      if (diff !== 0) return diff;
      return tierIndex(a) - tierIndex(b);
    });
    selected = onRoute[0];
  } else {
    // Если ни на одном маршруте не находимся — берём кратчайший от старта.
    evaluated.sort((a, b) => {
      const diff = a.route.steps_remaining - b.route.steps_remaining;
      if (diff !== 0) return diff;
      return tierIndex(a) - tierIndex(b);
    });
    selected = evaluated[0];
  }

  const { route } = selected;
  const achievement = localizeAchievement(selected.achievement, lang);
  const path = route.path || [];

  if (selected.goalReached) {
    return {
      hint_enabled: true,
      reachable: true,
      reason: null,
      goal_reached: true,
      target_achievement: achievement,
      path,
      next_choice: null,
      steps_remaining: 0,
    };
  }

  if (!selected.onRoute) {
    return {
      hint_enabled: true,
      reachable: false,
      reason: 'off_route',
      target_achievement: achievement,
      path,
      next_choice: null,
      steps_remaining: route.steps_remaining,
    };
  }

  return buildResponse(player, achievement, route, selected.nextChoice, selected.stepsFromHere, lang);
}
