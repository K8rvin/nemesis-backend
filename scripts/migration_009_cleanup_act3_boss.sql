-- Migration 009: cleanup intermediate Act 3 boss / med nodes

-- 1. Redirect choices that currently point to nodes we are about to delete
UPDATE choices SET node_id = 'act3_boss_pat', target_node_id = 'act3_hub', sort_order = 6 WHERE id = 'ch_3_boss_distract_bar';
UPDATE choices SET node_id = 'act3_boss_pat', sort_order = 2 WHERE id = 'ch_3_boss_eng';
UPDATE choices SET node_id = 'act3_boss_pat', sort_order = 3 WHERE id = 'ch_3_boss_ref';
UPDATE choices SET node_id = 'act3_boss_pat', sort_order = 4 WHERE id = 'ch_3_boss_fight';
UPDATE choices SET node_id = 'act3_boss_pat', sort_order = 5 WHERE id = 'ch_3_boss_stl';
UPDATE choices SET sort_order = 1 WHERE id = 'ch_3_boss_yolo';

UPDATE choices SET target_node_id = 'act3_med_bay' WHERE id = 'ch_3_hub_to_med';
UPDATE choices SET target_node_id = 'act3_hub', effects = '{"add_hp":40,"remove_flags":["открытое_кровотечение","травма_контузия","травма_токсикоз"]}' WHERE id = 'ch_3_med_heal';

-- 2. Delete obsolete choices
DELETE FROM choices WHERE id IN (
    'ch_3_boss_annihilate',
    'trans_choice_ch_3_boss_annihilate',
    'ch_3_boss_to_stealth',
    'trans_choice_ch_3_boss_to_stealth',
    'ch_3_stealth_back',
    'ch_3_boss_to_combat',
    'ch_3_combat_back',
    'trans_choice_ch_3_hub_to_med',
    'trans_choice_ch_3_med_heal'
);

-- 3. Delete obsolete nodes
DELETE FROM nodes WHERE id IN (
    'trans_ch_3_boss_annihilate',
    'trans_ch_3_boss_to_stealth',
    'act3_boss_stealth',
    'act3_boss_distract_result',
    'act3_boss_combat',
    'trans_ch_3_hub_to_med',
    'trans_ch_3_med_heal'
);
