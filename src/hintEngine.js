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

function filterSingleChoice(choice, player) {
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
  const achievementToChoices = new Map();
  const nodeMap = new Map();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    nodeToChoices.set(node.id, []);
  }

  for (const choice of choices) {
    const list = nodeToChoices.get(choice.node_id) || [];
    list.push(choice);
    nodeToChoices.set(choice.node_id, list);

    const achId = choice.effects?.unlock_achievement;
    if (achId) {
      const achList = achievementToChoices.get(achId) || [];
      achList.push(choice);
      achievementToChoices.set(achId, achList);
    }
  }

  return { nodeToChoices, achievementToChoices, nodeMap };
}

// Кэш графа и справочника ачивок между запросами в warm-изоляторе Worker.
let _graphCache = null;
let _achievementsCache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут

async function loadGraphAndAchievements(env, supabaseFetch) {
  const now = Date.now();
  if (_graphCache && _achievementsCache && (now - _cacheTs) < CACHE_TTL_MS) {
    return { graph: _graphCache, allAchievements: _achievementsCache };
  }

  const [nodesRes, choicesRes, achRes] = await Promise.all([
    supabaseFetch(env, '/nodes?select=id,ending_type'),
    supabaseFetch(env, '/choices?select=*'),
    supabaseFetch(env, '/achievements?select=*'),
  ]);

  const [nodes, choices, allAchievements] = await Promise.all([
    nodesRes.json(),
    choicesRes.json(),
    achRes.json(),
  ]);

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

export function pickTargetAchievement(allAchievements, unlockedIds, targetTier, targetType, graph) {
  let candidates = allAchievements.filter(a => !unlockedIds.includes(a.id));

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

export async function getHint(env, userId, targetTier, targetType, targetAchievementId, dataProviders) {
  const {
    getPlayerState,
    supabaseFetch,
  } = dataProviders;

  const player = await getPlayerState(env, userId);
  if (!player) {
    return { error: 'Player not found' };
  }

  const [{ graph, allAchievements }, uaRes] = await Promise.all([
    loadGraphAndAchievements(env, supabaseFetch),
    supabaseFetch(env, `/user_achievements?user_id=eq.${userId}&select=achievement_id`),
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

  // Если закреплённая цель недоступна — выбираем новую.
  if (!targetAchievement) {
    targetAchievement = pickTargetAchievement(allAchievements, unlockedIds, targetTier, targetType, graph);
  }

  if (!targetAchievement) {
    return {
      hint_enabled: true,
      reachable: false,
      reason: 'no_suitable_achievement',
      target_achievement: null,
      next_choice: null,
    };
  }

  // Для более редких ачивок путь обычно длиннее — даём BFS больше свободы.
  // PLATINUM оставляем в более жёстких рамках, чтобы не провоцировать таймауты.
  const tierUpper = (targetAchievement.medal_tier || '').toUpperCase();
  let maxDepth = 18;
  let maxVisited = 20000;
  switch (tierUpper) {
    case 'BRONZE':
      maxDepth = 12;
      maxVisited = 8000;
      break;
    case 'SILVER':
      maxDepth = 20;
      maxVisited = 25000;
      break;
    case 'GOLD':
      maxDepth = 25;
      maxVisited = 40000;
      break;
    case 'PLATINUM':
      maxDepth = 15;
      maxVisited = 12000;
      break;
  }

  const result = findPath(player.current_node_id, player, targetAchievement.id, graph, maxDepth, maxVisited);

  const tierMap = { 'BRONZE': 'ОБЫЧНАЯ', 'SILVER': 'РЕДКАЯ', 'GOLD': 'ЭПИЧЕСКАЯ', 'PLATINUM': 'ЛЕГЕНДАРНАЯ' };

  return {
    hint_enabled: true,
    reachable: result.reachable,
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
