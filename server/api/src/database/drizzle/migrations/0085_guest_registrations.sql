-- Guests and local leaders, P5 (blueprint 1.5, step 15): guest registrations and their routes.
--
-- countries and guest_relationships are the reference lists the guest form offers, seeded here so
-- every database has them after migrating (scripts/reference-data.mjs keeps them current).
-- guest_registrations is one guest staying in a rented home, filed by the tenant (for their lease)
-- or the landlord (their own guest at a building), with where the home was down to the village.
-- guest_registration_routes is one row per step of the leader chain; assignment_id stays null while
-- nobody holds the post (the step waits). guest_purge_tallies keeps counts of what the 12 month
-- purge removed. DGIE joins the government bodies for the district immigration officer.
--
-- The recipient_role check compares `::text`: the leader roles are added to oversight_role by 0084
-- in the same run (see 0084's header).
CREATE TYPE "public"."guest_host_kind" AS ENUM('tenant', 'landlord');--> statement-breakpoint
CREATE TYPE "public"."guest_registration_status" AS ENUM('submitted', 'cancelled');--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "countries_code_shape" CHECK ("countries"."code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "guest_purge_tallies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"arrival_month" date NOT NULL,
	"village_id" integer,
	"cell_id" integer,
	"sector_id" integer,
	"district_id" integer,
	"from_abroad" boolean NOT NULL,
	"registrations" integer NOT NULL,
	"flagged" integer NOT NULL,
	CONSTRAINT "guest_purge_tallies_counts" CHECK ("guest_purge_tallies"."registrations" > 0 AND "guest_purge_tallies"."flagged" BETWEEN 0 AND "guest_purge_tallies"."registrations")
);
--> statement-breakpoint
CREATE TABLE "guest_registration_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"step" smallint NOT NULL,
	"recipient_role" "oversight_role" NOT NULL,
	"village_id" integer,
	"cell_id" integer,
	"sector_id" integer,
	"district_id" integer,
	"assignment_id" uuid,
	"delivered_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"seen_by_user_id" uuid,
	"flagged_at" timestamp with time zone,
	"flagged_by_user_id" uuid,
	"flag_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_registration_routes_role" CHECK ("guest_registration_routes"."recipient_role"::text IN ('village_leader', 'dasso', 'cell_executive', 'district_officer', 'district_immigration')),
	CONSTRAINT "guest_registration_routes_step" CHECK ("guest_registration_routes"."step" BETWEEN 1 AND 4),
	CONSTRAINT "guest_registration_routes_delivered" CHECK (("guest_registration_routes"."assignment_id" IS NULL) = ("guest_registration_routes"."delivered_at" IS NULL)),
	CONSTRAINT "guest_registration_routes_seen" CHECK (("guest_registration_routes"."seen_at" IS NULL) = ("guest_registration_routes"."seen_by_user_id" IS NULL)),
	CONSTRAINT "guest_registration_routes_flag" CHECK (("guest_registration_routes"."flagged_at" IS NULL) = ("guest_registration_routes"."flag_note" IS NULL) AND ("guest_registration_routes"."flagged_at" IS NULL) = ("guest_registration_routes"."flagged_by_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "guest_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"host_kind" "guest_host_kind" NOT NULL,
	"lease_id" uuid,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"registered_by_user_id" uuid NOT NULL,
	"village_id" integer,
	"cell_id" integer,
	"sector_id" integer,
	"district_id" integer,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"nationality" text NOT NULL,
	"id_kind" "id_kind",
	"id_number" text,
	"relationship" text NOT NULL,
	"relationship_other" text,
	"origin_country" text NOT NULL,
	"origin_village_id" integer,
	"arrival_on" date NOT NULL,
	"departure_on" date NOT NULL,
	"status" "guest_registration_status" DEFAULT 'submitted' NOT NULL,
	"changed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_registrations_host_shape" CHECK (("guest_registrations"."host_kind" = 'tenant' AND "guest_registrations"."lease_id" IS NOT NULL) OR ("guest_registrations"."host_kind" = 'landlord' AND "guest_registrations"."lease_id" IS NULL)),
	CONSTRAINT "guest_registrations_area_shape" CHECK (("guest_registrations"."village_id" IS NULL OR "guest_registrations"."cell_id" IS NOT NULL)
          AND ("guest_registrations"."cell_id" IS NULL OR "guest_registrations"."sector_id" IS NOT NULL)
          AND ("guest_registrations"."sector_id" IS NULL OR "guest_registrations"."district_id" IS NOT NULL)),
	CONSTRAINT "guest_registrations_name_present" CHECK (length(btrim("guest_registrations"."full_name")) > 1),
	CONSTRAINT "guest_registrations_phone_e164" CHECK ("guest_registrations"."phone" ~ '^[+][1-9][0-9]{7,14}$'),
	CONSTRAINT "guest_registrations_id_shape" CHECK (("guest_registrations"."id_kind" IS NULL AND "guest_registrations"."id_number" IS NULL)
          OR ("guest_registrations"."id_kind" = 'national_id' AND "guest_registrations"."id_number" ~ '^[0-9]{16}$')
          OR ("guest_registrations"."id_kind" = 'passport' AND "guest_registrations"."id_number" ~ '^[A-Z0-9]{5,20}$')),
	CONSTRAINT "guest_registrations_relationship_other" CHECK ("guest_registrations"."relationship_other" IS NULL OR length(btrim("guest_registrations"."relationship_other")) >= 2),
	CONSTRAINT "guest_registrations_origin_shape" CHECK (("guest_registrations"."origin_country" = 'RW') = ("guest_registrations"."origin_village_id" IS NOT NULL)),
	CONSTRAINT "guest_registrations_dates" CHECK ("guest_registrations"."departure_on" >= "guest_registrations"."arrival_on" AND "guest_registrations"."departure_on" - "guest_registrations"."arrival_on" <= 90),
	CONSTRAINT "guest_registrations_cancelled_shape" CHECK (("guest_registrations"."status" = 'cancelled') = ("guest_registrations"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "guest_relationships" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"needs_detail" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_purge_tallies" ADD CONSTRAINT "guest_purge_tallies_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_purge_tallies" ADD CONSTRAINT "guest_purge_tallies_cell_id_cells_id_fk" FOREIGN KEY ("cell_id") REFERENCES "public"."cells"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_purge_tallies" ADD CONSTRAINT "guest_purge_tallies_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_purge_tallies" ADD CONSTRAINT "guest_purge_tallies_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_registration_id_guest_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."guest_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_cell_id_cells_id_fk" FOREIGN KEY ("cell_id") REFERENCES "public"."cells"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_assignment_id_oversight_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."oversight_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_seen_by_user_id_users_id_fk" FOREIGN KEY ("seen_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registration_routes" ADD CONSTRAINT "guest_registration_routes_flagged_by_user_id_users_id_fk" FOREIGN KEY ("flagged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_cell_id_cells_id_fk" FOREIGN KEY ("cell_id") REFERENCES "public"."cells"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_nationality_countries_code_fk" FOREIGN KEY ("nationality") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_relationship_guest_relationships_code_fk" FOREIGN KEY ("relationship") REFERENCES "public"."guest_relationships"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_origin_country_countries_code_fk" FOREIGN KEY ("origin_country") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_origin_village_id_villages_id_fk" FOREIGN KEY ("origin_village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_purge_tallies_district_idx" ON "guest_purge_tallies" USING btree ("district_id","arrival_month");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_registration_routes_role_uk" ON "guest_registration_routes" USING btree ("registration_id","recipient_role");--> statement-breakpoint
CREATE INDEX "guest_registration_routes_waiting_idx" ON "guest_registration_routes" USING btree ("recipient_role","district_id","sector_id","cell_id","village_id") WHERE "guest_registration_routes"."assignment_id" IS NULL;--> statement-breakpoint
CREATE INDEX "guest_registration_routes_assignment_idx" ON "guest_registration_routes" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "guest_registrations_host_idx" ON "guest_registrations" USING btree ("workspace_id","host_kind","arrival_on");--> statement-breakpoint
CREATE INDEX "guest_registrations_lease_idx" ON "guest_registrations" USING btree ("lease_id") WHERE "guest_registrations"."lease_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "guest_registrations_property_idx" ON "guest_registrations" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "guest_registrations_district_idx" ON "guest_registrations" USING btree ("district_id","arrival_on");--> statement-breakpoint
CREATE INDEX "guest_registrations_sector_idx" ON "guest_registrations" USING btree ("sector_id","arrival_on");--> statement-breakpoint
CREATE INDEX "guest_registrations_cell_idx" ON "guest_registrations" USING btree ("cell_id","arrival_on");--> statement-breakpoint
CREATE INDEX "guest_registrations_village_idx" ON "guest_registrations" USING btree ("village_id","arrival_on");--> statement-breakpoint
CREATE INDEX "guest_registrations_departure_idx" ON "guest_registrations" USING btree ("departure_on");
--> statement-breakpoint
-- Reference data. Countries are contracts' COUNTRY_NAMES (ISO 3166-1 alpha-2, the list the
-- country picker offers), Rwanda first. guests.spec keeps the two lists equal.
INSERT INTO "countries" ("code", "name", "sort_order") VALUES
	('AF', 'Afghanistan', 100),
	('AX', 'Åland Islands', 100),
	('AL', 'Albania', 100),
	('DZ', 'Algeria', 100),
	('AS', 'American Samoa', 100),
	('AD', 'Andorra', 100),
	('AO', 'Angola', 100),
	('AI', 'Anguilla', 100),
	('AQ', 'Antarctica', 100),
	('AG', 'Antigua and Barbuda', 100),
	('AR', 'Argentina', 100),
	('AM', 'Armenia', 100),
	('AW', 'Aruba', 100),
	('AU', 'Australia', 100),
	('AT', 'Austria', 100),
	('AZ', 'Azerbaijan', 100),
	('BS', 'Bahamas', 100),
	('BH', 'Bahrain', 100),
	('BD', 'Bangladesh', 100),
	('BB', 'Barbados', 100),
	('BY', 'Belarus', 100),
	('BE', 'Belgium', 100),
	('BZ', 'Belize', 100),
	('BJ', 'Benin', 100),
	('BM', 'Bermuda', 100),
	('BT', 'Bhutan', 100),
	('BO', 'Bolivia', 100),
	('BQ', 'Bonaire, Sint Eustatius and Saba', 100),
	('BA', 'Bosnia and Herzegovina', 100),
	('BW', 'Botswana', 100),
	('BV', 'Bouvet Island', 100),
	('BR', 'Brazil', 100),
	('IO', 'British Indian Ocean Territory', 100),
	('BN', 'Brunei Darussalam', 100),
	('BG', 'Bulgaria', 100),
	('BF', 'Burkina Faso', 100),
	('BI', 'Burundi', 100),
	('CV', 'Cabo Verde', 100),
	('KH', 'Cambodia', 100),
	('CM', 'Cameroon', 100),
	('CA', 'Canada', 100),
	('KY', 'Cayman Islands', 100),
	('CF', 'Central African Republic', 100),
	('TD', 'Chad', 100),
	('CL', 'Chile', 100),
	('CN', 'China', 100),
	('CX', 'Christmas Island', 100),
	('CC', 'Cocos (Keeling) Islands', 100),
	('CO', 'Colombia', 100),
	('KM', 'Comoros', 100),
	('CG', 'Congo', 100),
	('CD', 'Congo, Democratic Republic of the', 100),
	('CK', 'Cook Islands', 100),
	('CR', 'Costa Rica', 100),
	('CI', 'Côte d''Ivoire', 100),
	('HR', 'Croatia', 100),
	('CU', 'Cuba', 100),
	('CW', 'Curaçao', 100),
	('CY', 'Cyprus', 100),
	('CZ', 'Czechia', 100),
	('DK', 'Denmark', 100),
	('DJ', 'Djibouti', 100),
	('DM', 'Dominica', 100),
	('DO', 'Dominican Republic', 100),
	('EC', 'Ecuador', 100),
	('EG', 'Egypt', 100),
	('SV', 'El Salvador', 100),
	('GQ', 'Equatorial Guinea', 100),
	('ER', 'Eritrea', 100),
	('EE', 'Estonia', 100),
	('SZ', 'Eswatini', 100),
	('ET', 'Ethiopia', 100),
	('FK', 'Falkland Islands', 100),
	('FO', 'Faroe Islands', 100),
	('FJ', 'Fiji', 100),
	('FI', 'Finland', 100),
	('FR', 'France', 100),
	('GF', 'French Guiana', 100),
	('PF', 'French Polynesia', 100),
	('TF', 'French Southern Territories', 100),
	('GA', 'Gabon', 100),
	('GM', 'Gambia', 100),
	('GE', 'Georgia', 100),
	('DE', 'Germany', 100),
	('GH', 'Ghana', 100),
	('GI', 'Gibraltar', 100),
	('GR', 'Greece', 100),
	('GL', 'Greenland', 100),
	('GD', 'Grenada', 100),
	('GP', 'Guadeloupe', 100),
	('GU', 'Guam', 100),
	('GT', 'Guatemala', 100),
	('GG', 'Guernsey', 100),
	('GN', 'Guinea', 100),
	('GW', 'Guinea-Bissau', 100),
	('GY', 'Guyana', 100),
	('HT', 'Haiti', 100),
	('HM', 'Heard Island and McDonald Islands', 100),
	('VA', 'Holy See', 100),
	('HN', 'Honduras', 100),
	('HK', 'Hong Kong', 100),
	('HU', 'Hungary', 100),
	('IS', 'Iceland', 100),
	('IN', 'India', 100),
	('ID', 'Indonesia', 100),
	('IR', 'Iran', 100),
	('IQ', 'Iraq', 100),
	('IE', 'Ireland', 100),
	('IM', 'Isle of Man', 100),
	('IL', 'Israel', 100),
	('IT', 'Italy', 100),
	('JM', 'Jamaica', 100),
	('JP', 'Japan', 100),
	('JE', 'Jersey', 100),
	('JO', 'Jordan', 100),
	('KZ', 'Kazakhstan', 100),
	('KE', 'Kenya', 100),
	('KI', 'Kiribati', 100),
	('KP', 'Korea, Democratic People''s Republic of', 100),
	('KR', 'Korea, Republic of', 100),
	('KW', 'Kuwait', 100),
	('KG', 'Kyrgyzstan', 100),
	('LA', 'Lao People''s Democratic Republic', 100),
	('LV', 'Latvia', 100),
	('LB', 'Lebanon', 100),
	('LS', 'Lesotho', 100),
	('LR', 'Liberia', 100),
	('LY', 'Libya', 100),
	('LI', 'Liechtenstein', 100),
	('LT', 'Lithuania', 100),
	('LU', 'Luxembourg', 100),
	('MO', 'Macao', 100),
	('MG', 'Madagascar', 100),
	('MW', 'Malawi', 100),
	('MY', 'Malaysia', 100),
	('MV', 'Maldives', 100),
	('ML', 'Mali', 100),
	('MT', 'Malta', 100),
	('MH', 'Marshall Islands', 100),
	('MQ', 'Martinique', 100),
	('MR', 'Mauritania', 100),
	('MU', 'Mauritius', 100),
	('YT', 'Mayotte', 100),
	('MX', 'Mexico', 100),
	('FM', 'Micronesia', 100),
	('MD', 'Moldova', 100),
	('MC', 'Monaco', 100),
	('MN', 'Mongolia', 100),
	('ME', 'Montenegro', 100),
	('MS', 'Montserrat', 100),
	('MA', 'Morocco', 100),
	('MZ', 'Mozambique', 100),
	('MM', 'Myanmar', 100),
	('NA', 'Namibia', 100),
	('NR', 'Nauru', 100),
	('NP', 'Nepal', 100),
	('NL', 'Netherlands', 100),
	('NC', 'New Caledonia', 100),
	('NZ', 'New Zealand', 100),
	('NI', 'Nicaragua', 100),
	('NE', 'Niger', 100),
	('NG', 'Nigeria', 100),
	('NU', 'Niue', 100),
	('NF', 'Norfolk Island', 100),
	('MK', 'North Macedonia', 100),
	('MP', 'Northern Mariana Islands', 100),
	('NO', 'Norway', 100),
	('OM', 'Oman', 100),
	('PK', 'Pakistan', 100),
	('PW', 'Palau', 100),
	('PS', 'Palestine, State of', 100),
	('PA', 'Panama', 100),
	('PG', 'Papua New Guinea', 100),
	('PY', 'Paraguay', 100),
	('PE', 'Peru', 100),
	('PH', 'Philippines', 100),
	('PN', 'Pitcairn', 100),
	('PL', 'Poland', 100),
	('PT', 'Portugal', 100),
	('PR', 'Puerto Rico', 100),
	('QA', 'Qatar', 100),
	('RE', 'Réunion', 100),
	('RO', 'Romania', 100),
	('RU', 'Russian Federation', 100),
	('RW', 'Rwanda', 0),
	('BL', 'Saint Barthélemy', 100),
	('SH', 'Saint Helena, Ascension and Tristan da Cunha', 100),
	('KN', 'Saint Kitts and Nevis', 100),
	('LC', 'Saint Lucia', 100),
	('MF', 'Saint Martin (French part)', 100),
	('PM', 'Saint Pierre and Miquelon', 100),
	('VC', 'Saint Vincent and the Grenadines', 100),
	('WS', 'Samoa', 100),
	('SM', 'San Marino', 100),
	('ST', 'Sao Tome and Principe', 100),
	('SA', 'Saudi Arabia', 100),
	('SN', 'Senegal', 100),
	('RS', 'Serbia', 100),
	('SC', 'Seychelles', 100),
	('SL', 'Sierra Leone', 100),
	('SG', 'Singapore', 100),
	('SX', 'Sint Maarten (Dutch part)', 100),
	('SK', 'Slovakia', 100),
	('SI', 'Slovenia', 100),
	('SB', 'Solomon Islands', 100),
	('SO', 'Somalia', 100),
	('ZA', 'South Africa', 100),
	('GS', 'South Georgia and the South Sandwich Islands', 100),
	('SS', 'South Sudan', 100),
	('ES', 'Spain', 100),
	('LK', 'Sri Lanka', 100),
	('SD', 'Sudan', 100),
	('SR', 'Suriname', 100),
	('SJ', 'Svalbard and Jan Mayen', 100),
	('SE', 'Sweden', 100),
	('CH', 'Switzerland', 100),
	('SY', 'Syrian Arab Republic', 100),
	('TW', 'Taiwan', 100),
	('TJ', 'Tajikistan', 100),
	('TZ', 'Tanzania', 100),
	('TH', 'Thailand', 100),
	('TL', 'Timor-Leste', 100),
	('TG', 'Togo', 100),
	('TK', 'Tokelau', 100),
	('TO', 'Tonga', 100),
	('TT', 'Trinidad and Tobago', 100),
	('TN', 'Tunisia', 100),
	('TR', 'Türkiye', 100),
	('TM', 'Turkmenistan', 100),
	('TC', 'Turks and Caicos Islands', 100),
	('TV', 'Tuvalu', 100),
	('UG', 'Uganda', 100),
	('UA', 'Ukraine', 100),
	('AE', 'United Arab Emirates', 100),
	('GB', 'United Kingdom', 100),
	('UM', 'United States Minor Outlying Islands', 100),
	('US', 'United States of America', 100),
	('UY', 'Uruguay', 100),
	('UZ', 'Uzbekistan', 100),
	('VU', 'Vanuatu', 100),
	('VE', 'Venezuela', 100),
	('VN', 'Viet Nam', 100),
	('VG', 'Virgin Islands (British)', 100),
	('VI', 'Virgin Islands (U.S.)', 100),
	('WF', 'Wallis and Futuna', 100),
	('EH', 'Western Sahara', 100),
	('YE', 'Yemen', 100),
	('ZM', 'Zambia', 100),
	('ZW', 'Zimbabwe', 100)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- Who a guest is to the host, in the order a form offers them (contracts GUEST_RELATIONSHIPS).
INSERT INTO "guest_relationships" ("code", "label", "sort_order", "needs_detail") VALUES
	('father', 'Father', 10, false),
	('mother', 'Mother', 20, false),
	('sibling', 'Brother or sister', 30, false),
	('spouse', 'Husband or wife', 40, false),
	('partner', 'Partner', 50, false),
	('child', 'Son or daughter', 60, false),
	('grandparent', 'Grandparent', 70, false),
	('grandchild', 'Grandchild', 80, false),
	('uncle', 'Uncle', 90, false),
	('aunt', 'Aunt', 100, false),
	('cousin', 'Cousin', 110, false),
	('nephew_niece', 'Nephew or niece', 120, false),
	('in_law', 'In-law', 130, false),
	('guardian', 'Guardian', 140, false),
	('friend', 'Friend', 150, false),
	('colleague', 'Colleague', 160, false),
	('other', 'Other', 170, true)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- The immigration directorate a district immigration officer is appointed under.
INSERT INTO "government_bodies" ("code", "name_en", "name_rw", "abbreviation", "active")
VALUES ('DGIE', 'Directorate General of Immigration and Emigration', 'Ubuyobozi Bukuru bw''Abinjira n''Abasohoka', 'DGIE', true)
ON CONFLICT ("code") DO NOTHING;
