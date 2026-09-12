ALTER TABLE "properties" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_slug_uk" ON "properties" USING btree ("slug");--> statement-breakpoint
-- Backfill every property that already exists.
--
-- A row written before this column existed still needs a public address, and
-- the name the business trades under is the address a reader would guess. The
-- slug is derived ONCE, here, and is a stored value from then on: a later
-- rename must not silently move a page that is already linked to.
--
-- Two properties can legitimately share a name (a chain with a second site), so
-- the candidate is de-duplicated inside the statement rather than left to
-- collide with the unique index above. The oldest row keeps the clean slug and
-- any later one takes six characters of its own id — stable, and never a guess
-- about which site is "the real" one.
--
-- A name that reduces to nothing (punctuation only) falls back to the id, which
-- is ugly and addressable; the alternative is a NULL that makes the property
-- unreachable on the marketplace with nothing saying why.
UPDATE "properties" AS p
SET "slug" = c.candidate
FROM (
  SELECT
    id,
    CASE
      WHEN row_number() OVER (PARTITION BY base ORDER BY created_at, id) = 1
        THEN base
      ELSE base || '-' || left(replace(id::text, '-', ''), 6)
    END AS candidate
  FROM (
    SELECT
      id,
      created_at,
      COALESCE(
        NULLIF(trim(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
        replace(id::text, '-', '')
      ) AS base
    FROM "properties"
  ) AS b
) AS c
WHERE p.id = c.id AND p."slug" IS NULL;
