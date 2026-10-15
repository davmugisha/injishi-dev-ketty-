CREATE TABLE "housekeeping_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"section_code" text NOT NULL,
	"section_title" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housekeeping_checklist_items_kind_ck" CHECK ("housekeeping_checklist_items"."kind" IN ('cleaning', 'inspection')),
	CONSTRAINT "housekeeping_checklist_items_status_ck" CHECK ("housekeeping_checklist_items"."status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "housekeeping_task_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"result" text NOT NULL,
	"photo_object_key" text,
	"checked_by_user_id" uuid,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housekeeping_task_checks_result_ck" CHECK ("housekeeping_task_checks"."result" IN ('done', 'pass', 'fail'))
);
--> statement-breakpoint
CREATE TABLE "maintenance_time_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text DEFAULT 'repair' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "maintenance_time_logs_kind_ck" CHECK ("maintenance_time_logs"."kind" IN ('diagnosis', 'repair')),
	CONSTRAINT "maintenance_time_logs_dates_ck" CHECK ("maintenance_time_logs"."ended_at" IS NULL OR "maintenance_time_logs"."ended_at" >= "maintenance_time_logs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "minibar_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"par_level" smallint NOT NULL,
	"used" smallint NOT NULL,
	"counted_by_user_id" uuid,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "minibar_counts_used_ck" CHECK ("minibar_counts"."used" >= 0 AND "minibar_counts"."used" <= "minibar_counts"."par_level")
);
--> statement-breakpoint
CREATE TABLE "minibar_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"par_level" smallint NOT NULL,
	"service_item_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "minibar_items_par_ck" CHECK ("minibar_items"."par_level" BETWEEN 0 AND 99),
	CONSTRAINT "minibar_items_status_ck" CHECK ("minibar_items"."status" IN ('active', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "floor" smallint;--> statement-breakpoint
ALTER TABLE "housekeeping_checklist_items" ADD CONSTRAINT "housekeeping_checklist_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_checklist_items" ADD CONSTRAINT "housekeeping_checklist_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_task_checks" ADD CONSTRAINT "housekeeping_task_checks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_task_checks" ADD CONSTRAINT "housekeeping_task_checks_task_id_housekeeping_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."housekeeping_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_task_checks" ADD CONSTRAINT "housekeeping_task_checks_item_id_housekeeping_checklist_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."housekeeping_checklist_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_task_checks" ADD CONSTRAINT "housekeeping_task_checks_checked_by_user_id_users_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_time_logs" ADD CONSTRAINT "maintenance_time_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_time_logs" ADD CONSTRAINT "maintenance_time_logs_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_time_logs" ADD CONSTRAINT "maintenance_time_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_counts" ADD CONSTRAINT "minibar_counts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_counts" ADD CONSTRAINT "minibar_counts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_counts" ADD CONSTRAINT "minibar_counts_task_id_housekeeping_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."housekeeping_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_counts" ADD CONSTRAINT "minibar_counts_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_counts" ADD CONSTRAINT "minibar_counts_item_id_minibar_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."minibar_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_counts" ADD CONSTRAINT "minibar_counts_counted_by_user_id_users_id_fk" FOREIGN KEY ("counted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_items" ADD CONSTRAINT "minibar_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_items" ADD CONSTRAINT "minibar_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minibar_items" ADD CONSTRAINT "minibar_items_service_item_id_service_items_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_checklist_items_code_uk" ON "housekeeping_checklist_items" USING btree ("property_id","kind","code");--> statement-breakpoint
CREATE INDEX "housekeeping_checklist_items_property_idx" ON "housekeeping_checklist_items" USING btree ("property_id","kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_task_checks_task_item_uk" ON "housekeeping_task_checks" USING btree ("task_id","item_id");--> statement-breakpoint
CREATE INDEX "housekeeping_task_checks_workspace_idx" ON "housekeeping_task_checks" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_time_logs_running_uk" ON "maintenance_time_logs" USING btree ("ticket_id","user_id") WHERE "maintenance_time_logs"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "maintenance_time_logs_ticket_idx" ON "maintenance_time_logs" USING btree ("ticket_id","started_at");--> statement-breakpoint
CREATE INDEX "maintenance_time_logs_workspace_idx" ON "maintenance_time_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "minibar_counts_task_item_uk" ON "minibar_counts" USING btree ("task_id","item_id");--> statement-breakpoint
CREATE INDEX "minibar_counts_workspace_idx" ON "minibar_counts" USING btree ("workspace_id","counted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "minibar_items_code_uk" ON "minibar_items" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "minibar_items_property_idx" ON "minibar_items" USING btree ("property_id","status");