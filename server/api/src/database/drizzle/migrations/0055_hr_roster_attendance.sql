CREATE TYPE "public"."attendance_source" AS ENUM('self', 'manual');--> statement-breakpoint
CREATE TABLE "attendance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"department_member_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"clock_in_at" timestamp with time zone NOT NULL,
	"clock_out_at" timestamp with time zone,
	"shift_id" uuid,
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"source" "attendance_source" DEFAULT 'self' NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_entries_member_day_uk" UNIQUE("department_member_id","work_date")
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"department_member_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_assignments_member_day_uk" UNIQUE("department_member_id","work_date")
);
--> statement-breakpoint
CREATE TABLE "work_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"grace_minutes" integer DEFAULT 10 NOT NULL,
	"color_slot" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_department_member_id_department_members_id_fk" FOREIGN KEY ("department_member_id") REFERENCES "public"."department_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_department_member_id_department_members_id_fk" FOREIGN KEY ("department_member_id") REFERENCES "public"."department_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_entries_workspace_day_idx" ON "attendance_entries" USING btree ("workspace_id","work_date");--> statement-breakpoint
CREATE INDEX "shift_assignments_workspace_day_idx" ON "shift_assignments" USING btree ("workspace_id","work_date");--> statement-breakpoint
CREATE INDEX "work_shifts_workspace_idx" ON "work_shifts" USING btree ("workspace_id","is_active");