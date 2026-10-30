-- A PSF District Manager reviews a registration in one step (2026-10-30, the owner's decision).
--
-- The manager checks the documents and marks the business Reviewed, and that one decision approves it:
-- `tin_verified → approved`, then on to `active` as an approval always does. The review row records it at
-- the `tin_verified` gate under the manager's own function, so this check now names that function there
-- too. The two-step path (a Document reviewer, then a different Business approver) is unchanged.
ALTER TABLE "org_registration_reviews" DROP CONSTRAINT "org_registration_reviews_role_shape";--> statement-breakpoint
ALTER TABLE "org_registration_reviews" ADD CONSTRAINT "org_registration_reviews_role_shape" CHECK (("org_registration_reviews"."stage" = 'tin_verified' AND "org_registration_reviews"."oversight_role" IN ('business_field_verifier', 'psf_membership_officer'))
          OR ("org_registration_reviews"."stage" = 'field_verified' AND "org_registration_reviews"."oversight_role" = 'business_approver'));
