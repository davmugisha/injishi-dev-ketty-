-- A checklist step's code, its detail, and whether only the owner may tick it (ADR-058).
--
-- 0104 made the joining and leaving checklists (templates, and each person's
-- checklist with its tasks). The interface's people screens kept their own
-- steps in hr_checklist_items (0067), each with a code, a line of detail and an
-- owner-only flag. Those three now live on the template items and the tasks,
-- so 0135 can move the steps across and the two records become one.
ALTER TABLE "checklist_template_items" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD COLUMN "owner_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_checklist_tasks" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "employee_checklist_tasks" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "employee_checklist_tasks" ADD COLUMN "owner_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_checklist_tasks_code_uk" ON "employee_checklist_tasks" USING btree ("checklist_id","code") WHERE "employee_checklist_tasks"."code" is not null;
