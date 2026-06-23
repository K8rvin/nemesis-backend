-- Добавляем историю посещённых нод для интерактивной карты сюжета.
ALTER TABLE public.game_state
ADD COLUMN IF NOT EXISTS visited_nodes jsonb NOT NULL DEFAULT '[]'::jsonb;
