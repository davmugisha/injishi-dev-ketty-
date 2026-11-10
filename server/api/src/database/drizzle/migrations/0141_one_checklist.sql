-- One checklist for HR (ADR-058).
--
-- The interface's people screens kept onboarding and offboarding steps in
-- hr_checklist_items (0067), beside the joining and leaving checklists people
-- are given from a template (0104). They were two records of the same thing.
-- The steps now live as tasks of employee_checklists, which carry the step's
-- code, detail and owner-only flag (0134), and GET /ops/hr/checklists reads
-- them there.
--
-- Whatever a database already holds is moved before the table goes: one
-- checklist per person and kind (an existing one is kept and the steps join
-- it), each step a task with its tick, who ticked it and when. A step whose
-- code the checklist already has is not copied twice.
INSERT INTO "employee_checklists" ("org_id", "employee_id", "kind", "template_name", "anchor_on", "started_at")
SELECT DISTINCT ON (i."employee_id", i."checklist")
  i."org_id",
  i."employee_id",
  i."checklist"::"hr_checklist_kind",
  CASE i."checklist" WHEN 'onboarding' THEN 'Joining' ELSE 'Leaving' END,
  CASE i."checklist"
    WHEN 'onboarding' THEN e."hired_on"
    ELSE COALESCE(e."offboarded_on", (i."created_at" AT TIME ZONE 'Africa/Kigali')::date)
  END,
  i."created_at"
FROM "hr_checklist_items" i
JOIN "employees" e ON e."id" = i."employee_id"
ORDER BY i."employee_id", i."checklist", i."created_at"
ON CONFLICT ("employee_id", "kind") DO NOTHING;
--> statement-breakpoint
INSERT INTO "employee_checklist_tasks" ("org_id", "checklist_id", "label", "code", "detail", "sort_order", "by_employee", "owner_only", "due_on", "done_at", "done_by_user_id")
SELECT
  i."org_id",
  c."id",
  i."title",
  i."code",
  i."detail",
  i."sort_order",
  false,
  i."owner_only",
  c."anchor_on",
  i."done_at",
  i."done_by_user_id"
FROM "hr_checklist_items" i
JOIN "employee_checklists" c ON c."employee_id" = i."employee_id" AND c."kind"::text = i."checklist"
WHERE NOT EXISTS (
  SELECT 1 FROM "employee_checklist_tasks" t WHERE t."checklist_id" = c."id" AND t."code" = i."code"
);
--> statement-breakpoint
DROP TABLE "hr_checklist_items" CASCADE;
