-- Customers of the bar and restaurant (CRM, phase 1). ADDITIVE ONLY.
--
--   * one new table, `customers`: a person a business serves, keyed by phone (E.164);
--   * one new NULLABLE column, `pos_orders.customer_id`, with a composite foreign key so an order can only name a
--     customer of its own business, and a partial index for "this customer's orders".
--
-- Nothing is dropped, renamed, rewritten or backfilled. Every existing order keeps `customer_id` NULL, and adding a
-- nullable column without a default is a catalogue change only (no table rewrite), so the POS keeps running while it
-- is applied. The new foreign key is checked against existing rows, all of which are NULL, so it does not scan.
--
-- Nothing reads `customer_id` unless a customer has been attached, so an API build that predates this migration and
-- a database that already has it work together; the reverse (new API, old database) is refused at boot by the
-- readiness check, not by a half-working screen.
--
-- Rollback (not run by the migrator): drizzle/rollbacks/0153_customers.down.sql
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"email" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone,
	"consent_source" text,
	"source" text DEFAULT 'pos' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"merged_into_id" uuid,
	"notes" text,
	"created_by_user_id" uuid,
	"erased_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_workspace_id_uk" UNIQUE("workspace_id","id"),
	CONSTRAINT "customers_source_valid" CHECK ("source" IN ('pos', 'qr', 'reservation', 'import')),
	CONSTRAINT "customers_status_valid" CHECK ("status" IN ('active', 'merged', 'erased')),
	CONSTRAINT "customers_name_length" CHECK (char_length(btrim("full_name")) BETWEEN 1 AND 120),
	CONSTRAINT "customers_phone_shape" CHECK ("status" = 'erased' OR ("phone_e164" ~ '^\+[1-9][0-9]{7,14}$' AND ("phone_e164" NOT LIKE '+250%' OR "phone_e164" ~ '^\+250(72|73|78|79)[0-9]{7}$'))),
	CONSTRAINT "customers_merge_shape" CHECK (("status" = 'merged') = ("merged_into_id" IS NOT NULL) AND "merged_into_id" IS DISTINCT FROM "id"),
	CONSTRAINT "customers_erase_shape" CHECK (("status" = 'erased') = ("erased_at" IS NOT NULL) AND ("status" <> 'erased' OR ("email" IS NULL AND "notes" IS NULL AND "marketing_consent" = false)))
);--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_fk" FOREIGN KEY ("workspace_id","merged_into_id") REFERENCES "customers"("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_workspace_phone_uk" ON "customers" ("workspace_id","phone_e164") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_workspace_status_idx" ON "customers" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_workspace_email_idx" ON "customers" ("workspace_id",lower("email")) WHERE "email" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_customer_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "customers"("workspace_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_orders_customer_idx" ON "pos_orders" ("customer_id","created_at") WHERE "customer_id" IS NOT NULL;
