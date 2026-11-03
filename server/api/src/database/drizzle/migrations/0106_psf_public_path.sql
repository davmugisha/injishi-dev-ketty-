-- THE PUBLIC PSF PATH (2026-10-19): a business joins PSF without an account.
--
-- It fills in one public form, pays the registration fee, and keeps a docID
-- (`PSF-7K3M-Q9XD`) that opens its tracking page. What this adds:
--   * `psf_membership_applications.doc_id`: the bearer key, random (40 bits of
--     Crockford base32, never a counter), on every application. Existing rows
--     are given one below; new ones get theirs from `newPsfDocId`.
--   * `submitted_by_user_id` becomes nullable: a public application has nobody
--     signed in behind it. `applicant_phone_e164` (always, for SMS) and
--     `applicant_email` (when given) are where its news goes instead, and
--     `psf_membership_applications_public_shape` holds that one of the two
--     (a user, or a phone) is always there.
--   * `psf_identity_checks`: the National ID check the public form runs before
--     submit, the same code rules as `identity_challenges` with no user.
CREATE TABLE "psf_identity_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"person" jsonb,
	"token_hash" text,
	"token_expires_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"spent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ALTER COLUMN "submitted_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "doc_id" text;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "applicant_phone_e164" text;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "applicant_email" text;--> statement-breakpoint
-- A docID for every application already filed. Eight characters from
-- Crockford's alphabet, drawn per row; the unique index below would refuse a
-- clash, and at 40 bits over a few thousand rows there is none to refuse.
UPDATE "psf_membership_applications" SET "doc_id" = 'PSF-' || (
  SELECT string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 32)::int, 1), '')
    FROM generate_series(1, 4)
  WHERE "psf_membership_applications"."id" IS NOT NULL
) || '-' || (
  SELECT string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 32)::int, 1), '')
    FROM generate_series(1, 4)
  WHERE "psf_membership_applications"."id" IS NOT NULL
);--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ALTER COLUMN "doc_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "psf_identity_checks_token_uk" ON "psf_identity_checks" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "psf_identity_checks_created_idx" ON "psf_identity_checks" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "psf_membership_applications_doc_id_uk" ON "psf_membership_applications" USING btree ("doc_id");--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_public_shape" CHECK ("psf_membership_applications"."submitted_by_user_id" IS NOT NULL OR "psf_membership_applications"."applicant_phone_e164" IS NOT NULL);
