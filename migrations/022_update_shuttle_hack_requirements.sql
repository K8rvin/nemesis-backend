-- Миграция: для концовки "Побег на шаттле Цельс" кроме Запасного аккумулятора
-- требуется ещё и Усиленный Сервопривод с Акта 1.
UPDATE public.choices
SET conditions = '{"item_required":["Запасной аккумулятор","Усиленный Сервопривод"]}'::jsonb
WHERE id = 'ch_1_shuttle_hack'
  AND conditions = '{"item_required":"Запасной аккумулятор"}'::jsonb;
