-- Миграция: переименовать misleading choice в act2_corridors.
-- Выбор возвращает в act2_start, поэтому лейбл должен это отражать.

UPDATE public.choices
SET
  label = '👣 Вернуться к началу жилого сектора',
  translations = '{
    "en": {"label": "👣 Return to the beginning of the residential sector"},
    "es": {"label": "👣 Volver al inicio del sector residencial"},
    "pt_br": {"label": "👣 Voltar ao início do setor residencial"},
    "de": {"label": "👣 Zurück zum Anfang des Wohnsektors"}
  }'::jsonb
WHERE id = 'ch_2_corridors_to_start';
