CREATE TYPE "public"."report_run_kind" AS ENUM('export', 'report', 'subscription');--> statement-breakpoint
CREATE TABLE "list_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"list_key" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" "report_run_kind" NOT NULL,
	"subject" text NOT NULL,
	"filters" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "list_saved_views" ADD CONSTRAINT "list_saved_views_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_saved_views" ADD CONSTRAINT "list_saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "list_saved_views_name_uk" ON "list_saved_views" USING btree ("org_id","user_id","list_key",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "list_saved_views_default_uk" ON "list_saved_views" USING btree ("org_id","user_id","list_key") WHERE "list_saved_views"."is_default";--> statement-breakpoint
CREATE INDEX "list_saved_views_shared_idx" ON "list_saved_views" USING btree ("org_id","list_key") WHERE "list_saved_views"."shared";--> statement-breakpoint
CREATE INDEX "report_runs_org_created_idx" ON "report_runs" USING btree ("org_id","created_at");