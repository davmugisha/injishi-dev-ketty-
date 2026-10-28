-- The guest chains settled (2026-10-26, the user): village, cell, district, for both bodies.
--   Local government reads every guest: village leader (1), cell executive secretary (2), district officer (3).
--   DGIE reads guests from abroad only: DGIE village officer (4), cell officer (5), district officer (6).
-- The DASSO, sector executive and DGIE province and headquarters posts are retired: never routed to or
-- appointed again. Their steps that never reached anyone (no holder, never opened) are removed; a step
-- someone received stays as a record. The new DGIE steps for current guests come from the routing sweep.
ALTER TYPE "public"."oversight_role" ADD VALUE 'dgie_village';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'dgie_cell';--> statement-breakpoint
ALTER TABLE "oversight_assignments" DROP CONSTRAINT "oversight_assignments_role_scope";--> statement-breakpoint
ALTER TABLE "guest_registration_routes" DROP CONSTRAINT "guest_registration_routes_role";--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_role_scope" CHECK (("oversight_assignments"."oversight_role"::text IN ('village_leader', 'dgie_village') AND "oversight_assignments"."scope_level"::text = 'village')
          OR ("oversight_assignments"."oversight_role"::text = 'dasso' AND "oversight_assignments"."scope_level"::text = 'sector')
          OR ("oversight_assignments"."oversight_role"::text IN ('cell_executive', 'dgie_cell') AND "oversight_assignments"."scope_level"::text = 'cell')
          OR ("oversight_assignments"."oversight_role"::text = 'sector_executive' AND "oversight_assignments"."scope_level"::text = 'sector')
          OR ("oversight_assignments"."oversight_role"::text IN ('district_officer', 'district_immigration') AND "oversight_assignments"."scope_level"::text = 'district')
          OR ("oversight_assignments"."oversight_role"::text = 'dgie_province' AND "oversight_assignments"."scope_level"::text = 'province')
          OR ("oversight_assignments"."oversight_role"::text = 'dgie_national' AND "oversight_assignments"."scope_level"::text = 'country')
          OR ("oversight_assignments"."oversight_role"::text IN ('business_field_verifier', 'business_approver', 'tax_compliance_officer', 'psf_membership_officer')
              AND "oversight_assignments"."scope_level"::text IN ('country', 'province', 'district')));--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_role" CHECK ("guest_registration_routes"."recipient_role"::text IN ('village_leader', 'dasso', 'cell_executive', 'sector_executive', 'district_officer', 'district_immigration', 'dgie_province', 'dgie_national', 'dgie_village', 'dgie_cell'));--> statement-breakpoint
DELETE FROM "guest_registration_routes"
 WHERE "recipient_role"::text IN ('dasso', 'sector_executive', 'dgie_province', 'dgie_national')
   AND "assignment_id" IS NULL AND "seen_at" IS NULL AND "flagged_at" IS NULL;--> statement-breakpoint
UPDATE "guest_registration_routes" SET "step" = CASE "recipient_role"::text
    WHEN 'village_leader' THEN 1 WHEN 'cell_executive' THEN 2 WHEN 'district_officer' THEN 3
    WHEN 'district_immigration' THEN 6 WHEN 'dasso' THEN 7 WHEN 'sector_executive' THEN 7 ELSE 8 END;
