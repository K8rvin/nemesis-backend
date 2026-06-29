-- Исправление: возврат из YOLO-выбора у Патриарха возвращал в ending_terminal_node,
-- что приводило к безвыходному тупику. Теперь возврат ведёт обратно в хаб битвы.

UPDATE public.choices
SET target_node_id = 'act3_boss_pat'
WHERE id = 'ch_3_boss_yolo_back';
