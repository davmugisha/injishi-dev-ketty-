-- A person can ask to join a rotation: a shift request of a third kind, naming the rotation.
-- The enum value is new in this transaction, so the check compares the kind as text.
ALTER TYPE "public"."hr_shift_request_kind" ADD VALUE IF NOT EXISTS 'rotation';--> statement-breakpoint
ALTER TABLE "shift_requests" ADD COLUMN "rotation_pattern_id" uuid;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_rotation_pattern_id_rotation_patterns_id_fk" FOREIGN KEY ("rotation_pattern_id") REFERENCES "public"."rotation_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" DROP CONSTRAINT "shift_requests_kind_ck";--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_kind_ck" CHECK (("kind"::text = 'change' AND "shift_template_id" IS NOT NULL AND "swap_employee_id" IS NULL AND "rotation_pattern_id" IS NULL)
        OR ("kind"::text = 'swap' AND "swap_employee_id" IS NOT NULL AND "shift_template_id" IS NULL AND "rotation_pattern_id" IS NULL)
        OR ("kind"::text = 'rotation' AND "rotation_pattern_id" IS NOT NULL AND "shift_template_id" IS NULL AND "swap_employee_id" IS NULL));
