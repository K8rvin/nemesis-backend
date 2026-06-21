-- Миграция: скрыть выбор "Взломать архивный терминал лаборатории"
-- после успешного взлома.
--
-- Логика:
--   - При успехе мини-игры ставится флаг arch_terminal_hacked.
--   - Выбор скрывается, если установлен флаг провала
--     (ch_3_hub_to_lore_failed) или флаг успеха (arch_terminal_hacked).

UPDATE public.choices
SET
  conditions = '{"flag_not_required":["ch_3_hub_to_lore_failed","arch_terminal_hacked"]}',
  effects = '{"minigame":"pattern_lock","pattern_sequence":"3-6-9-8-7","add_flag":"arch_terminal_hacked"}'
WHERE id = 'ch_3_hub_to_lore';
