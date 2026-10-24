-- NO REFUNDS ON PSF (2026-10-23). A declined application keeps its membership
-- fee, which goes on to PSF, so nothing is owed back and finance releases
-- nothing. The refund columns and their check go.
ALTER TABLE "psf_membership_applications" DROP CONSTRAINT "psf_membership_applications_refund_shape";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" DROP CONSTRAINT "psf_membership_applications_refunded_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "psf_membership_applications" DROP COLUMN "refund_requested_at";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" DROP COLUMN "refund_amount_rwf";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" DROP COLUMN "refunded_at";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" DROP COLUMN "refund_ref";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" DROP COLUMN "refunded_by_user_id";