CREATE TABLE "candidate_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"name" text NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "access_code_hash" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "access_code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "access_code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "access_session_hash" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "access_session_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "required_documents" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_documents_candidate_idx" ON "candidate_documents" USING btree ("candidate_id");--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_access_token_unique" UNIQUE("access_token");--> statement-breakpoint
-- Every applicant already on the board gets their progress page link.
UPDATE "candidates" SET "access_token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE "access_token" IS NULL;
