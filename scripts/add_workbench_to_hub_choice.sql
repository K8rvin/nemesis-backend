-- Добавляет прямой выход с инженерного верстака в центр хаба,
-- чтобы маршрут через ремонт сервопривода не зацикливался
-- на возврате через палубу отходов.

INSERT INTO public.choices (id, node_id, target_node_id, label, conditions, effects, sort_order)
VALUES (
  'ch_1_workbench_to_hub',
  'act1_hub_workbench',
  'act1_hub',
  '↩️ Вернуться в центр хаба',
  '{}'::jsonb,
  '{}'::jsonb,
  6
)
ON CONFLICT (id) DO NOTHING;
