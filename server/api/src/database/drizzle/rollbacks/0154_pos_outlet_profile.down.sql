-- Rollback for migration 0154_pos_outlet_profile. NOT run by the migrator (it lives outside migrations/ on purpose).
--
-- Removes what 0154 added and nothing else: the venue's TIN, phone and address and its business-day start. Orders,
-- payments, receipts already printed and every other setting are untouched. The entered values ARE LOST, so dump
-- them first if any were set:
--   psql <database> -c "\copy (select outlet_id, venue_tin, venue_phone, venue_address, business_day_start_minutes from pos_outlet_settings) to 'outlet-profile-before-rollback.csv' csv header"
-- Roll back the API to a build that does not read these columns BEFORE running this, or every POS screen fails.
-- Safe to run twice. Read the count the first SELECT prints before you COMMIT.
BEGIN;
SELECT count(*) AS outlets_with_details_that_will_be_lost FROM pos_outlet_settings
 WHERE venue_tin <> '' OR venue_phone <> '' OR venue_address <> '' OR business_day_start_minutes <> 0;
ALTER TABLE public.pos_outlet_settings DROP CONSTRAINT IF EXISTS pos_outlet_settings_business_day_range;
ALTER TABLE public.pos_outlet_settings DROP CONSTRAINT IF EXISTS pos_outlet_settings_tin_shape;
ALTER TABLE public.pos_outlet_settings DROP COLUMN IF EXISTS business_day_start_minutes;
ALTER TABLE public.pos_outlet_settings DROP COLUMN IF EXISTS venue_address;
ALTER TABLE public.pos_outlet_settings DROP COLUMN IF EXISTS venue_phone;
ALTER TABLE public.pos_outlet_settings DROP COLUMN IF EXISTS venue_tin;
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793929335159;
-- COMMIT;  -- uncomment only after reading the count above
ROLLBACK;
