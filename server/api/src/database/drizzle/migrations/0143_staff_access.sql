-- HR onboarding: a login given, or asked of the owner, while putting a person on file.
-- Joins the staff file to the invitation sent for it, so accepting links the account to
-- that file instead of writing a second one. One request waits for the owner per file.
CREATE TABLE "staff_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"email" text NOT NULL,
	"org_role" "org_role" NOT NULL,
	"branch_property_ids" uuid[],
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"requested_by_user_id" uuid NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"invitation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_access_requests_status_ck" CHECK ("staff_access_requests"."status" in ('pending', 'approved', 'declined', 'cancelled')),
	CONSTRAINT "staff_access_requests_not_owner_ck" CHECK ("staff_access_requests"."org_role" <> 'owner')
);
--> statement-breakpoint
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_invitation_id_org_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."org_invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_access_requests_org_status_idx" ON "staff_access_requests" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "staff_access_requests_employee_idx" ON "staff_access_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "staff_access_requests_invitation_idx" ON "staff_access_requests" USING btree ("invitation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_access_requests_one_pending_uk" ON "staff_access_requests" USING btree ("employee_id") WHERE "staff_access_requests"."status" = 'pending';