-- ADR-049 - training, live attendance and the digital certificate.
--
-- NUMBERED 0034, NOT 0032. ADR-049 says "Migration 0032" because 0031 was the
-- highest on disk when it was written. Two concurrent slices took 0032
-- (payment_attempts) and 0033 (waitlist_signups) first, and a migration number
-- is never reused, so this is 0034. The ADR's own numbering note records the
-- same thing happening to the record itself, which was authored as 048.
--
-- WHY THE TWO `ADD VALUE` LINES ARE SAFE HERE. Migrations 0005, 0009 and 0012
-- record the rule: `ALTER TYPE ... ADD VALUE` is legal inside a transaction but
-- Postgres then refuses to USE the new value until that transaction commits,
-- and `drizzle-kit migrate` applies every pending migration in ONE transaction.
-- Neither new literal is used anywhere below - nothing writes 'trainer' and
-- nothing writes 'training_certificate' - so no recreate dance is needed. This
-- is exactly the exemption 0005 claimed for its own `stored_object_kind` line.
-- The four training enums are CREATEd rather than altered, and a type created
-- inside a transaction may be used inside it, so the column defaults are fine.
--
-- THE SEQUENCE NEVER RESETS (AC-18). A serial reads INJ-TR-<year>-<sequence>:
-- the year comes from the session date and the number from here, so serials
-- inside one year are unique but not contiguous. A per-year counter would need
-- something to reset it, and the thing that resets a counter is the thing that
-- eventually reissues a serial that has already been printed.
--
-- FORWARD ONLY, like every migration here. Enum values cannot be removed, and
-- a certificate row is never deleted by design (AC-23).
CREATE TYPE "public"."training_attendance_decision" AS ENUM('present', 'absent');--> statement-breakpoint
CREATE TYPE "public"."training_registration_source" AS ENUM('self', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."training_registration_status" AS ENUM('registered', 'attended', 'absent', 'withdrawn', 'released');--> statement-breakpoint
CREATE TYPE "public"."training_session_status" AS ENUM('draft', 'published', 'cancelled', 'completed');--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE 'trainer';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'training_certificate';--> statement-breakpoint
CREATE SEQUENCE "public"."training_certificate_serial_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "training_attendance_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"decision" "training_attendance_decision" NOT NULL,
	"decided_by" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_attendance_decisions_idempotency_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "training_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"course_version" integer NOT NULL,
	"serial" text NOT NULL,
	"verify_token" text NOT NULL,
	"holder_name" text NOT NULL,
	"holder_org_id" uuid,
	"holder_business_name" text,
	"session_date" date NOT NULL,
	"venue_name" text NOT NULL,
	"district_name" text NOT NULL,
	"lead_trainer_name" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" uuid NOT NULL,
	"pdf_object_key" text,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_certificates_registration_uk" UNIQUE("registration_id"),
	CONSTRAINT "training_certificates_serial_uk" UNIQUE("serial"),
	CONSTRAINT "training_certificates_verify_token_uk" UNIQUE("verify_token"),
	CONSTRAINT "training_certificates_revocation_shape" CHECK (("training_certificates"."revoked_at" IS NULL AND "training_certificates"."revoked_by" IS NULL AND "training_certificates"."revocation_reason" IS NULL)
          OR ("training_certificates"."revoked_at" IS NOT NULL AND "training_certificates"."revoked_by" IS NOT NULL AND "training_certificates"."revocation_reason" IS NOT NULL)),
	CONSTRAINT "training_certificates_course_version" CHECK ("training_certificates"."course_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "training_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_courses_slug_uk" UNIQUE("slug"),
	CONSTRAINT "training_courses_version_positive" CHECK ("training_courses"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "training_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "training_registration_status" DEFAULT 'registered' NOT NULL,
	"source" "training_registration_source" DEFAULT 'self' NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"org_id" uuid,
	"business_name" text,
	"fee_rwf" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"paid_at" timestamp with time zone,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_registrations_session_user_uk" UNIQUE("session_id","user_id"),
	CONSTRAINT "training_registrations_business_shape" CHECK (("training_registrations"."org_id" IS NOT NULL AND "training_registrations"."business_name" IS NULL)
          OR ("training_registrations"."org_id" IS NULL AND "training_registrations"."business_name" IS NOT NULL)),
	CONSTRAINT "training_registrations_fee_nonnegative" CHECK ("training_registrations"."fee_rwf" >= 0)
);
--> statement-breakpoint
CREATE TABLE "training_session_trainers" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_session_trainers_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"status" "training_session_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"venue_id" uuid NOT NULL,
	"fee_rwf" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"seat_count" integer NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"rescheduled_from" timestamp with time zone,
	"roster_closed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_sessions_window" CHECK ("training_sessions"."ends_at" > "training_sessions"."starts_at"),
	CONSTRAINT "training_sessions_seat_count" CHECK ("training_sessions"."seat_count" >= 0),
	CONSTRAINT "training_sessions_fee_nonnegative" CHECK ("training_sessions"."fee_rwf" >= 0),
	CONSTRAINT "training_sessions_cancellation_shape" CHECK (("training_sessions"."cancelled_at" IS NULL AND "training_sessions"."cancellation_reason" IS NULL)
          OR ("training_sessions"."cancelled_at" IS NOT NULL AND "training_sessions"."cancellation_reason" IS NOT NULL)),
	CONSTRAINT "training_sessions_publication_shape" CHECK (("training_sessions"."published_at" IS NULL AND "training_sessions"."published_by" IS NULL)
          OR ("training_sessions"."published_at" IS NOT NULL AND "training_sessions"."published_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "training_venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"district_id" integer NOT NULL,
	"is_office" boolean DEFAULT false NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_attendance_decisions" ADD CONSTRAINT "training_attendance_decisions_registration_id_training_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."training_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attendance_decisions" ADD CONSTRAINT "training_attendance_decisions_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attendance_decisions" ADD CONSTRAINT "training_attendance_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_registration_id_training_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."training_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_holder_org_id_orgs_id_fk" FOREIGN KEY ("holder_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_registrations" ADD CONSTRAINT "training_registrations_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_registrations" ADD CONSTRAINT "training_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_registrations" ADD CONSTRAINT "training_registrations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_trainers" ADD CONSTRAINT "training_session_trainers_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_trainers" ADD CONSTRAINT "training_session_trainers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_venue_id_training_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."training_venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_venues" ADD CONSTRAINT "training_venues_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_attendance_decisions_registration_idx" ON "training_attendance_decisions" USING btree ("registration_id","decided_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "training_attendance_decisions_session_idx" ON "training_attendance_decisions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "training_certificates_course_idx" ON "training_certificates" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "training_certificates_issued_at_idx" ON "training_certificates" USING btree ("issued_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "training_courses_published_idx" ON "training_courses" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "training_registrations_session_status_idx" ON "training_registrations" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "training_registrations_user_idx" ON "training_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_registrations_session_email_uk" ON "training_registrations" USING btree ("session_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "training_session_trainers_lead_uk" ON "training_session_trainers" USING btree ("session_id") WHERE "training_session_trainers"."is_lead";--> statement-breakpoint
CREATE INDEX "training_session_trainers_user_idx" ON "training_session_trainers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "training_sessions_course_idx" ON "training_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "training_sessions_venue_idx" ON "training_sessions" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "training_sessions_status_starts_idx" ON "training_sessions" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "training_venues_district_idx" ON "training_venues" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "training_venues_active_idx" ON "training_venues" USING btree ("name") WHERE "training_venues"."retired_at" IS NULL;