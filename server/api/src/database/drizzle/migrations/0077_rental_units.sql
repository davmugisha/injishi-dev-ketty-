-- Rentals rebuild, P1 (blueprint 1.5, step 3): `rental_units`, the one unit record, and its media.
--
-- Every residence room becomes a unit with the SAME id, so a room id held anywhere (leases,
-- tickets, threads) already names its unit. The rooms, room types, rate plans and
-- residence_units rows stay until 0089 drops them.
CREATE TABLE "rental_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"block_id" uuid,
	"label" text NOT NULL,
	"bedrooms" smallint,
	"bathrooms" smallint,
	"kitchen" "unit_kitchen",
	"furnished" boolean DEFAULT false NOT NULL,
	"floor" smallint,
	"size_sqm" integer,
	"asking_rent_rwf" bigint,
	"asking_deposit_rwf" bigint,
	"state" "rental_unit_state" DEFAULT 'active' NOT NULL,
	"listed" boolean DEFAULT false NOT NULL,
	"available_from" date,
	"note" text,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_units_label_present" CHECK (length(btrim("rental_units"."label")) > 0),
	CONSTRAINT "rental_units_rooms_range" CHECK (("rental_units"."bedrooms" IS NULL OR "rental_units"."bedrooms" BETWEEN 0 AND 50) AND ("rental_units"."bathrooms" IS NULL OR "rental_units"."bathrooms" BETWEEN 0 AND 50)),
	CONSTRAINT "rental_units_size_positive" CHECK ("rental_units"."size_sqm" IS NULL OR "rental_units"."size_sqm" > 0),
	CONSTRAINT "rental_units_asking_rent_positive" CHECK ("rental_units"."asking_rent_rwf" IS NULL OR "rental_units"."asking_rent_rwf" > 0),
	CONSTRAINT "rental_units_asking_deposit_not_negative" CHECK ("rental_units"."asking_deposit_rwf" IS NULL OR "rental_units"."asking_deposit_rwf" >= 0),
	CONSTRAINT "rental_units_listed_shape" CHECK (NOT "rental_units"."listed" OR ("rental_units"."state" = 'active' AND "rental_units"."asking_rent_rwf" IS NOT NULL)),
	CONSTRAINT "rental_units_retired_shape" CHECK (("rental_units"."state" = 'retired') = ("rental_units"."retired_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "unit_amenities" (
	"unit_id" uuid NOT NULL,
	"amenity_code" text NOT NULL,
	CONSTRAINT "unit_amenities_unit_id_amenity_code_pk" PRIMARY KEY("unit_id","amenity_code")
);
--> statement-breakpoint
CREATE TABLE "unit_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stored_object_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_photos_unit_object_uk" UNIQUE("unit_id","stored_object_id"),
	CONSTRAINT "unit_photos_position_range" CHECK ("unit_photos"."position" BETWEEN 0 AND 19)
);
--> statement-breakpoint
CREATE TABLE "unit_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stored_object_id" uuid NOT NULL,
	"poster_object_id" uuid,
	"duration_s" integer NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_videos_unit_uk" UNIQUE("unit_id"),
	CONSTRAINT "unit_videos_duration_range" CHECK ("unit_videos"."duration_s" BETWEEN 1 AND 180)
);
--> statement-breakpoint
ALTER TABLE "property_blocks" DROP CONSTRAINT "property_blocks_property_code_uk";--> statement-breakpoint
ALTER TABLE "property_blocks" ALTER COLUMN "kind" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_block_id_property_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."property_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_amenities" ADD CONSTRAINT "unit_amenities_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_amenities" ADD CONSTRAINT "unit_amenities_amenity_code_amenities_code_fk" FOREIGN KEY ("amenity_code") REFERENCES "public"."amenities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_photos" ADD CONSTRAINT "unit_photos_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_photos" ADD CONSTRAINT "unit_photos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_photos" ADD CONSTRAINT "unit_photos_stored_object_id_stored_objects_id_fk" FOREIGN KEY ("stored_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_videos" ADD CONSTRAINT "unit_videos_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_videos" ADD CONSTRAINT "unit_videos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_videos" ADD CONSTRAINT "unit_videos_stored_object_id_stored_objects_id_fk" FOREIGN KEY ("stored_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_videos" ADD CONSTRAINT "unit_videos_poster_object_id_stored_objects_id_fk" FOREIGN KEY ("poster_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_videos" ADD CONSTRAINT "unit_videos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_units_property_label_uk" ON "rental_units" USING btree ("property_id",lower("label"));--> statement-breakpoint
CREATE INDEX "rental_units_scope_idx" ON "rental_units" USING btree ("workspace_id","property_id");--> statement-breakpoint
CREATE INDEX "rental_units_block_idx" ON "rental_units" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "unit_photos_unit_idx" ON "unit_photos" USING btree ("unit_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "property_blocks_property_code_uk" ON "property_blocks" USING btree ("property_id",lower("code"));--> statement-breakpoint
-- Backfill: one unit per residence room, with the room's id.
--   label            the room's label; a blank one becomes "Unit <id prefix>", and a label that
--                    collides with another in the property once case is ignored gets " (2)", ...
--   asking rent      residence_units, then the room type's default (or first) rate plan, then the
--                    room type's own base price; null when none is above 0 (the landlord sets it)
--   asking deposit   the rate plan's caution, then the room type's; null when none is set
--   bedrooms         read from the room type's name ("2 bedrooms", "Two-bedroom", "Studio")
--   block, note, available from (residence_units.vacant_since), floor (rooms.floor)
--   state            off_market when the room is not `available`, else active
WITH src AS (
  SELECT r."id", r."workspace_id", r."property_id", r."floor", r."status" AS room_status, r."created_at",
         nullif(btrim(r."label"), '') AS label,
         lower(rt."name") AS type_name,
         ru."block_id", ru."note", ru."vacant_since",
         CASE WHEN ru."asking_rent_rwf" > 0 THEN ru."asking_rent_rwf" END AS unit_rent,
         (SELECT rp."base_price_rwf" FROM "rate_plans" rp
           WHERE rp."room_type_id" = rt."id" AND rp."base_price_rwf" > 0
           ORDER BY rp."is_default" DESC, rp."created_at", rp."id" LIMIT 1) AS plan_rent,
         CASE WHEN rt."base_price_rwf" > 0 THEN rt."base_price_rwf" END AS type_rent,
         (SELECT rp."caution_rwf" FROM "rate_plans" rp
           WHERE rp."room_type_id" = rt."id" AND rp."caution_rwf" >= 0
           ORDER BY rp."is_default" DESC, rp."created_at", rp."id" LIMIT 1) AS plan_caution,
         CASE WHEN rt."caution_rwf" >= 0 THEN rt."caution_rwf" END AS type_caution
    FROM "rooms" r
    JOIN "room_types" rt ON rt."id" = r."room_type_id"
    LEFT JOIN "residence_units" ru ON ru."room_id" = r."id"
   WHERE rt."domain" = 'residence'
), labelled AS (
  SELECT src.*,
         coalesce(label, 'Unit ' || left("id"::text, 8)) AS base_label,
         row_number() OVER (PARTITION BY "property_id", lower(coalesce(label, 'Unit ' || left("id"::text, 8)))
                            ORDER BY "created_at", "id") AS dup
    FROM src
)
INSERT INTO "rental_units" ("id", "workspace_id", "property_id", "block_id", "label", "bedrooms", "floor",
                            "asking_rent_rwf", "asking_deposit_rwf", "state", "available_from", "note",
                            "created_at")
SELECT "id", "workspace_id", "property_id", "block_id",
       CASE WHEN dup = 1 THEN base_label ELSE base_label || ' (' || dup || ')' END,
       CASE
         WHEN type_name ~ 'studio' THEN 0
         WHEN type_name ~ '([0-9]+)[ -]*bed' THEN least(50, substring(type_name FROM '([0-9]+)[ -]*bed')::int)
         WHEN type_name ~ '(^|[^a-z])one[ -]*bed' THEN 1
         WHEN type_name ~ '(^|[^a-z])two[ -]*bed' THEN 2
         WHEN type_name ~ '(^|[^a-z])three[ -]*bed' THEN 3
         WHEN type_name ~ '(^|[^a-z])four[ -]*bed' THEN 4
         WHEN type_name ~ '(^|[^a-z])five[ -]*bed' THEN 5
       END,
       "floor",
       coalesce(unit_rent, plan_rent, type_rent),
       coalesce(plan_caution, type_caution),
       CASE WHEN room_status = 'available' THEN 'active' ELSE 'off_market' END::"rental_unit_state",
       "vacant_since", "note", "created_at"
  FROM labelled;--> statement-breakpoint
DO $$
DECLARE
  units integer; missing integer; no_rent integer; renamed integer;
BEGIN
  SELECT count(*) INTO units FROM "rental_units";
  SELECT count(*) INTO missing
    FROM "rooms" r JOIN "room_types" rt ON rt."id" = r."room_type_id"
   WHERE rt."domain" = 'residence' AND NOT EXISTS (SELECT 1 FROM "rental_units" u WHERE u."id" = r."id");
  IF missing > 0 THEN
    RAISE EXCEPTION '0075: % residence room(s) have no rental unit', missing;
  END IF;
  SELECT count(*) INTO no_rent FROM "rental_units" WHERE "asking_rent_rwf" IS NULL;
  SELECT count(*) INTO renamed
    FROM "rental_units" u JOIN "rooms" r ON r."id" = u."id"
   WHERE u."label" IS DISTINCT FROM r."label";
  RAISE NOTICE '0075: % rental unit(s) from residence rooms; % with no asking rent yet; % label(s) filled in or made unique', units, no_rent, renamed;
END $$;
