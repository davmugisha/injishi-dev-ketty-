-- Phone sign in (ADR-039). Additive and reversible: nothing reads these
-- columns or tables until the plugin ships, so this deploys on its own safely,
-- and a rollback simply leaves them unread.
--
-- WHY THIS IS 0028 AND IDEMPOTENT. It was written as 0026_phone_sign_in.sql on
-- the same day as 0026_broker_reveal_credits.sql. The broker migration took the
-- 0026 slot in meta/_journal.json and the snapshot, so the migrator never ran
-- the phone one, and its tables were missing from the TypeScript schema too.
-- Better Auth's send cap (`otpSendCap()`) spends every email sign-in code
-- through `auth_otp_requests`, so every code send failed. The same statements
-- live here now, journaled and snapshotted, and every one is a no-op where the
-- object already exists: a database that ran 0026 by hand is left as it is.
--
-- DIVERGENCE FROM THE ADR'S MIGRATION PLAN, PHASE 2. It asks for
-- `CREATE UNIQUE INDEX CONCURRENTLY` on `users_phone_number_uk` so a live table
-- is not locked while the index builds. That is not available here:
-- `scripts/migrate.mjs` runs each migration inside a transaction, and Postgres
-- refuses CONCURRENTLY in a transaction block. The plain build below is correct
-- and takes a brief ACCESS EXCLUSIVE lock on `users` instead. Build it
-- concurrently by hand, outside the migrator, before this runs against a
-- `users` table large enough for that lock to be felt.
DO $$ BEGIN
  CREATE TYPE "public"."otp_channel" AS ENUM('sms', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."phone_link_stage" AS ENUM('sms_sent', 'phone_proved', 'email_sent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_otp_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"channel" "otp_channel" NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"count_hour" integer DEFAULT 0 NOT NULL,
	"day_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"count_day" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_link_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"stage" "phone_link_stage" DEFAULT 'sms_sent' NOT NULL,
	"link_token_hash" text,
	"email" text,
	"user_id" uuid,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "phone_link_challenges" ADD CONSTRAINT "phone_link_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_otp_requests_identifier_channel_uk" ON "auth_otp_requests" USING btree ("identifier","channel");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "phone_link_challenges_phone_uk" ON "phone_link_challenges" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_link_challenges_link_token_idx" ON "phone_link_challenges" USING btree ("link_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_number_uk" ON "users" USING btree ("phone_number");
