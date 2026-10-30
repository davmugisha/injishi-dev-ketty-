-- The rest of a hotel's setup (2026-10-30, Phase 2 of the hotel setup).
--
-- Extra beds and cribs: how many extra beds a room type takes and what one costs a night, and whether a
-- crib is free, charged or not offered. Said to the guest, settled at the property: a booking charges the
-- room, and the extra bed is arranged with the desk.
ALTER TABLE "room_types" ADD COLUMN "extra_beds_max" smallint;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "extra_bed_price_rwf" bigint;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_extra_beds_ck" CHECK ("extra_beds_max" BETWEEN 0 AND 4 AND ("extra_bed_price_rwf" IS NULL OR "extra_bed_price_rwf" >= 0));--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "cribs" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "crib_price_rwf" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_cribs_ck" CHECK ("cribs" IN ('free', 'charged', 'none') AND ("cribs" = 'charged') = ("crib_price_rwf" IS NOT NULL));--> statement-breakpoint
-- A photograph may show one room type. Booking.com and Agoda ask for one per room type, so a guest sees
-- the room they pick, not only the lobby. Null is a photograph of the property itself.
ALTER TABLE "property_photos" ADD COLUMN "room_type_id" uuid;--> statement-breakpoint
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_photos_room_type_idx" ON "property_photos" ("room_type_id") WHERE "room_type_id" IS NOT NULL;--> statement-breakpoint
-- A star grade is the business's word until an officer checks it against RDB's grading certificate.
-- `eac_star_grade` stays the grade (registration already asks it); these say who confirmed it and when.
-- The guest page shows stars only once confirmed, and changing the grade withdraws the confirmation.
ALTER TABLE "orgs" ADD COLUMN "star_grade_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "star_grade_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_star_grade_verified_by_users_id_fk" FOREIGN KEY ("star_grade_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_star_grade_verified_ck" CHECK ("star_grade_verified_at" IS NULL OR "eac_star_grade" IS NOT NULL);--> statement-breakpoint
-- The facilities the catalogue lacked (also in scripts/reference-data.mjs). Kinyarwanda labels are owed.
INSERT INTO "amenities" ("code", "category", "label_en", "label_rw", "active") VALUES
  ('bar', 'Food & drink', 'Bar', NULL, true),
  ('gym', 'Leisure & business', 'Fitness room', NULL, true),
  ('spa', 'Leisure & business', 'Spa', NULL, true),
  ('meeting', 'Leisure & business', 'Meeting room', NULL, true),
  ('stepfree', 'Accessibility', 'Step-free entrance', NULL, true),
  ('accessible_room', 'Accessibility', 'Accessible room', NULL, true),
  ('lift', 'Accessibility', 'Lift', NULL, true)
ON CONFLICT ("code") DO NOTHING;
