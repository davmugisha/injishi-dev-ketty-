-- PSF APPROVES ONLY A BUSINESS THAT HAS PAID (2026-10-20). On the public
-- path the form takes one payment at submit: the registration fee and the
-- membership fee together. PSF then decides a paid application:
--   * approve makes it a member at once (the membership starts that day);
--   * decline owes the membership fee back. The registration fee is kept, and
--     the business keeps its code. Finance releases each refund (refund_*).
-- A paid application may not be withdrawn: only PSF's decision ends it.
--
-- So a payment may now sit on a `submitted` application (paid, waiting on PSF)
-- and on a `declined` one (owed back), not only on a member.
--
-- And the PSF path's registration fee becomes RWF 500 (the owner, 2026-10-20):
-- a new fee row, effective now; the newest active row is the one in force.
ALTER TABLE "psf_membership_applications" DROP CONSTRAINT "psf_membership_applications_payment_shape";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "refund_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "refund_amount_rwf" bigint;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "refund_ref" text;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "refunded_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_refunded_by_user_id_users_id_fk" FOREIGN KEY ("refunded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_refund_shape" CHECK (("psf_membership_applications"."refund_requested_at" IS NULL OR ("psf_membership_applications"."status" = 'declined' AND "psf_membership_applications"."paid_at" IS NOT NULL AND "psf_membership_applications"."refund_amount_rwf" IS NOT NULL))
          AND ("psf_membership_applications"."refunded_at" IS NULL OR "psf_membership_applications"."refund_requested_at" IS NOT NULL)
          AND (("psf_membership_applications"."refunded_at" IS NULL) = ("psf_membership_applications"."refund_ref" IS NULL)));--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_payment_shape" CHECK (("psf_membership_applications"."status" IN ('submitted', 'member', 'declined', 'withdrawn') OR ("psf_membership_applications"."approved_membership_number" IS NOT NULL AND "psf_membership_applications"."approved_fee_rwf" IS NOT NULL))
          AND (("psf_membership_applications"."paid_at" IS NULL) = ("psf_membership_applications"."paid_amount_rwf" IS NULL)
               AND ("psf_membership_applications"."paid_at" IS NULL) = ("psf_membership_applications"."payment_ref" IS NULL)
               AND ("psf_membership_applications"."paid_at" IS NULL) = ("psf_membership_applications"."payment_mode" IS NULL))
          AND ("psf_membership_applications"."paid_at" IS NULL OR "psf_membership_applications"."status" IN ('submitted', 'member', 'declined'))
          AND ("psf_membership_applications"."remitted_at" IS NULL OR "psf_membership_applications"."paid_at" IS NOT NULL)
          AND (("psf_membership_applications"."remitted_at" IS NULL) = ("psf_membership_applications"."remittance_ref" IS NULL)));
--> statement-breakpoint
INSERT INTO "registration_fees" ("business_type", "amount_rwf", "effective_from", "active")
SELECT 'enterprise', 500, now(), true
 WHERE NOT EXISTS (SELECT 1 FROM "registration_fees"
                    WHERE "business_type" = 'enterprise' AND "active" AND "amount_rwf" = 500);
