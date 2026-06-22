-- Миграция: добавляем инженерный вариант перехода к секретному шаттлу,
-- чтобы маршрут через ремонт сервопривода (ENG) не конфликтовал с требованием STL.
INSERT INTO public.choices (
  id,
  node_id,
  target_node_id,
  label,
  narrative_override,
  conditions,
  effects,
  sort_order,
  translations
) VALUES (
  'ch_1_hub_to_shuttle_eng',
  'act1_hub',
  'act1_secret_shuttle',
  '🔍 [СЕКРЕТ] Просканировать заблокированную гидроизоляцию костюмным сканером',
  'Технические датчики костюма фиксируют пустоту за обшивкой. Там, за гидроизоляцией, покоится старый спасательный шаттл.',
  '{"required_skill":"ENG"}'::jsonb,
  '{}'::jsonb,
  8,
  '{"de":{"label":"🔍 [GEHEIM] Verdächtige Abdichtung mit dem Anzug-Scanner untersuchen","narrative_override":"Mit den technischen Sensoren des Anzugs entdeckst du eine Leere hinter der Verkleidung. Dahinter liegt ein altes Rettungsshuttle."},"en":{"label":"🔍 [SECRET] Scan the blocked waterproofing with the suit scanner","narrative_override":"Using the suit technical sensors, you detect a void behind the cladding. Behind the waterproofing rests an old rescue shuttle."},"es":{"label":"🔍 [SECRETO] Escanear el sellado bloqueado con el escáner del traje","narrative_override":"Con los sensores técnicos del traje detectas un vacío detrás del revestimiento. Detrás de la impermeabilización descansa un viejo transbordador de rescate."},"pt_br":{"label":"🔍 [SEGREDO] Escanear a vedação bloqueada com o scanner do traje","narrative_override":"Usando os sensores técnicos do traje, você detecta um vazio atrás do revestimento. Atrás da impermeabilização repousa uma antiga nave de resgate."}}'::jsonb
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
