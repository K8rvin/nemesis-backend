-- Миграция: объединение двух "Тобиас"-выборов на мостике в один.
-- Остаётся один выбор, ведущий к печальной концовке ach_no_man_left_behind_bad.
-- Бывший безопасный выбор перепрофилирован в общий отступ к терминалу.

-- 1. Единственный выбор Тобиаса: сразу ведёт к ending_3_bad.
UPDATE public.choices
SET
  label = '[ТОБИАС] Приказать раненому напарнику прикрыть тебя и отойти к терминалу',
  conditions = jsonb_build_object(
    'flag_required', 'tobias_saved',
    'item_required_any', jsonb_build_array('Квантовый Носитель', 'Запасной аккумулятор')
  ),
  effects = jsonb_build_object(
    'set_hp', 15,
    'add_flag', 'tobias_mortally_wounded',
    'unlock_achievement', 'ach_no_man_left_behind_bad'
  ),
  target_node_id = 'ending_3_bad',
  narrative_override = 'Тобиас, преодолевая адскую боль, сползает с твоих плеч и вскидывает захваченный пулемёт: «Беги к консоли, Маркус! Я прикрою и сам отойду!» Он ведёт шквальный огонь по турелям, прикрывая ваш прорыв. Лазерные лучи вспарывают его броню. Ты добираешься до терминала и тащишь его за собой, но Тобиас уже смертельно ранен. Шаттл «Авангард» уходит в последний рейс — рядом с тобой в кресле второго пилота сидит мёртвый друг.'
WHERE id = 'ch_5_showdown_tobias';

-- 2. Бывший безопасный выбор становится общим отступом к терминалу.
UPDATE public.choices
SET
  label = 'Отступить к терминалу',
  narrative_override = 'Под огнём турелей вы отступаете к главному терминалу мостика. Тобиас цепляется за тебя, всё ещё живой.',
  conditions = '{}'::jsonb,
  effects = '{}'::jsonb,
  target_node_id = 'act5_terminal_final'
WHERE id = 'ch_5_showdown_tobias_safe';

-- 3. Финальный выбор в терминале больше не нужен — концовка теперь на мостике.
DELETE FROM public.choices WHERE id = 'ch_5_b_ending_3_bad';
