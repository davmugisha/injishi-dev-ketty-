ALTER TYPE "public"."guest_host_kind" ADD VALUE 'stay';--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT "guest_registrations_host_shape";--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT "guest_registrations_origin_shape";--> statement-breakpoint
ALTER TABLE "guest_registrations" DROP CONSTRAINT "guest_registrations_dates";--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD COLUMN "guest_stay_id" uuid;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_registrations_stay_uk" ON "guest_registrations" USING btree ("guest_stay_id") WHERE "guest_registrations"."guest_stay_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_host_shape" CHECK (("guest_registrations"."host_kind"::text = 'tenant' AND "guest_registrations"."lease_id" IS NOT NULL AND "guest_registrations"."guest_stay_id" IS NULL)
          OR ("guest_registrations"."host_kind"::text = 'landlord' AND "guest_registrations"."lease_id" IS NULL AND "guest_registrations"."guest_stay_id" IS NULL)
          OR ("guest_registrations"."host_kind"::text = 'stay' AND "guest_registrations"."lease_id" IS NULL AND "guest_registrations"."guest_stay_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_origin_shape" CHECK (("guest_registrations"."host_kind"::text = 'stay' AND "guest_registrations"."origin_village_id" IS NULL)
          OR (("guest_registrations"."origin_country" = 'RW') = ("guest_registrations"."origin_village_id" IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_dates" CHECK ("guest_registrations"."departure_on" >= "guest_registrations"."arrival_on"
          AND "guest_registrations"."departure_on" - "guest_registrations"."arrival_on" <= (CASE WHEN "guest_registrations"."host_kind"::text = 'stay' THEN 366 ELSE 90 END));--> statement-breakpoint
-- A stay business's guest is a paying guest. Not offered on the tenant's or the landlord's form (inactive),
-- only written by check in.
INSERT INTO "guest_relationships" ("code", "label", "sort_order", "needs_detail", "active")
VALUES ('stay_guest', 'Staying guest', 900, false, false)
ON CONFLICT ("code") DO NOTHING;
