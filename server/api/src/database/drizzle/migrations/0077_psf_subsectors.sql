-- A SECTOR'S SUBTYPES (2026-10-20): the PSF form asks Sector, then Subtype,
-- then Association. Services is Hospitality, Tourism, Transport, Finance…, and
-- the association list follows the subtype through psf_subsector_associations.
--
-- A subtype with no district_id is national: a national PSF officer sets it and
-- every business is offered it. One with a district_id was added by an officer
-- of that district or its province, and is offered only to businesses there.
-- A business on neither list types its own (orgs.psf_subsector_other).
--
-- Seeded below: the national subtypes PSF's own sector descriptions name, each
-- linked to the associations already in the catalogue, and every business that
-- names an association given the subtype that association sits under.
CREATE TABLE "psf_subsector_associations" (
	"subsector_id" uuid NOT NULL,
	"association_code" text NOT NULL,
	CONSTRAINT "psf_subsector_associations_subsector_id_association_code_pk" PRIMARY KEY("subsector_id","association_code")
);
--> statement-breakpoint
CREATE TABLE "psf_subsectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_code" text NOT NULL,
	"name_en" text NOT NULL,
	"district_id" integer,
	"sort_order" smallint DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "psf_subsector_id" uuid;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "psf_subsector_other" text;--> statement-breakpoint
ALTER TABLE "psf_subsector_associations" ADD CONSTRAINT "psf_subsector_associations_subsector_id_psf_subsectors_id_fk" FOREIGN KEY ("subsector_id") REFERENCES "public"."psf_subsectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_subsector_associations" ADD CONSTRAINT "psf_subsector_associations_association_code_psf_associations_code_fk" FOREIGN KEY ("association_code") REFERENCES "public"."psf_associations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_subsectors" ADD CONSTRAINT "psf_subsectors_cluster_code_psf_clusters_code_fk" FOREIGN KEY ("cluster_code") REFERENCES "public"."psf_clusters"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_subsectors" ADD CONSTRAINT "psf_subsectors_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_subsectors" ADD CONSTRAINT "psf_subsectors_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_subsectors" ADD CONSTRAINT "psf_subsectors_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "psf_subsectors_cluster_idx" ON "psf_subsectors" USING btree ("cluster_code");--> statement-breakpoint
CREATE UNIQUE INDEX "psf_subsectors_name_uk" ON "psf_subsectors" USING btree ("cluster_code",lower("name_en"),coalesce("district_id", 0));--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_psf_subsector_id_psf_subsectors_id_fk" FOREIGN KEY ("psf_subsector_id") REFERENCES "public"."psf_subsectors"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "psf_subsectors" ("cluster_code", "name_en", "sort_order") VALUES
  ('agriculture', 'Crops and coffee', 10),
  ('agriculture', 'Poultry', 20),
  ('agriculture', 'Livestock', 30),
  ('industry', 'Manufacturing', 10),
  ('industry', 'Food and drink processing', 20),
  ('industry', 'Mining and energy', 30),
  ('industry', 'Construction', 40),
  ('industry', 'Textiles, leather and crafts', 50),
  ('industry', 'Metal, wood and printing', 60),
  ('trade', 'Wholesale and retail', 10),
  ('trade', 'Motor vehicles', 20),
  ('trade', 'Pharmacy', 30),
  ('trade', 'Fuel and energy products', 40),
  ('trade', 'Produce and raw materials', 50),
  ('trade', 'Cross-border trade', 60),
  ('services', 'Hospitality', 10),
  ('services', 'Tourism', 20),
  ('services', 'Transport and logistics', 30),
  ('services', 'Finance', 40),
  ('services', 'Health', 50),
  ('services', 'ICT', 60),
  ('services', 'Professional services', 70),
  ('services', 'Garages and repair', 80)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "psf_subsector_associations" ("subsector_id", "association_code")
SELECT s.id, x.code
  FROM (VALUES
    ('agriculture', 'Crops and coffee', 'coffee_cooperatives'),
    ('agriculture', 'Poultry', 'poultry'),
    ('agriculture', 'Livestock', 'pig_farmers'),
    ('industry', 'Manufacturing', 'ram'),
    ('industry', 'Food and drink processing', 'approjubar'),
    ('industry', 'Food and drink processing', 'ammirwa'),
    ('industry', 'Food and drink processing', 'rfma'),
    ('industry', 'Food and drink processing', 'acper'),
    ('industry', 'Mining and energy', 'rma'),
    ('industry', 'Mining and energy', 'epd'),
    ('industry', 'Construction', 'icar'),
    ('industry', 'Textiles, leather and crafts', 'rta'),
    ('industry', 'Textiles, leather and crafts', 'raprolep'),
    ('industry', 'Textiles, leather and crafts', 'rapesh'),
    ('industry', 'Metal, wood and printing', 'apromet'),
    ('industry', 'Metal, wood and printing', 'rwvca'),
    ('industry', 'Metal, wood and printing', 'apior'),
    ('trade', 'Wholesale and retail', 'acgdr'),
    ('trade', 'Motor vehicles', 'automobile_dealers'),
    ('trade', 'Pharmacy', 'appor'),
    ('trade', 'Fuel and energy products', 'asimper'),
    ('trade', 'Produce and raw materials', 'hides_skins'),
    ('trade', 'Produce and raw materials', 'onion_traders'),
    ('trade', 'Cross-border trade', 'actr'),
    ('services', 'Hospitality', 'rha'),
    ('services', 'Hospitality', 'rhtea'),
    ('services', 'Tourism', 'rtta'),
    ('services', 'Tourism', 'rata'),
    ('services', 'Tourism', 'rsga'),
    ('services', 'Tourism', 'community_tourism'),
    ('services', 'Tourism', 'rhtea'),
    ('services', 'Transport and logistics', 'artr'),
    ('services', 'Transport and logistics', 'atpr'),
    ('services', 'Transport and logistics', 'rwaffa'),
    ('services', 'Finance', 'rba'),
    ('services', 'Finance', 'amir'),
    ('services', 'Finance', 'forex_bureaus'),
    ('services', 'Health', 'medical_facilities'),
    ('services', 'ICT', 'ict_chamber'),
    ('services', 'Professional services', 'bar_association'),
    ('services', 'Garages and repair', 'rga')
  ) AS x(cluster, name, code)
  JOIN "psf_subsectors" s ON s.cluster_code = x.cluster AND s.name_en = x.name AND s.district_id IS NULL
  JOIN "psf_associations" a ON a.code = x.code
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Every business that names an association takes the first national subtype
-- that association sits under (the catch-all `*_other` associations sit under
-- none: those businesses type their subtype), so a report by subtype starts complete.
UPDATE "orgs" o SET "psf_subsector_id" = (
  SELECT s.id FROM "psf_subsector_associations" l
    JOIN "psf_subsectors" s ON s.id = l.subsector_id AND s.district_id IS NULL
   WHERE l.association_code = o.psf_association_code
   ORDER BY s.sort_order LIMIT 1
) WHERE o.psf_association_code IS NOT NULL AND o.psf_subsector_id IS NULL;
