-- 035_add_bug_report_type.sql
-- Тип сообщения (баг, предложение, идея, другое).

BEGIN;

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'bug';

CREATE INDEX IF NOT EXISTS idx_bug_reports_type
  ON public.bug_reports (type);

COMMENT ON COLUMN public.bug_reports.type IS 'Тип обратной связи';

COMMIT;
