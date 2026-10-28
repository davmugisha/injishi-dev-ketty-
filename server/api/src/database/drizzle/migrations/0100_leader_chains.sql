-- Guest chains (2026-10-26, the user): local government reads every guest, Rwandan or foreign; the
-- immigration directorate (DGIE) reads guests from abroad only, with its own levels.
--   Local government: village leader (1), sector DASSO (2), cell executive secretary (3),
--     sector executive secretary (4, new), district officer (5, now every guest).
--   DGIE, guests from abroad: district (6), province (7, new), headquarters (8, new).
-- New roles go on oversight_role; routes gain province_id for DGIE's province post. The checks compare
-- ::text, since a value added here cannot be used as a literal in the same transaction.
-- Data: existing routes move to the new step numbers. Guests still current get the posts their chain
-- now has from the routing sweep (GuestRoutingService.completeChains), not here: a row naming a new
-- role cannot be written in the transaction that adds the value.
ALTER TYPE "public"."oversight_role" ADD VALUE 'sector_executive';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'dgie_province';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'dgie_national';--> statement-breakpoint
ALTER TABLE "oversight_assignments" DROP CONSTRAINT "oversight_assignments_role_scope";--> statement-breakpoint
ALTER TABLE "guest_registration_routes" DROP CONSTRAINT "guest_registration_routes_role";--> statement-breakpoint
ALTER TABLE "guest_registration_routes" DROP CONSTRAINT "guest_registration_routes_step";--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD COLUMN "province_id" integer;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_role_scope" CHECK (("oversight_assignments"."oversight_role"::text = 'village_leader' AND "oversight_assignments"."scope_level"::text = 'village')
          OR ("oversight_assignments"."oversight_role"::text = 'dasso' AND "oversight_assignments"."scope_level"::text = 'sector')
          OR ("oversight_assignments"."oversight_role"::text = 'cell_executive' AND "oversight_assignments"."scope_level"::text = 'cell')
          OR ("oversight_assignments"."oversight_role"::text = 'sector_executive' AND "oversight_assignments"."scope_level"::text = 'sector')
          OR ("oversight_assignments"."oversight_role"::text IN ('district_officer', 'district_immigration') AND "oversight_assignments"."scope_level"::text = 'district')
          OR ("oversight_assignments"."oversight_role"::text = 'dgie_province' AND "oversight_assignments"."scope_level"::text = 'province')
          OR ("oversight_assignments"."oversight_role"::text = 'dgie_national' AND "oversight_assignments"."scope_level"::text = 'country')
          OR ("oversight_assignments"."oversight_role"::text IN ('business_field_verifier', 'business_approver', 'tax_compliance_officer', 'psf_membership_officer')
              AND "oversight_assignments"."scope_level"::text IN ('country', 'province', 'district')));--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_role" CHECK ("guest_registration_routes"."recipient_role"::text IN ('village_leader', 'dasso', 'cell_executive', 'sector_executive', 'district_officer', 'district_immigration', 'dgie_province', 'dgie_national'));--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_step" CHECK ("guest_registration_routes"."step" BETWEEN 1 AND 8);--> statement-breakpoint
UPDATE "guest_registration_routes" SET "step" = CASE "recipient_role"::text
    WHEN 'village_leader' THEN 1 WHEN 'dasso' THEN 2 WHEN 'cell_executive' THEN 3
    WHEN 'district_officer' THEN 5 WHEN 'district_immigration' THEN 6 ELSE "step" END;
