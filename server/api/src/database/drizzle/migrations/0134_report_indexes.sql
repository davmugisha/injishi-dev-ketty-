-- POS reports: the four indexes the report queries need, and nothing else.
--
-- Each one matches a filter in modules/pos/application/pos-report.service.ts:
--   pos_orders (outlet_id, completed_at)   outlet + completed_at range (sales totals, waiter and daily breakdowns, tax)
--   pos_payments (outlet_id, settled_at)   outlet + settled_at range (payment-method mix)
--   pos_order_lines (sent_at)              sent_at range (best sellers, joined to pos_orders by order_id)
--   service_items (outlet_id)              menu / stock listing per outlet
--
-- Plain CREATE INDEX IF NOT EXISTS: the Drizzle migrator runs every pending migration inside ONE transaction, and
-- CREATE INDEX CONCURRENTLY cannot run in a transaction. While an index builds, writes to that table wait; on the
-- POS tables that is a fraction of a second at demo and single-venue volumes. For a very large table, create the
-- same index CONCURRENTLY by hand first (same name); IF NOT EXISTS then makes this migration a no-op.
--
-- Rollback (not run by the migrator): drizzle/rollbacks/0134_report_indexes.down.sql
CREATE INDEX IF NOT EXISTS "pos_orders_outlet_completed_idx" ON "pos_orders" ("outlet_id", "completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_payments_outlet_settled_idx" ON "pos_payments" ("outlet_id", "settled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_order_lines_sent_at_idx" ON "pos_order_lines" ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_items_outlet_idx" ON "service_items" ("outlet_id");
