-- ADR-016 migration phase 7 - maintenance tickets, backfill.
--
-- Every row that already exists is a residence ticket, so its lease knows the
-- org, the workspace and (through the room) the property. Phase 8 makes
-- `workspace_id` NOT NULL and can only do that once this has run.
--
-- Additive and safe to leave in place if a later phase fails.
UPDATE "maintenance_tickets" mt
SET
  "workspace_id" = COALESCE(mt."workspace_id", l."workspace_id"),
  "org_id"       = COALESCE(mt."org_id",       l."org_id"),
  "property_id"  = COALESCE(mt."property_id",  r."property_id"),
  "room_id"      = COALESCE(mt."room_id",      l."room_id")
FROM "leases" l
JOIN "rooms" r ON r."id" = l."room_id"
WHERE mt."lease_id" = l."id";--> statement-breakpoint
-- Engineering is where a work order belongs under USALI, and migration phase 1
-- created one for every property. Left null where the property could not be
-- resolved above: `department_id` stays nullable on purpose, because a ticket
-- raised before Engineering exists is still a real ticket.
UPDATE "maintenance_tickets" mt
SET "department_id" = d."id"
FROM "departments" d
WHERE d."property_id" = mt."property_id"
  AND d."department_category" = 'engineering'
  AND mt."department_id" IS NULL;--> statement-breakpoint
-- Every historical ticket came from the residence path, where the person
-- raising one is the tenant. Recorded rather than left blank so the new column
-- reads honestly from day one.
UPDATE "maintenance_tickets"
SET "raised_by_role" = 'tenant'
WHERE "raised_by_role" IS NULL AND "lease_id" IS NOT NULL;
