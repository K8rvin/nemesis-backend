import { filterSingleChoice } from '../src/achievementRoutes.js';

// Replicate filterChoices logic to test the new condition
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

const badFinalChoice = {
  id: 'ch_5_b_ending_3_bad',
  conditions: {
    flag_required: ['tobias_saved', 'tobias_mortally_wounded'],
    item_required_any: ['Квантовый Носитель', 'Запасной аккумулятор'],
  },
  effects: { unlock_achievement: 'ach_no_man_left_behind_bad' },
};

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('OK:', msg);
}

// Player with Quantum Carrier -> visible
let player = { skills: [], story_flags: ['tobias_saved', 'tobias_mortally_wounded'], inventory: ['Квантовый Носитель'] };
assert(filterSingleChoice(badFinalChoice, player), 'final visible with Quantum Carrier');
assert(filterChoices([badFinalChoice], player).length === 1, 'filterChoices includes final with Quantum Carrier');

// Player with Spare Battery -> visible
player = { skills: [], story_flags: ['tobias_saved', 'tobias_mortally_wounded'], inventory: ['Запасной аккумулятор'] };
assert(filterSingleChoice(badFinalChoice, player), 'final visible with Spare Battery');

// Player with both items -> visible
player = { skills: [], story_flags: ['tobias_saved', 'tobias_mortally_wounded'], inventory: ['Квантовый Носитель', 'Запасной аккумулятор'] };
assert(filterSingleChoice(badFinalChoice, player), 'final visible with both items');

// Player with no required item -> hidden
player = { skills: [], story_flags: ['tobias_saved', 'tobias_mortally_wounded'], inventory: ['Монтировка'] };
assert(!filterSingleChoice(badFinalChoice, player), 'final hidden without required item');

// Player missing wound flag -> hidden
player = { skills: [], story_flags: ['tobias_saved'], inventory: ['Квантовый Носитель'] };
assert(!filterSingleChoice(badFinalChoice, player), 'final hidden without mortal wound flag');

// Tobias safe choice should be hidden when wound flag is set
const safeChoice = {
  id: 'ch_5_showdown_tobias_safe',
  conditions: { flag_required: 'tobias_saved', flag_not_required: 'tobias_mortally_wounded' },
};
player = { skills: [], story_flags: ['tobias_saved', 'tobias_mortally_wounded'], inventory: [] };
assert(!filterSingleChoice(safeChoice, player), 'safe choice hidden after wound');

// Bad bridge choice should be hidden after wound flag (to avoid repeat)
const bridgeBadChoice = {
  id: 'ch_5_showdown_tobias',
  conditions: { flag_required: 'tobias_saved', flag_not_required: 'tobias_mortally_wounded' },
  effects: { set_hp: 15, add_flag: 'tobias_mortally_wounded' },
};
assert(!filterSingleChoice(bridgeBadChoice, player), 'bridge bad choice hidden after wound');

console.log('All item_required_any tests passed.');
