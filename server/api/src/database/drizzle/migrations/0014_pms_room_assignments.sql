-- ADR-016 migration phase 4 - btree_gist and room_assignments, alone.
--
-- ISOLATED ON PURPOSE. `btree_gist` is a standard extension but is not enabled
-- by default everywhere, and a managed Postgres that forbids it fails HERE and
-- loses only room assignment, rather than taking departments, the ledger and
-- the folio down with it.
--
-- The extension is required rather than optional: without it the exclusion
-- constraint cannot be created, and the fallback is application level locking
-- that is strictly worse. It fails loudly instead of silently skipping the
-- constraint, which would leave AC-6 believing itself satisfied.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."room_assignment_status" AS ENUM('assigned', 'released');--> statement-breakpoint
CREATE TABLE "room_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"occupies" daterange NOT NULL,
	"status" "room_assignment_status" DEFAULT 'assigned' NOT NULL,
	"assigned_by_user_id" uuid,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_assignments_range_not_empty" CHECK (NOT isempty("room_assignments"."occupies")),
	CONSTRAINT "room_assignments_released_shape" CHECK (("room_assignments"."status" = 'released') = ("room_assignments"."released_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_assignments_booking_idx" ON "room_assignments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "room_assignments_room_idx" ON "room_assignments" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_assignments_workspace_idx" ON "room_assignments" USING btree ("workspace_id");--> statement-breakpoint
-- The point of the whole table (AC-6, D-g).
--
-- Two guests can no longer hold one room over overlapping dates, and the
-- refusal comes from the DATABASE, so a direct SQL insert is refused exactly as
-- an API call is. An application check would only be as good as the last path
-- somebody remembered to route through it.
--
-- Partial on `assigned`, so a released row keeps its history without blocking
-- the room forever.
--
-- `btree_gist` is what lets `room_id` (a uuid, equality) sit in the same
-- constraint as `occupies` (a range, overlap). Without the extension GiST knows
-- how to compare the range and not the uuid.
ALTER TABLE "room_assignments"
  ADD CONSTRAINT "room_assignments_no_overlap"
  EXCLUDE USING gist ("room_id" WITH =, "occupies" WITH &&)
  WHERE ("status" = 'assigned');
