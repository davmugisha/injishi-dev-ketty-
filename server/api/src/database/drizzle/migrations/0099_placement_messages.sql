-- A broker and a landlord about a placement (2026-10-26).
--
-- `thread_kind` gains `placement`; `threads.placement_id` links the conversation to its placement, one per
-- placement (`threads_placement_uk`), and `threads_scope_exactly_one` counts it. `thread_digests` gains the
-- broker's side. Nothing here uses the value this run's ALTER TYPE ... ADD VALUE added (the index and the
-- check name only the column), so no type swap is needed.
ALTER TYPE "public"."thread_kind" ADD VALUE 'placement';--> statement-breakpoint
ALTER TABLE "thread_digests" DROP CONSTRAINT "thread_digests_side";--> statement-breakpoint
ALTER TABLE "threads" DROP CONSTRAINT "threads_scope_exactly_one";--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "placement_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_placement_id_tenant_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."tenant_placements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "threads_placement_uk" ON "threads" USING btree ("placement_id") WHERE "threads"."placement_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_digests" ADD CONSTRAINT "thread_digests_side" CHECK ("thread_digests"."side" IN ('landlord', 'tenant', 'broker'));--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_scope_exactly_one" CHECK ((CASE WHEN "threads"."booking_id" IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN "threads"."guest_stay_id" IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN "threads"."lease_id" IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN "threads"."placement_id" IS NOT NULL THEN 1 ELSE 0 END) = 1);