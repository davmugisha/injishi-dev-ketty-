-- PSF, 2026-11-05 (the owner's decisions):
--
--  - Every fee is recorded as 60% for the district and 40% for headquarters. The money still goes to PSF's one
--    account; this is the record of what each is owed. The remainder of a rounding goes to headquarters.
--  - A renewal row can be an upgrade: a higher band paid in full, a new year starting that day.
--  - The owner's passport photo, printed on the membership card and certificate.
CREATE TABLE "psf_fee_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_kind" text NOT NULL,
  "source_id" uuid NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "district_id" integer NOT NULL REFERENCES "districts"("id"),
  "amount_rwf" bigint NOT NULL,
  "district_rwf" bigint NOT NULL,
  "headquarters_rwf" bigint NOT NULL,
  "paid_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "psf_fee_allocations_line_uk" UNIQUE ("source_kind", "source_id", "district_id"),
  CONSTRAINT "psf_fee_allocations_kind" CHECK ("source_kind" IN ('application', 'renewal')),
  CONSTRAINT "psf_fee_allocations_adds_up" CHECK ("district_rwf" + "headquarters_rwf" = "amount_rwf")
);--> statement-breakpoint
CREATE INDEX "psf_fee_allocations_district_idx" ON "psf_fee_allocations" ("district_id", "paid_at");--> statement-breakpoint
INSERT INTO "psf_fee_allocations" ("source_kind", "source_id", "org_id", "district_id", "amount_rwf", "district_rwf", "headquarters_rwf", "paid_at")
SELECT 'application', a."id", a."org_id", o."district_id", a."paid_amount_rwf", floor(a."paid_amount_rwf" * 0.6)::bigint, a."paid_amount_rwf" - floor(a."paid_amount_rwf" * 0.6)::bigint, a."paid_at"
  FROM "psf_membership_applications" a JOIN "orgs" o ON o."id" = a."org_id"
 WHERE a."paid_at" IS NOT NULL AND a."paid_amount_rwf" > 0 AND o."district_id" IS NOT NULL;--> statement-breakpoint
INSERT INTO "psf_fee_allocations" ("source_kind", "source_id", "org_id", "district_id", "amount_rwf", "district_rwf", "headquarters_rwf", "paid_at")
SELECT 'renewal', r."id", r."org_id", o."district_id", r."amount_rwf", floor(r."amount_rwf" * 0.6)::bigint, r."amount_rwf" - floor(r."amount_rwf" * 0.6)::bigint, r."paid_at"
  FROM "psf_membership_renewals" r JOIN "orgs" o ON o."id" = r."org_id"
 WHERE r."status" = 'paid' AND r."paid_at" IS NOT NULL AND o."district_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "psf_membership_renewals" ADD COLUMN "kind" text DEFAULT 'renewal' NOT NULL;--> statement-breakpoint
ALTER TABLE "psf_membership_renewals" ADD CONSTRAINT "psf_membership_renewals_kind" CHECK ("kind" IN ('renewal', 'upgrade'));--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "psf_owner_photo_key" text;
