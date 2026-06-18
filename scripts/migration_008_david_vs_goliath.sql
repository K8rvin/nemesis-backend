-- Migration 008: move "David vs Goliath" unlock to the actual boss-kill choices

-- 1. Direct annihilation choice now grants the achievement
--    (and item name is normalized to match the real inventory item "Тяжелый Плазморез")
UPDATE choices
SET conditions = '{"item_required":"Тяжелый Плазморез"}',
    effects    = '{"unlock_achievement":"ach_david_vs_goliath"}'
WHERE id = 'ch_3_boss_annihilate';

-- 2. Standard plasma-cutter fight choice also grants the achievement
UPDATE choices
SET effects = '{"unlock_achievement":"ach_david_vs_goliath"}'
WHERE id = 'ch_3_boss_fight';

-- 3. Remove the old unlock from the post-kill transition choice
UPDATE choices
SET effects = '{}'
WHERE id = 'trans_choice_ch_3_boss_kill_to_hub';
