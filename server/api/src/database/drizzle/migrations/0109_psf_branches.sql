-- BRANCHES ON A PUBLIC PSF APPLICATION (2026-10-23). A business lists the
-- other places it trades from, under its own name; the PSF officer of each
-- branch's district admits or declines that branch, beside the head office's
-- decision.
CREATE TYPE "public"."psf_branch_status" AS ENUM('pending', 'admitted', 'declined');--> statement-breakpoint
CREATE TABLE "psf_application_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"district_id" integer NOT NULL,
	"sector_id" integer NOT NULL,
	"street" text NOT NULL,
	"status" "psf_branch_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "psf_application_branches_decision_shape" CHECK (("psf_application_branches"."status" = 'pending') = ("psf_application_branches"."decided_at" IS NULL AND "psf_application_branches"."decided_by_user_id" IS NULL)
          AND ("psf_application_branches"."status" <> 'declined' OR "psf_application_branches"."decision_note" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "psf_application_branches" ADD CONSTRAINT "psf_application_branches_application_id_psf_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."psf_membership_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_application_branches" ADD CONSTRAINT "psf_application_branches_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_application_branches" ADD CONSTRAINT "psf_application_branches_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_application_branches" ADD CONSTRAINT "psf_application_branches_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_application_branches" ADD CONSTRAINT "psf_application_branches_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "psf_application_branches_application_idx" ON "psf_application_branches" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "psf_application_branches_district_idx" ON "psf_application_branches" USING btree ("district_id","status");