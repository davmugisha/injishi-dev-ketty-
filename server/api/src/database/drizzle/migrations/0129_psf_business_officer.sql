-- The PSF team (2026-11-02, the owner's decisions):
--
--  - Injishi's admin appoints PSF's Province (and National) Managers; each Province Manager appoints
--    the District Managers and District Business Officers (DBOs) of their own province's districts, and
--    may end those appointments with a reason.
--  - A DBO (`psf_business_officer`) reads one district's PSF console and decides nothing.
ALTER TYPE "oversight_role" ADD VALUE IF NOT EXISTS 'psf_business_officer';--> statement-breakpoint
ALTER TABLE "oversight_assignments" DROP CONSTRAINT "oversight_assignments_role_scope";--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_role_scope" CHECK (("oversight_assignments"."oversight_role"::text IN ('village_leader', 'dgie_village') AND "oversight_assignments"."scope_level"::text = 'village')
          OR ("oversight_assignments"."oversight_role"::text = 'dasso' AND "oversight_assignments"."scope_level"::text = 'sector')
          OR ("oversight_assignments"."oversight_role"::text IN ('cell_executive', 'dgie_cell') AND "oversight_assignments"."scope_level"::text = 'cell')
          OR ("oversight_assignments"."oversight_role"::text = 'sector_executive' AND "oversight_assignments"."scope_level"::text = 'sector')
          OR ("oversight_assignments"."oversight_role"::text IN ('district_officer', 'district_immigration', 'psf_business_officer') AND "oversight_assignments"."scope_level"::text = 'district')
          OR ("oversight_assignments"."oversight_role"::text = 'dgie_province' AND "oversight_assignments"."scope_level"::text = 'province')
          OR ("oversight_assignments"."oversight_role"::text = 'dgie_national' AND "oversight_assignments"."scope_level"::text = 'country')
          OR ("oversight_assignments"."oversight_role"::text IN ('business_field_verifier', 'business_approver', 'tax_compliance_officer', 'psf_membership_officer')
              AND "oversight_assignments"."scope_level"::text IN ('country', 'province', 'district')));
