-- The PSF membership fee as a payment attempt purpose (2026-10-29). When
-- origin/main was merged into audric-main, the PSF fee moved onto GTBank's one
-- time fee, which records each attempt under its purpose. Added alone: a new
-- enum value cannot be used in the transaction that adds it, and nothing here
-- uses it.
ALTER TYPE "public"."payment_attempt_purpose" ADD VALUE IF NOT EXISTS 'psf_membership';
