-- The venue's own details on its receipts, and when its business day starts (POS venue setup, round 1). ADDITIVE ONLY.
--
--   * `venue_tin`, `venue_phone`, `venue_address`: printed on the EBM-layout receipt in place of "TIN: set in Setup".
--     A TIN is empty or Rwanda's 9 digits.
--   * `business_day_start_minutes`: minutes after midnight (Kigali) at which a business day starts, 0 to 719 (up to
--     11:59). A bar that closes at 03:00 sets 240 (04:00) so a sale at 01:30 counts in the evening before. The
--     dashboard and the reports use it; receipt and order numbers keep their calendar date.
--
-- Four NOT NULL columns with constant defaults on one small table: a catalogue change only since PostgreSQL 11 (no
-- table rewrite), and every existing row reads the default, which is exactly today's behaviour (no details printed,
-- a business day from 00:00 to 00:00). Nothing is dropped, renamed, rewritten or backfilled. Safe to run twice.
--
-- Order of deployment: this migration FIRST, then an API that reads the columns (an older API ignores them).
--
-- Rollback (not run by the migrator): drizzle/rollbacks/0154_pos_outlet_profile.down.sql
ALTER TABLE "pos_outlet_settings" ADD COLUMN IF NOT EXISTS "venue_tin" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_outlet_settings" ADD COLUMN IF NOT EXISTS "venue_phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_outlet_settings" ADD COLUMN IF NOT EXISTS "venue_address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_outlet_settings" ADD COLUMN IF NOT EXISTS "business_day_start_minutes" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_outlet_settings" ADD CONSTRAINT "pos_outlet_settings_tin_shape" CHECK ("venue_tin" = '' OR "venue_tin" ~ '^[0-9]{9}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_outlet_settings" ADD CONSTRAINT "pos_outlet_settings_business_day_range" CHECK ("business_day_start_minutes" >= 0 AND "business_day_start_minutes" < 720);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
