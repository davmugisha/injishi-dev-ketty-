CREATE TYPE "public"."room_service_flag" AS ENUM('dnd', 'make_up_room');--> statement-breakpoint
CREATE TYPE "public"."maintenance_event_kind" AS ENUM('reported', 'assigned', 'block_requested', 'block_approved', 'block_declined', 'block_released', 'parts', 'scheduled', 'started', 'note', 'next_step', 'fixed', 'verified', 'from_signal', 'planned');--> statement-breakpoint
CREATE TYPE "public"."condition_signal_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."condition_signal_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."found_item_category" AS ENUM('electronics', 'jewellery', 'clothing', 'accessories', 'documents', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."found_item_event_kind" AS ENUM('found', 'handed_over', 'stored', 'logged', 'claim_opened', 'verified', 'returned', 'disposal_proposed', 'disposal_approved', 'retention_extended', 'note');--> statement-breakpoint
CREATE TYPE "public"."found_item_release_method" AS ENUM('in_person', 'authorised_person', 'courier');--> statement-breakpoint
CREATE TYPE "public"."found_item_status" AS ENUM('stored', 'claimed', 'returned', 'disposal_pending', 'disposed');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_allocation_role" AS ENUM('attendant', 'supervisor');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_escalation_kind" AS ENUM('not_started', 'awaiting_inspection');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_escalation_level" AS ENUM('supervisor', 'manager');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_rule_code" AS ENUM('checkout', 'stayover', 'inspection', 'turndown', 'deep_clean');--> statement-breakpoint
CREATE TYPE "public"."maintenance_part_state" AS ENUM('requested', 'ordered', 'issued', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."room_block_status" AS ENUM('requested', 'active', 'declined', 'released');--> statement-breakpoint
CREATE TYPE "public"."room_event_kind" AS ENUM('housekeeping', 'inventory', 'occupancy', 'task_assigned', 'task_created', 'inspection_failed', 'escalation', 'fault_reported', 'block');--> statement-breakpoint
ALTER TYPE "public"."housekeeping_task_status" ADD VALUE 'failed';--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"space_id" uuid,
	"name" text NOT NULL,
	"kind" text,
	"model" text,
	"installed_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "condition_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"asset_id" uuid,
	"asset_label" text NOT NULL,
	"rule_code" text NOT NULL,
	"rule_text" text NOT NULL,
	"headline" text NOT NULL,
	"confidence" "condition_signal_confidence" NOT NULL,
	"evidence" jsonb NOT NULL,
	"data_quality" text NOT NULL,
	"recommendation" text NOT NULL,
	"draft" jsonb,
	"status" "condition_signal_status" DEFAULT 'open' NOT NULL,
	"work_order_id" uuid,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "found_item_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"found_item_id" uuid NOT NULL,
	"kind" "found_item_event_kind" NOT NULL,
	"summary" text NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text,
	"detail" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "found_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"description" text NOT NULL,
	"category" "found_item_category" NOT NULL,
	"valuable" boolean DEFAULT false NOT NULL,
	"found_location" text NOT NULL,
	"found_spot" text,
	"room_id" uuid,
	"found_at" timestamp with time zone NOT NULL,
	"found_by_user_id" uuid,
	"found_by_name" text NOT NULL,
	"custodian_user_id" uuid,
	"storage_location" text,
	"photo_count" smallint DEFAULT 0 NOT NULL,
	"status" "found_item_status" DEFAULT 'stored' NOT NULL,
	"retention_until" date NOT NULL,
	"retention_note" text,
	"claimant_name" text,
	"claim_booking_reference" text,
	"claim_booking_id" uuid,
	"claim_statement" text,
	"claim_matched" boolean,
	"claim_match_note" text,
	"claim_opened_at" timestamp with time zone,
	"claim_opened_by_user_id" uuid,
	"release_method" "found_item_release_method",
	"released_at" timestamp with time zone,
	"released_by_user_id" uuid,
	"disposal_note" text,
	"disposal_rule" text,
	"disposal_proposed_by_user_id" uuid,
	"disposal_proposed_at" timestamp with time zone,
	"disposal_approved_by_user_id" uuid,
	"disposed_at" timestamp with time zone,
	"closed_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "found_items_disposal_two_people_ck" CHECK ("found_items"."disposal_approved_by_user_id" IS NULL OR "found_items"."disposal_approved_by_user_id" IS DISTINCT FROM "found_items"."disposal_proposed_by_user_id")
);
--> statement-breakpoint
CREATE TABLE "housekeeping_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "housekeeping_allocation_role" DEFAULT 'attendant' NOT NULL,
	"section" text NOT NULL,
	"floors" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"shift_starts_at" timestamp with time zone NOT NULL,
	"shift_ends_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housekeeping_allocations_shift_ck" CHECK ("housekeeping_allocations"."shift_ends_at" > "housekeeping_allocations"."shift_starts_at")
);
--> statement-breakpoint
CREATE TABLE "housekeeping_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"kind" "housekeeping_escalation_kind" NOT NULL,
	"level" "housekeeping_escalation_level" NOT NULL,
	"escalated_to_user_id" uuid,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reminded_at" timestamp with time zone,
	"reminded_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housekeeping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"code" "housekeeping_rule_code" NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"trigger" jsonb NOT NULL,
	"estimated_minutes" smallint,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
	"unit" text,
	"state" "maintenance_part_state" DEFAULT 'requested' NOT NULL,
	"source" text NOT NULL,
	"purchase_order_reference" text,
	"due_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"maintenance_ticket_id" uuid,
	"status" "room_block_status" DEFAULT 'requested' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"reason" text NOT NULL,
	"requested_by_user_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"released_by_user_id" uuid,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_blocks_dates_ck" CHECK ("room_blocks"."ends_at" IS NULL OR "room_blocks"."ends_at" > "room_blocks"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "room_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"kind" "room_event_kind" NOT NULL,
	"from_value" text,
	"to_value" text,
	"summary" text NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text,
	"detail" text,
	"housekeeping_task_id" uuid,
	"maintenance_ticket_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "floor" smallint;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "service_flag" "room_service_flag";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "service_flag_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD COLUMN "kind" "maintenance_event_kind" DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "assigned_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "assigned_contractor" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "asset_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "scheduled_for" date;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "raised_via" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "impact_note" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "release_note" text;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "estimated_minutes" smallint;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "rule_id" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "reopened_from_task_id" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "inspected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "inspected_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "inspection_note" text;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_signals" ADD CONSTRAINT "condition_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_signals" ADD CONSTRAINT "condition_signals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_signals" ADD CONSTRAINT "condition_signals_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_signals" ADD CONSTRAINT "condition_signals_work_order_id_maintenance_tickets_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_signals" ADD CONSTRAINT "condition_signals_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_item_events" ADD CONSTRAINT "found_item_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_item_events" ADD CONSTRAINT "found_item_events_found_item_id_found_items_id_fk" FOREIGN KEY ("found_item_id") REFERENCES "public"."found_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_item_events" ADD CONSTRAINT "found_item_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_found_by_user_id_users_id_fk" FOREIGN KEY ("found_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_custodian_user_id_users_id_fk" FOREIGN KEY ("custodian_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_claim_booking_id_bookings_id_fk" FOREIGN KEY ("claim_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_claim_opened_by_user_id_users_id_fk" FOREIGN KEY ("claim_opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_disposal_proposed_by_user_id_users_id_fk" FOREIGN KEY ("disposal_proposed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_disposal_approved_by_user_id_users_id_fk" FOREIGN KEY ("disposal_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_allocations" ADD CONSTRAINT "housekeeping_allocations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_allocations" ADD CONSTRAINT "housekeeping_allocations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_allocations" ADD CONSTRAINT "housekeeping_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_allocations" ADD CONSTRAINT "housekeeping_allocations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_escalations" ADD CONSTRAINT "housekeeping_escalations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_escalations" ADD CONSTRAINT "housekeeping_escalations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_escalations" ADD CONSTRAINT "housekeeping_escalations_task_id_housekeeping_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."housekeeping_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_escalations" ADD CONSTRAINT "housekeeping_escalations_escalated_to_user_id_users_id_fk" FOREIGN KEY ("escalated_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_escalations" ADD CONSTRAINT "housekeeping_escalations_reminded_by_user_id_users_id_fk" FOREIGN KEY ("reminded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_rules" ADD CONSTRAINT "housekeeping_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_rules" ADD CONSTRAINT "housekeeping_rules_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_parts" ADD CONSTRAINT "maintenance_parts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_parts" ADD CONSTRAINT "maintenance_parts_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_maintenance_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("maintenance_ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_status_events" ADD CONSTRAINT "room_status_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_status_events" ADD CONSTRAINT "room_status_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_status_events" ADD CONSTRAINT "room_status_events_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_status_events" ADD CONSTRAINT "room_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_status_events" ADD CONSTRAINT "room_status_events_housekeeping_task_id_housekeeping_tasks_id_fk" FOREIGN KEY ("housekeeping_task_id") REFERENCES "public"."housekeeping_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_status_events" ADD CONSTRAINT "room_status_events_maintenance_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("maintenance_ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_property_idx" ON "assets" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "assets_workspace_idx" ON "assets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "condition_signals_property_status_idx" ON "condition_signals" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "found_item_events_item_idx" ON "found_item_events" USING btree ("found_item_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "found_items_workspace_reference_uk" ON "found_items" USING btree ("workspace_id","reference");--> statement-breakpoint
CREATE INDEX "found_items_property_status_idx" ON "found_items" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "found_items_found_at_idx" ON "found_items" USING btree ("workspace_id","found_at");--> statement-breakpoint
CREATE INDEX "housekeeping_allocations_day_idx" ON "housekeeping_allocations" USING btree ("property_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_allocations_person_day_uk" ON "housekeeping_allocations" USING btree ("property_id","work_date","user_id");--> statement-breakpoint
CREATE INDEX "housekeeping_escalations_open_idx" ON "housekeeping_escalations" USING btree ("property_id","resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_escalations_task_level_uk" ON "housekeeping_escalations" USING btree ("task_id","kind","level");--> statement-breakpoint
CREATE INDEX "housekeeping_rules_property_idx" ON "housekeeping_rules" USING btree ("property_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_rules_property_code_uk" ON "housekeeping_rules" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "maintenance_parts_ticket_idx" ON "maintenance_parts" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "room_blocks_workspace_status_idx" ON "room_blocks" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "room_blocks_room_idx" ON "room_blocks" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_blocks_ticket_idx" ON "room_blocks" USING btree ("maintenance_ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_blocks_open_uk" ON "room_blocks" USING btree ("room_id") WHERE "room_blocks"."status" IN ('requested', 'active');--> statement-breakpoint
CREATE INDEX "room_status_events_room_idx" ON "room_status_events" USING btree ("room_id","occurred_at");--> statement-breakpoint
CREATE INDEX "room_status_events_workspace_idx" ON "room_status_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_rule_id_housekeeping_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."housekeeping_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_reopened_from_task_id_housekeeping_tasks_id_fk" FOREIGN KEY ("reopened_from_task_id") REFERENCES "public"."housekeeping_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_inspected_by_user_id_users_id_fk" FOREIGN KEY ("inspected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_tickets_workspace_reference_uk" ON "maintenance_tickets" USING btree ("workspace_id","reference") WHERE "maintenance_tickets"."reference" IS NOT NULL;