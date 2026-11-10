-- HR's optional features a business has switched off (Injishi staff switch them). Empty means everything is on.
ALTER TABLE "hr_settings" ADD COLUMN "features_off" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_settings" ADD CONSTRAINT "hr_settings_features_off_ck" CHECK ("features_off" <@ ARRAY['talent','reviews','insurance','loans','claims','assets','announcements','helpDesk']::text[]);
