-- ADR-050 Migration C — the catalog can be sold (slice 3, task 16).
--
-- HAND CORRECTED after `drizzle-kit generate`, in one place. Read it before
-- regenerating, or it comes back:
--
-- 1. `service_orders.tax_entity_org_id` is added NULLABLE, BACKFILLED, and only
--    then set NOT NULL. The generator emits a bare `ADD COLUMN ... NOT NULL`,
--    which fails against a table that already holds a row. Every existing order
--    takes its outlet's tax entity, else its property's org, which is the order
--    of the one rule (cross child contract 1, and `resolveTaxEntityTx`).
--
-- Two things that look like they need the same care and do not:
--
-- - `service_order_status` gains its two values with a plain ADD VALUE. Nothing
--   in this migration compares a status to either literal (neither new CHECK
--   reads `status`), so the "unsafe use of new value" rule 0036 hit never bites.
-- - There is deliberately NO check tying `guest_orderable` to the RRA codes
--   (ADR-050 D-m, amended 2026-09-12). Every item on sale today carries none, so
--   such a check would fail here or switch them all off; the service guards it.
CREATE TYPE "public"."payment_attempt_purpose" AS ENUM('booking', 'service_order');--> statement-breakpoint
CREATE TYPE "public"."service_order_context" AS ENUM('in_house_folio', 'pay_now');--> statement-breakpoint
ALTER TYPE "public"."service_order_status" ADD VALUE 'pending_payment';--> statement-breakpoint
ALTER TYPE "public"."service_order_status" ADD VALUE 'payment_failed';--> statement-breakpoint
CREATE TABLE "rra_item_classifications" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_code" text,
	"level" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "room_type_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "check_in" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "check_out" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "guest_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ALTER COLUMN "property_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "purpose" "payment_attempt_purpose" DEFAULT 'booking' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "service_order_id" uuid;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "default_rra_item_cls_cd" text;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "default_rra_item_ty_cd" text;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "default_rra_pkg_unit_cd" text;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "default_rra_qty_unit_cd" text;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "default_tax_code" "tax_code";--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN "rra_item_cls_cd" text;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN "rra_item_ty_cd" text;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN "rra_item_cd" text;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN "rra_pkg_unit_cd" text;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN "rra_qty_unit_cd" text;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "order_context" "service_order_context" DEFAULT 'in_house_folio' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "tax_entity_org_id" uuid;--> statement-breakpoint
UPDATE "service_orders" so
   SET "tax_entity_org_id" = COALESCE(
     (SELECT o."tax_entity_org_id" FROM "outlets" o WHERE o."id" = so."outlet_id"),
     (SELECT p."org_id" FROM "properties" p WHERE p."id" = so."property_id")
   )
 WHERE so."tax_entity_org_id" IS NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ALTER COLUMN "tax_entity_org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "payment_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "paid_marked_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "customer_user_id" uuid;--> statement-breakpoint
CREATE INDEX "rra_item_classifications_parent_idx" ON "rra_item_classifications" USING btree ("parent_code");--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_default_rra_item_cls_cd_rra_item_classifications_code_fk" FOREIGN KEY ("default_rra_item_cls_cd") REFERENCES "public"."rra_item_classifications"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_rra_item_cls_cd_rra_item_classifications_code_fk" FOREIGN KEY ("rra_item_cls_cd") REFERENCES "public"."rra_item_classifications"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_tax_entity_org_id_orgs_id_fk" FOREIGN KEY ("tax_entity_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_paid_marked_by_user_id_users_id_fk" FOREIGN KEY ("paid_marked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_items_workspace_item_cd_uk" ON "service_items" USING btree ("workspace_id","rra_item_cd") WHERE "service_items"."rra_item_cd" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_purpose_shape" CHECK (("payment_attempts"."purpose" = 'booking'
            AND "payment_attempts"."room_type_id" IS NOT NULL AND "payment_attempts"."check_in" IS NOT NULL
            AND "payment_attempts"."check_out" IS NOT NULL AND "payment_attempts"."guest_count" IS NOT NULL
            AND "payment_attempts"."service_order_id" IS NULL)
        OR ("payment_attempts"."purpose" = 'service_order'
            AND "payment_attempts"."service_order_id" IS NOT NULL
            AND "payment_attempts"."room_type_id" IS NULL AND "payment_attempts"."check_in" IS NULL
            AND "payment_attempts"."check_out" IS NULL AND "payment_attempts"."guest_count" IS NULL));--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_default_item_ty_cd" CHECK ("service_categories"."default_rra_item_ty_cd" IS NULL OR "service_categories"."default_rra_item_ty_cd" IN ('1', '2', '3'));--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_rra_item_ty_cd" CHECK ("service_items"."rra_item_ty_cd" IS NULL OR "service_items"."rra_item_ty_cd" IN ('1', '2', '3'));--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_context_folio" CHECK (("service_orders"."order_context" = 'in_house_folio' AND "service_orders"."folio_id" IS NOT NULL)
        OR ("service_orders"."order_context" = 'pay_now' AND "service_orders"."folio_id" IS NULL));--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_property_or_outlet" CHECK ("service_orders"."property_id" IS NOT NULL OR "service_orders"."outlet_id" IS NOT NULL);