-- ==========================================
-- fixHydroPlasmaBypass.sql
-- Логика использования Тяжелого плазмореза в Плотоядном саду.
-- После первого использования выбор "Использовать плазморез" скрывается
-- и заменяется на "Пройти через открытый люк".
-- ==========================================

BEGIN;

-- 1. При использовании плазмореза ставим флаг и скрываем выбор после применения
UPDATE public.choices
SET conditions = '{"item_required":"Тяжелый Плазморез","flag_not_required":"hydro_plasma_used"}'::jsonb,
    effects = '{"add_flag":"hydro_plasma_used"}'::jsonb
WHERE id = 'ch_2_hydro_to_bypass';

-- 2. Новый выбор: пройти через уже открытый люк
INSERT INTO public.choices (
    id,
    node_id,
    target_node_id,
    label,
    narrative_override,
    conditions,
    effects,
    sort_order
) VALUES (
    'ch_2_hydro_bypass_open',
    'act2_hydroponics',
    'act2_bypass_tunnel',
    '🚪 Пройти через открытый грузовой люк',
    NULL,
    '{"flag_required":"hydro_plasma_used"}'::jsonb,
    '{}'::jsonb,
    4
);

COMMIT;
