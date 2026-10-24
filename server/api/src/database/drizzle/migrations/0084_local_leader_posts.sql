-- Guests and local leaders, P5 (blueprint 1.5, step 14): the local leaders' posts.
--
-- New enum values: the five leader roles (village leader, sector DASSO, cell executive
-- secretary, district officer, district immigration officer), the sector, cell and village scope
-- levels, the guest outbox events and the guest registration audit subject.
--
-- migrate.mjs applies every pending migration in ONE transaction, and a value added with
-- ALTER TYPE ... ADD VALUE cannot be used before that transaction commits. So nothing in this run
-- uses a new value as an enum literal: the checks below and in 0085 compare `::text`, and no row
-- is written with one.
--
-- oversight_assignments gains sector_id, cell_id and village_id. A post names its own level and
-- every level above it down to the district; the scope-shape check holds that, and the new
-- role-scope check pairs each role with the level it is appointed at (the same pairs as
-- OVERSIGHT_ROLE_SCOPES in contracts). The active-unique index takes the new levels.
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'guest_registration';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'guest.registered';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'guest.flagged';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'village_leader';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'dasso';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'cell_executive';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'district_officer';--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'district_immigration';--> statement-breakpoint
ALTER TYPE "public"."oversight_scope_level" ADD VALUE 'sector';--> statement-breakpoint
ALTER TYPE "public"."oversight_scope_level" ADD VALUE 'cell';--> statement-breakpoint
ALTER TYPE "public"."oversight_scope_level" ADD VALUE 'village';--> statement-breakpoint
ALTER TABLE "oversight_assignments" DROP CONSTRAINT "oversight_assignments_scope_shape";--> statement-breakpoint
DROP INDEX "oversight_assignments_active_uk";--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD COLUMN "sector_id" integer;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD COLUMN "cell_id" integer;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD COLUMN "village_id" integer;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_cell_id_cells_id_fk" FOREIGN KEY ("cell_id") REFERENCES "public"."cells"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oversight_assignments_area_idx" ON "oversight_assignments" USING btree ("oversight_role","district_id","sector_id","cell_id","village_id") WHERE "oversight_assignments"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "oversight_assignments_active_uk" ON "oversight_assignments" USING btree ("user_id","oversight_role","scope_level","province_id","district_id","sector_id","cell_id","village_id") WHERE "oversight_assignments"."revoked_at" IS NULL;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_role_scope" CHECK (("oversight_assignments"."oversight_role"::text = 'village_leader' AND "oversight_assignments"."scope_level"::text = 'village')
          OR ("oversight_assignments"."oversight_role"::text = 'dasso' AND "oversight_assignments"."scope_level"::text = 'sector')
          OR ("oversight_assignments"."oversight_role"::text = 'cell_executive' AND "oversight_assignments"."scope_level"::text = 'cell')
          OR ("oversight_assignments"."oversight_role"::text IN ('district_officer', 'district_immigration') AND "oversight_assignments"."scope_level"::text = 'district')
          OR ("oversight_assignments"."oversight_role"::text IN ('business_field_verifier', 'business_approver', 'tax_compliance_officer', 'psf_membership_officer')
              AND "oversight_assignments"."scope_level"::text IN ('country', 'province', 'district')));--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_scope_shape" CHECK (("oversight_assignments"."scope_level"::text = 'country' AND "oversight_assignments"."province_id" IS NULL AND "oversight_assignments"."district_id" IS NULL AND "oversight_assignments"."sector_id" IS NULL AND "oversight_assignments"."cell_id" IS NULL AND "oversight_assignments"."village_id" IS NULL)
          OR ("oversight_assignments"."scope_level"::text = 'province' AND "oversight_assignments"."province_id" IS NOT NULL AND "oversight_assignments"."district_id" IS NULL AND "oversight_assignments"."sector_id" IS NULL AND "oversight_assignments"."cell_id" IS NULL AND "oversight_assignments"."village_id" IS NULL)
          OR ("oversight_assignments"."scope_level"::text = 'district' AND "oversight_assignments"."district_id" IS NOT NULL AND "oversight_assignments"."sector_id" IS NULL AND "oversight_assignments"."cell_id" IS NULL AND "oversight_assignments"."village_id" IS NULL)
          OR ("oversight_assignments"."scope_level"::text = 'sector' AND "oversight_assignments"."district_id" IS NOT NULL AND "oversight_assignments"."sector_id" IS NOT NULL AND "oversight_assignments"."cell_id" IS NULL AND "oversight_assignments"."village_id" IS NULL)
          OR ("oversight_assignments"."scope_level"::text = 'cell' AND "oversight_assignments"."district_id" IS NOT NULL AND "oversight_assignments"."sector_id" IS NOT NULL AND "oversight_assignments"."cell_id" IS NOT NULL AND "oversight_assignments"."village_id" IS NULL)
          OR ("oversight_assignments"."scope_level"::text = 'village' AND "oversight_assignments"."district_id" IS NOT NULL AND "oversight_assignments"."sector_id" IS NOT NULL AND "oversight_assignments"."cell_id" IS NOT NULL AND "oversight_assignments"."village_id" IS NOT NULL));--> statement-breakpoint
