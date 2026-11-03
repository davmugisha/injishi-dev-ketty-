-- People: custom staff roles, suspension and sign in history (2026-11-02). Additive only.
--
--  - `staff_custom_roles` is a named bundle of staff permissions a super admin makes in the console. The
--    permissions themselves stay code (`StaffPermission` in @injishi/contracts); a role only chooses among them.
--  - `staff_custom_role_permissions` holds the choice. The five reserved powers are refused here as well as in
--    the API, so no write path can put them in a custom role.
--  - `user_staff_custom_roles` is who holds which custom role. Revoked rows stay, for the trail.
--  - `user_suspensions` stops an account from signing in. Lifted rows stay, for the trail.
--  - `sign_in_events` is one row per sign in, written when a session is made.
ALTER TYPE "audit_subject_type" ADD VALUE IF NOT EXISTS 'staff_role';--> statement-breakpoint
CREATE TABLE "staff_custom_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "updated_by_user_id" uuid REFERENCES "users"("id"),
  "archived_at" timestamp with time zone,
  "archived_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staff_custom_roles_key_uk" UNIQUE ("key"),
  CONSTRAINT "staff_custom_roles_key_shape" CHECK ("key" ~ '^[a-z0-9][a-z0-9_]{1,62}$'),
  CONSTRAINT "staff_custom_roles_not_builtin" CHECK ("key" NOT IN ('super_admin', 'ops', 'compliance', 'finance', 'trainer'))
);--> statement-breakpoint
CREATE UNIQUE INDEX "staff_custom_roles_live_name_uk" ON "staff_custom_roles" (lower("name")) WHERE "archived_at" IS NULL;--> statement-breakpoint
CREATE TABLE "staff_custom_role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "staff_custom_roles"("id") ON DELETE CASCADE,
  "permission" text NOT NULL,
  CONSTRAINT "staff_custom_role_permissions_pk" PRIMARY KEY ("role_id", "permission"),
  CONSTRAINT "staff_custom_role_permissions_shape" CHECK ("permission" ~ '^(admin|training)\.[a-z_.]+$'),
  CONSTRAINT "staff_custom_role_permissions_not_reserved" CHECK ("permission" NOT IN (
    'admin.user.role.grant', 'admin.user.impersonate', 'admin.money.override', 'admin.config.edit', 'admin.environment.manage'
  ))
);--> statement-breakpoint
CREATE TABLE "user_staff_custom_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "staff_custom_roles"("id"),
  "granted_by_user_id" uuid REFERENCES "users"("id"),
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by_user_id" uuid REFERENCES "users"("id")
);--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_custom_roles_live_uk" ON "user_staff_custom_roles" ("user_id", "role_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_staff_custom_roles_role_idx" ON "user_staff_custom_roles" ("role_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE TABLE "user_suspensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "suspended_at" timestamp with time zone DEFAULT now() NOT NULL,
  "suspended_by_user_id" uuid REFERENCES "users"("id"),
  "reason" text NOT NULL,
  "lifted_at" timestamp with time zone,
  "lifted_by_user_id" uuid REFERENCES "users"("id"),
  "lift_reason" text,
  CONSTRAINT "user_suspensions_lift_shape" CHECK (("lifted_at" IS NULL) = ("lift_reason" IS NULL))
);--> statement-breakpoint
CREATE UNIQUE INDEX "user_suspensions_live_uk" ON "user_suspensions" ("user_id") WHERE "lifted_at" IS NULL;--> statement-breakpoint
CREATE TABLE "sign_in_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "session_id" uuid,
  "method" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "sign_in_events_user_idx" ON "sign_in_events" ("user_id", "occurred_at" DESC);
