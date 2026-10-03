CREATE TABLE "assistant_model_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"user_id" uuid,
	"surface" text NOT NULL,
	"caller_role" text NOT NULL,
	"request_type" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micro_usd" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_model_usage_caller_role" CHECK ("assistant_model_usage"."caller_role" IN ('anonymous', 'signed_in', 'operator', 'staff')),
	CONSTRAINT "assistant_model_usage_tokens_nonnegative" CHECK ("assistant_model_usage"."input_tokens" >= 0 AND "assistant_model_usage"."output_tokens" >= 0 AND "assistant_model_usage"."cache_read_tokens" >= 0 AND "assistant_model_usage"."cache_write_tokens" >= 0 AND "assistant_model_usage"."estimated_cost_micro_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assistant_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"surface" text NOT NULL,
	"caller_role" text NOT NULL,
	"route" text NOT NULL,
	"outcome" text NOT NULL,
	"model_calls" integer DEFAULT 0 NOT NULL,
	"model_tool_calls" integer DEFAULT 0 NOT NULL,
	"tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micro_usd" bigint DEFAULT 0 NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_turns_caller_role" CHECK ("assistant_turns"."caller_role" IN ('anonymous', 'signed_in', 'operator', 'staff')),
	CONSTRAINT "assistant_turns_outcome" CHECK ("assistant_turns"."outcome" IN ('answered', 'fallback', 'withheld', 'truncated', 'out_of_time', 'step_limit', 'refused', 'failed')),
	CONSTRAINT "assistant_turns_counts_nonnegative" CHECK ("assistant_turns"."model_calls" >= 0 AND "assistant_turns"."model_tool_calls" >= 0 AND "assistant_turns"."input_tokens" >= 0 AND "assistant_turns"."output_tokens" >= 0 AND "assistant_turns"."cache_read_tokens" >= 0 AND "assistant_turns"."cache_write_tokens" >= 0 AND "assistant_turns"."estimated_cost_micro_usd" >= 0 AND "assistant_turns"."duration_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "assistant_model_usage" ADD CONSTRAINT "assistant_model_usage_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_model_usage" ADD CONSTRAINT "assistant_model_usage_message_id_assistant_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_model_usage" ADD CONSTRAINT "assistant_model_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_turns" ADD CONSTRAINT "assistant_turns_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_turns" ADD CONSTRAINT "assistant_turns_message_id_assistant_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_model_usage_created_idx" ON "assistant_model_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assistant_model_usage_user_created_idx" ON "assistant_model_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_model_usage_conversation_created_idx" ON "assistant_model_usage" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_turns_created_idx" ON "assistant_turns" USING btree ("created_at");