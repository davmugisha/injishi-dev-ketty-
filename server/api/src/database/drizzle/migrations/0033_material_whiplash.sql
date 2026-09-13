CREATE TABLE "property_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"position" integer NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_object_key_stored_objects_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."stored_objects"("object_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_photos_property_idx" ON "property_photos" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_photos_position_uk" ON "property_photos" USING btree ("property_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "property_photos_cover_uk" ON "property_photos" USING btree ("property_id") WHERE "property_photos"."is_cover";--> statement-breakpoint

-- ===========================================================================
-- Backfill `properties.photo_object_keys` into `property_photos` (ADR-049).
--
-- Hand written. `drizzle-kit` generates the table and the DROP, and cannot know
-- that the column it is dropping holds data worth moving. The backfill and the
-- drop are in ONE migration because the column has exactly one producer (the
-- catalogue seed) and no reader outside the repository layer changed in the same
-- slice, so there is no window in which half-migrated is observable.
--
-- The column is `jsonb` with no enforced shape, so the shape is ASSERTED before
-- anything is written and the migration fails loudly rather than writing partial
-- rows.
--
-- ## The dangling keys, which ADR-049 did not anticipate
--
-- `object_key` references `stored_objects.object_key`, and some existing entries
-- are not object keys at all: the seeds wrote FRONT END ASSET PATHS such as
-- `/assets/rwanda-kigali-hero.webp`, which never had a `stored_objects` row. They
-- cannot be inserted, and failing the migration on them would make it unrunnable
-- on every database that has ever been seeded.
--
-- So they are SKIPPED, counted, and reported with a NOTICE rather than dropped
-- silently. Nothing is lost that was ever a stored object: an asset path carries
-- no retention obligation and no bytes in the bucket. A property whose only
-- "photographs" were asset paths now has none, and therefore cannot be published
-- until a real one is attached — which is exactly the consequence ADR-049
-- records for seeded properties with no photograph.
-- ===========================================================================
DO $$
DECLARE
  bad_shape    bigint;
  bad_element  bigint;
  resolvable   bigint;
  skipped      bigint;
  inserted     bigint;
  sample       text;
BEGIN
  -- 1. Shape. Anything that is not a JSON array is a column nobody can migrate.
  SELECT count(*) INTO bad_shape
  FROM properties
  WHERE photo_object_keys IS NOT NULL
    AND jsonb_typeof(photo_object_keys) <> 'array';

  IF bad_shape > 0 THEN
    RAISE EXCEPTION
      'properties.photo_object_keys holds % row(s) that are not a JSON array. Fix those rows, then re-run.',
      bad_shape;
  END IF;

  -- 2. Elements. An array of objects or numbers is just as unmigratable.
  SELECT count(*) INTO bad_element
  FROM properties p,
       LATERAL jsonb_array_elements(p.photo_object_keys) AS e(value)
  WHERE jsonb_typeof(p.photo_object_keys) = 'array'
    AND jsonb_typeof(e.value) <> 'string';

  IF bad_element > 0 THEN
    RAISE EXCEPTION
      'properties.photo_object_keys holds % non-string element(s). Fix those rows, then re-run.',
      bad_element;
  END IF;

  -- 3. Insert every key that names a real stored object.
  --
  -- `row_number()` rather than the array index, so positions stay DENSE after a
  -- dangling key is skipped, and the FIRST SURVIVING key becomes the cover. Using
  -- the raw index would leave a gap, and using index zero for the cover would
  -- leave a property with photographs and no cover when index zero was the
  -- dangling one — a state `property_photos_cover_uk` permits and no operator
  -- chose.
  WITH keys AS (
    SELECT
      p.id AS property_id,
      k.key,
      row_number() OVER (PARTITION BY p.id ORDER BY k.ord) - 1 AS position
    FROM properties p
    CROSS JOIN LATERAL jsonb_array_elements_text(p.photo_object_keys)
      WITH ORDINALITY AS k(key, ord)
    WHERE jsonb_typeof(p.photo_object_keys) = 'array'
      AND EXISTS (SELECT 1 FROM stored_objects so WHERE so.object_key = k.key)
  )
  INSERT INTO property_photos (property_id, object_key, position, is_cover)
  SELECT property_id, key, position, position = 0
  FROM keys;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  -- 4. Verify, by count and by a spot read, BEFORE the drop.
  SELECT count(*) INTO resolvable
  FROM properties p
  CROSS JOIN LATERAL jsonb_array_elements_text(p.photo_object_keys) AS k(key)
  WHERE jsonb_typeof(p.photo_object_keys) = 'array'
    AND EXISTS (SELECT 1 FROM stored_objects so WHERE so.object_key = k.key);

  IF inserted <> resolvable THEN
    RAISE EXCEPTION
      'Backfill wrote % row(s) but % key(s) were resolvable. Refusing to drop the column.',
      inserted, resolvable;
  END IF;

  SELECT count(*) INTO skipped
  FROM properties p
  CROSS JOIN LATERAL jsonb_array_elements_text(p.photo_object_keys) AS k(key)
  WHERE jsonb_typeof(p.photo_object_keys) = 'array'
    AND NOT EXISTS (SELECT 1 FROM stored_objects so WHERE so.object_key = k.key);

  -- The spot read: if anything was written, at least one property must now have
  -- exactly one cover. A count alone would pass on rows that all landed with
  -- `is_cover = false`.
  IF inserted > 0 THEN
    SELECT pp.object_key INTO sample
    FROM property_photos pp
    WHERE pp.is_cover
    LIMIT 1;

    IF sample IS NULL THEN
      RAISE EXCEPTION
        'Backfill wrote % row(s) and no cover. Refusing to drop the column.',
        inserted;
    END IF;

    RAISE NOTICE 'property_photos backfill: % row(s) written, cover sample %.',
      inserted, sample;
  END IF;

  IF skipped > 0 THEN
    RAISE NOTICE
      'property_photos backfill: % key(s) skipped because they name no stored_objects row (seeded asset paths). Those properties now have no photograph and cannot publish until one is attached.',
      skipped;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "properties" DROP COLUMN "photo_object_keys";
