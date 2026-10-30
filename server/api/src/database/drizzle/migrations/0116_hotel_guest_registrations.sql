-- Hotel, motel and lodge guests in the guest register (2026-10-29).
--
-- Until now the register held only a residence's guests: a tenant's, or a
-- landlord's own. A guest checked in at a hotel reached no village leader, no
-- DASSO and no district, which is the report local government reads. A check
-- in now files one registration per stay, `host_kind = 'hotel'`, at the
-- property's own place, routed up the same leader chain (and DGIE for a guest
-- from abroad).
--
-- A hotel guest has no relationship to a host, may give no phone at the desk,
-- and is rarely asked their home village, so those three are optional for a
-- hotel row only; a tenant's or landlord's filing keeps every rule it had.
--
-- `hotel` is compared as `::text` in the checks below: Postgres refuses a new
-- enum value inside the transaction that adds it, and the migrator runs every
-- pending migration in one.
ALTER TYPE "public"."guest_host_kind" ADD VALUE IF NOT EXISTS 'hotel';--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD COLUMN "guest_stay_id" uuid;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_registrations_stay_uk" ON "guest_registrations" USING btree ("guest_stay_id") WHERE "guest_registrations"."guest_stay_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_registrations" ALTER COLUMN "relationship" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_registrations" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT "guest_registrations_host_shape";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_host_shape" CHECK (("guest_registrations"."host_kind"::text = 'tenant' AND "guest_registrations"."lease_id" IS NOT NULL AND "guest_registrations"."guest_stay_id" IS NULL)
          OR ("guest_registrations"."host_kind"::text = 'landlord' AND "guest_registrations"."lease_id" IS NULL AND "guest_registrations"."guest_stay_id" IS NULL)
          OR ("guest_registrations"."host_kind"::text = 'hotel' AND "guest_registrations"."lease_id" IS NULL AND "guest_registrations"."unit_id" IS NULL AND "guest_registrations"."guest_stay_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_residence_fields" CHECK ("guest_registrations"."host_kind"::text = 'hotel' OR ("guest_registrations"."relationship" IS NOT NULL AND "guest_registrations"."phone" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT "guest_registrations_phone_e164";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_phone_e164" CHECK ("guest_registrations"."phone" IS NULL OR "guest_registrations"."phone" ~ '^[+][1-9][0-9]{7,14}$');--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT "guest_registrations_origin_shape";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_origin_shape" CHECK (("guest_registrations"."host_kind"::text = 'hotel' AND ("guest_registrations"."origin_country" = 'RW' OR "guest_registrations"."origin_village_id" IS NULL))
          OR ("guest_registrations"."host_kind"::text <> 'hotel' AND ("guest_registrations"."origin_country" = 'RW') = ("guest_registrations"."origin_village_id" IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "stay_identities" ADD COLUMN "nationality" char(2);
