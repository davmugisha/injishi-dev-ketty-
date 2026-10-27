-- Rentals P4, WP 4.1 (blueprint 1.2, 1.3, 1.5): one ticket lifecycle for a hotel work order and a
-- rented home's fault, Reported > Seen > Assigned > In progress > Fixed > Closed, with Won't fix and
-- Cancelled off any open state and a reopen back to Reported.
--
-- migrate.mjs applies every pending migration in ONE transaction, and a value added with
-- ALTER TYPE ... ADD VALUE cannot be used before that transaction commits. The new values here that
-- nothing in this run uses (audit subjects, stored object kinds, timeline kinds) are ADD VALUE; the
-- ticket status, which this migration's CHECKs name at once, is swapped to a new type instead.
--
-- Tickets gain the rented unit (a lease's ticket takes the lease's unit, a residence room's ticket
-- the unit with its id), who it is handed to and the fixer's phone, when it was seen, why it won't be
-- fixed, and how often it was reopened. Timeline rows gain from/to, who wrote them and whether the
-- tenant sees them. Photos move from the jsonb into `maintenance_photos`, by phase.
CREATE TYPE "public"."maintenance_assignee_kind" AS ENUM('member', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."maintenance_photo_phase" AS ENUM('report', 'progress', 'fixed');--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'maintenance_ticket';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'expense';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'tax_declaration';--> statement-breakpoint
CREATE TYPE "public"."maintenance_status_v2" AS ENUM('open', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'closed', 'wont_fix', 'cancelled');--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ALTER COLUMN "status" SET DATA TYPE "public"."maintenance_status_v2" USING ("status"::text)::"public"."maintenance_status_v2";--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
DROP TYPE "public"."maintenance_status";--> statement-breakpoint
ALTER TYPE "public"."maintenance_status_v2" RENAME TO "maintenance_status";--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'fault_photo';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'expense_receipt';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'tax_receipt';--> statement-breakpoint
ALTER TYPE "public"."maintenance_event_kind" ADD VALUE 'acknowledged';--> statement-breakpoint
ALTER TYPE "public"."maintenance_event_kind" ADD VALUE 'wont_fix';--> statement-breakpoint
ALTER TYPE "public"."maintenance_event_kind" ADD VALUE 'reopened';--> statement-breakpoint
ALTER TYPE "public"."maintenance_event_kind" ADD VALUE 'paid';--> statement-breakpoint
ALTER TYPE "public"."maintenance_event_kind" ADD VALUE 'closed';--> statement-breakpoint
ALTER TYPE "public"."maintenance_event_kind" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "maintenance_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"stored_object_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"phase" "maintenance_photo_phase" DEFAULT 'report' NOT NULL,
	"caption" text,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_photos_position_range" CHECK ("maintenance_photos"."position" BETWEEN 0 AND 99)
);
--> statement-breakpoint
ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "maintenance_tickets_subject_at_least_one";--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD COLUMN "author_role" "maintenance_raised_by_role";--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD COLUMN "from_status" "maintenance_status";--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD COLUMN "to_status" "maintenance_status";--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD COLUMN "visible_to_tenant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "assignee_kind" "maintenance_assignee_kind";--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "assigned_contractor_phone" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "wont_fix_reason" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "reopened_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_photos" ADD CONSTRAINT "maintenance_photos_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_photos" ADD CONSTRAINT "maintenance_photos_stored_object_id_stored_objects_id_fk" FOREIGN KEY ("stored_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_photos" ADD CONSTRAINT "maintenance_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_photos_object_uk" ON "maintenance_photos" USING btree ("ticket_id","stored_object_id");--> statement-breakpoint
CREATE INDEX "maintenance_photos_ticket_idx" ON "maintenance_photos" USING btree ("ticket_id","phase","position");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_events_ticket_idx" ON "maintenance_events" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_unit_idx" ON "maintenance_tickets" USING btree ("unit_id");--> statement-breakpoint
-- A residence room's ticket is about the rented unit with the same id (0075 made rental_units.id =
-- rooms.id); a lease's ticket is about the lease's unit.
UPDATE "maintenance_tickets" t SET "unit_id" = t."room_id"
 WHERE t."unit_id" IS NULL AND t."room_id" IS NOT NULL
   AND EXISTS (SELECT 1 FROM "rental_units" u WHERE u."id" = t."room_id");--> statement-breakpoint
UPDATE "maintenance_tickets" t SET "unit_id" = l."unit_id"
  FROM "leases" l
 WHERE t."unit_id" IS NULL AND t."lease_id" = l."id" AND l."unit_id" IS NOT NULL;--> statement-breakpoint
UPDATE "maintenance_tickets" SET "assignee_kind" = 'member'
 WHERE "assigned_to_user_id" IS NOT NULL AND "assigned_contractor" IS NULL;--> statement-breakpoint
UPDATE "maintenance_tickets" SET "assignee_kind" = 'contractor'
 WHERE "assigned_contractor" IS NOT NULL AND "assigned_to_user_id" IS NULL;--> statement-breakpoint
-- The photos the jsonb held (a key, or {key, caption}), for every key that names a stored object.
INSERT INTO "maintenance_photos" ("ticket_id", "stored_object_id", "position", "phase", "caption", "created_at")
SELECT t."id", so."id", LEAST(e.ord - 1, 99)::int, 'report', NULLIF(e.v ->> 'caption', ''), t."created_at"
  FROM "maintenance_tickets" t
 CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(t."photo_object_keys") = 'array' THEN t."photo_object_keys" ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS e(v, ord)
  JOIN "stored_objects" so
    ON so."object_key" = CASE WHEN jsonb_typeof(e.v) = 'string' THEN e.v #>> '{}' ELSE e.v ->> 'key' END
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assignee_shape" CHECK ("maintenance_tickets"."assignee_kind" IS NULL
        OR ("maintenance_tickets"."assignee_kind" = 'member' AND "maintenance_tickets"."assigned_to_user_id" IS NOT NULL AND "maintenance_tickets"."assigned_contractor" IS NULL)
        OR ("maintenance_tickets"."assignee_kind" = 'contractor' AND "maintenance_tickets"."assigned_contractor" IS NOT NULL AND "maintenance_tickets"."assigned_to_user_id" IS NULL));--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_contractor_phone_shape" CHECK ("maintenance_tickets"."assigned_contractor_phone" IS NULL
        OR ("maintenance_tickets"."assignee_kind" = 'contractor' AND "maintenance_tickets"."assigned_contractor_phone" ~ '^[+][1-9][0-9]{7,14}$'));--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_wont_fix_reason" CHECK (("maintenance_tickets"."status" = 'wont_fix') = ("maintenance_tickets"."wont_fix_reason" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_acknowledged_shape" CHECK ("maintenance_tickets"."status" <> 'acknowledged' OR "maintenance_tickets"."acknowledged_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_reopened_count_range" CHECK ("maintenance_tickets"."reopened_count" >= 0);--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_subject_at_least_one" CHECK ("maintenance_tickets"."room_id" IS NOT NULL OR "maintenance_tickets"."space_id" IS NOT NULL OR "maintenance_tickets"."lease_id" IS NOT NULL OR "maintenance_tickets"."unit_id" IS NOT NULL);
