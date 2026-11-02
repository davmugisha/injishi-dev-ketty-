-- Registration's National ID check without a selfie (2026-11-02, the owner's decision): the number is
-- looked up with NIDA, its details are filled in, and the document reviewer confirms the ID. Such a
-- check has no selfie to keep; a card scan (a passport, or a National ID where NIDA is off) still does.
ALTER TABLE "identity_scans" ALTER COLUMN "selfie_object_key" DROP NOT NULL;
