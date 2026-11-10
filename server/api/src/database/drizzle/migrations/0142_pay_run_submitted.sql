-- A pay run is submitted to whoever confirms it (ADR-069 D-e): who handed it
-- over, when, and what they said. A submitted draft is locked until it is
-- confirmed or withdrawn; withdrawing clears the three.
ALTER TABLE "pay_runs" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "submitted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "submit_note" text;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;