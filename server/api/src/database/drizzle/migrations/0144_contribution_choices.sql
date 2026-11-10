CREATE TABLE "payroll_contribution_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"enabled" boolean NOT NULL,
	"employee_amount_rwf" bigint,
	"employer_amount_rwf" bigint,
	"provider" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_contribution_choices" ADD CONSTRAINT "payroll_contribution_choices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_contribution_choices" ADD CONSTRAINT "payroll_contribution_choices_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_contribution_choices_org_code_uk" ON "payroll_contribution_choices" USING btree ("org_id","code");