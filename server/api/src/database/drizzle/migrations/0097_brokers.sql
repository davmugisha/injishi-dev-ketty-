-- Brokers (P5, 2026-10-25: opt in per unit, landlord-set fee, plans on the gateway).
--
-- `rental_units.broker_offer` and its fee (a percent of the first month or fixed francs): brokers see
-- no other unit. `landlord_profiles.broker_fee_kind/_rwf`: the fee a unit starts with. `brokers`
-- gains the home district the free plan shows. `contact_reveals` and `tenant_placements` gain the
-- unit; a placement keeps the fee it started on. `placement_fees` records what was agreed and when
-- the landlord marked it paid (money moves outside Injishi). New: `broker_plans` (seeded District
-- free, Province 10,000, Country 25,000 RWF a month), `broker_subscriptions` and their payments, the
-- registration fee paid before the broker row exists, and `broker_ratings`.
CREATE TYPE "public"."broker_fee_kind" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."broker_fee_method" AS ENUM('mtn_momo', 'airtel_money');--> statement-breakpoint
CREATE TYPE "public"."broker_pay_method" AS ENUM('mtn_momo', 'airtel_money', 'card');--> statement-breakpoint
CREATE TYPE "public"."broker_payment_kind" AS ENUM('start', 'renewal');--> statement-breakpoint
CREATE TYPE "public"."broker_payment_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."broker_plan_code" AS ENUM('district', 'province', 'country');--> statement-breakpoint
CREATE TYPE "public"."broker_rater_role" AS ENUM('tenant', 'landlord');--> statement-breakpoint
CREATE TYPE "public"."broker_subscription_status" AS ENUM('active', 'pending_payment', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "broker_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "broker_plan_code" NOT NULL,
	"name" text NOT NULL,
	"price_rwf" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_plans_code_uk" UNIQUE("code"),
	CONSTRAINT "broker_plans_price_ck" CHECK ("broker_plans"."price_rwf" BETWEEN 0 AND 10000000),
	CONSTRAINT "broker_plans_district_free_ck" CHECK ("broker_plans"."code" <> 'district' OR "broker_plans"."price_rwf" = 0)
);
--> statement-breakpoint
CREATE TABLE "broker_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"rater_user_id" uuid NOT NULL,
	"rater_role" "broker_rater_role" NOT NULL,
	"stars" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_ratings_lease_role_uk" UNIQUE("lease_id","rater_role"),
	CONSTRAINT "broker_ratings_stars_ck" CHECK ("broker_ratings"."stars" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "broker_registration_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"broker_id" uuid,
	"amount_rwf" integer NOT NULL,
	"method" "broker_fee_method" NOT NULL,
	"msisdn_masked" text,
	"adapter_mode" "adapter_mode" NOT NULL,
	"gateway_ref" text,
	"status" "broker_payment_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"idempotency_key" text NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_registration_payments_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "broker_registration_payments_amount_ck" CHECK ("broker_registration_payments"."amount_rwf" > 0),
	CONSTRAINT "broker_registration_payments_paid_ck" CHECK (("broker_registration_payments"."status" = 'paid') = ("broker_registration_payments"."paid_at" IS NOT NULL)),
	CONSTRAINT "broker_registration_payments_failed_ck" CHECK ("broker_registration_payments"."status" <> 'failed' OR "broker_registration_payments"."failure_reason" IS NOT NULL),
	CONSTRAINT "broker_registration_payments_broker_paid_ck" CHECK ("broker_registration_payments"."broker_id" IS NULL OR "broker_registration_payments"."status" = 'paid')
);
--> statement-breakpoint
CREATE TABLE "broker_subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"broker_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"kind" "broker_payment_kind" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount_rwf" integer NOT NULL,
	"method" "broker_pay_method" NOT NULL,
	"msisdn_masked" text,
	"adapter_mode" "adapter_mode" NOT NULL,
	"gateway_ref" text,
	"checkout_url" text,
	"status" "broker_payment_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"idempotency_key" text NOT NULL,
	"paid_at" timestamp with time zone,
	"receipt_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_subscription_payments_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "broker_subscription_payments_amount_ck" CHECK ("broker_subscription_payments"."amount_rwf" > 0 AND "broker_subscription_payments"."amount_rwf" <= 10000000),
	CONSTRAINT "broker_subscription_payments_period_ck" CHECK ("broker_subscription_payments"."period_end" > "broker_subscription_payments"."period_start"),
	CONSTRAINT "broker_subscription_payments_paid_ck" CHECK (("broker_subscription_payments"."status" = 'paid') = ("broker_subscription_payments"."paid_at" IS NOT NULL)),
	CONSTRAINT "broker_subscription_payments_failed_ck" CHECK ("broker_subscription_payments"."status" <> 'failed' OR "broker_subscription_payments"."failure_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "broker_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"scope_province_id" integer,
	"scope_changed_at" timestamp with time zone,
	"status" "broker_subscription_status" DEFAULT 'pending_payment' NOT NULL,
	"current_period_start" date NOT NULL,
	"current_period_end" date NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"next_plan_id" uuid,
	"next_scope_province_id" integer,
	"pay_method" "broker_pay_method",
	"pay_msisdn" text,
	"card_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_subscriptions_period_ck" CHECK ("broker_subscriptions"."current_period_end" > "broker_subscriptions"."current_period_start"),
	CONSTRAINT "broker_subscriptions_msisdn_ck" CHECK ("broker_subscriptions"."pay_msisdn" IS NULL OR "broker_subscriptions"."pay_msisdn" ~ '^[0-9]{9}$'),
	CONSTRAINT "broker_subscriptions_cancel_ck" CHECK (NOT ("broker_subscriptions"."cancel_at_period_end" AND "broker_subscriptions"."next_plan_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN "broker_offer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN "broker_fee_kind" "broker_fee_kind";--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN "broker_fee_percent" integer;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN "broker_fee_rwf" bigint;--> statement-breakpoint
ALTER TABLE "brokers" ADD COLUMN "home_district_id" integer;--> statement-breakpoint
ALTER TABLE "brokers" ADD COLUMN "home_district_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD COLUMN "revealed_name" text;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD COLUMN "tenant_name" text;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD COLUMN "fee_kind" "broker_fee_kind";--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD COLUMN "fee_percent" integer;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD COLUMN "fee_rwf" bigint;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD COLUMN "fee_kind" "broker_fee_kind";--> statement-breakpoint
ALTER TABLE "placement_fees" ADD COLUMN "percent" integer;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD COLUMN "disbursed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD COLUMN "disbursed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD COLUMN "broker_fee_kind" "broker_fee_kind";--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD COLUMN "broker_fee_rwf" bigint;--> statement-breakpoint
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_rater_user_id_users_id_fk" FOREIGN KEY ("rater_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_registration_payments" ADD CONSTRAINT "broker_registration_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_registration_payments" ADD CONSTRAINT "broker_registration_payments_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscription_payments" ADD CONSTRAINT "broker_subscription_payments_subscription_id_broker_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."broker_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscription_payments" ADD CONSTRAINT "broker_subscription_payments_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscription_payments" ADD CONSTRAINT "broker_subscription_payments_plan_id_broker_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."broker_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscriptions" ADD CONSTRAINT "broker_subscriptions_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscriptions" ADD CONSTRAINT "broker_subscriptions_plan_id_broker_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."broker_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscriptions" ADD CONSTRAINT "broker_subscriptions_scope_province_id_provinces_id_fk" FOREIGN KEY ("scope_province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscriptions" ADD CONSTRAINT "broker_subscriptions_next_plan_id_broker_plans_id_fk" FOREIGN KEY ("next_plan_id") REFERENCES "public"."broker_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_subscriptions" ADD CONSTRAINT "broker_subscriptions_next_scope_province_id_provinces_id_fk" FOREIGN KEY ("next_scope_province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broker_ratings_broker_idx" ON "broker_ratings" USING btree ("broker_id","created_at");--> statement-breakpoint
CREATE INDEX "broker_registration_payments_user_idx" ON "broker_registration_payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "broker_registration_payments_broker_uk" ON "broker_registration_payments" USING btree ("broker_id") WHERE "broker_registration_payments"."broker_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "broker_subscription_payments_broker_idx" ON "broker_subscription_payments" USING btree ("broker_id","created_at");--> statement-breakpoint
CREATE INDEX "broker_subscription_payments_pending_idx" ON "broker_subscription_payments" USING btree ("created_at") WHERE "broker_subscription_payments"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "broker_subscriptions_broker_idx" ON "broker_subscriptions" USING btree ("broker_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "broker_subscriptions_one_live_uk" ON "broker_subscriptions" USING btree ("broker_id") WHERE "broker_subscriptions"."status" IN ('active', 'past_due');--> statement-breakpoint
CREATE UNIQUE INDEX "broker_subscriptions_one_pending_uk" ON "broker_subscriptions" USING btree ("broker_id") WHERE "broker_subscriptions"."status" = 'pending_payment';--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_home_district_id_districts_id_fk" FOREIGN KEY ("home_district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD CONSTRAINT "tenant_placements_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD CONSTRAINT "tenant_placements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD CONSTRAINT "placement_fees_disbursed_by_user_id_users_id_fk" FOREIGN KEY ("disbursed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_units_broker_offer_idx" ON "rental_units" USING btree ("workspace_id") WHERE "rental_units"."broker_offer";--> statement-breakpoint
CREATE UNIQUE INDEX "contact_reveals_broker_org_uk" ON "contact_reveals" USING btree ("broker_id","landlord_org_id") WHERE "contact_reveals"."landlord_org_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tenant_placements_broker_idx" ON "tenant_placements" USING btree ("broker_id","initiated_at");--> statement-breakpoint
CREATE INDEX "tenant_placements_workspace_idx" ON "tenant_placements" USING btree ("workspace_id","initiated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_placements_open_unit_uk" ON "tenant_placements" USING btree ("broker_id","unit_id") WHERE "tenant_placements"."status" = 'initiated' AND "tenant_placements"."unit_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_broker_fee_shape" CHECK (("rental_units"."broker_fee_kind" IS NULL AND "rental_units"."broker_fee_percent" IS NULL AND "rental_units"."broker_fee_rwf" IS NULL)
          OR ("rental_units"."broker_fee_kind" = 'percent' AND "rental_units"."broker_fee_percent" BETWEEN 1 AND 200 AND "rental_units"."broker_fee_rwf" IS NULL)
          OR ("rental_units"."broker_fee_kind" = 'fixed' AND "rental_units"."broker_fee_rwf" > 0 AND "rental_units"."broker_fee_percent" IS NULL));--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_broker_offer_shape" CHECK (NOT "rental_units"."broker_offer" OR ("rental_units"."state" = 'active' AND "rental_units"."asking_rent_rwf" IS NOT NULL AND "rental_units"."broker_fee_kind" IS NOT NULL));--> statement-breakpoint
-- A fee already marked disbursed keeps the moment it last moved as when it was paid.
UPDATE "placement_fees" SET "disbursed_at" = "updated_at" WHERE "status" = 'disbursed' AND "disbursed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD CONSTRAINT "placement_fees_disbursed_shape" CHECK (("placement_fees"."status" = 'disbursed') = ("placement_fees"."disbursed_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "placement_fees" ADD CONSTRAINT "placement_fees_terms_shape" CHECK ("placement_fees"."fee_kind" IS NULL OR ("placement_fees"."fee_kind" = 'percent' AND "placement_fees"."percent" BETWEEN 1 AND 200) OR ("placement_fees"."fee_kind" = 'fixed' AND "placement_fees"."percent" IS NULL));--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD CONSTRAINT "landlord_profiles_broker_fee_shape" CHECK ("landlord_profiles"."broker_fee_kind" IS NULL
          OR ("landlord_profiles"."broker_fee_kind" = 'percent' AND "landlord_profiles"."broker_fee_percent" IS NOT NULL AND "landlord_profiles"."broker_fee_rwf" IS NULL)
          OR ("landlord_profiles"."broker_fee_kind" = 'fixed' AND "landlord_profiles"."broker_fee_rwf" > 0 AND "landlord_profiles"."broker_fee_percent" IS NULL));--> statement-breakpoint
-- The three plans, priced as agreed. Finance edits the prices in the admin console from here on.
INSERT INTO "broker_plans" ("code", "name", "price_rwf", "sort") VALUES
	('district', 'District', 0, 1),
	('province', 'Province', 10000, 2),
	('country', 'Country', 25000, 3)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- A broker already registered works where their profile says they live.
UPDATE "brokers" b
   SET "home_district_id" = coalesce(up."district_id", s."district_id")
  FROM "user_profiles" up
  LEFT JOIN "sectors" s ON s."id" = up."sector_id"
 WHERE up."user_id" = b."user_id"
   AND b."home_district_id" IS NULL
   AND coalesce(up."district_id", s."district_id") IS NOT NULL;
