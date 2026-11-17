-- Rollback for migration 0156_table_qr_ordering. NOT run by the migrator (it lives outside migrations/ on purpose).
--
-- Puts the schema back exactly as 0155 left it: the three NOT NULLs return, the three `source` columns, the three
-- CHECKs, the index, `table_qr_codes` and the `pos_order_source` enum go.
--
-- It NEVER deletes or rewrites an order. A guest's QR order has no staff member behind it, so NOT NULL cannot come
-- back while one exists: in that case this script STOPS (RAISE) and changes nothing. Decide first what those orders
-- become (for example: attribute them to the owner, after exporting them), e.g.
--   \copy (select * from pos_orders where source = 'table_qr') to 'qr-orders-before-rollback.csv' csv header
--   UPDATE pos_orders      SET created_by_user_id = '<owner user id>' WHERE created_by_user_id IS NULL;
--   UPDATE pos_order_lines SET created_by_user_id = '<owner user id>' WHERE created_by_user_id IS NULL;
--   UPDATE table_sessions  SET opened_by_user_id  = '<owner user id>' WHERE opened_by_user_id  IS NULL;
-- and only then run this. The printed QR codes stop working after it: their table_qr_codes rows go.
-- Roll back the API and the app to builds that do not read these columns BEFORE running this.
-- Safe to run twice.
BEGIN;
DO $$
DECLARE
  orphan_orders int;
  orphan_lines int;
  orphan_sessions int;
BEGIN
  SELECT count(*) INTO orphan_orders FROM pos_orders WHERE created_by_user_id IS NULL;
  SELECT count(*) INTO orphan_lines FROM pos_order_lines WHERE created_by_user_id IS NULL;
  SELECT count(*) INTO orphan_sessions FROM table_sessions WHERE opened_by_user_id IS NULL;
  IF orphan_orders + orphan_lines + orphan_sessions > 0 THEN
    RAISE EXCEPTION 'Rollback stopped, nothing changed: % guest QR orders, % lines and % table sessions have no staff member. Export and attribute them first (see the header of this file).',
      orphan_orders, orphan_lines, orphan_sessions;
  END IF;
END $$;
DROP INDEX IF EXISTS public.pos_orders_outlet_source_idx;
ALTER TABLE public.pos_orders DROP CONSTRAINT IF EXISTS pos_orders_creator_shape;
ALTER TABLE public.pos_order_lines DROP CONSTRAINT IF EXISTS pos_order_lines_creator_shape;
ALTER TABLE public.table_sessions DROP CONSTRAINT IF EXISTS table_sessions_opener_shape;
ALTER TABLE public.pos_orders ALTER COLUMN created_by_user_id SET NOT NULL;
ALTER TABLE public.pos_order_lines ALTER COLUMN created_by_user_id SET NOT NULL;
ALTER TABLE public.table_sessions ALTER COLUMN opened_by_user_id SET NOT NULL;
ALTER TABLE public.pos_orders DROP COLUMN IF EXISTS source;
ALTER TABLE public.pos_order_lines DROP COLUMN IF EXISTS source;
ALTER TABLE public.table_sessions DROP COLUMN IF EXISTS source;
DROP TABLE IF EXISTS public.table_qr_codes;
DROP TYPE IF EXISTS public.pos_order_source;
COMMIT;
