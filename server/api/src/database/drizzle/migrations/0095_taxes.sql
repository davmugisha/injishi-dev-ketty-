-- Rentals P4, WP 4.4 (blueprint 1.2 "Expenses and tax", 2.6): rental income tax and lease filings.
--
-- `tax_declarations`: a business's declaration of a year's rental income tax, as the landlord tells
-- it (declared, paid, the RRA reference and receipt); one row per business and year. The estimate is
-- worked out on every read and never stored. `nudges_sent` counts the January reminders.
-- `lease_filings.reminders_sent`: the reminders sent while a copy for RRA is due (five days and one
-- day before its day), so the hourly job never sends one twice.
-- Nothing here uses a value an ALTER TYPE ... ADD VALUE of this run added.
CREATE TYPE "public"."tax_declaration_status" AS ENUM('not_started', 'declared', 'paid');--> statement-breakpoint
CREATE TABLE "tax_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"status" "tax_declaration_status" DEFAULT 'not_started' NOT NULL,
	"declared_on" date,
	"paid_on" date,
	"amount_paid_rwf" bigint,
	"rra_reference" text,
	"receipt_object_id" uuid,
	"nudges_sent" integer DEFAULT 0 NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_declarations_org_year_uk" UNIQUE("org_id","year"),
	CONSTRAINT "tax_declarations_year_range" CHECK ("tax_declarations"."year" BETWEEN 2020 AND 2100),
	CONSTRAINT "tax_declarations_shape" CHECK (("tax_declarations"."status" = 'not_started' AND "tax_declarations"."declared_on" IS NULL AND "tax_declarations"."paid_on" IS NULL AND "tax_declarations"."amount_paid_rwf" IS NULL)
        OR ("tax_declarations"."status" = 'declared' AND "tax_declarations"."declared_on" IS NOT NULL AND "tax_declarations"."paid_on" IS NULL AND "tax_declarations"."amount_paid_rwf" IS NULL)
        OR ("tax_declarations"."status" = 'paid' AND "tax_declarations"."declared_on" IS NOT NULL AND "tax_declarations"."paid_on" IS NOT NULL AND "tax_declarations"."amount_paid_rwf" IS NOT NULL)),
	CONSTRAINT "tax_declarations_declared_after_year" CHECK ("tax_declarations"."declared_on" IS NULL OR "tax_declarations"."declared_on" >= make_date("tax_declarations"."year" + 1, 1, 1)),
	CONSTRAINT "tax_declarations_paid_after_declared" CHECK ("tax_declarations"."paid_on" IS NULL OR "tax_declarations"."paid_on" >= "tax_declarations"."declared_on"),
	CONSTRAINT "tax_declarations_amount_positive" CHECK ("tax_declarations"."amount_paid_rwf" IS NULL OR ("tax_declarations"."amount_paid_rwf" > 0 AND "tax_declarations"."amount_paid_rwf" <= 2000000000)),
	CONSTRAINT "tax_declarations_nudges_range" CHECK ("tax_declarations"."nudges_sent" BETWEEN 0 AND 3)
);
--> statement-breakpoint
ALTER TABLE "lease_filings" ADD COLUMN "reminders_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_declarations" ADD CONSTRAINT "tax_declarations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_declarations" ADD CONSTRAINT "tax_declarations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_declarations" ADD CONSTRAINT "tax_declarations_receipt_object_id_stored_objects_id_fk" FOREIGN KEY ("receipt_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_declarations" ADD CONSTRAINT "tax_declarations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Every lease signed by both sides owes RRA a copy within 15 days (Law No. 048/2023 Art. 41). Leases
-- signed before the signing step wrote that row get theirs now, due 15 days after the Kigali day
-- they were signed.
INSERT INTO "lease_filings" ("lease_id", "kind", "due_on", "status")
SELECT l."id", 'new_lease', ((l."signed_at" AT TIME ZONE 'Africa/Kigali')::date + 15), 'pending'
  FROM "leases" l
 WHERE l."signed_at" IS NOT NULL
   AND l."status" IN ('signed', 'active', 'ending', 'ended')
   AND NOT EXISTS (SELECT 1 FROM "lease_filings" f WHERE f."lease_id" = l."id" AND f."kind" = 'new_lease');--> statement-breakpoint
ALTER TABLE "lease_filings" ADD CONSTRAINT "lease_filings_reminders_range" CHECK ("lease_filings"."reminders_sent" BETWEEN 0 AND 2);
