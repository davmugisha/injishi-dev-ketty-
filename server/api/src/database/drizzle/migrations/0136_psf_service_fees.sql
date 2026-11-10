-- PSF prices by service and place (2026-11-05, the owner): a salon may cost RWF 1M in Kicukiro and RWF 3M in
-- Gasabo. A District Manager sets an optional price for a kind of business in its district; it is the floor
-- for that kind there, inside the band that holds it. Each branch pays by its own district and kind.
CREATE TABLE "psf_service_fees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subsector_id" uuid NOT NULL REFERENCES "psf_subsectors"("id") ON DELETE CASCADE,
  "district_id" integer NOT NULL REFERENCES "districts"("id"),
  "amount_rwf" bigint NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "psf_service_fees_place_uk" UNIQUE ("subsector_id", "district_id"),
  CONSTRAINT "psf_service_fees_positive" CHECK ("amount_rwf" > 0)
);--> statement-breakpoint
ALTER TABLE "psf_application_branches" ADD COLUMN "fee_rwf" bigint;
