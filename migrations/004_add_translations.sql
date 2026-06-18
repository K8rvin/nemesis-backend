-- ==========================================
-- 🌍 Миграция: JSONB-переводы для игрового контента
-- ==========================================

ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.choices
ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.achievements
ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb;

-- GIN-индексы ускоряют поиск по переводам при росте объёма данных
CREATE INDEX IF NOT EXISTS idx_nodes_translations ON public.nodes USING GIN (translations);
CREATE INDEX IF NOT EXISTS idx_choices_translations ON public.choices USING GIN (translations);
CREATE INDEX IF NOT EXISTS idx_achievements_translations ON public.achievements USING GIN (translations);
