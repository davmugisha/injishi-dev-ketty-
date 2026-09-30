CREATE TABLE "assistant_action_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_label" text NOT NULL,
	"property_id" uuid NOT NULL,
	"current_value" jsonb NOT NULL,
	"proposed_value" jsonb NOT NULL,
	"request_text" text NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"idempotency_key" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "assistant_action_proposals_kind" CHECK ("assistant_action_proposals"."kind" IN ('room_type.price')),
	CONSTRAINT "assistant_action_proposals_state" CHECK ("assistant_action_proposals"."state" IN ('proposed', 'approved', 'executed', 'failed', 'rejected', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"anon_token_hash" text,
	"surface" text NOT NULL,
	"workspace_id" uuid,
	"page_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attached_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "assistant_conversations_has_holder" CHECK ("assistant_conversations"."owner_user_id" IS NOT NULL OR "assistant_conversations"."anon_token_hash" IS NOT NULL),
	CONSTRAINT "assistant_conversations_surface" CHECK ("assistant_conversations"."surface" IN ('web', 'app', 'admin', 'mobile'))
);
--> statement-breakpoint
CREATE TABLE "assistant_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"helpful" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"role" text NOT NULL,
	"display_text" text NOT NULL,
	"model_content" jsonb NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_messages_role" CHECK ("assistant_messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "assistant_conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "context" jsonb;--> statement-breakpoint
ALTER TABLE "assistant_action_proposals" ADD CONSTRAINT "assistant_action_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_feedback" ADD CONSTRAINT "assistant_feedback_message_id_assistant_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_action_proposals_user_idx" ON "assistant_action_proposals" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_action_proposals_idempotency_uk" ON "assistant_action_proposals" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_conversations_anon_token_uk" ON "assistant_conversations" USING btree ("anon_token_hash");--> statement-breakpoint
CREATE INDEX "assistant_conversations_owner_idx" ON "assistant_conversations" USING btree ("owner_user_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assistant_conversations_expires_idx" ON "assistant_conversations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_feedback_message_uk" ON "assistant_feedback" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_messages_conversation_seq_uk" ON "assistant_messages" USING btree ("conversation_id","seq");--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assistant_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("assistant_conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE set null ON UPDATE no action;