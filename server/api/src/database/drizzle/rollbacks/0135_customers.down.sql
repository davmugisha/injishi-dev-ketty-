-- Rollback for migration 0135_customers. NOT run by the migrator (it lives outside migrations/ on purpose).
--
-- Removes what 0135 added and nothing else: the customer link on orders, then the customers table. An order that named a
-- customer keeps every line, payment and total; it just no longer says who the customer was. THAT IS LOST, so if any
-- customer data has been entered, dump it first:
--   pg_dump --table=customers --data-only <database> > customers-before-rollback.sql
-- and take a full backup. Safe to run twice.
-- Then remove the migration's row so a later `migrate` re-applies it if wanted (done below, in the same transaction).
-- Run against the database you mean to roll back, and read the row count the first SELECT prints before you COMMIT.
BEGIN;
SELECT count(*) AS customers_that_will_be_lost FROM customers;
SELECT count(*) AS orders_that_name_a_customer FROM pos_orders WHERE customer_id IS NOT NULL;
DROP INDEX IF EXISTS public.pos_orders_customer_idx;
ALTER TABLE public.pos_orders DROP CONSTRAINT IF EXISTS pos_orders_customer_fk;
ALTER TABLE public.pos_orders DROP COLUMN IF EXISTS customer_id;
DROP TABLE IF EXISTS public.customers;
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794010000000;
-- COMMIT;  -- uncomment only after reading the two counts above
ROLLBACK;
