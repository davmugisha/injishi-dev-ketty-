-- Guests of a hotel, lodge, guest house or apartment block, filed with the local leaders at check in
-- (2026-10-29, revised 2026-10-30).
--
-- Written by hand and IDEMPOTENT on purpose. Staging already carries this shape from a migration of
-- another branch (host kind `hotel`, `guest_stay_id`, the hotel constraints), so every step checks before
-- it acts: on a fresh database it builds the shape, on staging it changes nothing and is recorded as applied.
-- The constraint definitions are staging's, word for word.
ALTER TYPE "public"."guest_host_kind" ADD VALUE IF NOT EXISTS 'hotel';--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD COLUMN IF NOT EXISTS "guest_stay_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guest_registrations_guest_stay_id_guest_stays_id_fk') THEN
    ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_guest_stay_id_guest_stays_id_fk"
      FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guest_registrations_stay_uk" ON "guest_registrations" USING btree ("guest_stay_id") WHERE "guest_registrations"."guest_stay_id" IS NOT NULL;--> statement-breakpoint
-- A hotel's desk records no relationship and may have no phone: both are a resident host's fields.
ALTER TABLE "guest_registrations" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_registrations" ALTER COLUMN "relationship" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT IF EXISTS "guest_registrations_host_shape";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_host_shape" CHECK (((("host_kind")::text = 'tenant'::text) AND ("lease_id" IS NOT NULL) AND ("guest_stay_id" IS NULL)) OR ((("host_kind")::text = 'landlord'::text) AND ("lease_id" IS NULL) AND ("guest_stay_id" IS NULL)) OR ((("host_kind")::text = 'hotel'::text) AND ("lease_id" IS NULL) AND ("unit_id" IS NULL) AND ("guest_stay_id" IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT IF EXISTS "guest_registrations_origin_shape";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_origin_shape" CHECK (((("host_kind")::text = 'hotel'::text) AND (("origin_country" = 'RW'::text) OR ("origin_village_id" IS NULL))) OR ((("host_kind")::text <> 'hotel'::text) AND (("origin_country" = 'RW'::text) = ("origin_village_id" IS NOT NULL))));--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT IF EXISTS "guest_registrations_dates";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_dates" CHECK (("departure_on" >= "arrival_on") AND (("departure_on" - "arrival_on") <= 90));--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT IF EXISTS "guest_registrations_phone_e164";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_phone_e164" CHECK (("phone" IS NULL) OR ("phone" ~ '^[+][1-9][0-9]{7,14}$'::text));--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT IF EXISTS "guest_registrations_residence_fields";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_residence_fields" CHECK ((("host_kind")::text = 'hotel'::text) OR (("relationship" IS NOT NULL) AND ("phone" IS NOT NULL)));--> statement-breakpoint
-- A hotel's guest is a paying guest. Inactive, so the residents' forms never offer it.
INSERT INTO "guest_relationships" ("code", "label", "sort_order", "needs_detail", "active")
VALUES ('stay_guest', 'Staying guest', 900, false, false)
ON CONFLICT ("code") DO NOTHING;
