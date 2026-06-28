-- 034_bug_reports_status.sql
-- Статус обработки баг-репорта.

BEGIN;

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_bug_reports_status
  ON public.bug_reports (status);

COMMENT ON COLUMN public.bug_reports.status IS 'Статус обработки репорта';

COMMIT;
