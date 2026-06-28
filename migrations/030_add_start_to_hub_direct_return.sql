-- Миграция: добавить прямой возврат из act2_start (Квартал Б-12) обратно в act2_corridors (хаб жилого сектора).
-- Убирает лишний транзит trans_ch_2_start_next при возврате из начала сектора.

INSERT INTO public.choices (id, node_id, target_node_id, label, narrative_override, conditions, effects, sort_order, translations)
VALUES (
  'ch_2_start_back',
  'act2_start',
  'act2_corridors',
  '↩️ Вернуться на перекрёсток',
  NULL,
  '{}',
  '{}',
  10,
  '{
    "ru": {"label": "↩️ Вернуться на перекрёсток"},
    "en": {"label": "↩️ Return to the crossroads"},
    "es": {"label": "↩️ Volver a la encrucijada"},
    "pt_br": {"label": "↩️ Voltar para o cruzamento"},
    "de": {"label": "↩️ Zurück zur Kreuzung"}
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  narrative_override = EXCLUDED.narrative_override,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order,
  translations = EXCLUDED.translations;
