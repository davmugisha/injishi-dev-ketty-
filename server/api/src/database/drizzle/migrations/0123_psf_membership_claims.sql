-- A PSF membership number a business types is a CLAIM until PSF confirms it (2026-10-30, the owner's
-- decision). It was filed as a `self_declared` membership and counted as a member at once, with nothing
-- checked. Now:
--
--  - `psf_membership_claims` holds every typed number: claimed, confirmed or rejected, who decided, why.
--  - `psf_member_list` is PSF's own list of its members, uploaded by an officer, so a claim whose number
--    and TIN match a row is confirmed on the spot.
--  - A confirmed claim becomes a membership of a new kind, `psf_record` (confirmed against PSF's records):
--    a tier and dates, no application and no fee through Injishi.
--  - Existing self-declared memberships move into claims and stop counting as members.
ALTER TYPE "psf_membership_source" ADD VALUE IF NOT EXISTS 'psf_record';--> statement-breakpoint
ALTER TABLE "psf_memberships" DROP CONSTRAINT IF EXISTS "psf_memberships_source_shape";--> statement-breakpoint
ALTER TABLE "psf_memberships" ADD CONSTRAINT "psf_memberships_source_shape" CHECK (
  ("source"::text = 'psf_confirmed' AND "application_id" IS NOT NULL AND "tier_code" IS NOT NULL AND "annual_fee_rwf" IS NOT NULL AND "starts_on" IS NOT NULL AND "expires_on" IS NOT NULL AND "expires_on" > "starts_on")
  OR ("source"::text = 'self_declared' AND "application_id" IS NULL)
  OR ("source"::text = 'psf_record' AND "application_id" IS NULL AND "tier_code" IS NOT NULL AND "starts_on" IS NOT NULL AND "expires_on" IS NOT NULL AND "expires_on" > "starts_on")
);--> statement-breakpoint
CREATE TABLE "psf_member_list" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "membership_number" text NOT NULL,
  "legal_name" text,
  "tin" text,
  "tier_code" text REFERENCES "psf_membership_tiers"("code"),
  "starts_on" date,
  "expires_on" date,
  "uploaded_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "psf_member_list_number_uk" UNIQUE ("membership_number")
);--> statement-breakpoint
CREATE TABLE "psf_membership_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "membership_number" text NOT NULL,
  "status" text DEFAULT 'claimed' NOT NULL,
  "claimed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decided_at" timestamp with time zone,
  "decision_note" text,
  "matched_by" text,
  "membership_id" uuid REFERENCES "psf_memberships"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "psf_membership_claims_status_ck" CHECK ("status" IN ('claimed', 'confirmed', 'rejected')),
  CONSTRAINT "psf_membership_claims_matched_ck" CHECK ("matched_by" IS NULL OR "matched_by" IN ('member_list', 'officer')),
  CONSTRAINT "psf_membership_claims_decided_ck" CHECK (("status" = 'claimed') = ("decided_at" IS NULL)),
  CONSTRAINT "psf_membership_claims_rejected_ck" CHECK ("status" <> 'rejected' OR "decision_note" IS NOT NULL)
);--> statement-breakpoint
CREATE UNIQUE INDEX "psf_membership_claims_open_uk" ON "psf_membership_claims" ("org_id") WHERE "status" = 'claimed';--> statement-breakpoint
CREATE INDEX "psf_membership_claims_status_idx" ON "psf_membership_claims" ("status", "claimed_at");--> statement-breakpoint
INSERT INTO "psf_membership_claims" ("org_id", "membership_number", "claimed_by_user_id", "claimed_at", "created_at", "updated_at")
  SELECT "org_id", "membership_number", "recorded_by_user_id", "created_at", "created_at", now()
    FROM "psf_memberships" WHERE "source"::text = 'self_declared' AND "ended_at" IS NULL;--> statement-breakpoint
DELETE FROM "psf_memberships" WHERE "source"::text = 'self_declared';
