-- Residence inventory is never bookable as a stay (FL06 §5C), enforced where it
-- cannot drift.
--
-- `BookingService.create` has always refused a non-hospitality room type, but
-- nothing stopped a `residence` row from CARRYING a `booking_mode`, and one did:
-- Lavender Hill's "Two-bedroom apartment" was seeded `request_to_book` /
-- `approve_first_three`. `GET /api/v1/bookable/:roomTypeId` read that row back
-- happily, so a hand-edited `/book?roomType=<residence id>` rendered a fully
-- priced checkout whose confirm was then refused with 400 "That room type is
-- not bookable." Two endpoints, two answers, from one row.
--
-- `listing.service.ts` now applies the domain rule on the read as well, so the
-- dead end is closed in code. This closes it in the schema, which is the half
-- that survives the next seed, the next importer and the next hand-written
-- INSERT. It is the sibling of `room_types_approval_policy_shape`, which pins
-- the other shape rule on this same table.
--
-- The UPDATE runs first because the constraint cannot be added while the demo
-- and any other database carrying that seeded row still violate it. It touches
-- only non-hospitality rows, and only the two columns that should never have
-- been set on them; `approval_policy` goes with `booking_mode` because
-- `room_types_approval_policy_shape` forbids a policy without
-- `booking_mode = 'request_to_book'`, which is now unreachable for residence.
UPDATE "room_types"
   SET "booking_mode" = NULL,
       "approval_policy" = NULL
 WHERE "domain" <> 'hospitality'
   AND ("booking_mode" IS NOT NULL OR "approval_policy" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_residence_not_bookable" CHECK (("room_types"."domain" = 'hospitality') OR ("room_types"."booking_mode" IS NULL));
