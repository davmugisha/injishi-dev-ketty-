-- Rentals rebuild, P1 (blueprint 1.5, step 4): tenants as real records, and the lease's links to
-- its unit, tenant and property.
--
-- leases.unit_id = room_id (units kept their room's id in 0075), property_id = the room's,
-- billing_starts_on = start_date, deposit_rwf = caution_rwf. The old tenant_* text columns,
-- room_id and caution_rwf stay until 0089.
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"id_kind" "id_kind",
	"id_number" text,
	"nationality" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_name_present" CHECK (length(btrim("tenants"."full_name")) > 0),
	CONSTRAINT "tenants_email_lower" CHECK ("tenants"."email" IS NULL OR "tenants"."email" = lower("tenants"."email")),
	CONSTRAINT "tenants_phone_e164" CHECK ("tenants"."phone" IS NULL OR "tenants"."phone" ~ '^[+][1-9][0-9]{7,14}$'),
	CONSTRAINT "tenants_id_shape" CHECK (("tenants"."id_kind" IS NULL AND "tenants"."id_number" IS NULL)
        OR ("tenants"."id_kind" = 'national_id' AND "tenants"."id_number" ~ '^[0-9]{16}$')
        OR ("tenants"."id_kind" = 'passport' AND "tenants"."id_number" ~ '^[A-Z0-9]{5,20}$')),
	CONSTRAINT "tenants_nationality_shape" CHECK ("tenants"."nationality" IS NULL OR "tenants"."nationality" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "billing_starts_on" date;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "deposit_rwf" bigint;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_workspace_email_uk" ON "tenants" USING btree ("workspace_id",lower("email")) WHERE "tenants"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_workspace_user_uk" ON "tenants" USING btree ("workspace_id","user_id") WHERE "tenants"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tenants_user_idx" ON "tenants" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leases_unit_idx" ON "leases" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "leases_tenant_id_idx" ON "leases" USING btree ("tenant_id");--> statement-breakpoint
-- A unit for a lease whose room is not a residence room, so 0075 made none. None is expected;
-- such a unit is created off market, its label marked with the room id, and counted below.
INSERT INTO "rental_units" ("id", "workspace_id", "property_id", "label", "state", "created_at")
SELECT DISTINCT ON (r."id") r."id", r."workspace_id", r."property_id",
       coalesce(nullif(btrim(r."label"), ''), 'Unit') || ' (' || left(r."id"::text, 8) || ')',
       'off_market', r."created_at"
  FROM "leases" l
  JOIN "rooms" r ON r."id" = l."room_id"
 WHERE NOT EXISTS (SELECT 1 FROM "rental_units" u WHERE u."id" = r."id")
 ORDER BY r."id";--> statement-breakpoint
-- The person on each lease, from its tenant_* text and the linked account:
--   name     tenant_name, else the account's name, else "Tenant <lease id prefix>"
--   email    tenant_email, else the account's email; lower case
--   phone    tenant_phone, else the account's; spaces and dashes removed, a Rwandan 07.. or 7..
--            number given +250; anything that is still not E.164 is dropped (counted below)
--   ID       tenant_national_id without spaces or dashes: 16 digits is a national ID (nationality
--            RW), letters and digits (5 to 20, at least one letter) a passport; anything else is
--            dropped (counted below)
CREATE TEMP TABLE "_m0076_people" ON COMMIT DROP AS
SELECT l."id" AS lease_id, l."workspace_id", l."org_id", l."tenant_user_id" AS user_id,
       coalesce(nullif(btrim(l."tenant_name"), ''), nullif(btrim(u."name"), ''),
                'Tenant ' || left(l."id"::text, 8)) AS full_name,
       lower(coalesce(nullif(btrim(l."tenant_email"), ''), u."email")) AS email,
       raw.p AS raw_phone,
       CASE
         WHEN raw.p ~ '^[+][1-9][0-9]{7,14}$' THEN raw.p
         WHEN raw.p ~ '^07[0-9]{8}$' THEN '+250' || substr(raw.p, 2)
         WHEN raw.p ~ '^7[0-9]{8}$' THEN '+250' || raw.p
         WHEN raw.p ~ '^250[0-9]{9}$' THEN '+' || raw.p
       END AS phone,
       rawid.n AS raw_id,
       CASE
         WHEN rawid.n ~ '^[0-9]{16}$' THEN 'national_id'
         WHEN rawid.n ~ '^[A-Z0-9]{5,20}$' AND rawid.n ~ '[A-Z]' THEN 'passport'
       END::"id_kind" AS id_kind,
       CASE
         WHEN rawid.n ~ '^[0-9]{16}$' OR (rawid.n ~ '^[A-Z0-9]{5,20}$' AND rawid.n ~ '[A-Z]') THEN rawid.n
       END AS id_number,
       l."start_date", l."created_at"
  FROM "leases" l
  LEFT JOIN "users" u ON u."id" = l."tenant_user_id"
  CROSS JOIN LATERAL (
    SELECT regexp_replace(coalesce(nullif(btrim(l."tenant_phone"), ''), u."phone_number", ''), '[^0-9+]', '', 'g') AS p
  ) raw
  CROSS JOIN LATERAL (
    SELECT regexp_replace(upper(coalesce(l."tenant_national_id", '')), '[^A-Z0-9]', '', 'g') AS n
  ) rawid;--> statement-breakpoint
-- One tenant per person per business: leases with the same account are one person; leases with
-- the same email are one person (joined to the account holder with that email, when there is one);
-- a lease with neither is a person of its own.
CREATE TEMP TABLE "_m0076_keys" ON COMMIT DROP AS
WITH account_holders AS (
  SELECT "workspace_id", user_id,
         (array_agg(email ORDER BY "start_date" DESC NULLS LAST, "created_at" DESC, lease_id)
            FILTER (WHERE email IS NOT NULL))[1] AS email
    FROM "_m0076_people" WHERE user_id IS NOT NULL
   GROUP BY 1, 2
)
SELECT p.lease_id, p."workspace_id",
       CASE
         WHEN p.user_id IS NOT NULL THEN 'u:' || p.user_id
         WHEN p.email IS NOT NULL THEN coalesce(
           (SELECT 'u:' || a.user_id FROM account_holders a
             WHERE a."workspace_id" = p."workspace_id" AND a.email = p.email
             ORDER BY a.user_id LIMIT 1),
           'e:' || p.email)
         ELSE 'l:' || p.lease_id
       END AS person
  FROM "_m0076_people" p;--> statement-breakpoint
CREATE TEMP TABLE "_m0076_tenants" ON COMMIT DROP AS
SELECT gen_random_uuid() AS id, g.*
  FROM (
    SELECT k."workspace_id", k.person,
           (array_agg(p."org_id" ORDER BY p."created_at", p.lease_id))[1] AS org_id,
           (array_agg(p.user_id ORDER BY p."created_at", p.lease_id) FILTER (WHERE p.user_id IS NOT NULL))[1] AS user_id,
           (array_agg(p.full_name ORDER BY p."start_date" DESC NULLS LAST, p."created_at" DESC, p.lease_id))[1] AS full_name,
           (array_agg(p.email ORDER BY p."start_date" DESC NULLS LAST, p."created_at" DESC, p.lease_id)
              FILTER (WHERE p.email IS NOT NULL))[1] AS email,
           (array_agg(p.phone ORDER BY p."start_date" DESC NULLS LAST, p."created_at" DESC, p.lease_id)
              FILTER (WHERE p.phone IS NOT NULL))[1] AS phone,
           (array_agg(p.id_kind ORDER BY p."start_date" DESC NULLS LAST, p."created_at" DESC, p.lease_id)
              FILTER (WHERE p.id_number IS NOT NULL))[1] AS id_kind,
           (array_agg(p.id_number ORDER BY p."start_date" DESC NULLS LAST, p."created_at" DESC, p.lease_id)
              FILTER (WHERE p.id_number IS NOT NULL))[1] AS id_number,
           min(p."created_at") AS created_at
      FROM "_m0076_keys" k
      JOIN "_m0076_people" p USING (lease_id)
     GROUP BY k."workspace_id", k.person
  ) g;--> statement-breakpoint
-- An email two different account holders' leases carried stays with the first of them only.
UPDATE "_m0076_tenants" t SET email = NULL
 WHERE t.email IS NOT NULL
   AND EXISTS (SELECT 1 FROM "_m0076_tenants" o
                WHERE o."workspace_id" = t."workspace_id" AND o.email = t.email
                  AND (o.created_at, o.id) < (t.created_at, t.id));--> statement-breakpoint
INSERT INTO "tenants" ("id", "workspace_id", "org_id", "user_id", "full_name", "email", "phone",
                       "id_kind", "id_number", "nationality", "created_at")
SELECT id, "workspace_id", org_id, user_id, full_name, email, phone, id_kind, id_number,
       CASE WHEN id_kind = 'national_id' THEN 'RW' END, created_at
  FROM "_m0076_tenants";--> statement-breakpoint
UPDATE "leases" l
   SET "tenant_id" = t.id
  FROM "_m0076_keys" k
  JOIN "_m0076_tenants" t ON t."workspace_id" = k."workspace_id" AND t.person = k.person
 WHERE k.lease_id = l."id";--> statement-breakpoint
UPDATE "leases" l
   SET "unit_id" = l."room_id",
       "property_id" = r."property_id",
       "billing_starts_on" = l."start_date",
       "deposit_rwf" = greatest(coalesce(l."caution_rwf", 0), 0)
  FROM "rooms" r
 WHERE r."id" = l."room_id";--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "unit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "deposit_rwf" SET NOT NULL;--> statement-breakpoint
-- A tenant is reached by email or phone. Old lease text sometimes held neither, and inventing a
-- contact would be worse, so the rule is added NOT VALID: it binds every new row and every change
-- to an old one, and is validated outright when no carried-over row breaks it.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_contact_present" CHECK ("tenants"."email" IS NOT NULL OR "tenants"."phone" IS NOT NULL) NOT VALID;--> statement-breakpoint
DO $$
DECLARE
  n_tenants integer; n_linked integer; n_no_contact integer; n_bad_phone integer; n_bad_id integer;
  n_odd_units integer; n_email_dupes integer;
BEGIN
  SELECT count(*) INTO n_tenants FROM "tenants";
  SELECT count(*) INTO n_linked FROM "tenants" WHERE "user_id" IS NOT NULL;
  SELECT count(*) INTO n_no_contact FROM "tenants" WHERE "email" IS NULL AND "phone" IS NULL;
  SELECT count(*) INTO n_bad_phone FROM "_m0076_people" WHERE raw_phone <> '' AND phone IS NULL;
  SELECT count(*) INTO n_bad_id FROM "_m0076_people" WHERE raw_id <> '' AND id_number IS NULL;
  SELECT count(*) INTO n_odd_units FROM "rental_units" WHERE "label" ~ ' [(][0-9a-f]{8}[)]$';
  SELECT count(*) INTO n_email_dupes FROM "_m0076_tenants" t
   WHERE t.email IS NULL AND EXISTS (SELECT 1 FROM "_m0076_keys" k JOIN "_m0076_people" p USING (lease_id)
                                       WHERE k.person = t.person AND k."workspace_id" = t."workspace_id" AND p.email IS NOT NULL);
  IF n_no_contact = 0 THEN
    ALTER TABLE "tenants" VALIDATE CONSTRAINT "tenants_contact_present";
  END IF;
  RAISE NOTICE '0076: % tenant(s), % linked to an account; % with neither email nor phone (rule left NOT VALID for them); % phone(s) and % ID number(s) not usable and left out; % email(s) shared by two account holders kept on the first; % unit(s) made for leases on non-residence rooms',
    n_tenants, n_linked, n_no_contact, n_bad_phone, n_bad_id, n_email_dupes, n_odd_units;
END $$;--> statement-breakpoint
DROP TABLE "_m0076_tenants";--> statement-breakpoint
DROP TABLE "_m0076_keys";--> statement-breakpoint
DROP TABLE "_m0076_people";
