-- ADR-016 migration phase 3 - the folio thread.
--
-- `folios` and `folio_charges` with the corrected shape: no `is_void` column
-- (correction 1, D-j), and the subject check relaxed to "at least one" and
-- scoped to a `guest` folio (correction 2, D-k).
--
-- Additive only, and it rolls back by dropping its two tables.
--
-- The partial unique index on `(folio_id, business_date)` for room charges is
-- what makes AC-15 true: the night audit is a job, a job runs twice, and
-- without it a rerun bills the guest for the same night again.
CREATE TYPE "public"."charge_type" AS ENUM('room', 'service_order', 'pos', 'tax', 'service_charge', 'adjustment', 'discount', 'deposit', 'payment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."folio_status" AS ENUM('open', 'settled', 'closed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."folio_type" AS ENUM('guest', 'master', 'group', 'house');--> statement-breakpoint
CREATE TABLE "folio_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"department_id" uuid,
	"outlet_id" uuid,
	"charge_type" charge_type NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_rwf" bigint,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"tax_code" "tax_code",
	"tax_rate" numeric,
	"tax_amount_rwf" bigint,
	"source_ref_type" text,
	"source_ref_id" uuid,
	"posted_by_user_id" uuid,
	"business_date" date,
	"idempotency_key" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folio_charges_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "folios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio_number" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"guest_stay_id" uuid,
	"booking_id" uuid,
	"lease_id" uuid,
	"guest_user_id" uuid,
	"folio_type" "folio_type" DEFAULT 'guest' NOT NULL,
	"status" "folio_status" DEFAULT 'open' NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"balance_rwf" bigint DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folios_number_uk" UNIQUE("folio_number"),
	CONSTRAINT "folios_guest_subject_at_least_one" CHECK ("folios"."folio_type" <> 'guest'
           OR "folios"."guest_stay_id" IS NOT NULL
           OR "folios"."booking_id" IS NOT NULL
           OR "folios"."lease_id" IS NOT NULL),
	CONSTRAINT "folios_closed_is_zero" CHECK ("folios"."status" <> 'closed' OR "folios"."balance_rwf" = 0)
);
--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_posted_by_user_id_users_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folio_charges_folio_idx" ON "folio_charges" USING btree ("folio_id","posted_at");--> statement-breakpoint
CREATE INDEX "folio_charges_department_idx" ON "folio_charges" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "folio_charges_source_idx" ON "folio_charges" USING btree ("source_ref_type","source_ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "folio_charges_room_night_uk" ON "folio_charges" USING btree ("folio_id","business_date") WHERE "folio_charges"."charge_type" = 'room'
             AND "folio_charges"."business_date" IS NOT NULL
             AND "folio_charges"."source_ref_type" IS DISTINCT FROM 'void';--> statement-breakpoint
CREATE INDEX "folios_workspace_status_idx" ON "folios" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "folios_stay_idx" ON "folios" USING btree ("guest_stay_id");--> statement-breakpoint
CREATE INDEX "folios_booking_idx" ON "folios" USING btree ("booking_id");