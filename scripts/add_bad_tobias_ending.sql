-- Печальная концовка "Своих не бросаем?..":
-- игрок дотаскивает Тобиаса до кабины, отдаёт ему последний приказ прикрыть отход,
-- Тобиас получает смертельное ранение, но игрок подхватывает его и несёт дальше.

INSERT INTO public.nodes (
  id,
  act,
  location_name,
  title,
  narrative,
  thought,
  image_prompt,
  is_start_node,
  is_ending,
  ending_type
) VALUES (
  'ending_3_bad',
  5,
  'Кабина шаттла',
  'ПОСЛЕДНИЙ ПРИКАЗ',
  'Ты тащишь Тобиаса в разрушенную кабину шаттла. За иллюминаторами — последние вспышки плазмы и рев тварей. Враг ломится с кормы, и времени на раздумья нет. «Тобиас, прикрой меня», — говоришь ты. Он кивает, хрипло выдыхает, поднимает ствол. Выстрелы. Крик. Когда ты добираешься до панели запуска, он уже на полу, смертельно раненый, но всё ещё дышит. Ты подхватываешь его под руку и тащишь к выходу. Шаттл отрывается. Тобиас не шевелится.',
  'Ты отдал приказ. Он выполнил. Теперь ты несёшь его дальше.',
  'Dark shuttle cabin, dying companion in arms, sparks, blood, sad sci-fi ending',
  false,
  true,
  'sad'
)
ON CONFLICT (id) DO UPDATE SET
  act = EXCLUDED.act,
  location_name = EXCLUDED.location_name,
  title = EXCLUDED.title,
  narrative = EXCLUDED.narrative,
  thought = EXCLUDED.thought,
  image_prompt = EXCLUDED.image_prompt,
  is_start_node = EXCLUDED.is_start_node,
  is_ending = EXCLUDED.is_ending,
  ending_type = EXCLUDED.ending_type;

INSERT INTO public.achievements (
  id,
  title,
  description,
  medal_tier
) VALUES (
  'ach_no_man_left_behind_bad',
  'Своих не бросаем?..',
  'Ты спас Тобиаса, но в кабине шаттла отдал ему последний приказ. Он прикрыл тебя и получил смертельное ранение. Ты подхватил его и понёс дальше — но останется ли он жив?',
  'GOLD'
)
ON CONFLICT (id) DO NOTHING;

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
  'ch_5_b_ending_3_bad',
  'act5_terminal_final',
  'ending_3_bad',
  '🎖 [ФИНАЛ] Отдать последний приказ Тобиасу',
  'Ты понимаешь, что без прикрытия не доберёшься до панели запуска. Тобиас смотрит на тебя, уже зная ответ. «Прикрой меня», — говоришь ты.',
  '{"flag_required": "tobias_saved"}'::jsonb,
  '{"unlock_achievement": "ach_no_man_left_behind_bad", "add_flag": "tobias_mortally_wounded", "apply_damage": 25}'::jsonb,
  5
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  narrative_override = EXCLUDED.narrative_override,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order;
