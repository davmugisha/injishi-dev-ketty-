-- A business names its own association when PSF's list does not have it
-- (2026-10-20). Filed under the cluster's "other" row, which keeps the foreign
-- key; this is the name it gave, for the officer to read.
ALTER TABLE "orgs" ADD COLUMN "psf_association_other" text;
