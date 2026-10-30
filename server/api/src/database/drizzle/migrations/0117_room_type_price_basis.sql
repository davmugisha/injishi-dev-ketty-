-- How a room type's price is counted (2026-10-29, owner decisions).
--
-- Until now every stay was priced per person, per night: a villa for six cost
-- six times its rate. A villa or an apartment is let whole, to one party, so it
-- is priced per unit, per night. A bar or coffee shop lists what it sells with
-- a price each, and is not booked at all: its rows are menu items, and the
-- booking path refuses them.
--
-- Existing rows keep per person, which is what they were charged as.
CREATE TYPE "public"."room_price_basis" AS ENUM('per_person', 'per_unit', 'per_item');--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "price_basis" "room_price_basis" DEFAULT 'per_person' NOT NULL;--> statement-breakpoint
-- Items a venue already listed were created bookable; they become menu items.
UPDATE "room_types" rt SET "price_basis" = 'per_item'::text::"room_price_basis", "booking_mode" = NULL
FROM "properties" p JOIN "orgs" o ON o.id = p.org_id
WHERE rt.property_id = p.id AND o.rdb_entity_group = 'restaurant_bar_nightclub';--> statement-breakpoint
UPDATE "rate_plans" rp SET "booking_mode" = NULL
FROM "room_types" rt
WHERE rp.room_type_id = rt.id AND rt.price_basis::text = 'per_item';--> statement-breakpoint
-- A villa or apartment is let whole.
UPDATE "room_types" rt SET "price_basis" = 'per_unit'::text::"room_price_basis"
FROM "properties" p JOIN "orgs" o ON o.id = p.org_id
WHERE rt.property_id = p.id AND o.accommodation_class IN ('villa', 'apartment', 'serviced_apartment');
