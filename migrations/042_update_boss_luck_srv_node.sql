-- Миграция: привязка LUCK и SRV выборов Патриарха к основной ноде act3_boss_pat.
-- Ранее они были привязаны к act3_boss_stealth, но игрок выбирает их прямо на экране битвы.

UPDATE public.choices
SET node_id = 'act3_boss_pat'
WHERE id IN ('ch_3_boss_luck', 'ch_3_boss_srv');
