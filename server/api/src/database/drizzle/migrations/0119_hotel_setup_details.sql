-- What a hotel tells its guests, as the platforms ask it (2026-10-29, owner decisions).
--
-- A property's policies were one free text box, and its check-in a single time. Booking.com and Expedia
-- refuse to open a hotel without a check-in window, a front desk answer, a language and, per room type,
-- the beds and who may sleep there. So each becomes a column a guest page and a desk can read:
--   * check-in is a window (check_in_time is its start, check_in_until its end), with a minimum age;
--   * the front desk is open around the clock, for set hours, or not at all;
--   * the languages the staff speak;
--   * children, pets, smoking, parties and quiet hours as choices, not prose (house_rules stays for
--     anything else);
--   * how guests get online and where they park.
-- Every value is checked here as well as in the contract, so a row can never say what no screen offers.
ALTER TABLE "properties" ADD COLUMN "check_in_until" time;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "front_desk" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "front_desk_opens" time;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "front_desk_closes" time;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "languages" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "directions" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "min_check_in_age" smallint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "children_policy" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "pets_policy" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "smoking_policy" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "parties_policy" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "quiet_from" time;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "quiet_until" time;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "internet" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "parking" text;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_front_desk_ck" CHECK ("front_desk" IN ('24h', 'limited', 'none'));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_front_desk_hours_ck" CHECK ("front_desk" IS DISTINCT FROM 'limited' OR ("front_desk_opens" IS NOT NULL AND "front_desk_closes" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_languages_ck" CHECK ("languages" <@ ARRAY['rw', 'en', 'fr', 'sw']::text[]);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_min_check_in_age_ck" CHECK ("min_check_in_age" BETWEEN 16 AND 25);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_children_policy_ck" CHECK ("children_policy" IN ('welcome', 'adults_only'));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_pets_policy_ck" CHECK ("pets_policy" IN ('no', 'on_request', 'yes'));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_smoking_policy_ck" CHECK ("smoking_policy" IN ('no', 'designated', 'allowed'));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_parties_policy_ck" CHECK ("parties_policy" IN ('no', 'on_request'));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_internet_ck" CHECK ("internet" IN ('free_everywhere', 'rooms_only', 'public_only', 'paid', 'none'));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_parking_ck" CHECK ("parking" IN ('free_on_site', 'paid_on_site', 'street', 'none'));--> statement-breakpoint
-- A room type says what it is and what is in it: the kind of room (a Double has one bed for two, a Twin
-- two), its beds by width, its size and its bathroom.
ALTER TABLE "room_types" ADD COLUMN "room_category" text;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "beds" jsonb;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "size_m2" smallint;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "bathroom" text;--> statement-breakpoint
-- What one guest pays for a room priced per room (owner decision, 2026-10-29): hotels quote a room, and
-- often a lower price when one person sleeps in it. Null means one guest pays the room price.
ALTER TABLE "room_types" ADD COLUMN "single_guest_price_rwf" bigint;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_room_category_ck" CHECK ("room_category" IN ('single', 'double', 'twin', 'triple', 'family', 'suite', 'studio', 'tent', 'dorm_bed'));--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_beds_ck" CHECK ("beds" IS NULL OR jsonb_typeof("beds") = 'array');--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_size_m2_ck" CHECK ("size_m2" BETWEEN 4 AND 2000);--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_bathroom_ck" CHECK ("bathroom" IN ('private', 'shared'));--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_single_guest_price_ck" CHECK ("single_guest_price_rwf" IS NULL OR ("single_guest_price_rwf" > 0 AND "price_basis" = 'per_unit'));--> statement-breakpoint
-- The default rate plan mirrors its room type's price (RoomTypesRepository.update), so it moves first,
-- while the room type still reads per person.
UPDATE "rate_plans" rp
SET "base_price_rwf" = rp.base_price_rwf * coalesce(rt.max_guests, 1),
    "single_occupancy_price_rwf" = CASE WHEN coalesce(rt.max_guests, 1) > 1 THEN rp.base_price_rwf END
FROM "room_types" rt JOIN "properties" p ON p.id = rt.property_id JOIN "orgs" o ON o.id = p.org_id
WHERE rp.room_type_id = rt.id
  AND rp.is_default
  AND rt.price_basis::text = 'per_person'
  AND rt.domain::text = 'hospitality'
  AND o.rdb_entity_group IS DISTINCT FROM 'restaurant_bar_nightclub';--> statement-breakpoint
-- A hotel, motel, lodge, guest house or tented camp is priced per room from now on, not per person.
-- Nobody's price moves: a full room costs what it did (the old per person rate times the guests it
-- sleeps), and one guest pays what one guest paid (the old rate). Bookings already made keep the party
-- figure they locked, so their receipts read as charged.
UPDATE "room_types" rt
SET "price_basis" = 'per_unit'::text::"room_price_basis",
    "single_guest_price_rwf" = CASE WHEN coalesce(rt.max_guests, 1) > 1 THEN rt.base_price_rwf END,
    "base_price_rwf" = rt.base_price_rwf * coalesce(rt.max_guests, 1)
FROM "properties" p JOIN "orgs" o ON o.id = p.org_id
WHERE rt.property_id = p.id
  AND rt.price_basis::text = 'per_person'
  AND rt.domain::text = 'hospitality'
  AND o.rdb_entity_group IS DISTINCT FROM 'restaurant_bar_nightclub';
