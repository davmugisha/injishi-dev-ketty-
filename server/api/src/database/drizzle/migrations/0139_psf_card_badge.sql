-- The badge a band prints on its membership card (2026-11-06): PSF's cards say Bronze, for instance.
ALTER TABLE "psf_membership_tiers" ADD COLUMN "card_badge" text;
