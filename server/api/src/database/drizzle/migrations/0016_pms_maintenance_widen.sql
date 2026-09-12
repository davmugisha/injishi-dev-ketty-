-- ADR-016 migration phase 6 - maintenance tickets, widen.
--
-- One work order model for both surfaces (D16). `maintenance_tickets.lease_id`
-- was NOT NULL, so a maintenance ticket could not exist without a lease and a
-- hotel has no lease. The `ticket.advance` command ADR-012 shipped was
-- therefore residence only, and nobody reading its route would have guessed.
--
-- EVERY NEW COLUMN IS NULLABLE HERE, including `workspace_id`. Phase 7
-- backfills it and phase 8 makes it NOT NULL. Adding a NOT NULL column with no
-- default to a table that already has rows fails outright, and this table has
-- rows in every environment that has ever run the residence path.
--
-- WHY `maintenance_status` IS RECREATED RATHER THAN ALTERED:
-- the rule migrations 0005 and 0009 record. `ALTER TYPE ... ADD VALUE` cannot
-- be USED in the transaction that adds it, and `drizzle-kit migrate` applies
-- every pending migration in ONE transaction.
--
-- THE DEFAULT COMES OFF FIRST AND GOES BACK ON AFTER. `ALTER COLUMN ... TYPE
-- ... USING` fails while a default of the OLD type is still attached, which is
-- the trap this table sets and `audit_events` in migration 0009 did not.
CREATE TYPE "public"."maintenance_category" AS ENUM('plumbing', 'electrical', 'hvac', 'appliance', 'furniture', 'it_tech', 'safety', 'other');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."maintenance_raised_by_role" AS ENUM('guest', 'tenant', 'staff', 'housekeeper');--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."maintenance_status" RENAME TO "maintenance_status_old";--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled');--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ALTER COLUMN "status" TYPE "public"."maintenance_status" USING "status"::text::"public"."maintenance_status";--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
DROP TYPE "public"."maintenance_status_old";--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "space_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "guest_stay_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "org_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "raised_by_role" "maintenance_raised_by_role";--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "category" "maintenance_category";--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "priority" "maintenance_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "photo_object_keys" jsonb;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_workspace_status_idx" ON "maintenance_tickets" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_property_idx" ON "maintenance_tickets" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_room_idx" ON "maintenance_tickets" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_lease_idx" ON "maintenance_tickets" USING btree ("lease_id");
