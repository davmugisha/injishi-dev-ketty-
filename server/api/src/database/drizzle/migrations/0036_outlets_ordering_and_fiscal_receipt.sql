-- ADR-050 Migration A — the fiscal receipt moves to check out, and an outlet
-- learns whose TIN signs it.
--
-- HAND CORRECTED after `drizzle-kit generate`, in three places it could not
-- know about. Read these before regenerating, or the same three come back:
--
-- 1. `ebm_source` is RECREATED rather than ALTERed. `ALTER TYPE ... ADD VALUE`
--    is legal inside a transaction, but Postgres then refuses to USE the new
--    value until that transaction commits, and `ebm_invoices_source_shape`
--    below compares `source` to 'folio' in this same transaction:
--
--      unsafe use of new value "folio" of enum type ebm_source
--
--    `drizzle-kit migrate` applies every pending migration in ONE transaction,
--    so splitting the ADD VALUE into its own FILE does not help. Renaming the
--    old type and creating a new one sidesteps the rule: a type CREATEd inside
--    a transaction may be used inside it. Same reasoning as 0005.
--
--    `domain_event_type` keeps its plain ADD VALUEs because nothing writes
--    those six literals during this migration; they are written at runtime,
--    after the commit, so the restriction never bites.
--
-- 2. `folio_charges.tax_entity_org_id` and `outlets.tax_entity_org_id` are
--    added NULLABLE, BACKFILLED, and only then set NOT NULL. The generator
--    emits a bare `ADD COLUMN ... NOT NULL`, which fails against any table that
--    already holds a row. Every existing charge takes its folio's property's
--    org and every existing outlet takes its property's, which is what they all
--    are today: a hotel selling under its own TIN.
--
-- 3. `bookings.ebm_sign_at` is backfilled to 'booking'. Every booking on disk
--    was confirmed under the old rule and its room is ALREADY declared as an
--    `NS`. A null here would leave the close guessing, and the one thing it
--    must never do is declare that room a second time (ADR-050 D-a, and the
--    straddling case in the fiscal child's migration plan).
CREATE TYPE "public"."ebm_receipt_type" AS ENUM('normal', 'training', 'proforma');--> statement-breakpoint
CREATE TYPE "public"."ebm_transaction_type" AS ENUM('sale', 'refund');--> statement-breakpoint
CREATE TYPE "public"."outlet_ordering_access" AS ENUM('in_house_only', 'walk_in_only', 'both');--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'order.status';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'thread.message';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'housekeeping.task';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'folio.balance';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'ebm.health';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'ebm.sale';--> statement-breakpoint
ALTER TABLE "ebm_invoices" DROP CONSTRAINT "ebm_invoices_source_shape";--> statement-breakpoint
ALTER TYPE "public"."ebm_source" RENAME TO "ebm_source_old";--> statement-breakpoint
CREATE TYPE "public"."ebm_source" AS ENUM('booking', 'subscription', 'folio', 'outlet_order');--> statement-breakpoint
ALTER TABLE "ebm_invoices" ALTER COLUMN "source" TYPE "public"."ebm_source" USING "source"::text::"public"."ebm_source";--> statement-breakpoint
DROP TYPE "public"."ebm_source_old";--> statement-breakpoint
CREATE TABLE "ebm_receipt_counters" (
	"org_id" uuid NOT NULL,
	"rra_branch_id" text DEFAULT '00' NOT NULL,
	"receipt_label" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ebm_receipt_counters_pk" PRIMARY KEY("org_id","rra_branch_id","receipt_label")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ebm_sign_at" text;--> statement-breakpoint
UPDATE "bookings" SET "ebm_sign_at" = 'booking' WHERE "ebm_sign_at" IS NULL;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD COLUMN "folio_charge_id" uuid;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD COLUMN "service_order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD COLUMN "rra_item_cls_cd" text;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD COLUMN "rra_item_cd" text;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD COLUMN "rra_pkg_unit_cd" text;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD COLUMN "rra_qty_unit_cd" text;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD COLUMN "tax_type_code" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "folio_id" uuid;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "service_order_id" uuid;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "outlet_id" uuid;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "receipt_type" "ebm_receipt_type" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "transaction_type" "ebm_transaction_type" DEFAULT 'sale' NOT NULL;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "receipt_label" text GENERATED ALWAYS AS (CASE
              WHEN "transaction_type" = 'refund' AND "receipt_type" = 'normal' THEN 'NR'
              WHEN "transaction_type" = 'refund' AND "receipt_type" = 'training' THEN 'TR'
              WHEN "receipt_type" = 'normal' THEN 'NS'
              WHEN "receipt_type" = 'training' THEN 'TS'
              ELSE 'PS'
            END) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "refund_of_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "rra_branch_id" text DEFAULT '00' NOT NULL;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "cis_receipt_no" integer;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "sdc_id" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "sdc_receipt_no" integer;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "total_receipt_no" integer;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "internal_data" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "receipt_signature" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "vsdc_receipt_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "mrc" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "journal_text" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "original_rendered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "customer_tin" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "tax_entity_org_id" uuid;--> statement-breakpoint
UPDATE "outlets" o SET "tax_entity_org_id" = p."org_id" FROM "properties" p WHERE p."id" = o."property_id" AND o."tax_entity_org_id" IS NULL;--> statement-breakpoint
ALTER TABLE "outlets" ALTER COLUMN "tax_entity_org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "ordering_access" "outlet_ordering_access" DEFAULT 'in_house_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD COLUMN "tax_entity_org_id" uuid;--> statement-breakpoint
UPDATE "folio_charges" c SET "tax_entity_org_id" = p."org_id" FROM "folios" f, "properties" p WHERE f."id" = c."folio_id" AND p."id" = f."property_id" AND c."tax_entity_org_id" IS NULL;--> statement-breakpoint
ALTER TABLE "folio_charges" ALTER COLUMN "tax_entity_org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD COLUMN "ebm_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD COLUMN "payment_method_code" text;--> statement-breakpoint
ALTER TABLE "folios" ADD COLUMN "folio_sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "folios" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "folios" ADD COLUMN "customer_tin" text;--> statement-breakpoint
ALTER TABLE "folios" ADD COLUMN "customer_name" text;--> statement-breakpoint
UPDATE "folios" f SET "folio_sequence" = r.seq FROM (SELECT id, row_number() OVER (PARTITION BY "guest_stay_id" ORDER BY "opened_at", "id") AS seq FROM "folios" WHERE "guest_stay_id" IS NOT NULL) r WHERE r.id = f.id AND r.seq > 1;--> statement-breakpoint
ALTER TABLE "ebm_receipt_counters" ADD CONSTRAINT "ebm_receipt_counters_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD CONSTRAINT "ebm_invoice_lines_folio_charge_id_folio_charges_id_fk" FOREIGN KEY ("folio_charge_id") REFERENCES "public"."folio_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD CONSTRAINT "ebm_invoice_lines_service_order_item_id_service_order_items_id_fk" FOREIGN KEY ("service_order_item_id") REFERENCES "public"."service_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_refund_of_invoice_id_ebm_invoices_id_fk" FOREIGN KEY ("refund_of_invoice_id") REFERENCES "public"."ebm_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_tax_entity_org_id_orgs_id_fk" FOREIGN KEY ("tax_entity_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_ebm_invoice_id_ebm_invoices_id_fk" FOREIGN KEY ("ebm_invoice_id") REFERENCES "public"."ebm_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_tax_entity_org_id_orgs_id_fk" FOREIGN KEY ("tax_entity_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ebm_invoices_report_idx" ON "ebm_invoices" USING btree ("org_id","rra_branch_id","receipt_label","emitted_at");--> statement-breakpoint
CREATE INDEX "ebm_invoices_folio_idx" ON "ebm_invoices" USING btree ("folio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ebm_invoices_cis_receipt_no_uk" ON "ebm_invoices" USING btree ("org_id","rra_branch_id","receipt_label","cis_receipt_no") WHERE "ebm_invoices"."cis_receipt_no" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "folios_stay_sequence_uk" ON "folios" USING btree ("guest_stay_id","folio_sequence") WHERE "folios"."guest_stay_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_refund_shape" CHECK (("ebm_invoices"."transaction_type" = 'refund' AND "ebm_invoices"."refund_of_invoice_id" IS NOT NULL)
          OR ("ebm_invoices"."transaction_type" = 'sale' AND "ebm_invoices"."refund_of_invoice_id" IS NULL));--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_no_proforma_refund" CHECK (NOT ("ebm_invoices"."receipt_type" = 'proforma' AND "ebm_invoices"."transaction_type" = 'refund'));--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_source_shape" CHECK (("ebm_invoices"."source" = 'booking' AND "ebm_invoices"."booking_id" IS NOT NULL AND "ebm_invoices"."subscription_invoice_id" IS NULL AND "ebm_invoices"."folio_id" IS NULL AND "ebm_invoices"."service_order_id" IS NULL)
          OR ("ebm_invoices"."source" = 'subscription' AND "ebm_invoices"."subscription_invoice_id" IS NOT NULL AND "ebm_invoices"."booking_id" IS NULL AND "ebm_invoices"."folio_id" IS NULL AND "ebm_invoices"."service_order_id" IS NULL)
          OR ("ebm_invoices"."source" = 'folio' AND "ebm_invoices"."folio_id" IS NOT NULL AND "ebm_invoices"."booking_id" IS NULL AND "ebm_invoices"."subscription_invoice_id" IS NULL AND "ebm_invoices"."service_order_id" IS NULL)
          OR ("ebm_invoices"."source" = 'outlet_order' AND "ebm_invoices"."service_order_id" IS NOT NULL AND "ebm_invoices"."booking_id" IS NULL AND "ebm_invoices"."subscription_invoice_id" IS NULL AND "ebm_invoices"."folio_id" IS NULL));
