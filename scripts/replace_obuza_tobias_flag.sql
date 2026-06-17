-- Заменяем флаг `обуза_тобиас` на `tobias_saved` в условиях выборов.
-- Флаг `tobias_saved` уже выставляется в `trans_choice_ch_2_save_to_act3`.

UPDATE public.choices
SET conditions = jsonb_set(
  conditions,
  '{flag_required}',
  '"tobias_saved"'::jsonb
)
WHERE id = 'ch_5_b_ending_3';

UPDATE public.choices
SET conditions = jsonb_set(
  conditions,
  '{flag_required}',
  '"tobias_saved"'::jsonb
)
WHERE id = 'ch_4_phase2_fall_tobias';

UPDATE public.choices
SET conditions = jsonb_set(
  conditions,
  '{flag_not_required}',
  '"tobias_saved"'::jsonb
)
WHERE id = 'ch_4_phase2_solo_clean';
