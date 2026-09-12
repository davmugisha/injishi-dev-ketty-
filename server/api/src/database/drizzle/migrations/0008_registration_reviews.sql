CREATE TYPE "public"."registration_rejection_reason" AS ENUM('tin_not_found', 'tin_mismatch', 'premises_not_found', 'documents_invalid', 'documents_expired', 'not_operating', 'ownership_unclear', 'duplicate_business', 'other');--> statement-breakpoint
CREATE TYPE "public"."registration_review_decision" AS ENUM('passed', 'rejected');--> statement-breakpoint
CREATE TABLE "org_registration_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stage" "org_registration_status" NOT NULL,
	"decision" "registration_review_decision" NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"oversight_role" "oversight_role" NOT NULL,
	"government_body_code" text NOT NULL,
	"government_title" text,
	"reason_code" "registration_rejection_reason",
	"notes" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_registration_reviews_stage_shape" CHECK ("org_registration_reviews"."stage" IN ('tin_verified', 'field_verified')),
	CONSTRAINT "org_registration_reviews_role_shape" CHECK (("org_registration_reviews"."stage" = 'tin_verified' AND "org_registration_reviews"."oversight_role" = 'business_field_verifier')
          OR ("org_registration_reviews"."stage" = 'field_verified' AND "org_registration_reviews"."oversight_role" = 'business_approver')),
	CONSTRAINT "org_registration_reviews_reason_shape" CHECK (("org_registration_reviews"."decision" = 'rejected' AND "org_registration_reviews"."reason_code" IS NOT NULL)
          OR ("org_registration_reviews"."decision" = 'passed' AND "org_registration_reviews"."reason_code" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "org_registration_reviews" ADD CONSTRAINT "org_registration_reviews_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_registration_reviews" ADD CONSTRAINT "org_registration_reviews_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_registration_reviews" ADD CONSTRAINT "org_registration_reviews_government_body_code_government_bodies_code_fk" FOREIGN KEY ("government_body_code") REFERENCES "public"."government_bodies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_registration_reviews_org_idx" ON "org_registration_reviews" USING btree ("org_id","decided_at");--> statement-breakpoint
CREATE INDEX "org_registration_reviews_stage_idx" ON "org_registration_reviews" USING btree ("org_id","stage","decision");