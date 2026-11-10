CREATE TYPE "public"."hr_clock_mode" AS ENUM('anywhere', 'at_work', 'entrance');--> statement-breakpoint
ALTER TYPE "public"."hr_attendance_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "branch_clock_settings" ADD COLUMN "clock_mode" "hr_clock_mode" DEFAULT 'anywhere' NOT NULL;--> statement-breakpoint
ALTER TABLE "branch_clock_settings" ADD COLUMN "opens_minutes_before" integer;--> statement-breakpoint
ALTER TABLE "branch_clock_settings" ADD CONSTRAINT "branch_clock_settings_opens_ck" CHECK ("branch_clock_settings"."opens_minutes_before" IS NULL OR "branch_clock_settings"."opens_minutes_before" BETWEEN 5 AND 240);