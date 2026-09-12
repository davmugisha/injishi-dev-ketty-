-- ADR-016 migration phase 8 - maintenance tickets, constrain.
--
-- The tightening half of the widen. It runs last of the three because every
-- statement here depends on phase 7 having filled the column it constrains.
--
-- Reverted by re-adding the NOT NULL on `lease_id`, which holds because phase 7
-- left every existing row with its lease.
--
-- `department_id` deliberately stays nullable: a ticket raised before
-- Engineering exists is still a real ticket, and refusing it would lose the
-- report rather than improve the data.
ALTER TABLE "maintenance_tickets" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ALTER COLUMN "lease_id" DROP NOT NULL;--> statement-breakpoint
-- A ticket has to be ABOUT something (AC-11). With `lease_id` nullable, nothing
-- else would stop a row that names no subject at all, and a work order nobody
-- can locate is worse than no work order.
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_subject_at_least_one" CHECK ("maintenance_tickets"."room_id" IS NOT NULL OR "maintenance_tickets"."space_id" IS NOT NULL OR "maintenance_tickets"."lease_id" IS NOT NULL);
