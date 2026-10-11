ALTER TABLE "leave_type_settings" ADD COLUMN "yearly_days" integer;--> statement-breakpoint
ALTER TABLE "leave_type_settings" ADD COLUMN "seniority_every_years" integer;--> statement-breakpoint
ALTER TABLE "leave_type_settings" ADD COLUMN "seniority_extra_days" integer;--> statement-breakpoint
ALTER TABLE "leave_type_settings" ADD COLUMN "seniority_cap_days" integer;