-- Миграция: переработка платиновой ачивки "Своих не бросаем?.." (ach_no_man_left_behind_bad).
-- 1. Смертельное ранение Тобиаса и HP=15 переносятся в act5_bridge_showdown (ch_5_showdown_tobias).
-- 2. В act5_terminal_final выбор ch_5_b_ending_3_bad становится финальным запуском концовки.
-- 3. Добавляется безопасная альтернатива ch_5_showdown_tobias_safe для маршрутов, где Тобиас должен выжить.
-- 4. ending_3_bad переписывается под финал "Протокол Альянса" с мёртвым Тобиасом.

-- 1. Мостик: выбор "Приказать раненому напарнику..." теперь ранит Тобиаса и ставит HP=15.
UPDATE public.choices
SET
  conditions = jsonb_build_object(
    'flag_required', 'tobias_saved',
    'flag_not_required', 'tobias_mortally_wounded'
  ),
  effects = jsonb_build_object(
    'set_hp', 15,
    'add_flag', 'tobias_mortally_wounded'
  ),
  narrative_override = 'Тобиас, преодолевая адскую боль, сползает с твоих плеч и вскидывает захваченный пулемёт: «Беги к консоли, Маркус! Я приму эти чёртовы пушки на себя!» Он ведёт шквальный огонь по турелям, прикрывая твой прорыв. Лазерные лучи вспарывают его броню. Когда ты добираешься до терминала, Тобиас падает у входа, смертельно раненый. Ты тащишь его внутрь, оставляя кровавый след.'
WHERE id = 'ch_5_showdown_tobias';

-- 2. Безопасная альтернатива: Тобиас прикрывает и отступает к терминалу целым.
INSERT INTO public.choices (
  id,
  node_id,
  target_node_id,
  label,
  narrative_override,
  conditions,
  effects,
  sort_order,
  created_at
) VALUES (
  'ch_5_showdown_tobias_safe',
  'act5_bridge_showdown',
  'trans_ch_5_showdown_tobias',
  '[ТОБИАС] Приказать раненому напарнику прикрыть тебя и отойти к терминалу',
  'Тобиас, преодолевая боль, вскидывает пулемёт и открывает огонь по турелям, удерживая их под подавляющим огнём. Под его прикрытием ты прорываешься к терминалу. Он отступает к тебе последним, цел.',
  jsonb_build_object(
    'flag_required', 'tobias_saved',
    'flag_not_required', 'tobias_mortally_wounded'
  ),
  '{}'::jsonb,
  8,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  narrative_override = EXCLUDED.narrative_override,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order;

-- 3. Терминал: финальный запуск печальной концовки.
UPDATE public.choices
SET
  label = '[ФИНАЛ] Запустить протокол «Альянс» с телом Тобиаса в кресле',
  conditions = jsonb_build_object(
    'flag_required', jsonb_build_array('tobias_saved', 'tobias_mortally_wounded'),
    'item_required_any', jsonb_build_array('Квантовый Носитель', 'Запасной аккумулятор')
  ),
  effects = jsonb_build_object(
    'unlock_achievement', 'ach_no_man_left_behind_bad'
  ),
  narrative_override = 'Ты вставляешь носитель в порт терминала. Системы шаттла оживают. Тобиас мёртв в кресле второго пилота. «Авангард» отрывается от станции, унося с собой данные корпорации — и последний приказ, который ты отдал другу.',
  target_node_id = 'ending_3_bad'
WHERE id = 'ch_5_b_ending_3_bad';

-- 4. Хорошая концовка ending_3 недоступна, если Тобиас уже смертельно ранен.
UPDATE public.choices
SET conditions = conditions || '{"flag_not_required":"tobias_mortally_wounded"}'::jsonb
WHERE id = 'ch_5_b_ending_3';

-- 5. Переписываем ending_3_bad под аналог ending_3, но с мёртвым Тобиасом.
UPDATE public.nodes
SET
  title = 'КОНЦОВКА: ПРОТОКОЛ «АЛЬЯНС» — ПОСЛЕДНИЙ ПРИКАЗ',
  narrative = 'Невероятный исход. Ты спас Тобиаса на станции, но ценой его жизни добрался до терминала. С помощью Квантового Носителя — или последнего заряда Запасного аккумулятора — шаттл «Авангард» уходит на полной скорости к дальней колонии мятежников. Рядом с тобой в кресле второго пилота сидит Тобиас. Он мёртв. У тебя на руках все секреты корпорации, но цена оказалась слишком высока.',
  thought = 'Мы покажем всему миру, что они здесь творили... даже если он больше не услышит этого.',
  ending_type = 'sad'
WHERE id = 'ending_3_bad';
