CREATE TYPE "public"."employment_event_type" AS ENUM('hired', 'title_change', 'department_change', 'employment_type_change', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'casual');--> statement-breakpoint
CREATE TABLE "employment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_member_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_type" "employment_event_type" NOT NULL,
	"job_title" text,
	"employment_type" "employment_type",
	"note" text,
	"effective_from" timestamp with time zone NOT NULL,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_department_member_id_department_members_id_fk" FOREIGN KEY ("department_member_id") REFERENCES "public"."department_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employment_history_member_idx" ON "employment_history" USING btree ("department_member_id","effective_from");--> statement-breakpoint
CREATE INDEX "employment_history_workspace_idx" ON "employment_history" USING btree ("workspace_id");