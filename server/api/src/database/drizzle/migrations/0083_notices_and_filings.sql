-- Rentals rebuild, P1 (blueprint 1.5, step 10): move out notices with a status, lease filings, and
-- the two things drafting a lease on a new unit needs.
--
-- move_out_notices: who gave it (tenant or landlord), how it arrived (enum), the Kigali day it
-- was given, the move out day, the reason (enum), the days of notice, and its status (submitted,
-- acknowledged, withdrawn). The old reason codes map to the contracts list: kigali ->
-- moving_in_kigali, leaving -> leaving_kigali, own-home -> own_home, terms -> terms, anything else
-- (other, or none) -> other. Every notice before this was a tenant's. A notice on a lease that is
-- already ending, ended or cancelled is acknowledged (as of when it was filed). One live (not
-- withdrawn) notice per lease.
--
-- contract_filings becomes lease_filings: a kind (new lease, change, termination), the Kigali day
-- it is due (`due_by` read in Kigali, else 15 days after the clock started, else after signing),
-- the day it was filed, RRA's reference, the proof and who filed it. The mock adapter's columns
-- (adapter_mode, attempts, clock_start_at, failure_reason) and `due_by` go: the landlord files on
-- RRA's portal and records it here. `filing_status` loses `failed` (only that adapter wrote it;
-- such a filing is pending again), by swapping the type, never by ADD VALUE.
--
-- Drafting: `leases.room_id` (legacy, dropped by 0089) becomes nullable, because a unit added
-- after the rebuild is a `rental_units` row with no hotel room behind it; and a landlord may set
-- the day of the month rent falls due on new leases (`landlord_profiles.default_rent_due_day`,
-- null meaning the day each lease starts), with when the lease defaults were last saved.
CREATE TYPE "public"."lease_filing_kind" AS ENUM('new_lease', 'change', 'termination');--> statement-breakpoint
CREATE TYPE "public"."move_out_notice_channel" AS ENUM('app', 'letter', 'email', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."move_out_notice_status" AS ENUM('submitted', 'acknowledged', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."move_out_reason" AS ENUM('moving_in_kigali', 'leaving_kigali', 'own_home', 'cost', 'terms', 'landlord_use', 'tenant_breach', 'other');--> statement-breakpoint
-- Drafting -------------------------------------------------------------------------------------
ALTER TABLE "leases" ALTER COLUMN "room_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD COLUMN "default_rent_due_day" integer;--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD COLUMN "lease_defaults_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD CONSTRAINT "landlord_profiles_due_day_range" CHECK ("landlord_profiles"."default_rent_due_day" IS NULL OR "landlord_profiles"."default_rent_due_day" BETWEEN 1 AND 28);--> statement-breakpoint
-- Move out notices ------------------------------------------------------------------------------
ALTER TABLE "move_out_notices" DROP CONSTRAINT "move_out_notices_reason_known";--> statement-breakpoint
ALTER TABLE "move_out_notices" DROP CONSTRAINT "move_out_notices_channel_known";--> statement-breakpoint
ALTER TABLE "move_out_notices" RENAME COLUMN "move_out_date" TO "move_out_on";--> statement-breakpoint
ALTER TABLE "move_out_notices" RENAME COLUMN "notice_given_days" TO "notice_days";--> statement-breakpoint
ALTER TABLE "move_out_notices" RENAME COLUMN "filed_via" TO "channel";--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "filed_by_role" "signer_role";--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "filed_on" date;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "status" "move_out_notice_status" DEFAULT 'submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "acknowledged_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
UPDATE "move_out_notices"
   SET "filed_by_role" = 'tenant',
       "filed_on" = ("filed_at" AT TIME ZONE 'Africa/Kigali')::date;--> statement-breakpoint
UPDATE "move_out_notices" SET "notice_days" = "move_out_on" - "filed_on";--> statement-breakpoint
UPDATE "move_out_notices" n
   SET "status" = 'acknowledged', "acknowledged_at" = n."filed_at"
  FROM "leases" l
 WHERE l."id" = n."lease_id" AND l."status" IN ('ending', 'ended', 'cancelled');--> statement-breakpoint
ALTER TABLE "move_out_notices" ALTER COLUMN "reason_code" SET DATA TYPE "public"."move_out_reason" USING (CASE "reason_code"
  WHEN 'kigali' THEN 'moving_in_kigali'
  WHEN 'leaving' THEN 'leaving_kigali'
  WHEN 'own-home' THEN 'own_home'
  WHEN 'terms' THEN 'terms'
  ELSE 'other' END)::"public"."move_out_reason";--> statement-breakpoint
ALTER TABLE "move_out_notices" ALTER COLUMN "channel" SET DATA TYPE "public"."move_out_notice_channel" USING coalesce("channel", 'app')::"public"."move_out_notice_channel";--> statement-breakpoint
ALTER TABLE "move_out_notices" ALTER COLUMN "reason_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "move_out_notices" ALTER COLUMN "channel" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "move_out_notices" ALTER COLUMN "filed_by_role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "move_out_notices" ALTER COLUMN "filed_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "move_out_notices" ALTER COLUMN "notice_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "move_out_notices_live_uk" ON "move_out_notices" USING btree ("lease_id") WHERE "move_out_notices"."status" <> 'withdrawn';--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_dates_order" CHECK ("move_out_notices"."move_out_on" > "move_out_notices"."filed_on");--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_days_shape" CHECK ("move_out_notices"."notice_days" = "move_out_notices"."move_out_on" - "move_out_notices"."filed_on");--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_acknowledged_shape" CHECK ("move_out_notices"."status" <> 'acknowledged' OR "move_out_notices"."acknowledged_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_withdrawn_shape" CHECK (("move_out_notices"."status" = 'withdrawn') = ("move_out_notices"."withdrawn_at" IS NOT NULL));--> statement-breakpoint
-- Lease filings ---------------------------------------------------------------------------------
ALTER TABLE "contract_filings" RENAME TO "lease_filings";--> statement-breakpoint
ALTER TABLE "lease_filings" RENAME CONSTRAINT "contract_filings_pkey" TO "lease_filings_pkey";--> statement-breakpoint
ALTER TABLE "lease_filings" RENAME CONSTRAINT "contract_filings_lease_id_leases_id_fk" TO "lease_filings_lease_id_leases_id_fk";--> statement-breakpoint
ALTER TABLE "lease_filings" RENAME COLUMN "filing_copy_object_id" TO "proof_object_id";--> statement-breakpoint
ALTER TABLE "lease_filings" RENAME CONSTRAINT "contract_filings_filing_copy_object_id_stored_objects_id_fk" TO "lease_filings_proof_object_id_stored_objects_id_fk";--> statement-breakpoint
ALTER TABLE "lease_filings" DROP CONSTRAINT "contract_filings_lease_uk";--> statement-breakpoint
ALTER TABLE "lease_filings" ADD COLUMN "kind" "lease_filing_kind" DEFAULT 'new_lease' NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_filings" ADD COLUMN "due_on" date;--> statement-breakpoint
ALTER TABLE "lease_filings" ADD COLUMN "filed_on" date;--> statement-breakpoint
ALTER TABLE "lease_filings" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "lease_filings" ADD COLUMN "filed_by_user_id" uuid;--> statement-breakpoint
UPDATE "lease_filings" f
   SET "due_on" = coalesce(
         (f."due_by" AT TIME ZONE 'Africa/Kigali')::date,
         (f."clock_start_at" AT TIME ZONE 'Africa/Kigali')::date + 15,
         (l."signed_at" AT TIME ZONE 'Africa/Kigali')::date + 15,
         (f."created_at" AT TIME ZONE 'Africa/Kigali')::date + 15)
  FROM "leases" l
 WHERE l."id" = f."lease_id";--> statement-breakpoint
UPDATE "lease_filings" SET "filed_on" = ("updated_at" AT TIME ZONE 'Africa/Kigali')::date WHERE "status" = 'filed';--> statement-breakpoint
ALTER TABLE "lease_filings" ALTER COLUMN "due_on" SET NOT NULL;--> statement-breakpoint
CREATE TYPE "public"."filing_status_v2" AS ENUM('pending', 'filed');--> statement-breakpoint
ALTER TABLE "lease_filings" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lease_filings" ALTER COLUMN "status" SET DATA TYPE "public"."filing_status_v2" USING (CASE WHEN "status"::text = 'failed' THEN 'pending' ELSE "status"::text END)::"public"."filing_status_v2";--> statement-breakpoint
ALTER TABLE "lease_filings" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
DROP TYPE "public"."filing_status";--> statement-breakpoint
ALTER TYPE "public"."filing_status_v2" RENAME TO "filing_status";--> statement-breakpoint
ALTER TABLE "lease_filings" DROP COLUMN "adapter_mode";--> statement-breakpoint
ALTER TABLE "lease_filings" DROP COLUMN "attempts";--> statement-breakpoint
ALTER TABLE "lease_filings" DROP COLUMN "clock_start_at";--> statement-breakpoint
ALTER TABLE "lease_filings" DROP COLUMN "due_by";--> statement-breakpoint
ALTER TABLE "lease_filings" DROP COLUMN "failure_reason";--> statement-breakpoint
ALTER TABLE "lease_filings" ADD CONSTRAINT "lease_filings_filed_by_user_id_users_id_fk" FOREIGN KEY ("filed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_filings_lease_kind_uk" ON "lease_filings" USING btree ("lease_id","kind") WHERE "lease_filings"."kind" <> 'change';--> statement-breakpoint
CREATE INDEX "lease_filings_due_idx" ON "lease_filings" USING btree ("due_on") WHERE "lease_filings"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "lease_filings" ADD CONSTRAINT "lease_filings_filed_shape" CHECK (("lease_filings"."status" = 'filed') = ("lease_filings"."filed_on" IS NOT NULL));--> statement-breakpoint
DO $$
DECLARE n integer; f integer;
BEGIN
  SELECT count(*) INTO n FROM "move_out_notices";
  SELECT count(*) INTO f FROM "lease_filings";
  RAISE NOTICE '0082: % move out notice(s) and % lease filing(s) reshaped', n, f;
END $$;
