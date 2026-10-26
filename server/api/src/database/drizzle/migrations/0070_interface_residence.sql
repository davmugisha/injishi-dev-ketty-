ALTER TYPE "public"."maintenance_category" ADD VALUE 'doors_windows';--> statement-breakpoint
ALTER TYPE "public"."maintenance_category" ADD VALUE 'decoration';--> statement-breakpoint
CREATE TABLE "lease_application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"stored_object_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_application_documents_state_known" CHECK ("lease_application_documents"."state" IN ('requested', 'waiting', 'uploaded', 'checked'))
);
--> statement-breakpoint
CREATE TABLE "lease_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"stage" text DEFAULT 'invited' NOT NULL,
	"source" text NOT NULL,
	"broker_id" uuid,
	"broker_fee_rwf" bigint,
	"broker_terms" text,
	"referred_at" timestamp with time zone,
	"desired_move_in" date,
	"term_months" integer,
	"occupants" text,
	"offered_rent_rwf" bigint,
	"deposit_rwf" bigint,
	"screening" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decline_reason" text,
	"lease_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_applications_stage_known" CHECK ("lease_applications"."stage" IN ('invited', 'screening', 'ready', 'declined', 'converted')),
	CONSTRAINT "lease_applications_converted_shape" CHECK (("lease_applications"."stage" = 'converted') = ("lease_applications"."lease_id" IS NOT NULL)),
	CONSTRAINT "lease_applications_broker_shape" CHECK ("lease_applications"."broker_id" IS NOT NULL OR ("lease_applications"."broker_fee_rwf" IS NULL AND "lease_applications"."broker_terms" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "lease_clause_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"note" text NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_clause_templates_workspace_code_uk" UNIQUE("workspace_id","code")
);
--> statement-breakpoint
CREATE TABLE "property_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_blocks_property_code_uk" UNIQUE("property_id","code")
);
--> statement-breakpoint
CREATE TABLE "rent_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"rent_charge_id" uuid NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"method" text NOT NULL,
	"provider_ref" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"recorded_by_user_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rent_payments_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "rent_payments_amount_positive" CHECK ("rent_payments"."amount_rwf" > 0),
	CONSTRAINT "rent_payments_method_known" CHECK ("rent_payments"."method" IN ('mtn_momo', 'airtel_money', 'bank_transfer', 'cash')),
	CONSTRAINT "rent_payments_status_known" CHECK ("rent_payments"."status" IN ('pending', 'verified', 'unknown', 'failed')),
	CONSTRAINT "rent_payments_verified_shape" CHECK (("rent_payments"."status" = 'verified') = ("rent_payments"."verified_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "rent_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"note" text NOT NULL,
	"sent_by_user_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "rent_reminders_channel_known" CHECK ("rent_reminders"."channel" IN ('in_app', 'in_app_email', 'email', 'call', 'letter'))
);
--> statement-breakpoint
CREATE TABLE "residence_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"block_id" uuid NOT NULL,
	"asking_rent_rwf" bigint NOT NULL,
	"vacant_since" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "residence_units_room_uk" UNIQUE("room_id"),
	CONSTRAINT "residence_units_asking_rent_positive" CHECK ("residence_units"."asking_rent_rwf" > 0)
);
--> statement-breakpoint
CREATE TABLE "visitor_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"lease_id" uuid,
	"maintenance_ticket_id" uuid,
	"kind" text DEFAULT 'guest' NOT NULL,
	"visitor_name" text NOT NULL,
	"code" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"overnight" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'expected' NOT NULL,
	"created_by_user_id" uuid,
	"by_tenant" boolean DEFAULT false NOT NULL,
	"used_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_passes_window" CHECK ("visitor_passes"."valid_to" > "visitor_passes"."valid_from"),
	CONSTRAINT "visitor_passes_code_shape" CHECK ("visitor_passes"."code" ~ '^[0-9]{4}$'),
	CONSTRAINT "visitor_passes_kind_known" CHECK ("visitor_passes"."kind" IN ('guest', 'contractor')),
	CONSTRAINT "visitor_passes_status_known" CHECK ("visitor_passes"."status" IN ('expected', 'approved', 'used', 'expired', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ALTER COLUMN "lease_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "kind" text DEFAULT 'tenant_request' NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "offer_status" text;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "offered_rent_rwf" bigint;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "term_months" integer;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "starts_on" date;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "answer_by" date;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "deposit_topup_rwf" bigint;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "other_terms" text;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "answered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "rent_due_day" integer;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "grace_days" integer;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "notice_period_days" integer;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "occupants" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "staff_may_enter" boolean;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "visit_window" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "cost_bearer" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "cost_note" text;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD COLUMN "filed_via" text;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD COLUMN "kind" text DEFAULT 'overnight' NOT NULL;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD COLUMN "visitor_name" text;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD COLUMN "to_date" date;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD COLUMN "decided_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD COLUMN "visitor_pass_id" uuid;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD COLUMN "admitted_how" text;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD COLUMN "recorded_by" text;--> statement-breakpoint
ALTER TABLE "lease_application_documents" ADD CONSTRAINT "lease_application_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_application_documents" ADD CONSTRAINT "lease_application_documents_application_id_lease_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."lease_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_application_documents" ADD CONSTRAINT "lease_application_documents_stored_object_id_stored_objects_id_fk" FOREIGN KEY ("stored_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_clause_templates" ADD CONSTRAINT "lease_clause_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_blocks" ADD CONSTRAINT "property_blocks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_blocks" ADD CONSTRAINT "property_blocks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_rent_charge_id_rent_charges_id_fk" FOREIGN KEY ("rent_charge_id") REFERENCES "public"."rent_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_reminders" ADD CONSTRAINT "rent_reminders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_reminders" ADD CONSTRAINT "rent_reminders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_reminders" ADD CONSTRAINT "rent_reminders_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_reminders" ADD CONSTRAINT "rent_reminders_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residence_units" ADD CONSTRAINT "residence_units_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residence_units" ADD CONSTRAINT "residence_units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residence_units" ADD CONSTRAINT "residence_units_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residence_units" ADD CONSTRAINT "residence_units_block_id_property_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."property_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_maintenance_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("maintenance_ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lease_application_documents_application_idx" ON "lease_application_documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "lease_applications_scope_stage_idx" ON "lease_applications" USING btree ("workspace_id","stage");--> statement-breakpoint
CREATE INDEX "rent_payments_scope_status_idx" ON "rent_payments" USING btree ("workspace_id","status","received_at");--> statement-breakpoint
CREATE INDEX "rent_payments_lease_idx" ON "rent_payments" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "rent_reminders_scope_sent_idx" ON "rent_reminders" USING btree ("workspace_id","sent_at");--> statement-breakpoint
CREATE INDEX "rent_reminders_lease_idx" ON "rent_reminders" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "residence_units_scope_idx" ON "residence_units" USING btree ("workspace_id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visitor_passes_live_code_uk" ON "visitor_passes" USING btree ("property_id","code") WHERE "visitor_passes"."status" IN ('expected', 'approved');--> statement-breakpoint
CREATE INDEX "visitor_passes_scope_status_idx" ON "visitor_passes" USING btree ("workspace_id","status","valid_from");--> statement-breakpoint
CREATE INDEX "visitor_passes_lease_idx" ON "visitor_passes" USING btree ("lease_id");--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD CONSTRAINT "visitor_access_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD CONSTRAINT "visitor_log_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD CONSTRAINT "visitor_log_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD CONSTRAINT "visitor_log_entries_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD CONSTRAINT "visitor_log_entries_visitor_pass_id_visitor_passes_id_fk" FOREIGN KEY ("visitor_pass_id") REFERENCES "public"."visitor_passes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lease_renewals_lease_idx" ON "lease_renewals" USING btree ("lease_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leases_workspace_reference_uk" ON "leases" USING btree ("workspace_id","reference") WHERE "leases"."reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "visitor_access_requests_lease_idx" ON "visitor_access_requests" USING btree ("lease_id","status");--> statement-breakpoint
CREATE INDEX "visitor_log_entries_scope_arrival_idx" ON "visitor_log_entries" USING btree ("workspace_id","arrival_at");--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_kind_known" CHECK ("lease_renewals"."kind" IN ('tenant_request', 'landlord_offer'));--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_offer_shape" CHECK ("lease_renewals"."kind" = 'tenant_request' OR ("lease_renewals"."offer_status" IN ('open', 'accepted', 'declined', 'withdrawn', 'signed')
            AND "lease_renewals"."offered_rent_rwf" > 0 AND "lease_renewals"."term_months" > 0 AND "lease_renewals"."starts_on" IS NOT NULL
            AND "lease_renewals"."requested_end_date" IS NOT NULL AND "lease_renewals"."answer_by" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_rent_due_day_in_month" CHECK ("leases"."rent_due_day" IS NULL OR "leases"."rent_due_day" BETWEEN 1 AND 28);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_terms_not_negative" CHECK (("leases"."grace_days" IS NULL OR "leases"."grace_days" >= 0) AND ("leases"."notice_period_days" IS NULL OR "leases"."notice_period_days" >= 0));--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_cost_bearer_known" CHECK ("maintenance_tickets"."cost_bearer" IS NULL OR "maintenance_tickets"."cost_bearer" IN ('landlord', 'tenant', 'to_be_decided'));--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_reason_known" CHECK ("move_out_notices"."reason_code" IS NULL OR "move_out_notices"."reason_code" IN ('kigali', 'leaving', 'own-home', 'terms', 'other'));--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_channel_known" CHECK ("move_out_notices"."filed_via" IS NULL OR "move_out_notices"."filed_via" IN ('app', 'letter', 'email', 'in_person'));--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD CONSTRAINT "visitor_access_requests_kind_known" CHECK ("visitor_access_requests"."kind" IN ('overnight', 'delivery', 'gate_entry'));--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD CONSTRAINT "visitor_access_requests_status_known" CHECK ("visitor_access_requests"."status" IN ('open', 'approved', 'declined'));--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD CONSTRAINT "visitor_access_requests_decided_shape" CHECK (("visitor_access_requests"."status" = 'open') = ("visitor_access_requests"."decided_at" IS NULL));--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD CONSTRAINT "visitor_log_entries_located" CHECK ("visitor_log_entries"."lease_id" IS NOT NULL OR "visitor_log_entries"."room_id" IS NOT NULL OR "visitor_log_entries"."property_id" IS NOT NULL);