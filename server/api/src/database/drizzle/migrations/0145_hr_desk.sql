CREATE TYPE "public"."asset_kind" AS ENUM('key', 'uniform', 'phone', 'laptop', 'tool', 'other');--> statement-breakpoint
CREATE TYPE "public"."hr_ticket_status" AS ENUM('open', 'answered', 'closed');--> statement-breakpoint
CREATE TYPE "public"."hr_ticket_topic" AS ENUM('pay', 'leave', 'documents', 'uniform', 'it', 'other');--> statement-breakpoint
CREATE TABLE "asset_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"name" text NOT NULL,
	"tag" text,
	"issued_on" date NOT NULL,
	"due_back_on" date,
	"returned_on" date,
	"note" text,
	"issued_by_user_id" uuid,
	"returned_to_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"from_staff" boolean NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"employee_id" uuid NOT NULL,
	"topic" "hr_ticket_topic" NOT NULL,
	"subject" text NOT NULL,
	"status" "hr_ticket_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_returned_to_user_id_users_id_fk" FOREIGN KEY ("returned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_ticket_messages" ADD CONSTRAINT "hr_ticket_messages_ticket_id_hr_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."hr_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_ticket_messages" ADD CONSTRAINT "hr_ticket_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_tickets" ADD CONSTRAINT "hr_tickets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_tickets" ADD CONSTRAINT "hr_tickets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_tickets" ADD CONSTRAINT "hr_tickets_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_loans_org_idx" ON "asset_loans" USING btree ("org_id","returned_on");--> statement-breakpoint
CREATE INDEX "asset_loans_employee_idx" ON "asset_loans" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hr_ticket_messages_ticket_idx" ON "hr_ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_tickets_number_uk" ON "hr_tickets" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "hr_tickets_org_status_idx" ON "hr_tickets" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "hr_tickets_employee_idx" ON "hr_tickets" USING btree ("employee_id");