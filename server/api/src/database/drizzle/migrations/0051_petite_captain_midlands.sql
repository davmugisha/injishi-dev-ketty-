CREATE TABLE "leave_type_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"is_unpaid" boolean DEFAULT false NOT NULL,
	"carry_forward" boolean DEFAULT false NOT NULL,
	"applicable_after_days" integer DEFAULT 0 NOT NULL,
	"max_consecutive_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_type_settings_workspace_type_uk" UNIQUE("workspace_id","leave_type")
);
--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "assignee_role" text;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "begin_on_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD COLUMN "assignee_role" text;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD COLUMN "begin_on_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_type_settings" ADD CONSTRAINT "leave_type_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;