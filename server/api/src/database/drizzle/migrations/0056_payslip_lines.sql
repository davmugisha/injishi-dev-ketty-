ALTER TABLE "payslips" ADD COLUMN "lines" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "attendance" jsonb;