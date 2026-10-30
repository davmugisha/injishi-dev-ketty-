-- Renumbered from 0083 to 0113 when origin/main was merged (2026-10-29): main already has an 0083.
-- Dynamic fields on the PSF membership form (registration + public apply).
-- Officers (national) configure the catalogue; applicants fill `extra_answers`
-- on each application. Keys are stable; labels and options may change.

CREATE TABLE IF NOT EXISTS "psf_membership_form_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "help_text" text,
  "field_type" text NOT NULL,
  "required" boolean DEFAULT false NOT NULL,
  "options" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "psf_membership_form_fields_key_uk" UNIQUE ("key"),
  CONSTRAINT "psf_membership_form_fields_type_ck"
    CHECK ("field_type" IN ('text', 'textarea', 'number', 'boolean', 'select')),
  CONSTRAINT "psf_membership_form_fields_key_ck"
    CHECK ("key" ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT "psf_membership_form_fields_select_options_ck"
    CHECK (
      ("field_type" <> 'select' AND jsonb_typeof("options") = 'array' AND jsonb_array_length("options") = 0)
      OR ("field_type" = 'select' AND jsonb_typeof("options") = 'array' AND jsonb_array_length("options") >= 1)
    )
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "psf_membership_form_fields_active_idx"
  ON "psf_membership_form_fields" ("active", "sort_order");--> statement-breakpoint

ALTER TABLE "psf_membership_applications"
  ADD COLUMN IF NOT EXISTS "extra_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint

ALTER TABLE "psf_membership_applications"
  ADD CONSTRAINT "psf_membership_applications_extra_answers_object_ck"
  CHECK (jsonb_typeof("extra_answers") = 'object');
