-- Rentals rebuild, P1 (blueprint 1.5, step 11): `lease.advance` is `lease.manage` (blueprint 2.1;
-- contracts renamed it in WP 1.1). An org's grant or withdrawal of the old name now applies to the
-- new one. Where an org already has a row for `lease.manage` on the same role, that row decides
-- and the old one goes, so the unique (org, role, permission) holds.
DELETE FROM "org_role_permissions" old
 WHERE old."permission" = 'lease.advance'
   AND EXISTS (SELECT 1 FROM "org_role_permissions" cur
                WHERE cur."org_id" = old."org_id"
                  AND cur."org_role" = old."org_role"
                  AND cur."permission" = 'lease.manage');--> statement-breakpoint
UPDATE "org_role_permissions" SET "permission" = 'lease.manage', "updated_at" = now() WHERE "permission" = 'lease.advance';
