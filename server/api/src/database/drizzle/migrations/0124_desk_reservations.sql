-- The front desk books a guest for a later day (2026-10-30): a phone call, a WhatsApp, an email. Such a
-- booking has no guest account, so who it is for, what the desk took from them, an optional hold and why the
-- desk changed the price live beside the booking in one new table. Additive only: nothing that exists is
-- altered, so every booking read stays as it was. Idempotent, so a rerun is harmless.
CREATE TABLE IF NOT EXISTS "booking_desk_details" (
	"booking_id" uuid PRIMARY KEY NOT NULL
		CONSTRAINT "booking_desk_details_booking_id_bookings_id_fk" REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action,
	"workspace_id" uuid NOT NULL
		CONSTRAINT "booking_desk_details_workspace_id_workspaces_id_fk" REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action,
	"guest_name" text NOT NULL,
	"guest_phone" text,
	"guest_email" text,
	"nationality" char(2),
	"document_type" "document_type",
	"id_number" text,
	"hold_until" timestamp with time zone,
	"rate_override_reason" text,
	"created_by_user_id" uuid
		CONSTRAINT "booking_desk_details_created_by_user_id_users_id_fk" REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_desk_details_workspace_idx" ON "booking_desk_details" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_desk_details_hold_idx" ON "booking_desk_details" USING btree ("hold_until") WHERE "booking_desk_details"."hold_until" IS NOT NULL;
