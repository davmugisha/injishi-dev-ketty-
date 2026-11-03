-- PSF membership renewals (2026-11-02, the owner's decisions):
--
--  - A member renews by paying the next year's fee on the tracking page. A paid
--    renewal renews at once: no officer approves it.
--  - The new year runs from the day the old one ends, so renewing early loses
--    nothing. A membership that already lapsed starts again on the payment date.
--  - The band may change at renewal, at the district's current price.
--  - Early renewal extends the current `psf_memberships` row; a lapsed one gets
--    a new row with the same membership number. Either way the year bought, its
--    band and its payment are kept here, one row per attempt.
CREATE TABLE "psf_membership_renewals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  -- The membership it renews: the current one, or the newest lapsed one.
  "membership_id" uuid NOT NULL REFERENCES "psf_memberships"("id"),
  -- The application whose docID it was paid through, when it came that way.
  "application_id" uuid REFERENCES "psf_membership_applications"("id"),
  "membership_number" text NOT NULL,
  "tier_code" text NOT NULL REFERENCES "psf_membership_tiers"("code"),
  "amount_rwf" bigint NOT NULL,
  "payer_phone_e164" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "starts_on" date NOT NULL,
  "expires_on" date NOT NULL,
  "paid_at" timestamp with time zone,
  "payment_ref" text,
  "payment_mode" "adapter_mode",
  "failure" text,
  -- The membership row the paid renewal extended or created.
  "result_membership_id" uuid REFERENCES "psf_memberships"("id"),
  "remitted_at" timestamp with time zone,
  "remittance_ref" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "psf_membership_renewals_status_ck" CHECK ("status" IN ('pending', 'paid', 'failed')),
  CONSTRAINT "psf_membership_renewals_amount_ck" CHECK ("amount_rwf" > 0),
  CONSTRAINT "psf_membership_renewals_period_ck" CHECK ("expires_on" > "starts_on"),
  CONSTRAINT "psf_membership_renewals_paid_shape" CHECK (
    ("status" = 'paid') = ("paid_at" IS NOT NULL AND "payment_ref" IS NOT NULL AND "payment_mode" IS NOT NULL AND "result_membership_id" IS NOT NULL)
    AND ("remitted_at" IS NULL OR "status" = 'paid')
    AND (("remitted_at" IS NULL) = ("remittance_ref" IS NULL))
  )
);--> statement-breakpoint
-- One renewal in flight per business, so a retried prompt finds the same charge.
CREATE UNIQUE INDEX "psf_membership_renewals_one_pending_uk" ON "psf_membership_renewals" ("org_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "psf_membership_renewals_org_idx" ON "psf_membership_renewals" ("org_id", "created_at");--> statement-breakpoint
CREATE INDEX "psf_membership_renewals_paid_idx" ON "psf_membership_renewals" ("paid_at") WHERE "status" = 'paid';
--> statement-breakpoint
-- A business on the public PSF path has no workspace, so its payments could not
-- be written to the ledger at all (every collection had to name a workspace).
-- The ledger row names the business instead.
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "org_id" uuid REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_workspace_shape";--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_workspace_shape" CHECK ("workspace_id" IS NOT NULL OR "org_id" IS NOT NULL OR "direction" = 'adjustment');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_org_idx" ON "payment_transactions" ("org_id") WHERE "org_id" IS NOT NULL;
