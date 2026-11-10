-- Rollback for migration 0152_report_indexes. NOT run by the migrator (it lives outside migrations/ on purpose).
--
-- Only drops the four indexes that 0134 created; no table or row is touched. Safe to run twice.
-- Then remove the migration's row so a later `migrate` re-applies it if wanted:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793842115354;
-- (Do both in one transaction, against the database you mean to roll back, after taking a backup.)
BEGIN;
DROP INDEX IF EXISTS public.pos_orders_outlet_completed_idx;
DROP INDEX IF EXISTS public.pos_payments_outlet_settled_idx;
DROP INDEX IF EXISTS public.pos_order_lines_sent_at_idx;
DROP INDEX IF EXISTS public.service_items_outlet_idx;
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793842115354;
COMMIT;
