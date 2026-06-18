-- Migration 007: move "Use Heavy Crowbar" shortcut from workbench to cargo lift shaft
-- Target: act1_cargo_subdeck (ГРОХОЧУЩИЙ ПОДЪЯРУС)

-- 1. Move the shortcut choice to the cargo subdeck
UPDATE choices
SET node_id = 'act1_cargo_subdeck',
    sort_order = 5
WHERE id = 'ch_1_skip_to_act4';

-- 2. Update the "go back" choice from the transition node to return to cargo subdeck
UPDATE choices
SET target_node_id = 'act1_cargo_subdeck',
    narrative_override = 'Ты решаешь не рисковать и отходишь от ворот грузового лифта.',
    translations = jsonb_set(
        jsonb_set(
            COALESCE(translations, '{}'::jsonb),
            '{en,label}',
            '"↩️ Go back"'
        ),
        '{en,narrative_override}',
        '"You decide not to risk it and step back from the freight elevator gates."'
    )
WHERE id = 'ch_1_skip_to_act4_back';

-- 3. Update the failure-return choice to send the player back to cargo subdeck
UPDATE choices
SET target_node_id = 'act1_cargo_subdeck'
WHERE id = 'ch_1_skip_to_act4_return';
