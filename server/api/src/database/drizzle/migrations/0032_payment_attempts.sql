CREATE TYPE "public"."payment_attempt_state" AS ENUM('prompting', 'confirmed', 'refused', 'expired');--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempt_token" text NOT NULL,
	"guest_user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"guest_count" integer NOT NULL,
	"nonrefundable" boolean DEFAULT false NOT NULL,
	"attempt_fingerprint" text NOT NULL,
	"amount_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"adapter_ref" text,
	"adapter_mode" "adapter_mode" DEFAULT 'mock' NOT NULL,
	"instrument_kind" text NOT NULL,
	"network" text,
	"payer_masked" text,
	"state" "payment_attempt_state" DEFAULT 'prompting' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"booking_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_attempts_guest_idx" ON "payment_attempts" USING btree ("guest_user_id","attempt_token");--> statement-breakpoint
CREATE INDEX "payment_attempts_adapter_ref_idx" ON "payment_attempts" USING btree ("adapter_ref");--> statement-breakpoint
CREATE INDEX "payment_attempts_expiry_idx" ON "payment_attempts" USING btree ("expires_at") WHERE "payment_attempts"."state" = 'prompting';