-- Table QR self-service ordering. A guest scans the QR on a table, sees that outlet's menu on their phone and sends an
-- order that lands on THAT table, goes straight to its kitchen and bar stations and shows on the till and the floor as a
-- guest order. Staff keep every other step: the bill, discounts, voids, payment and releasing the table.
--
-- What changes:
--   * one new enum `pos_order_source` ('staff' | 'table_qr');
--   * one new table `table_qr_codes`: the permanent, unguessable code printed in each table's QR. The code alone names
--     the table, so editing the address can never reach another table; a code can be replaced for one table only;
--   * `pos_orders`, `pos_order_lines`, `table_sessions` each get a `source` column, DEFAULT 'staff' NOT NULL, so every
--     existing row reads 'staff' and every existing write (which never names it) still writes 'staff';
--   * `pos_orders.created_by_user_id`, `pos_order_lines.created_by_user_id` and `table_sessions.opened_by_user_id`
--     lose NOT NULL, and a CHECK puts the rule back for every row that is not a guest's: only a `table_qr` row may
--     have no staff member behind it.
--
-- No row is changed or deleted, no existing constraint is dropped. Safe to run twice.
--
-- Rollback (not run by the migrator): drizzle/rollbacks/0156_table_qr_ordering.down.sql
DO $$ BEGIN
  CREATE TYPE "public"."pos_order_source" AS ENUM('staff', 'table_qr');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "table_qr_codes" (
  "table_id" uuid PRIMARY KEY NOT NULL REFERENCES "restaurant_tables"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "outlet_id" uuid NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "table_qr_codes_code_shape" CHECK ("code" ~ '^[A-Za-z0-9_-]{24,64}$')
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "table_qr_codes_code_uk" ON "table_qr_codes" ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_qr_codes_outlet_idx" ON "table_qr_codes" ("outlet_id");--> statement-breakpoint
ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "source" "pos_order_source" DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD COLUMN IF NOT EXISTS "source" "pos_order_source" DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD COLUMN IF NOT EXISTS "source" "pos_order_source" DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_orders" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "table_sessions" ALTER COLUMN "opened_by_user_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_creator_shape"
    CHECK ("created_by_user_id" IS NOT NULL OR "source" = 'table_qr');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_creator_shape"
    CHECK ("created_by_user_id" IS NOT NULL OR "source" = 'table_qr');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_opener_shape"
    CHECK ("opened_by_user_id" IS NOT NULL OR "source" = 'table_qr');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_orders_outlet_source_idx" ON "pos_orders" ("outlet_id", "created_at") WHERE "source" = 'table_qr';
