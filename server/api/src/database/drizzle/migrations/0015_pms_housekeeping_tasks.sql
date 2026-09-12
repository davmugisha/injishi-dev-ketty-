-- ADR-016 migration phase 5 - the housekeeping queue.
--
-- Additive, and it rolls back by dropping its one table. This closes the last
-- of the five commands ADR-012 left blocked: `task.assign` had nowhere to write.
CREATE TYPE "public"."housekeeping_task_status" AS ENUM('pending', 'in_progress', 'done', 'inspected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_type" AS ENUM('checkout_clean', 'stayover_clean', 'inspection', 'deep_clean', 'turndown');--> statement-breakpoint
CREATE TABLE "housekeeping_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"department_id" uuid,
	"workspace_id" uuid NOT NULL,
	"guest_stay_id" uuid,
	"task_type" "housekeeping_task_type" NOT NULL,
	"status" "housekeeping_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to_user_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"note" text,
	"idempotency_key" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housekeeping_tasks_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_queue_idx" ON "housekeeping_tasks" USING btree ("property_id","status","priority");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_room_idx" ON "housekeeping_tasks" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_assignee_idx" ON "housekeeping_tasks" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_tasks_checkout_clean_uk" ON "housekeeping_tasks" USING btree ("guest_stay_id") WHERE "housekeeping_tasks"."task_type" = 'checkout_clean' AND "housekeeping_tasks"."guest_stay_id" IS NOT NULL;