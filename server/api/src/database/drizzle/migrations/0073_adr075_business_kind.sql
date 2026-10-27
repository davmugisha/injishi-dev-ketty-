-- ADR-075 A1, the thread: what kind of business an org is (D-h), the key that makes a Pay press create one
-- registration however often it is pressed (AC-14), and the 50,000 RWF fee (O-9, D-j).
--
-- Written by hand, not generated: drizzle-kit's diff against 0072's snapshot also holds the waitlist table and
-- enums the schema dropped in 4f32a8f1 without a migration, and generating would drop them. That drift is not
-- this migration's to settle.
CREATE TYPE "public"."business_kind" AS ENUM('hotel', 'motel', 'tented_camp', 'guest_house', 'apartment', 'lodge', 'villa', 'other', 'bar_restaurant', 'coffee_shop', 'residence', 'broker');--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "business_kind" "business_kind";--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "creation_key" text;--> statement-breakpoint
ALTER TABLE "orgs" DROP CONSTRAINT "orgs_domain_shape";--> statement-breakpoint
-- The backfill. A residence is a residence. A stay's kind is its accommodation class, a retired class reading as
-- the class that replaced it (CURRENT_CLASS in @injishi/contracts setup-steps.ts). Bar & Restaurant was the free
-- text escape under `other` in the restaurant group; it becomes its own kind and leaves the class, which a venue
-- has none of (D-h).
UPDATE "orgs" SET "business_kind" = 'residence' WHERE "domain" = 'residence';--> statement-breakpoint
UPDATE "orgs"
   SET "business_kind" = 'bar_restaurant', "accommodation_class" = NULL, "accommodation_class_other" = NULL
 WHERE "domain" = 'hospitality' AND "accommodation_class" = 'other'
   AND lower(trim("accommodation_class_other")) IN ('bar & restaurant', 'bar and restaurant');--> statement-breakpoint
UPDATE "orgs"
   SET "business_kind" = (CASE "accommodation_class"
         WHEN 'town_hotel' THEN 'hotel'
         WHEN 'vacation_hotel_resort' THEN 'hotel'
         WHEN 'serviced_apartment' THEN 'apartment'
         WHEN 'cottage' THEN 'lodge'
         ELSE "accommodation_class"
       END)::"business_kind"
 WHERE "domain" = 'hospitality' AND "business_kind" IS NULL;--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "business_kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_creation_key_uk" UNIQUE("creation_key");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_domain_shape" CHECK (("orgs"."domain" = 'hospitality' AND "orgs"."business_kind" IN ('bar_restaurant', 'coffee_shop') AND "orgs"."accommodation_class" IS NULL)
          OR ("orgs"."domain" = 'hospitality' AND "orgs"."business_kind" IN ('hotel', 'motel', 'tented_camp', 'guest_house', 'apartment', 'lodge', 'villa', 'other') AND "orgs"."accommodation_class" IS NOT NULL)
          OR ("orgs"."domain" = 'residence' AND "orgs"."business_kind" = 'residence' AND "orgs"."residence_class" IS NOT NULL AND "orgs"."tourism_license_number" IS NULL AND NOT "orgs"."psf_member"));--> statement-breakpoint
-- The fee (O-9, D-j): 50,000 RWF for every business PSF reviews, nothing for a broker, as new effective dated rows
-- so the old price stays readable against the registrations that were quoted it. A registration already billed
-- keeps its locked amount (D8). Inserted only where the current row is not already this amount, so a database a
-- later seed priced the same way is left as it is.
INSERT INTO "registration_fees" ("business_type", "amount_rwf", "effective_from", "active")
SELECT v.business_type::"registration_business_type", v.amount_rwf, now(), true
  FROM (VALUES ('hospitality', 50000), ('residence', 50000), ('broker', 0)) AS v(business_type, amount_rwf)
 WHERE NOT EXISTS (
   SELECT 1 FROM "registration_fees" f
    WHERE f.business_type = v.business_type::"registration_business_type"
      AND f.active AND f.amount_rwf = v.amount_rwf AND f.effective_from <= now()
      AND f.effective_from = (
        SELECT max(g.effective_from) FROM "registration_fees" g
         WHERE g.business_type = f.business_type AND g.active AND g.effective_from <= now()));
