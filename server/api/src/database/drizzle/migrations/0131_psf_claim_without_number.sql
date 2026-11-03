-- A PSF member registering may leave the membership number out (2026-11-02, the owner's decision): its
-- membership card is sent instead, and the claim is still filed for PSF to check. The officer who
-- confirms such a claim types the number from the card.
ALTER TABLE "psf_membership_claims" ALTER COLUMN "membership_number" DROP NOT NULL;
