-- Rentals rebuild, P1 (blueprint 1.5, step 5): the lease lifecycle.
--
--   1. Lifecycle columns; notice_period_days is renamed notice_days.
--   2. lease_status gains `signed` by a TYPE SWAP, not ADD VALUE: this run uses the value at once,
--      and a value added by ADD VALUE cannot be used before the transaction commits. A lease out
--      for signature that both sides already signed becomes `signed`.
--   3. Every lease's terms are made whole (dates, due day, grace and notice days, occupants,
--      reference), then the status timestamps (signed, activated, ending since, ended on,
--      cancelled) are filled from what each lease already says. Each correction is counted in a
--      NOTICE.
--   4. Contract version 1 of every lease (template version 0: the old contract_content and the
--      terms of the day), signatures carried over as `legacy`, invitations keep only a token hash.
--   5. Signing codes and the lease timeline.
--   6. No two live leases may hold one unit over overlapping days: an EXCLUDE constraint over
--      btree_gist (installed since 0014). It fails here, loudly, only on two live leases of one
--      unit that start within a day of each other, which no correction can separate.
--
-- "Today" is the day in Kigali the migration runs.
-- 1. Lifecycle columns ---------------------------------------------------------------------------
ALTER TABLE "leases" ADD COLUMN "placement_id" uuid;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "other_terms" text;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "current_version_id" uuid;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "ending_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "ended_on" date;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "end_reason" text;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "leases" RENAME COLUMN "notice_period_days" TO "notice_days";--> statement-breakpoint
ALTER TABLE "leases" DROP CONSTRAINT "leases_terms_not_negative";--> statement-breakpoint
ALTER TABLE "leases" DROP CONSTRAINT "leases_rent_due_day_in_month";--> statement-breakpoint
-- 2. lease_status gains `signed`: swap the type ---------------------------------------------------
-- The one-active-lease-per-room index compares status to an old-type value, so it goes first; the
-- overlap constraint at the end replaces it.
DROP INDEX "leases_active_room_uk";--> statement-breakpoint
CREATE TYPE "public"."lease_status_v2" AS ENUM('draft', 'pending_signature', 'signed', 'active', 'ending', 'ended', 'cancelled');--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "status" SET DATA TYPE "public"."lease_status_v2" USING (
  CASE
    WHEN "status" = 'pending_signature' AND "landlord_signed_at" IS NOT NULL AND "tenant_signed_at" IS NOT NULL
      THEN 'signed'
    ELSE "status"::text
  END
)::"public"."lease_status_v2";--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."lease_status";--> statement-breakpoint
ALTER TYPE "public"."lease_status_v2" RENAME TO "lease_status";--> statement-breakpoint
-- 3. Terms made whole ----------------------------------------------------------------------------
CREATE TEMP TABLE "_m0077_fixes" ("what" text NOT NULL, "n" integer NOT NULL) ON COMMIT DROP;--> statement-breakpoint
-- A lease with no start date starts the day it was written.
WITH fixed AS (
  UPDATE "leases" SET "start_date" = ("created_at" AT TIME ZONE 'Africa/Kigali')::date
   WHERE "start_date" IS NULL RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'start date taken from the day the lease was written', count(*) FROM fixed;--> statement-breakpoint
-- A lease with no rent takes its unit's asking rent. One with neither cannot be priced.
WITH fixed AS (
  UPDATE "leases" l SET "monthly_rent_rwf" = u."asking_rent_rwf"
    FROM "rental_units" u
   WHERE u."id" = l."unit_id" AND u."asking_rent_rwf" > 0
     AND (l."monthly_rent_rwf" IS NULL OR l."monthly_rent_rwf" <= 0)
  RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'rent taken from the unit''s asking rent', count(*) FROM fixed;--> statement-breakpoint
DO $$
DECLARE refs text;
BEGIN
  SELECT string_agg(coalesce("reference", "id"::text), ', ') INTO refs
    FROM "leases" WHERE "monthly_rent_rwf" IS NULL OR "monthly_rent_rwf" <= 0;
  IF refs IS NOT NULL THEN
    RAISE EXCEPTION '0077: these leases have no rent and their unit has no asking rent, so they cannot be priced: %. Set the rent (or cancel the lease) and migrate again.', refs;
  END IF;
END $$;--> statement-breakpoint
-- End date. Missing, or not after the start: the lease runs 12 months (to the day before its
-- anniversary). An active or ending lease that had no end date is a running tenancy: it runs to the
-- end of its current year, so it is not shown as past its end.
WITH ends AS (
  SELECT l."id",
         CASE
           WHEN l."status" = 'ended' THEN
             coalesce(
               (SELECT max(n."move_out_date") FROM "move_out_notices" n
                 WHERE n."lease_id" = l."id" AND n."move_out_date" > l."start_date"),
               greatest(l."start_date" + 1,
                        least((l."start_date" + interval '1 year' - interval '1 day')::date,
                              (now() AT TIME ZONE 'Africa/Kigali')::date)))
           WHEN l."status" IN ('active', 'ending') THEN
             (l."start_date" + make_interval(years => greatest(1,
                 extract(year FROM age((now() AT TIME ZONE 'Africa/Kigali')::date, l."start_date"))::int + 1))
               - interval '1 day')::date
           ELSE (l."start_date" + interval '1 year' - interval '1 day')::date
         END AS end_date
    FROM "leases" l
   WHERE l."end_date" IS NULL OR l."end_date" <= l."start_date"
), fixed AS (
  UPDATE "leases" l SET "end_date" = e.end_date FROM ends e WHERE e."id" = l."id" RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'end date filled in (12 months, or the current year of a running tenancy)', count(*) FROM fixed;--> statement-breakpoint
-- Two live leases of one unit may not overlap: a live lease that runs into the next live lease on
-- its unit ends the day before that one starts.
WITH live AS (
  SELECT "id", "unit_id", "start_date", "end_date"
    FROM "leases" WHERE "status" IN ('pending_signature', 'signed', 'active', 'ending')
), cut AS (
  SELECT a."id", min(b."start_date") - 1 AS end_date
    FROM live a
    JOIN live b ON b."unit_id" = a."unit_id" AND b."id" <> a."id"
               AND b."start_date" > a."start_date" AND b."start_date" <= a."end_date"
   GROUP BY a."id"
), fixed AS (
  UPDATE "leases" l SET "end_date" = c.end_date
    FROM cut c WHERE c."id" = l."id" AND c.end_date > l."start_date"
  RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'end date cut to the day before the next live lease on the unit starts', count(*) FROM fixed;--> statement-breakpoint
-- Rent falls due on the day of the month the lease's charges mostly fell due (the earliest such
-- day on a tie), else on its start day; 29th to 31st become the 28th.
WITH fixed AS (
  UPDATE "leases" l SET "rent_due_day" = coalesce(
      (SELECT least(28, extract(day FROM c."due_date")::int) AS d
         FROM "rent_charges" c
        WHERE c."lease_id" = l."id" AND c."due_date" IS NOT NULL
        GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1),
      least(28, extract(day FROM l."start_date")::int))
   WHERE l."rent_due_day" IS NULL OR l."rent_due_day" NOT BETWEEN 1 AND 28
  RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'rent due day filled in', count(*) FROM fixed;--> statement-breakpoint
-- Grace and notice days: the landlord's defaults when missing, then kept within 0-31 and 15-180.
WITH fixed AS (
  UPDATE "leases" l
     SET "grace_days" = least(31, greatest(0, coalesce(l."grace_days", p."default_grace_days", 5))),
         "notice_days" = least(180, greatest(15, coalesce(l."notice_days", p."default_notice_days", 15)))
    FROM "leases" l2
    LEFT JOIN "landlord_profiles" p ON p."workspace_id" = l2."workspace_id"
   WHERE l2."id" = l."id"
     AND (l."grace_days" IS NULL OR l."grace_days" NOT BETWEEN 0 AND 31
          OR l."notice_days" IS NULL OR l."notice_days" NOT BETWEEN 15 AND 180)
  RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'grace or notice days filled in or brought within range', count(*) FROM fixed;--> statement-breakpoint
-- Billing starts with the lease, and inside it.
WITH fixed AS (
  UPDATE "leases"
     SET "billing_starts_on" = greatest("start_date", least("end_date", coalesce("billing_starts_on", "start_date")))
   WHERE "billing_starts_on" IS NULL OR "billing_starts_on" < "start_date" OR "billing_starts_on" > "end_date"
  RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'billing start brought inside the lease', count(*) FROM fixed;--> statement-breakpoint
-- Occupants: the comma separated names become a list (at most 12).
ALTER TABLE "leases" ALTER COLUMN "occupants" SET DATA TYPE text[] USING (
  CASE
    WHEN "occupants" IS NULL OR btrim("occupants", ' ,') = '' THEN '{}'::text[]
    ELSE array_remove(regexp_split_to_array(btrim("occupants", ' ,'), '\s*,[\s,]*'), '')
  END
);--> statement-breakpoint
WITH fixed AS (
  UPDATE "leases" SET "occupants" = "occupants"[1:12] WHERE cardinality("occupants") > 12 RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'occupant list cut to 12 names', count(*) FROM fixed;--> statement-breakpoint
-- Every lease has a reference: one without gets "L-M001", "L-M002", ... in its business, in start
-- order ("-<id prefix>" added if a lease already uses that reference).
WITH missing AS (
  SELECT "id", "workspace_id",
         'L-M' || lpad(row_number() OVER (PARTITION BY "workspace_id" ORDER BY "start_date", "created_at", "id")::text, 3, '0') AS ref
    FROM "leases" WHERE "reference" IS NULL OR btrim("reference") = ''
), fixed AS (
  UPDATE "leases" l
     SET "reference" = CASE
           WHEN EXISTS (SELECT 1 FROM "leases" o WHERE o."workspace_id" = m."workspace_id" AND o."reference" = m.ref)
             THEN m.ref || '-' || left(m."id"::text, 4)
           ELSE m.ref
         END
    FROM missing m WHERE m."id" = l."id"
  RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'reference given', count(*) FROM fixed;--> statement-breakpoint
-- The moment each status says happened.
--   signed      both old signature times present: the later one; a lease that must be signed but
--               lost its times: its start day (midnight in Kigali), else when it was written
--   activated   the later of the start day and the signing, never after now
--   ending      the newest move-out notice, else 30 days before the end, never after now
--   ended       the move-out day of the newest notice, else the end date, never after today
--   cancelled   when the row last changed
UPDATE "leases"
   SET "signed_at" = coalesce(
         CASE WHEN "landlord_signed_at" IS NOT NULL AND "tenant_signed_at" IS NOT NULL
              THEN greatest("landlord_signed_at", "tenant_signed_at") END,
         CASE WHEN "status" IN ('signed', 'active', 'ending', 'ended')
              THEN coalesce(greatest("landlord_signed_at", "tenant_signed_at"),
                            "start_date"::timestamp AT TIME ZONE 'Africa/Kigali', "created_at") END)
 WHERE "landlord_signed_at" IS NOT NULL AND "tenant_signed_at" IS NOT NULL
    OR "status" IN ('signed', 'active', 'ending', 'ended');--> statement-breakpoint
UPDATE "leases"
   SET "activated_at" = least(now(), greatest("start_date"::timestamp AT TIME ZONE 'Africa/Kigali', "signed_at"))
 WHERE "status" IN ('active', 'ending', 'ended');--> statement-breakpoint
UPDATE "leases" l
   SET "ending_since" = least(now(), coalesce(
         (SELECT max(n."filed_at") FROM "move_out_notices" n WHERE n."lease_id" = l."id"),
         (l."end_date" - 30)::timestamp AT TIME ZONE 'Africa/Kigali'))
 WHERE l."status" = 'ending';--> statement-breakpoint
UPDATE "leases" l
   SET "ended_on" = greatest(l."start_date", least(
         l."end_date",
         coalesce((SELECT max(n."move_out_date") FROM "move_out_notices" n WHERE n."lease_id" = l."id"), l."end_date"),
         (now() AT TIME ZONE 'Africa/Kigali')::date))
 WHERE l."status" = 'ended';--> statement-breakpoint
UPDATE "leases" SET "cancelled_at" = "updated_at" WHERE "status" = 'cancelled';--> statement-breakpoint
UPDATE "leases" l
   SET "placement_id" = (SELECT p."id" FROM "tenant_placements" p WHERE p."lease_id" = l."id"
                          ORDER BY p."created_at" DESC, p."id" DESC LIMIT 1);--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "start_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "end_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "billing_starts_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "monthly_rent_rwf" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "reference" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "rent_due_day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "grace_days" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "grace_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "notice_days" SET DEFAULT 15;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "notice_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "occupants" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "occupants" SET NOT NULL;--> statement-breakpoint
DROP INDEX "leases_workspace_reference_uk";--> statement-breakpoint
CREATE UNIQUE INDEX "leases_workspace_reference_uk" ON "leases" USING btree ("workspace_id","reference");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_dates_order" CHECK ("leases"."end_date" > "leases"."start_date");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_billing_window" CHECK ("leases"."billing_starts_on" >= "leases"."start_date" AND "leases"."billing_starts_on" <= "leases"."end_date");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_rent_positive" CHECK ("leases"."monthly_rent_rwf" > 0);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_deposit_not_negative" CHECK ("leases"."deposit_rwf" >= 0);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_rent_due_day_in_month" CHECK ("leases"."rent_due_day" BETWEEN 1 AND 28);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_terms_range" CHECK ("leases"."grace_days" BETWEEN 0 AND 31 AND "leases"."notice_days" BETWEEN 15 AND 180);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_occupants_limit" CHECK (cardinality("leases"."occupants") <= 12);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_reference_present" CHECK (length(btrim("leases"."reference")) > 0);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_ended_after_start" CHECK ("leases"."ended_on" IS NULL OR "leases"."ended_on" >= "leases"."start_date");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_signed_shape" CHECK ("leases"."status" NOT IN ('signed', 'active', 'ending', 'ended') OR "leases"."signed_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_activated_shape" CHECK ("leases"."status" NOT IN ('active', 'ending', 'ended') OR "leases"."activated_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_ending_shape" CHECK ("leases"."status" <> 'ending' OR "leases"."ending_since" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_ended_shape" CHECK (("leases"."status" = 'ended') = ("leases"."ended_on" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_cancelled_shape" CHECK (("leases"."status" = 'cancelled') = ("leases"."cancelled_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_placement_id_tenant_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."tenant_placements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- 4. Contract versions, signatures, invitations --------------------------------------------------
CREATE TABLE "lease_contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"template_version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"pdf_object_id" uuid,
	"signed_pdf_object_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_contract_versions_lease_version_uk" UNIQUE("lease_id","version"),
	CONSTRAINT "lease_contract_versions_id_hash_uk" UNIQUE("id","content_hash"),
	CONSTRAINT "lease_contract_versions_version_positive" CHECK ("lease_contract_versions"."version" >= 1),
	CONSTRAINT "lease_contract_versions_template_known" CHECK ("lease_contract_versions"."template_version" >= 0),
	CONSTRAINT "lease_contract_versions_hash_shape" CHECK ("lease_contract_versions"."content_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "lease_contract_versions" ADD CONSTRAINT "lease_contract_versions_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_contract_versions" ADD CONSTRAINT "lease_contract_versions_pdf_object_id_stored_objects_id_fk" FOREIGN KEY ("pdf_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_contract_versions" ADD CONSTRAINT "lease_contract_versions_signed_pdf_fk" FOREIGN KEY ("signed_pdf_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_contract_versions" ADD CONSTRAINT "lease_contract_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Version 1 of every lease (template version 0): the old contract_content with the lease's terms,
-- tenant and unit as they stand now, hashed as Postgres prints the JSON. The old contract PDF, if
-- any, is its PDF.
INSERT INTO "lease_contract_versions" ("lease_id", "version", "template_version", "content", "content_hash", "pdf_object_id", "created_at")
SELECT l."id", 1, 0, c.content, encode(sha256(convert_to(c.content::text, 'UTF8')), 'hex'), l."contract_object_id",
       coalesce(least(l."landlord_signed_at", l."tenant_signed_at"), l."created_at")
  FROM "leases" l
  JOIN "tenants" t ON t."id" = l."tenant_id"
  JOIN "rental_units" u ON u."id" = l."unit_id"
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'legacy', true,
      'reference', l."reference",
      'contractContent', l."contract_content",
      'unit', jsonb_build_object('label', u."label"),
      'tenant', jsonb_build_object('fullName', t."full_name", 'email', t."email", 'phone', t."phone"),
      'terms', jsonb_build_object(
        'startDate', l."start_date", 'endDate', l."end_date", 'billingStartsOn', l."billing_starts_on",
        'monthlyRentRwf', l."monthly_rent_rwf", 'depositRwf', l."deposit_rwf", 'rentDueDay', l."rent_due_day",
        'graceDays', l."grace_days", 'noticeDays', l."notice_days", 'occupants', to_jsonb(l."occupants"))
    ) AS content
  ) c;--> statement-breakpoint
UPDATE "leases" l SET "current_version_id" = v."id"
  FROM "lease_contract_versions" v WHERE v."lease_id" = l."id" AND v."version" = 1;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_current_version_id_lease_contract_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."lease_contract_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "version_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "typed_name" text;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "signature_object_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "document_hash" text;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "method" "lease_signing_method";--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD COLUMN "note" text;--> statement-breakpoint
-- Signatures already on file sign version 1, as legacy signatures; of two for one side, the
-- older is voided.
UPDATE "lease_signatures" s
   SET "version_id" = v."id", "document_hash" = v."content_hash", "method" = 'legacy',
       "note" = 'Carried over by migration 0077: signed before signatures were kept with their evidence.'
  FROM "lease_contract_versions" v
 WHERE v."lease_id" = s."lease_id" AND v."version" = 1;--> statement-breakpoint
UPDATE "lease_signatures" s
   SET "voided_at" = now(), "note" = 'Voided by migration 0077: a later signature for the same side stands.'
 WHERE EXISTS (SELECT 1 FROM "lease_signatures" o
                WHERE o."version_id" = s."version_id" AND o."signer_role" = s."signer_role"
                  AND (o."signed_at", o."id") > (s."signed_at", s."id"));--> statement-breakpoint
-- The old signed-at times become legacy signatures where no signature row stands for that side.
-- The tenant's is attributed to the tenant's account when the lease named one; the landlord's
-- to nobody, because the old times never said who signed for the business.
INSERT INTO "lease_signatures" ("lease_id", "version_id", "signer_role", "signer_user_id", "signer_email",
                                "document_hash", "method", "signed_at", "note")
SELECT l."id", v."id", side.role::"signer_role",
       CASE WHEN side.role = 'tenant' THEN t."user_id" END,
       CASE WHEN side.role = 'tenant' THEN t."email" END,
       v."content_hash", 'legacy', side.at,
       'Carried over by migration 0077 from the lease''s old ' || side.role || ' signed-at time; no evidence was kept then.'
  FROM "leases" l
  JOIN "lease_contract_versions" v ON v."lease_id" = l."id" AND v."version" = 1
  JOIN "tenants" t ON t."id" = l."tenant_id"
  CROSS JOIN LATERAL (VALUES ('landlord', l."landlord_signed_at"), ('tenant', l."tenant_signed_at")) AS side(role, at)
 WHERE side.at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "lease_signatures" s
                    WHERE s."version_id" = v."id" AND s."signer_role" = side.role::"signer_role" AND s."voided_at" IS NULL);--> statement-breakpoint
ALTER TABLE "lease_signatures" ALTER COLUMN "version_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_signatures" ALTER COLUMN "document_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_signatures" ALTER COLUMN "method" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_signature_object_id_stored_objects_id_fk" FOREIGN KEY ("signature_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_version_hash_fk" FOREIGN KEY ("version_id","document_hash") REFERENCES "public"."lease_contract_versions"("id","content_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_signatures_live_uk" ON "lease_signatures" USING btree ("version_id","signer_role") WHERE "lease_signatures"."voided_at" IS NULL;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_evidence" CHECK ("lease_signatures"."method" = 'legacy' OR ("lease_signatures"."signer_user_id" IS NOT NULL AND "lease_signatures"."typed_name" IS NOT NULL AND "lease_signatures"."verified_at" IS NOT NULL));--> statement-breakpoint
-- Invitations keep only the SHA-256 of their token (an old link still works: the API hashes what
-- it is given). One `sent` invitation per lease: older ones expire.
ALTER TABLE "lease_invitations" DROP CONSTRAINT "lease_invitations_token_uk";--> statement-breakpoint
ALTER TABLE "lease_invitations" RENAME COLUMN "token" TO "token_hash";--> statement-breakpoint
UPDATE "lease_invitations" SET "token_hash" = encode(sha256(convert_to("token_hash", 'UTF8')), 'hex');--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD COLUMN "sent_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD COLUMN "last_sent_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD COLUMN "send_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
UPDATE "lease_invitations" i
   SET "tenant_id" = l."tenant_id",
       "email" = lower(btrim(i."email")),
       "sent_at" = i."created_at",
       "last_sent_at" = greatest(i."created_at", i."updated_at"),
       "expires_at" = coalesce(i."expires_at", i."created_at" + interval '14 days'),
       "accepted_at" = CASE WHEN i."status" = 'accepted' THEN i."updated_at" END,
       "revoked_at" = CASE WHEN i."status" = 'revoked' THEN i."updated_at" END
  FROM "leases" l WHERE l."id" = i."lease_id";--> statement-breakpoint
WITH fixed AS (
  UPDATE "lease_invitations" i SET "status" = 'expired'
   WHERE i."status" = 'sent'
     AND EXISTS (SELECT 1 FROM "lease_invitations" o
                  WHERE o."lease_id" = i."lease_id" AND o."status" = 'sent'
                    AND (o."created_at", o."id") > (i."created_at", i."id"))
  RETURNING 1
) INSERT INTO "_m0077_fixes" SELECT 'older open invitation expired (one per lease)', count(*) FROM fixed;--> statement-breakpoint
ALTER TABLE "lease_invitations" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_invitations" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_invitations_live_uk" ON "lease_invitations" USING btree ("lease_id") WHERE "lease_invitations"."status" = 'sent';--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_token_hash_uk" UNIQUE("token_hash");--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_token_hash_shape" CHECK ("lease_invitations"."token_hash" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_email_lower" CHECK ("lease_invitations"."email" = lower("lease_invitations"."email"));--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_send_count_positive" CHECK ("lease_invitations"."send_count" >= 1);--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_accepted_shape" CHECK (("lease_invitations"."status" = 'accepted') = ("lease_invitations"."accepted_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_revoked_shape" CHECK (("lease_invitations"."status" = 'revoked') = ("lease_invitations"."revoked_at" IS NOT NULL));--> statement-breakpoint
-- 5. Signing codes and the timeline ---------------------------------------------------------------
CREATE TABLE "lease_signing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"signer_role" "signer_role" NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_signing_codes_attempts_range" CHECK ("lease_signing_codes"."attempts" BETWEEN 0 AND 5),
	CONSTRAINT "lease_signing_codes_email_lower" CHECK ("lease_signing_codes"."email" = lower("lease_signing_codes"."email"))
);
--> statement-breakpoint
CREATE TABLE "lease_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "lease_event_kind" NOT NULL,
	"actor_user_id" uuid,
	"actor_role" "lease_actor_role" NOT NULL,
	"visible_to_tenant" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_events_actor_shape" CHECK ("lease_events"."actor_role" = 'system' OR "lease_events"."actor_user_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "lease_signing_codes" ADD CONSTRAINT "lease_signing_codes_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signing_codes" ADD CONSTRAINT "lease_signing_codes_version_id_lease_contract_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."lease_contract_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signing_codes" ADD CONSTRAINT "lease_signing_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_events" ADD CONSTRAINT "lease_events_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_events" ADD CONSTRAINT "lease_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_events" ADD CONSTRAINT "lease_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_signing_codes_live_uk" ON "lease_signing_codes" USING btree ("lease_id","signer_role","user_id") WHERE "lease_signing_codes"."consumed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "lease_events_lease_idx" ON "lease_events" USING btree ("lease_id","occurred_at");--> statement-breakpoint
CREATE INDEX "lease_events_scope_idx" ON "lease_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
-- 6. No two live leases on one unit over overlapping days ----------------------------------------
DO $$
DECLARE r record; pairs integer := 0; fixes text;
BEGIN
  FOR r IN
    SELECT a."reference" AS ra, b."reference" AS rb, u."label" AS unit
      FROM "leases" a
      JOIN "leases" b ON b."unit_id" = a."unit_id" AND a."id" < b."id"
      JOIN "rental_units" u ON u."id" = a."unit_id"
     WHERE a."status" IN ('pending_signature', 'signed', 'active', 'ending')
       AND b."status" IN ('pending_signature', 'signed', 'active', 'ending')
       AND daterange(a."start_date", coalesce(a."ended_on", a."end_date"), '[]')
           && daterange(b."start_date", coalesce(b."ended_on", b."end_date"), '[]')
  LOOP
    pairs := pairs + 1;
    RAISE WARNING '0077: leases % and % both hold unit % over the same days', r.ra, r.rb, r.unit;
  END LOOP;
  IF pairs > 0 THEN
    RAISE EXCEPTION '0077: % pair(s) of live leases overlap on one unit (listed above). Cancel or end one of each pair, then migrate again.', pairs;
  END IF;
  SELECT string_agg(n || ' ' || what, '; ' ORDER BY what) INTO fixes FROM "_m0077_fixes" WHERE n > 0;
  RAISE NOTICE '0077: corrections: %', coalesce(fixes, 'none');
END $$;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_no_overlap" EXCLUDE USING gist (
  "unit_id" WITH =,
  daterange("start_date", coalesce("ended_on", "end_date"), '[]') WITH &&
) WHERE ("status" IN ('pending_signature', 'signed', 'active', 'ending'));--> statement-breakpoint
DROP TABLE "_m0077_fixes";
