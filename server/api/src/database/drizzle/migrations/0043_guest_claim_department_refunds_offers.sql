CREATE TYPE "public"."offer_audience" AS ENUM('anyone', 'in_house');--> statement-breakpoint
CREATE TYPE "public"."offer_discount_kind" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TYPE "public"."offer_scope" AS ENUM('room', 'service', 'folio');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stay_refund_reason" AS ENUM('service_failure', 'room_not_as_described', 'cleanliness', 'noise', 'maintenance_unresolved', 'overcharged', 'early_departure', 'changed_plans', 'other');--> statement-breakpoint
CREATE TYPE "public"."stay_refund_refusal_reason" AS ENUM('non_refundable_rate', 'outside_cancellation_window', 'nights_already_consumed', 'no_show_policy', 'house_rules_breach', 'damage_to_property', 'third_party_booking', 'not_reported_during_stay', 'duplicate_request', 'other');--> statement-breakpoint
CREATE TYPE "public"."stay_refund_state" AS ENUM('submitted', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "offer_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"guest_stay_id" uuid NOT NULL,
	"folio_id" uuid NOT NULL,
	"folio_charge_id" uuid,
	"user_id" uuid,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_redemptions_amount_positive" CHECK ("offer_redemptions"."amount_rwf" > 0)
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"discount_kind" "offer_discount_kind" NOT NULL,
	"discount_value" bigint NOT NULL,
	"scope" "offer_scope" NOT NULL,
	"department_id" uuid,
	"code" text,
	"audience" "offer_audience" DEFAULT 'anyone' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"min_nights" integer,
	"min_spend_rwf" bigint,
	"max_redemptions" integer,
	"status" "offer_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_discount_value_in_range" CHECK (("offers"."discount_kind" = 'percentage' AND "offers"."discount_value" BETWEEN 1 AND 100)
           OR ("offers"."discount_kind" = 'fixed_amount' AND "offers"."discount_value" > 0)),
	CONSTRAINT "offers_department_only_on_service_scope" CHECK ("offers"."department_id" IS NULL OR "offers"."scope" = 'service'),
	CONSTRAINT "offers_window_ordered" CHECK ("offers"."ends_on" IS NULL OR "offers"."ends_on" >= "offers"."starts_on"),
	CONSTRAINT "offers_limits_positive" CHECK (("offers"."min_nights" IS NULL OR "offers"."min_nights" >= 1)
           AND ("offers"."min_spend_rwf" IS NULL OR "offers"."min_spend_rwf" >= 0)
           AND ("offers"."max_redemptions" IS NULL OR "offers"."max_redemptions" >= 1))
);
--> statement-breakpoint
CREATE TABLE "stay_refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"guest_stay_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"folio_id" uuid,
	"booking_id" uuid,
	"raised_by_user_id" uuid NOT NULL,
	"reason" "stay_refund_reason" NOT NULL,
	"detail" text NOT NULL,
	"requested_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"state" "stay_refund_state" DEFAULT 'submitted' NOT NULL,
	"policy_eligible" boolean DEFAULT false NOT NULL,
	"policy_max_rwf" bigint DEFAULT 0 NOT NULL,
	"policy_rule" text NOT NULL,
	"policy_refusal_reason" "stay_refund_refusal_reason",
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"approved_rwf" bigint,
	"refusal_reason" "stay_refund_refusal_reason",
	"decision_note" text,
	"payment_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stay_refund_requests_decision_shape" CHECK (("stay_refund_requests"."state" = 'submitted' AND "stay_refund_requests"."decided_at" IS NULL)
           OR ("stay_refund_requests"."state" = 'withdrawn' AND "stay_refund_requests"."decided_at" IS NOT NULL)
           OR ("stay_refund_requests"."state" = 'approved' AND "stay_refund_requests"."decided_at" IS NOT NULL
               AND "stay_refund_requests"."decided_by_user_id" IS NOT NULL AND "stay_refund_requests"."approved_rwf" IS NOT NULL)
           OR ("stay_refund_requests"."state" = 'rejected' AND "stay_refund_requests"."decided_at" IS NOT NULL
               AND "stay_refund_requests"."decided_by_user_id" IS NOT NULL AND "stay_refund_requests"."refusal_reason" IS NOT NULL)),
	CONSTRAINT "stay_refund_requests_amounts_nonnegative" CHECK (("stay_refund_requests"."requested_rwf" IS NULL OR "stay_refund_requests"."requested_rwf" >= 0)
           AND ("stay_refund_requests"."approved_rwf" IS NULL OR "stay_refund_requests"."approved_rwf" >= 0)
           AND "stay_refund_requests"."policy_max_rwf" >= 0)
);
--> statement-breakpoint
ALTER TABLE "guest_stays" ADD COLUMN "guest_email" text;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD COLUMN "guest_phone" text;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD COLUMN "claim_invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_folio_charge_id_folio_charges_id_fk" FOREIGN KEY ("folio_charge_id") REFERENCES "public"."folio_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_refund_requests" ADD CONSTRAINT "stay_refund_requests_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_refund_requests" ADD CONSTRAINT "stay_refund_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_refund_requests" ADD CONSTRAINT "stay_refund_requests_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_refund_requests" ADD CONSTRAINT "stay_refund_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_refund_requests" ADD CONSTRAINT "stay_refund_requests_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_refund_requests" ADD CONSTRAINT "stay_refund_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_redemptions_offer_stay_uk" ON "offer_redemptions" USING btree ("offer_id","guest_stay_id");--> statement-breakpoint
CREATE INDEX "offer_redemptions_offer_idx" ON "offer_redemptions" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_redemptions_stay_idx" ON "offer_redemptions" USING btree ("guest_stay_id");--> statement-breakpoint
CREATE INDEX "offers_property_status_idx" ON "offers" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "offers_workspace_idx" ON "offers" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_property_code_uk" ON "offers" USING btree ("property_id","code") WHERE "offers"."code" IS NOT NULL AND "offers"."status" <> 'archived';--> statement-breakpoint
CREATE UNIQUE INDEX "stay_refund_requests_reference_uk" ON "stay_refund_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "stay_refund_requests_workspace_state_idx" ON "stay_refund_requests" USING btree ("workspace_id","state","created_at");--> statement-breakpoint
CREATE INDEX "stay_refund_requests_stay_idx" ON "stay_refund_requests" USING btree ("guest_stay_id");--> statement-breakpoint
CREATE INDEX "stay_refund_requests_raised_by_idx" ON "stay_refund_requests" USING btree ("raised_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stay_refund_requests_one_open_per_stay_uk" ON "stay_refund_requests" USING btree ("guest_stay_id") WHERE "stay_refund_requests"."state" = 'submitted';--> statement-breakpoint
CREATE INDEX "guest_stays_unclaimed_email_idx" ON "guest_stays" USING btree ("guest_email") WHERE "guest_stays"."claim_status" = 'unclaimed' AND "guest_stays"."guest_email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "threads_stay_department_request_uk" ON "threads" USING btree ("guest_stay_id","department_id") WHERE "threads"."thread_kind" = 'department_request'
             AND "threads"."guest_stay_id" IS NOT NULL
             AND "threads"."department_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_claim_shape" CHECK ("guest_stays"."claim_status" = 'unclaimed'
           OR ("guest_stays"."claimed_by_user_id" IS NOT NULL AND "guest_stays"."claimed_at" IS NOT NULL));