-- Rentals P4, WP 4.3 (blueprint 1.2 "Expenses and tax"): what a landlord spends, and paying a
-- fault's fixer.
--
-- `expenses`: one row per payment, by business, building, unit and Kigali day; `recorded` (paid
-- outside Injishi, voidable with a reason) or `gateway` (paid through Injishi, carrying the payout
-- that moved the money, never voided). Only loan interest says what the loan was for (build or buy).
-- `maintenance_payouts`: which fault a repair payout pays for, while the prompt waits on the
-- landlord's phone; the payout row holds the money, rentals rows point at it (blueprint 1.1).
-- Nothing here uses a value an ALTER TYPE ... ADD VALUE of this run added (0087's kinds are used by
-- the code only).
CREATE TYPE "public"."expense_category" AS ENUM('repairs', 'utilities', 'security', 'cleaning', 'insurance', 'loan_interest', 'other');--> statement-breakpoint
CREATE TYPE "public"."expense_method" AS ENUM('cash', 'momo', 'bank', 'other');--> statement-breakpoint
CREATE TYPE "public"."expense_source" AS ENUM('gateway', 'recorded');--> statement-breakpoint
CREATE TYPE "public"."loan_purpose" AS ENUM('build', 'buy');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"ticket_id" uuid,
	"category" "expense_category" NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"paid_on" date NOT NULL,
	"method" "expense_method" NOT NULL,
	"payee_name" text,
	"payee_phone" text,
	"note" text,
	"receipt_object_id" uuid,
	"source" "expense_source" NOT NULL,
	"payout_id" uuid,
	"loan_purpose" "loan_purpose",
	"created_by_user_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_rwf" > 0 AND "expenses"."amount_rwf" <= 10000000000),
	CONSTRAINT "expenses_paid_on_floor" CHECK ("expenses"."paid_on" >= DATE '2000-01-01'),
	CONSTRAINT "expenses_gateway_payout" CHECK (("expenses"."source" = 'gateway') = ("expenses"."payout_id" IS NOT NULL)),
	CONSTRAINT "expenses_gateway_not_voided" CHECK ("expenses"."source" <> 'gateway' OR "expenses"."voided_at" IS NULL),
	CONSTRAINT "expenses_void_shape" CHECK (("expenses"."voided_at" IS NULL AND "expenses"."voided_by_user_id" IS NULL AND "expenses"."void_reason" IS NULL)
        OR ("expenses"."voided_at" IS NOT NULL AND "expenses"."void_reason" IS NOT NULL AND length(btrim("expenses"."void_reason")) > 0)),
	CONSTRAINT "expenses_loan_purpose" CHECK (("expenses"."category" = 'loan_interest') = ("expenses"."loan_purpose" IS NOT NULL)),
	CONSTRAINT "expenses_payee_phone_shape" CHECK ("expenses"."payee_phone" IS NULL OR "expenses"."payee_phone" ~ '^[+][1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "maintenance_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"payout_id" uuid NOT NULL,
	"payer_masked" text NOT NULL,
	"payee_phone" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_payouts_payout_uk" UNIQUE("payout_id"),
	CONSTRAINT "maintenance_payouts_payee_phone_shape" CHECK ("maintenance_payouts"."payee_phone" IS NULL OR "maintenance_payouts"."payee_phone" ~ '^[+][1-9][0-9]{7,14}$')
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_object_id_stored_objects_id_fk" FOREIGN KEY ("receipt_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_payouts" ADD CONSTRAINT "maintenance_payouts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_payouts" ADD CONSTRAINT "maintenance_payouts_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_payouts" ADD CONSTRAINT "maintenance_payouts_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_payouts" ADD CONSTRAINT "maintenance_payouts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_payout_uk" ON "expenses" USING btree ("payout_id") WHERE "expenses"."payout_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "expenses_org_paid_on_idx" ON "expenses" USING btree ("org_id","paid_on");--> statement-breakpoint
CREATE INDEX "expenses_workspace_paid_on_idx" ON "expenses" USING btree ("workspace_id","paid_on");--> statement-breakpoint
CREATE INDEX "expenses_ticket_idx" ON "expenses" USING btree ("ticket_id") WHERE "expenses"."ticket_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "maintenance_payouts_ticket_idx" ON "maintenance_payouts" USING btree ("ticket_id");
