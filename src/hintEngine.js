// ==========================================
// 💡 HINT ENGINE — умный подсказчик к ачивкам
// ==========================================

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

function applyChoiceEffects(choice, player) {
  const effects = choice.effects || {};
  const updates = clonePlayer(player);

  if (effects.apply_damage) updates.hp = Math.max(0, updates.hp - effects.apply_damage);
  if (effects.add_hp) updates.hp = Math.min(100, updates.hp + effects.add_hp);
  if (effects.set_hp !== undefined) updates.hp = effects.set_hp;

  if (effects.add_flag) {
    if (!updates.story_flags.includes(effects.add_flag)) {
      updates.story_flags.push(effects.add_flag);
    }
  }
  if (effects.remove_flags && Array.isArray(effects.remove_flags)) {
    updates.story_flags = updates.story_flags.filter(f => !effects.remove_flags.includes(f));
  }

  if (effects.add_item) {
    if (!updates.inventory.includes(effects.add_item)) {
      updates.inventory.push(effects.add_item);
    }
  }
  if (effects.remove_item) {
    updates.inventory = updates.inventory.filter(item => item !== effects.remove_item);
  }

  if (effects.add_skill && !updates.skills.includes(effects.add_skill)) {
    updates.skills.push(effects.add_skill);
  }

  return updates;
}

function makeStateKey(nodeId, player) {
  const flags = [...player.story_flags].sort().join(',');
  const items = [...player.inventory].sort().join(',');
  const skills = [...player.skills].sort().join(',');
  return `${nodeId}|${player.hp}|${flags}|${items}|${skills}`;
}

export function buildGraph(nodes, choices) {
  const nodeToChoices = new Map();
  const nodeToIncomingChoices = new Map();
  const achievementToChoices = new Map();
  const nodeMap = new Map();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    nodeToChoices.set(node.id, []);
    nodeToIncomingChoices.set(node.id, []);
  }

  for (const choice of choices) {
    const list = nodeToChoices.get(choice.node_id) || [];
    list.push(choice);
    nodeToChoices.set(choice.node_id, list);

    if (choice.target_node_id) {
      const incoming = nodeToIncomingChoices.get(choice.target_node_id) || [];
      incoming.push(choice);
      nodeToIncomingChoices.set(choice.target_node_id, incoming);
    }

    const achId = choice.effects?.unlock_achievement;
    if (achId) {
      const achList = achievementToChoices.get(achId) || [];
      achList.push(choice);
      achievementToChoices.set(achId, achList);
    }
  }

  return { nodeToChoices, nodeToIncomingChoices, achievementToChoices, nodeMap };
}

// Кэш графа и справочника ачивок между запросами в warm-изоляторе Worker.
let _graphCache = null;
let _achievementsCache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 минута

async function loadAllChoices(env, supabaseFetch) {
  const all = [];
  const pageSize = 200;
  let offset = 0;
  while (true) {
    const res = await supabaseFetch(env, `/choices?select=*&limit=${pageSize}&offset=${offset}`);
    const page = await res.json();
    if (page.length === 0) break;
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function loadGraphAndAchievements(env, supabaseFetch) {
  const now = Date.now();
  if (_graphCache && _achievementsCache && (now - _cacheTs) < CACHE_TTL_MS) {
    return { graph: _graphCache, allAchievements: _achievementsCache };
  }

  const [nodesRes, achRes] = await Promise.all([
    supabaseFetch(env, '/nodes?select=id,ending_type'),
    supabaseFetch(env, '/achievements?select=*'),
  ]);

  const [nodes, allAchievements] = await Promise.all([
    nodesRes.json(),
    achRes.json(),
  ]);

  const choices = await loadAllChoices(env, supabaseFetch);

  _graphCache = buildGraph(nodes, choices);
  _achievementsCache = allAchievements;
  _cacheTs = now;
  return { graph: _graphCache, allAchievements: _achievementsCache };
}

function getAchievementType(achievementId, graph) {
  const choices = graph.achievementToChoices.get(achievementId) || [];
  const types = new Set();

  for (const choice of choices) {
    const targetNode = graph.nodeMap.get(choice.target_node_id);
    if (!targetNode) continue;

    const endingType = (targetNode.ending_type || '').toUpperCase();
    if (endingType === 'DEATH' || endingType === 'ABSURD_DEATH') types.add('death');
    else if (endingType.startsWith('VICTORY') || endingType === 'SECRET_GOOD') types.add('victory');
    else if (endingType.includes('SECRET')) types.add('secret');
    else types.add('other');
  }

  // Если хотя бы один путь к ачивке — смерть, считаем death и т.д.
  if (types.has('death')) return 'death';
  if (types.has('secret')) return 'secret';
  if (types.has('victory')) return 'victory';
  return 'other';
}

export function pickTargetAchievement(allAchievements, unlockedIds, targetTier, targetType, graph, excludeIds = []) {
  let candidates = allAchievements.filter(a => !unlockedIds.includes(a.id) && !excludeIds.includes(a.id));

  if (targetTier) {
    candidates = candidates.filter(a => (a.medal_tier || '').toUpperCase() === targetTier.toUpperCase());
  }

  if (targetType && targetType !== 'any') {
    candidates = candidates.filter(a => getAchievementType(a.id, graph) === targetType);
  }

  if (candidates.length === 0) return null;

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

export function findPath(startNodeId, player, targetAchievementId, graph, maxDepth = 15, maxVisited = 15000) {
  const startState = clonePlayer(player);
  const queue = [{ nodeId: startNodeId, player: startState, path: [], firstChoice: null }];
  const visited = new Set();
  visited.add(makeStateKey(startNodeId, startState));

  let bestPartial = null;

  while (queue.length > 0) {
    const { nodeId, player: currentPlayer, path, firstChoice } = queue.shift();
    const steps = path.length / 2;
    if (steps >= maxDepth) continue;
    if (visited.size > maxVisited) break;

    const choices = graph.nodeToChoices.get(nodeId) || [];

    for (const choice of choices) {
      const isAvailable = filterSingleChoice(choice, currentPlayer);
      const currentFirstChoice = firstChoice || choice;

      // Целевой choice найден и доступен — победа
      if (isAvailable && choice.effects?.unlock_achievement === targetAchievementId) {
        return {
          reachable: true,
          path: [...path, choice.id],
          nextChoice: currentFirstChoice,
          stepsRemaining: steps + 1,
        };
      }

      // Целевой choice существует, но недоступен — запоминаем как лучший частичный результат
      if (!isAvailable && choice.effects?.unlock_achievement === targetAchievementId) {
        bestPartial = {
          reachable: false,
          reason: 'choice_locked',
          path: [...path],
          nextChoice: currentFirstChoice,
          stepsRemaining: steps + 1,
        };
        continue;
      }

      // Нецелевой choice — идём дальше, если доступен
      if (!isAvailable) continue;

      const newPlayer = applyChoiceEffects(choice, currentPlayer);
      const targetNodeId = choice.target_node_id;
      if (!targetNodeId) continue;

      // Если choice убивает игрока, не продолжаем путь (кроме случаев, когда целевая ачивка — эта смерть,
      // но такие мы уже проверили выше по unlock_achievement)
      if (newPlayer.hp <= 0) continue;

      const newPath = [...path, choice.id, targetNodeId];
      const stateKey = makeStateKey(targetNodeId, newPlayer);
      if (visited.has(stateKey)) continue;
      visited.add(stateKey);

      queue.push({ nodeId: targetNodeId, player: newPlayer, path: newPath, firstChoice: currentFirstChoice });
    }
  }

  return bestPartial || {
    reachable: false,
    reason: 'no_path_found',
    path: [],
    nextChoice: null,
    stepsRemaining: null,
  };
}

async function loadCachedRoutes(env, supabaseFetch, nodeId) {
  try {
    const res = await supabaseFetch(env, `/hint_routes?node_id=eq.${nodeId}`);
    const data = await res.json();
    const map = new Map();
    for (const row of data) {
      map.set(row.achievement_id, row);
    }
    return map;
  } catch (err) {
    console.warn('⚠️ Failed to load hint_routes:', err.message);
    return new Map();
  }
}

function buildCachedHintResponse(targetAchievement, route, graph, currentNodeId, player) {
  const tierMap = { 'BRONZE': 'ОБЫЧНАЯ', 'SILVER': 'РЕДКАЯ', 'GOLD': 'ЭПИЧЕСКАЯ', 'PLATINUM': 'ЛЕГЕНДАРНАЯ' };
  const choices = graph.nodeToChoices.get(currentNodeId) || [];
  let nextChoice = route.next_choice_id
    ? choices.find(c => c.id === route.next_choice_id) || null
    : null;

  // Для теоретических маршрутов условия игнорируются, поэтому next_choice
  // может быть недоступен прямо сейчас — это нормально.
  // Обратная совместимость: если is_theoretical не заполнено, ориентируемся на reason.
  const isTheoretical = route.is_theoretical === true || route.reason === 'theoretical_reverse';
  if (nextChoice && !isTheoretical && !filterSingleChoice(nextChoice, player)) {
    nextChoice = null;
  }

  const nextChoiceAvailable = nextChoice ? filterSingleChoice(nextChoice, player) : null;
  return {
    hint_enabled: true,
    reachable: route.reachable,
    goal_reached: isGoalReached(targetAchievement, player, graph),
    reason: isTheoretical ? 'theoretical_reverse' : route.reason,
    theoretical: isTheoretical,
    next_choice_available: nextChoiceAvailable,
    next_choice_requirements: isTheoretical && nextChoiceAvailable === false ? formatChoiceRequirements(nextChoice) : null,
    target_achievement: {
      ...targetAchievement,
      rarity: tierMap[targetAchievement.medal_tier?.toUpperCase()] || 'ОБЫЧНАЯ',
    },
    next_choice: nextChoice
      ? { id: nextChoice.id, label: nextChoice.label }
      : null,
    path: [],
    steps_remaining: route.steps_remaining,
    source: 'cache',
  };
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
    flags.forEach(f => reqs.push({ type: 'flag', value: String(f) }));
  }
  if (conds.item_required) {
    const items = Array.isArray(conds.item_required) ? conds.item_required : [conds.item_required];
    reqs.push({ type: 'item', value: items.join(' + ') });
  }
  if (conds.item_required_any) {
    const items = Array.isArray(conds.item_required_any) ? conds.item_required_any : [conds.item_required_any];
    reqs.push({ type: 'item', value: items.join(' / ') });
  }
  if (choice.effects?.add_skill) {
    reqs.push({ type: 'no_skill', value: String(choice.effects.add_skill) });
  }
  return reqs.length > 0 ? reqs : null;
}

// Проверяем, находится ли игрок уже в ноде с целевым choice и доступен ли он.
function isGoalReached(targetAchievement, player, graph) {
  if (!targetAchievement || !player) return false;
  const targetChoices = graph.achievementToChoices.get(targetAchievement.id) || [];
  return targetChoices.some(tc => tc.node_id === player.current_node_id && filterSingleChoice(tc, player));
}

function buildReverseHintResponse(targetAchievement, reverseResult, player = null) {
  const tierMap = { 'BRONZE': 'ОБЫЧНАЯ', 'SILVER': 'РЕДКАЯ', 'GOLD': 'ЭПИЧЕСКАЯ', 'PLATINUM': 'ЛЕГЕНДАРНАЯ' };
  const nextChoice = reverseResult.nextChoice || null;
  const nextChoiceAvailable = player && nextChoice ? filterSingleChoice(nextChoice, player) : null;
  return {
    hint_enabled: true,
    reachable: true,
    goal_reached: isGoalReached(targetAchievement, player, graph),
    reason: 'theoretical_path',
    theoretical: true,
    next_choice_available: nextChoiceAvailable,
    target_achievement: {
      ...targetAchievement,
      rarity: tierMap[targetAchievement.medal_tier?.toUpperCase()] || 'ОБЫЧНАЯ',
    },
    next_choice: nextChoice
      ? { id: nextChoice.id, label: nextChoice.label }
      : null,
    next_choice_available: nextChoiceAvailable,
    next_choice_requirements: nextChoiceAvailable === false ? formatChoiceRequirements(nextChoice) : null,
    path: reverseResult.path,
    steps_remaining: reverseResult.stepsRemaining,
    source: 'reverse',
  };
}

export function findReversePath(startNodeId, targetAchievementId, graph, maxDepth = 100, player = null) {
  // Находим choice(ы), который даёт целевую ачивку
  const targetChoices = graph.achievementToChoices.get(targetAchievementId) || [];
  if (targetChoices.length === 0) {
    return { reachable: false, reason: 'no_target_choice' };
  }

  const queue = [];
  const visited = new Set();

  for (const targetChoice of targetChoices) {
    // Если целевой choice требует навык, которого у игрока нет,
    // считаем ачивку недостижимой (навыки в игре выдаются только в act1).
    const requiredSkill = targetChoice.conditions?.required_skill;
    if (requiredSkill && player && !player.skills?.includes(requiredSkill)) continue;

    // Навыки взаимоисключающие: если choice выдаёт навык, отличный от
    // уже имеющегося у игрока, по нему нельзя идти назад.
    const addSkill = targetChoice.effects?.add_skill;
    if (addSkill && player && player.skills?.length > 0 && !player.skills.includes(addSkill)) continue;

    const sourceNodeId = targetChoice.node_id;
    const key = `${sourceNodeId}|${targetChoice.id}`;
    if (visited.has(key)) continue;
    visited.add(key);
    queue.push({
      nodeId: sourceNodeId,
      steps: 1,
      nextChoice: targetChoice,
      path: [targetChoice.id],
    });
  }

  let bestToStart = null;

  while (queue.length > 0) {
    const { nodeId, steps, nextChoice, path } = queue.shift();
    if (steps >= maxDepth) continue;

    if (nodeId === startNodeId) {
      if (!bestToStart || steps < bestToStart.steps) {
        bestToStart = { steps, nextChoice, path };
      }
      continue;
    }

    const incomingChoices = graph.nodeToIncomingChoices.get(nodeId) || [];
    for (const choice of incomingChoices) {
      // Исключаем из обратного пути выборы, требующие навык, которого нет у игрока,
      // а также выборы, которые выдали бы другой навык (навыки взаимоисключающие).
      const requiredSkill = choice.conditions?.required_skill;
      if (requiredSkill && player && !player.skills?.includes(requiredSkill)) continue;

      const addSkill = choice.effects?.add_skill;
      if (addSkill && player && player.skills?.length > 0 && !player.skills.includes(addSkill)) continue;

      const prevNodeId = choice.node_id;
      const newPath = [choice.id, ...path];
      const key = `${prevNodeId}|${choice.id}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({
        nodeId: prevNodeId,
        steps: steps + 1,
        nextChoice: choice,
        path: newPath,
      });
    }
  }

  if (bestToStart) {
    return {
      reachable: true,
      nextChoice: bestToStart.nextChoice,
      path: bestToStart.path,
      stepsRemaining: bestToStart.steps,
    };
  }

  return { reachable: false, reason: 'no_reverse_path' };
}

export async function getHint(env, userId, targetTier, targetType, targetAchievementId, dataProviders) {
  const {
    getPlayerState,
    supabaseFetch,
  } = dataProviders;

  const player = await getPlayerState(env, userId);
  if (!player) {
    return { error: 'Player not found' };
  }

  const [{ graph, allAchievements }, uaRes, cachedRoutes] = await Promise.all([
    loadGraphAndAchievements(env, supabaseFetch),
    supabaseFetch(env, `/user_achievements?user_id=eq.${userId}&select=achievement_id`),
    loadCachedRoutes(env, supabaseFetch, player.current_node_id),
  ]);

  const uaData = await uaRes.json();
  const unlockedIds = uaData.map(r => r.achievement_id);

  // Если клиент прислал закреплённую цель — пробуем использовать её,
  // но только пока она не разблокирована и существует.
  let targetAchievement = null;
  if (targetAchievementId) {
    targetAchievement = allAchievements.find(a => a.id === targetAchievementId) || null;
    if (targetAchievement && unlockedIds.includes(targetAchievement.id)) {
      targetAchievement = null;
    }
  }

  function getSearchLimits(tierUpper) {
    switch (tierUpper) {
      case 'BRONZE': return { maxDepth: 12, maxVisited: 8000 };
      case 'SILVER': return { maxDepth: 20, maxVisited: 25000 };
      case 'GOLD': return { maxDepth: 25, maxVisited: 40000 };
      case 'PLATINUM': return { maxDepth: 15, maxVisited: 12000 };
      default: return { maxDepth: 18, maxVisited: 20000 };
    }
  }

  // Если theoretical next_choice недоступен прямо сейчас, пробуем найти
  // доступный первый шаг прямым поиском. Если удаётся — возвращаем уже
  // реально достижимый маршрут, иначе оставляем theoretical.
  function tryForwardFromCache(cachedHint) {
    if (!cachedHint || !cachedHint.reachable || !cachedHint.theoretical || !cachedHint.next_choice) {
      return cachedHint;
    }

    const choices = graph.nodeToChoices.get(player.current_node_id) || [];
    const nextChoice = choices.find(c => c.id === cachedHint.next_choice.id);
    if (!nextChoice || filterSingleChoice(nextChoice, player)) {
      return cachedHint;
    }

    const targetId = cachedHint.target_achievement.id;
    const tierUpper = (cachedHint.target_achievement.medal_tier || '').toUpperCase();
    const { maxDepth, maxVisited } = getSearchLimits(tierUpper);
    const forward = findPath(player.current_node_id, player, targetId, graph, maxDepth, maxVisited);

    if (forward.reachable) {
      return {
        ...cachedHint,
        reachable: true,
        goal_reached: isGoalReached(cachedHint.target_achievement, player, graph),
        reason: null,
        theoretical: false,
        next_choice: forward.nextChoice ? { id: forward.nextChoice.id, label: forward.nextChoice.label } : null,
        path: forward.path,
        steps_remaining: forward.stepsRemaining,
        source: 'cache_forward',
      };
    }

    return cachedHint;
  }

  // Проверяет, доступен ли закэшированный первый выбор прямо сейчас.
  function isCachedRouteAvailable(route) {
    if (!route.next_choice_id) return false;
    const choices = graph.nodeToChoices.get(player.current_node_id) || [];
    const choice = choices.find(c => c.id === route.next_choice_id);
    return choice ? filterSingleChoice(choice, player) : false;
  }

  // ===== КЭШИРОВАННЫЕ МАРШРУТЫ =====
  // Если есть предвычисленный маршрут от текущей ноды — используем его.
  // Fallback к runtime BFS остаётся для состояний, не покрытых кэшем.
  function findBestCachedRoute(tiers) {
    let bestReachable = null;
    let bestLocked = null;

    for (const achievement of allAchievements) {
      if (unlockedIds.includes(achievement.id)) continue;
      const tier = (achievement.medal_tier || '').toUpperCase();
      if (tiers && !tiers.includes(tier)) continue;
      if (targetType && targetType !== 'any' && getAchievementType(achievement.id, graph) !== targetType) continue;

      const route = cachedRoutes.get(achievement.id);
      if (!route) continue;

      if (route.reachable) {
        const available = isCachedRouteAvailable(route);
        const bestAvailable = bestReachable ? isCachedRouteAvailable(bestReachable.route) : false;
        if (!bestReachable || available > bestAvailable || (available === bestAvailable && route.steps_remaining < bestReachable.route.steps_remaining)) {
          bestReachable = { achievement, route };
        }
      } else if (route.reason === 'choice_locked') {
        if (!bestLocked || route.steps_remaining < bestLocked.route.steps_remaining) {
          bestLocked = { achievement, route };
        }
      }
    }

    const picked = bestReachable || bestLocked;
    if (!picked) return null;
    return tryForwardFromCache(buildCachedHintResponse(picked.achievement, picked.route, graph, player.current_node_id, player));
  }

  // Закреплённая цель: ищем конкретную запись в кэше.
  if (targetAchievementId && targetAchievement) {
    const cached = cachedRoutes.get(targetAchievement.id);
    if (cached) {
      return tryForwardFromCache(buildCachedHintResponse(targetAchievement, cached, graph, player.current_node_id, player));
    }
  }

  // Поиск по тиру или ANY.
  const tiersToTry = targetTier && targetTier.toUpperCase() !== 'ANY'
    ? [targetTier.toUpperCase()]
    : ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const cachedHint = findBestCachedRoute(tiersToTry);
  if (cachedHint) {
    return cachedHint;
  }

  // Если закреплённая цель недоступна — подбираем новую.
  // При запросе "Любая" ищем по редкости от ближних к дальним:
  // BRONZE → SILVER → GOLD → PLATINUM. Это позволяет быстрее найти
  // достижимую цель и не тратить время на дальние легендарные сначала.
  const triedIds = [];
  let result = null;

  if (targetAchievement) {
    triedIds.push(targetAchievement.id);
    const { maxDepth, maxVisited } = getSearchLimits((targetAchievement.medal_tier || '').toUpperCase());
    result = findPath(player.current_node_id, player, targetAchievement.id, graph, maxDepth, maxVisited);

    // Если прямой поиск не нашёл путь — пробуем обратный (теоретический).
    if (!result.reachable && result.reason === 'no_path_found') {
      const reverse = findReversePath(player.current_node_id, targetAchievement.id, graph, 100, player);
      if (reverse.reachable) {
        return buildReverseHintResponse(targetAchievement, reverse, player);
      }
    }

    if (!result.reachable && result.reason !== 'choice_locked') {
      targetAchievement = null;
    }
  }

  // Если клиент явно закрепил цель — возвращаем результат для неё
  // (reachable или choice_locked), даже если есть другие достижимые цели.
  if (targetAchievementId && targetAchievement) {
    const tierMap = { 'BRONZE': 'ОБЫЧНАЯ', 'SILVER': 'РЕДКАЯ', 'GOLD': 'ЭПИЧЕСКАЯ', 'PLATINUM': 'ЛЕГЕНДАРНАЯ' };
    return {
      hint_enabled: true,
      reachable: result.reachable,
      goal_reached: isGoalReached(targetAchievement, player, graph),
      reason: result.reason,
      target_achievement: {
        ...targetAchievement,
        rarity: tierMap[targetAchievement.medal_tier?.toUpperCase()] || 'ОБЫЧНАЯ',
      },
      next_choice: result.nextChoice
        ? {
            id: result.nextChoice.id,
            label: result.nextChoice.label,
          }
        : null,
      path: result.path,
      steps_remaining: result.stepsRemaining,
    };
  }

  // tiersToTry уже определён при попытке использовать кэшированные маршруты.

  let bestReachable = null;
  let bestLocked = null;

  for (const currentTier of tiersToTry) {
    if (bestReachable && bestReachable.result.stepsRemaining <= 1) break;

    while (true) {
      const candidate = pickTargetAchievement(allAchievements, unlockedIds, currentTier, targetType, graph, triedIds);
      if (!candidate) break;
      triedIds.push(candidate.id);

      const { maxDepth, maxVisited } = getSearchLimits((candidate.medal_tier || '').toUpperCase());
      const res = findPath(player.current_node_id, player, candidate.id, graph, maxDepth, maxVisited);

      if (res.reachable) {
        if (!bestReachable || res.stepsRemaining < bestReachable.result.stepsRemaining) {
          bestReachable = { targetAchievement: candidate, result: res };
        }
        break;
      }

      if (res.reason === 'choice_locked') {
        if (!bestLocked || res.stepsRemaining < bestLocked.result.stepsRemaining) {
          bestLocked = { targetAchievement: candidate, result: res };
        }
      }
    }
  }

  const picked = bestReachable || bestLocked;

  // Если прямой поиск не дал reachable — пробуем обратный поиск
  // по всем подходящим ачивкам. Это находит теоретический путь
  // даже когда forward BFS не справляется с ветвлением состояний.
  // Среди theoretical маршрутов предпочитаем те, чей первый выбор
  // доступен прямо сейчас.
  if (!bestReachable) {
    let bestReverse = null;
    for (const achievement of allAchievements) {
      if (unlockedIds.includes(achievement.id)) continue;
      const tier = (achievement.medal_tier || '').toUpperCase();
      if (!tiersToTry.includes(tier)) continue;
      if (targetType && targetType !== 'any' && getAchievementType(achievement.id, graph) !== targetType) continue;

      const reverse = findReversePath(player.current_node_id, achievement.id, graph, 100, player);
      if (!reverse.reachable) continue;

      const available = reverse.nextChoice ? filterSingleChoice(reverse.nextChoice, player) : false;
      const bestAvailable = bestReverse ? (bestReverse.result.nextChoice ? filterSingleChoice(bestReverse.result.nextChoice, player) : false) : false;
      if (!bestReverse || available > bestAvailable || (available === bestAvailable && reverse.stepsRemaining < bestReverse.result.stepsRemaining)) {
        bestReverse = { achievement, result: reverse };
      }
    }

    if (bestReverse) {
      return buildReverseHintResponse(bestReverse.achievement, bestReverse.result, player);
    }
  }

  if (!picked) {
    return {
      hint_enabled: true,
      reachable: false,
      goal_reached: false,
      reason: 'no_suitable_achievement',
      target_achievement: null,
      next_choice: null,
    };
  }

  targetAchievement = picked.targetAchievement;
  result = picked.result;

  const tierMap = { 'BRONZE': 'ОБЫЧНАЯ', 'SILVER': 'РЕДКАЯ', 'GOLD': 'ЭПИЧЕСКАЯ', 'PLATINUM': 'ЛЕГЕНДАРНАЯ' };

  return {
    hint_enabled: true,
    reachable: result.reachable,
    goal_reached: isGoalReached(targetAchievement, player, graph),
    reason: result.reason,
    target_achievement: {
      ...targetAchievement,
      rarity: tierMap[targetAchievement.medal_tier?.toUpperCase()] || 'ОБЫЧНАЯ',
    },
    next_choice: result.nextChoice
      ? {
          id: result.nextChoice.id,
          label: result.nextChoice.label,
        }
      : null,
    path: result.path,
    steps_remaining: result.stepsRemaining,
  };
}
